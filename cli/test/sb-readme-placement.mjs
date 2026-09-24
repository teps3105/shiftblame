import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cli=fileURLToPath(new URL('../bin/sb.mjs',import.meta.url)),hook=fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs',import.meta.url));
const root=mkdtempSync(join(tmpdir(),'sb-docs-'));process.on('exit',()=>rmSync(root,{recursive:true,force:true}));
const git=(...args)=>spawnSync('git',args,{cwd:root,encoding:'utf8'});
const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8'});
const event=(name,input)=>spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd:root,hook_event_name:'PreToolUse',tool_name:name,tool_input:input})});
mkdirSync(join(root,'.shiftblame/tmp'),{recursive:true});
assert.equal(git('init').status,0);
assert.equal(run('sopreview','已核對').status,0,'缺少狀態時可寫審查記錄');assert.equal(run('state').status,0);writeFileSync(join(root,'.gitignore'),'.shiftblame/\n');
for(const path of ['README.md','docs/README.md','module/readme.MD','skills/shiftblame/SKILL.md','hooks/shiftblame-guard.mjs']){
 mkdirSync(join(root,path,'..'),{recursive:true});writeFileSync(join(root,path),'# Documentation\n');
 assert.equal(event('Write',{file_path:join(root,path)}).status,0);
}
assert.equal(git('add','.').status,0);
assert.equal(git('-c','user.name=test','-c','user.email=test@example.invalid','commit','-m','baseline').status,0);
writeFileSync(join(root,'README.md'),'# Documentation\nNew relevant section\n');
assert.equal(git('add','README.md').status,0);
writeFileSync(join(root,'.shiftblame/SOP.md'),'# SOP\npriority: 1\n');
for(const msg of ['fix: R24 API behavior','x','merge example','測試'.repeat(40)]){
 assert.equal(run('commitmsg',msg).status,0,msg);
 assert.equal(event('Bash',{command:'git commit -m "'+msg+'"'}).status,0,'追加文件與訊息風格不擋有效章');
}
for(const msg of ['','   ','fix: a\nb'])assert.notEqual(run('commitmsg',msg).status,0);
assert.equal(run('sopreview','已核對').status,0);assert.equal(run('state').status,0);
writeFileSync(join(root,'.shiftblame/SOP.md'),'# Changed config\n');assert.equal(run('commitmsg','docs: updated').status,0,'SOP修改不迫使重發審查戳');
assert.equal(git('add','-f','.shiftblame/SOP.md').status,0);assert.equal(run('commitmsg','docs: unsafe staged').status,1,'形式限制移除仍保護實際 staged 系統檔');
console.log('sb-readme-placement: pass');
