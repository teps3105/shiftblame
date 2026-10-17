// sb-root-anchor：專案根向上錨定時，磁碟根與系統頂層目錄不作錨點——誤留在磁碟根的 .shiftblame／.git
// 不會把底下所有非專案路徑（含暫存目錄）收成同一個專案；家目錄與非系統磁碟的第一層照常可作錨點。
// 磁碟根無法在測試中真的建檔：以注入的 exists 謂詞模擬檔案系統。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { anchorable, findRoot, topLevelSystemDir } from '../bin/project-root.mjs';

const WIN = process.platform === 'win32';
const key = (p) => (WIN || process.platform === 'darwin' ? resolve(p).toLowerCase() : resolve(p));
const fs = (...paths) => { const set = new Set(paths.map(key)); return (p) => set.has(key(p)); };

// 系統磁碟根、系統頂層目錄與另一顆非系統磁碟（Windows）；POSIX 只有一個根。
const sysRoot = WIN ? `${(process.env.SystemDrive || 'C:').toUpperCase()}\\` : '/';
const sysTop = join(sysRoot, WIN ? 'Users' : 'home');
const otherRoot = WIN ? (sysRoot.startsWith('D') ? 'E:\\' : 'D:\\') : null;
const temp = join(sysTop, 'u', 'AppData', 'Local', 'Temp', 'sb-x', 'a');

// 1. 磁碟根有 .shiftblame／.git、系統頂層目錄有 .shiftblame：暫存路徑不錨定到它們，以起點為根。
assert.equal(findRoot(temp, fs(join(sysRoot, '.shiftblame'))), temp, '磁碟根的 .shiftblame 不作錨點');
assert.equal(findRoot(temp, fs(join(sysRoot, '.git'))), temp, '磁碟根的 .git 不作錨點');
assert.equal(findRoot(temp, fs(join(sysTop, '.shiftblame'), join(sysTop, '.git'))), temp, '系統頂層目錄不作錨點');
// 2. 一般專案照常錨定：最近的 .git／.shiftblame 優先，磁碟根殘留不影響。
const proj = join(sysTop, 'u', 'work', 'proj');
assert.equal(findRoot(join(proj, 'src', 'lib'), fs(join(proj, '.git'), join(sysRoot, '.shiftblame'))), proj);
assert.equal(findRoot(join(proj, 'sub'), fs(join(proj, 'sub', '.shiftblame'), join(proj, '.git'))), join(proj, 'sub'));
// 3. 起點本身就是磁碟根：照舊以起點為根（不改變找不到錨點時的行為）。
assert.equal(findRoot(sysRoot, fs(join(sysRoot, '.shiftblame'))), resolve(sysRoot));
// 4. 家目錄照常可作錨點（dotfiles repo）。
const home = homedir();
assert.equal(findRoot(join(home, 'notes', 'x'), fs(join(home, '.git'))), resolve(home), '家目錄的 .git 照常錨定');
assert.equal(anchorable(resolve(home)), true);
// 家目錄位於系統頂層（POSIX 的 /root）時仍可作錨點：以子程序改設家目錄驗證。
{
  const env = { ...process.env, HOME: sysTop, USERPROFILE: sysTop };
  const code = `import(${JSON.stringify(new URL('../bin/project-root.mjs', import.meta.url).href)}).then((m) => process.stdout.write(String(m.anchorable(${JSON.stringify(sysTop)}))))`;
  const r = spawnSync(process.execPath, ['-e', code], { env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'true', '位於系統頂層的家目錄可作錨點');
}
// 5. 系統頂層判定：Windows 只限系統磁碟第一層，非系統磁碟第一層照常錨定、其磁碟根不作錨點。
assert.equal(topLevelSystemDir(sysTop), true);
assert.equal(anchorable(sysRoot), false);
assert.equal(anchorable(sysTop), false);
assert.equal(anchorable(join(sysTop, 'u')), true);
if (otherRoot) {
  const work = join(otherRoot, 'work');
  assert.equal(topLevelSystemDir(work), false);
  assert.equal(findRoot(join(work, 'a'), fs(join(work, '.git'), join(otherRoot, '.shiftblame'))), work, '非系統磁碟第一層照常錨定');
  assert.equal(findRoot(join(otherRoot, 'tmp-sb', 'a'), fs(join(otherRoot, '.shiftblame'))), join(otherRoot, 'tmp-sb', 'a'), '非系統磁碟根不作錨點');
}

console.log('sb-root-anchor: pass');
