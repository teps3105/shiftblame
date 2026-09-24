import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const hook=fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs',import.meta.url));
const root=mkdtempSync(join(tmpdir(),'sb-hooks-'));
process.on('exit',()=>rmSync(root,{recursive:true,force:true}));
mkdirSync(join(root,'.shiftblame/tmp'),{recursive:true});
const statePath=join(root,'.shiftblame/flow-state.json');
const state=()=>JSON.parse(readFileSync(statePath,'utf8'));
const set=(node,extra={})=>writeFileSync(statePath,JSON.stringify({slug:'demo',ms:'001',node,...extra}));
const run=(event,tool,input)=>spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd:root,hook_event_name:event,tool_name:tool,tool_input:input})});
const tool=(name,input)=>run('PreToolUse',name,input);
const git=(...args)=>spawnSync('git',['-C',root,...args],{encoding:'utf8'});
assert.equal(git('init').status,0);
writeFileSync(join(root,'.gitignore'),'.shiftblame/\n.cache/\n');
mkdirSync(join(root,'.cache'));writeFileSync(join(root,'.cache/tracked.txt'),'source');
assert.equal(git('add','-f','.cache/tracked.txt').status,0);
set('build');
let r=run('SessionStart');assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).hookSpecificOutput.hookEventName,'SessionStart');
assert.ok(JSON.parse(r.stdout).hookSpecificOutput.additionalContext.length<1200,'啟動提示有界且精簡');
assert.equal(state().hooksHeartbeat.event,'SessionStart');
// Prompts are platform conversation data, not a state transition API.
for(const node of ['intent','requirement','research','plan','test','build','verify']){
 for(const prompt of ['繼續','繼續。','可以繼續了','目前進度如何','你做到哪裡了','為什麼會失敗','新增付款功能']){
  set(node,{rev:2});
  r=spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd:root,hook_event_name:'UserPromptSubmit',prompt})});
  assert.equal(r.status,0,r.stderr);assert.equal(state().node,node);assert.equal(state().rev,2);
  assert.equal(state().lastBossInputAt,undefined);assert.equal(state().inputs,undefined);
 }
 assert.equal(run('Stop').status,0);assert.equal(state().node,node);
}
set('build');
for(let i=0;i<8;i++)assert.equal(tool('Bash',{command:'git status --porcelain'}).status,0,'輪詢不按本地寫入與否封禁');
const prefix='x'.repeat(220);
for(const suffix of ['readA','readB'])assert.equal(tool('functions.exec',{code:prefix+suffix}).status,0);
assert.equal(state().node,'build');assert.equal(state().turnUsage.requests,10);assert.equal(state().turnUsage.repeats,undefined);
// Rewriting does not depend on a particular Skill invocation event.
set('requirement',{rev:3});
assert.equal(tool('Edit',{file_path:join(root,'.shiftblame/demo/001/G1.md')}).status,0);
assert.equal(tool('Edit',{file_path:join(root,'.shiftblame/demo/001/G2.md')}).status,0);
// Structured writes and patch headers share verify protection.
set('verify');
assert.equal(tool('Write',{path:'.cache/output.txt'}).status,0,'未追蹤且被忽略的輸出可寫');
assert.equal(tool('Write',{path:'.cache/tracked.txt'}).status,2,'被追蹤來源即使命中ignore也保持穩定');
for(const name of ['Edit','mcp__storage__write_target','functions.apply_patch']){
 const input=name.includes('patch')?'*** Begin Patch\n*** Update File: src/app.js\n@@\n-old\n+new\n*** End Patch':{file_path:'src/app.js'};
 assert.equal(tool(name,input).status,2,name);
}
assert.equal(tool('mcp__storage__get_object',{path:'src/app.js'}).status,0);
assert.equal(tool('Write',{path:join(root,'.shiftblame/tmp/evidence.md')}).status,0);
set('build');assert.equal(tool('Write',{path:'src/app.js'}).status,0);
// Invalid state preserves the original and allows only observable recovery writes.
writeFileSync(statePath,'{broken');
assert.equal(tool('mcp__storage__write_target',{path:'src/app.js'}).status,2);
assert.equal(tool('apply_patch','*** Begin Patch\n*** Update File: src/app.js\n@@\n-a\n+b\n*** End Patch').status,2);
assert.equal(readFileSync(statePath,'utf8'),'{broken');
assert.equal(tool('Write',{file_path:statePath}).status,0);
assert.equal(tool('Bash',{command:'git add app.js'}).status,2);
assert.equal(tool('Bash',{command:'git status --porcelain'}).status,0);
set('requirement');
assert.equal(tool('Bash',{command:'sb next research --adversarial'}).status,2);
assert.equal(tool('Bash',{command:'sb next research --adversarial --boss-ok'}).status,0);
set('done');assert.equal(tool('Write',{path:'src/app.js'}).status,2,'done 是 verify 的舊狀態');
set('build');
assert.equal(tool('Bash',{command:'git config --get-regexp alias.'}).status,0,'唯讀診斷不是alias設定');
assert.equal(tool('Bash',{command:'git config alias.ci commit'}).status,2,'alias寫入仍需保護提交入口');
assert.equal(tool('Bash',{command:'git config alias.demo "!echo --get ok"'}).status,2,'alias值內的唯讀字詞不是選項');
assert.equal(tool('Bash',{command:'git config alias.demo status # --get'}).status,2,'註解中的唯讀字詞不是選項');
writeFileSync(join(root,'check.mjs'),'export const ok = true;\n');
for(const script of ['check.mjs','missing.mjs'])assert.equal(tool('Bash',{command:'node '+script+' && git commit -m "fix: x"'}).status,2,'腳本掃描不得跳過提交檢查');
writeFileSync(join(root,'cleanup.mjs'),'import fs from "node:fs"; fs.rmSync("C:/known-fixture", {recursive:true});\n');
assert.equal(tool('Bash',{command:'node cleanup.mjs && git commit -m "fix: x"'}).status,2,'提示不能跳過缺印章拒絕');
assert.equal(tool('Bash',{command:'echo hi > out.txt'}).status,2);
assert.equal(tool('Bash',{command:'git commit -m "fix: x"'}).status,2);
const stamp=join(root,'.shiftblame/tmp/commit-stamp.json');
writeFileSync(stamp,JSON.stringify({message:'fix: x',cwd:root,issuedAt:new Date().toISOString()}));
assert.equal(tool('Bash',{command:'git commit -m "fix: y"'}).status,2);assert.ok(existsSync(stamp));
assert.equal(tool('Bash',{command:'git commit -m "fix: x"'}).status,0);assert.ok(!existsSync(stamp));
assert.equal(tool('Bash',{command:'git commit -m "fix: x"'}).status,2);
const stray=join(root,'outside');mkdirSync(stray);
r=spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd:stray,hook_event_name:'SessionStart'})});
assert.equal(r.status,0);assert.ok(!existsSync(join(stray,'.shiftblame')));
console.log('sb-hooks: pass');
