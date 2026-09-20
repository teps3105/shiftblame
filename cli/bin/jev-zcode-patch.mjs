// 可回復的宿主生成前接合；原生工具 schema、權限及 executor 保持在宿主內。
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const supportedHash = '8f5cfccf2a899b92e57bc2a5760b949c1a928f739652fffc9e6d07c24f11ba05';
export const hash = value => createHash('sha256').update(value).digest('hex');
const start = 'async function iIo(e){';
const end = 'var swa,sIo=Y(';

function bridgeSnapshot(bridgePath) {
  const files=new Map();
  function visit(path) {
    const actual=realpathSync(path);if(files.has(actual))return;
    const source=readFileSync(actual,'utf8');files.set(actual,hash(source));
    for(const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      if(match[1].startsWith('.'))visit(fileURLToPath(new URL(match[1],pathToFileURL(actual))));
      else if(!match[1].startsWith('node:'))throw new Error('接合依賴未封存；拒絕未知外部模組。');
    }
  }
  visit(bridgePath);return [...files].map(([path,sha256])=>({path,sha256}));
}

export function patchSource(source, bridgePath) {
  if (hash(source) !== supportedHash) throw new Error('宿主內容與已驗證介面不同；未修改。');
  if (!isAbsolute(bridgePath)) throw new Error('接合模組須為絕對路徑。');
  const from = source.indexOf(start), until = source.indexOf(end, from);
  if (from < 0 || until < from || source.indexOf(start,from+1) !== -1) throw new Error('生成入口不是唯一已知介面。');
  let body = source.slice(from,until);
  for (const method of ['generateText','streamText']) {
    const original = `()=>n.${method}(g)`;
    if (body.split(original).length !== 2) throw new Error('實際供應者派送入口不唯一。');
    body = body.replace(original, `()=>{__sbJev?.noteProviderRequest(this);return n.${method}(g)}`);
  }
  const url = JSON.stringify(pathToFileURL(bridgePath).href);
  const files=bridgeSnapshot(bridgePath);
  const loader=`let __sbJevLoaded;function __sbJevLoad(){return __sbJevLoaded??=(async()=>{for(const f of ${JSON.stringify(files)})if(require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(f.path)).digest('hex')!==f.sha256)throw new Error('Jev bridge changed after review');return import(${url})})()}`;
  body = body.replace(start, `${loader}${start}let __sbJev;try{__sbJev=await __sbJevLoad();let __sbRoute=await __sbJev.routeModelRequest(this,e,__sbJev.hostProfile);if(__sbRoute)return __sbRoute}catch{e.abortSignal?.throwIfAborted()}`);
  return source.slice(0,from) + body + source.slice(until);
}

export function prepare(target, bridge, output) {
  for (const path of [target,bridge,output]) if (!isAbsolute(path)) throw new Error('全部檔案路徑須為絕對路徑。');
  const original = readFileSync(target), patched = patchSource(original.toString('utf8'),realpathSync(bridge));
  if (resolve(target) === resolve(output)) throw new Error('預覽檔不可覆寫宿主。');
  writeFileSync(output,patched,{flag:'wx'});
  return {target:realpathSync(target),bridge:realpathSync(bridge),bridgeFiles:bridgeSnapshot(bridge),originalHash:hash(original),patchedHash:hash(patched),preview:resolve(output)};
}

export function apply(receipt, backupPath) {
  if (!isAbsolute(backupPath)) throw new Error('備份須為絕對路徑。');
  const current = readFileSync(receipt.target), next = readFileSync(receipt.preview);
  if (receipt.originalHash !== supportedHash || hash(current) !== receipt.originalHash || hash(next) !== receipt.patchedHash ||
    hash(patchSource(current.toString('utf8'),receipt.bridge)) !== receipt.patchedHash) throw new Error('預覽後檔案已變或收據不符合補丁；未修改宿主。');
  writeFileSync(backupPath,current,{flag:'wx'});
  const record = {...receipt,backup:resolve(backupPath)};
  // 恢復資料先落地；即使寫入中斷也能以原始備份人工恢復。
  writeFileSync(`${backupPath}.json`,JSON.stringify(record,null,2),{flag:'wx'});
  if (hash(readFileSync(receipt.target)) !== receipt.originalHash) throw new Error('備份期間宿主已變；未覆寫。');
  writeFileSync(receipt.target,next);
  if (hash(readFileSync(receipt.target)) !== receipt.patchedHash) throw new Error('宿主寫入驗證失敗；原始備份已保存。');
  return record;
}

export function restore(record) {
  const current=readFileSync(record.target), backup=readFileSync(record.backup);
  if (hash(current) !== record.patchedHash || hash(backup) !== record.originalHash) throw new Error('檔案已另行修改；不覆蓋未知內容。');
  writeFileSync(record.target,backup);
  return hash(readFileSync(record.target)) === record.originalHash;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode,...args]=process.argv.slice(2);
  if (mode==='prepare') console.log(JSON.stringify(prepare(...args)));
  else if (mode==='apply') console.log(JSON.stringify(apply(JSON.parse(readFileSync(args[0],'utf8')),args[1])));
  else if (mode==='restore') console.log(JSON.stringify({restored:restore(JSON.parse(readFileSync(args[0],'utf8')))}));
  else throw new Error('使用 prepare <宿主> <模組> <新預覽檔>、apply <預覽收據> <新備份檔> 或 restore <備份收據>。');
}
