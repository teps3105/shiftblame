import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {prepare,apply,restore,hash,supportedHash} from '../bin/jev-zcode-patch.mjs';

test('real host preview pins bridge dependencies, refuses changes, applies and restores only its copy', {skip:!process.env.JEV_TEST_ZCODE_HOST},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jev-patch-'));
 try{
  const target=join(dir,'zcode.cjs'),bridge=join(dir,'jev-zcode.mjs'),preview=join(dir,'preview.cjs');
  copyFileSync(process.env.JEV_TEST_ZCODE_HOST,target);
  for(const name of ['jev-zcode.mjs','jev-route.mjs','jev-values.mjs','jev.mjs'])copyFileSync(new URL('../bin/'+name,import.meta.url),join(dir,name));
  assert.equal(hash(readFileSync(target)),supportedHash);
  const receipt=prepare(target,bridge,preview);
  assert.equal(receipt.bridgeFiles.length,4);
  for(const file of [bridge,join(dir,'jev-route.mjs'),join(dir,'jev-values.mjs'),join(dir,'jev.mjs')]){
   const original=readFileSync(file);writeFileSync(file,Buffer.concat([original,Buffer.from('\n// changed\n')]));
   assert.throws(()=>apply(receipt,join(dir,'invalid-backup')));
   assert.equal(hash(readFileSync(target)),supportedHash);
   writeFileSync(file,original);
  }
  const record=apply(receipt,join(dir,'original.cjs'));
  assert.equal(hash(readFileSync(target)),record.patchedHash);
  const patched=readFileSync(target,'utf8'),start=patched.indexOf('let __sbJevLoaded;'),end=patched.indexOf('async function iIo(e){',start);
  const loader=new Function('require',patched.slice(start,end)+';return __sbJevLoad;')(createRequire(import.meta.url));
  writeFileSync(bridge,readFileSync(bridge,'utf8')+'\n// changed after apply\n');
  await assert.rejects(loader(),/changed after review/);
  assert.equal(restore(record),true);
  assert.equal(hash(readFileSync(target)),supportedHash);
 }finally{
  assert.equal(dirname(dir),tmpdir());rmSync(dir,{recursive:true,force:true});
 }
});
