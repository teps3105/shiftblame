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
// hooks 的心跳與計數存於 tmp/hook-records.json。
const records=()=>JSON.parse(readFileSync(join(root,'.shiftblame/tmp/hook-records.json'),'utf8'));
const run=(event,tool,input)=>spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd:root,hook_event_name:event,tool_name:tool,tool_input:input})});
const tool=(name,input)=>run('PreToolUse',name,input);
const git=(...args)=>spawnSync('git',['-C',root,...args],{encoding:'utf8'});
assert.equal(git('init').status,0);
writeFileSync(join(root,'.gitignore'),'.shiftblame/\n.cache/\n');
let r=run('SessionStart');assert.equal(r.status,0);
const card=JSON.parse(r.stdout).hookSpecificOutput;
assert.equal(card.hookEventName,'SessionStart');
assert.ok(card.additionalContext.length<600,'啟動提示有界且精簡');
assert.doesNotMatch(card.additionalContext,/slug|G1|時點|\[段\]|\[接入\]/,'啟動提示不再帶流程段位');
assert.equal(records().hooksHeartbeat.event,'SessionStart');
// 遺留的舊版狀態檔一律忽略：不擋寫入、不擋提交、不改寫。
const legacy=join(root,'.shiftblame/flow-state.json');
for(const content of [JSON.stringify({slug:'demo',ms:'001',node:'verify'}),'{broken']){
 writeFileSync(legacy,content);
 assert.equal(tool('Write',{file_path:join(root,'src/app.js')}).status,0,'遺留狀態不擋寫入：'+content);
 assert.equal(tool('Bash',{command:'git add app.js'}).status,0,'遺留狀態不擋 git 寫入：'+content);
 r=run('UserPromptSubmit');assert.equal(r.status,0);assert.doesNotMatch(r.stdout,/段|接入/);
 assert.equal(readFileSync(legacy,'utf8'),content,'hook 不改寫遺留狀態檔');
}
rmSync(legacy);
for(let i=0;i<8;i++)assert.equal(tool('Bash',{command:'git status --porcelain'}).status,0,'輪詢不按本地寫入與否封禁');
const prefix='x'.repeat(220);
for(const suffix of ['readA','readB'])assert.equal(tool('functions.exec',{code:prefix+suffix}).status,0);
assert.equal(records().turnUsage.requests,10);assert.equal(records().turnUsage.repeats,undefined);
// 一般寫入工具、patch 與遠端工具都不受段位限制。
for(const name of ['Edit','mcp__storage__write_target','functions.apply_patch']){
 const input=name.includes('patch')?'*** Begin Patch\n*** Update File: src/app.js\n@@\n-old\n+new\n*** End Patch':{file_path:'src/app.js'};
 assert.equal(tool(name,input).status,0,name);
}
for(const [name,input] of [['mcp__github__create_or_update_file',{owner:'o',repo:'r',path:'src/app.js',content:'x',message:'m',branch:'main'}],
 ['mcp__s3__put_object',{path:'s3://bucket/src/app.js'}],['TodoWrite',{todos:[{content:'x',status:'pending'}]}]])
 assert.equal(tool(name,input).status,0,name);
// 已移除的流程命令不再有專屬攔截或詢問。
for(const command of ['sb next plan','sb end --adversarial --boss-ok']){
 r=tool('Bash',{command});assert.equal(r.status,0,command);assert.ok(!r.stdout.includes('permissionDecision'),command);
}
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
// 放行不刪章：同一呼叫仍可能被同命令另一錨定、其他 hook 或權限確認拒絕，提交未必執行；提交落地（HEAD 前進）才作廢。
assert.equal(tool('Bash',{command:'git commit -m "fix: x"'}).status,0);assert.ok(existsSync(stamp),'放行不刪章');
assert.equal(tool('Bash',{command:'git commit -m "fix: x"'}).status,0,'提交未落地前重試不必重簽');
const elsewhere=mkdtempSync(join(tmpdir(),'sb-hooks-cwd-'));
process.on('exit',()=>rmSync(elsewhere,{recursive:true,force:true}));
mkdirSync(join(elsewhere,'.shiftblame/tmp'),{recursive:true});
assert.equal(spawnSync('git',['-C',elsewhere,'init'],{encoding:'utf8'}).status,0);
const from=(cwd,command)=>spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd,hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command}})});
r=from(elsewhere,`git -C ${root} commit -m "fix: x" && git commit -m "fix: x"`);
assert.equal(r.status,2);assert.match(r.stderr,/缺少 commit 印章/);assert.ok(existsSync(stamp),'同命令另一錨定被拒時，已通過錨定的章不消費');
assert.equal(from(elsewhere,`git -C ${root} commit -m "fix: x"`).status,0,'被拒後以 -C 重試不必重簽');
r=from(elsewhere,`git -C ${root} commit -m "fix: x" && git -C ${root} commit --amend -m "fix: x"`);
assert.equal(r.status,2,'同命令對同一 repo 兩次不同提交——一枚章只授權一次提交');assert.ok(existsSync(stamp));
assert.equal(git('-c','user.name=fixture','-c','user.email=fixture@example.invalid','commit','-q','--allow-empty','-m','fix: x').status,0);
r=tool('Bash',{command:'git commit -m "fix: x"'});
assert.equal(r.status,2,'提交落地後同章不可再用');assert.match(r.stderr,/已用於先前的提交/);assert.ok(!existsSync(stamp),'作廢章清除');
assert.equal(tool('Bash',{command:'git commit -m "fix: x"'}).status,2);
const stray=join(root,'outside');mkdirSync(stray);
r=spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd:stray,hook_event_name:'SessionStart'})});
assert.equal(r.status,0);assert.ok(!existsSync(join(stray,'.shiftblame')));
// —— 最低品質機制（TDD→BDD→SDD 依意圖定檔）：行為碼提交無測試同批 → ask 自證檔位；有測試同批或純非程式碼不攔。
// 每場景重新發章，避免沿用上一場景的放行標記。
const cli=fileURLToPath(new URL('../bin/sb.mjs',import.meta.url));
const mint=(msg)=>spawnSync(process.execPath,[cli,'commitmsg',msg],{cwd:root,encoding:'utf8'});
writeFileSync(join(root,'app.js'),'export const main=1;\n');
assert.equal(git('add','app.js').status,0);
assert.equal(mint('feat: 最低機制驗證').status,0,'發章');
r=tool('Bash',{command:`git -C ${root} commit -m "feat: 最低機制驗證"`});
assert.ok(r.stdout.includes('permissionDecision')&&r.stdout.includes('最低品質機制'),'行為碼無測試同批→ask 自證檔位');
writeFileSync(join(root,'app.test.js'),'assert.ok(true);\n');
assert.equal(git('add','app.test.js').status,0);
assert.equal(mint('feat: 最低機制驗證').status,0,'重發章');
r=tool('Bash',{command:`git -C ${root} commit -m "feat: 最低機制驗證"`});
assert.equal(r.status,0,r.stderr);assert.ok(!r.stdout.includes('permissionDecision'),'測試同批→不攔');
console.log('sb-hooks: pass');
