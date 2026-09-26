import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Shell 防護依命令結構判斷：PowerShell 與巢狀 shell 納入，引號內文字與運算子不當成命令。
const hook=fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs',import.meta.url));
const root=mkdtempSync(join(tmpdir(),'sb-shell-'));
process.on('exit',()=>rmSync(root,{recursive:true,force:true}));
mkdirSync(join(root,'.shiftblame/tmp'),{recursive:true});mkdirSync(join(root,'sub'));
const statePath=join(root,'.shiftblame/flow-state.json');
const stamp=join(root,'.shiftblame/tmp/commit-stamp.json');
const set=(node,extra={})=>writeFileSync(statePath,JSON.stringify({slug:'demo',ms:'001',node,...extra}));
const run=(event,input={},cwd=root)=>spawnSync(process.execPath,[hook],{encoding:'utf8',input:JSON.stringify({cwd,hook_event_name:event,...input})});
const tool=(name,tool_input,cwd)=>run('PreToolUse',{tool_name:name,tool_input},cwd);
const sh=(command,cwd)=>tool('Bash',{command},cwd);
const ps=(command,cwd)=>tool('PowerShell',{command},cwd);
const issue=(message)=>writeFileSync(stamp,JSON.stringify({message,cwd:root,issuedAt:new Date().toISOString()}));
const git=(...args)=>spawnSync('git',['-C',root,...args],{encoding:'utf8'});
assert.equal(git('init','-q').status,0);
writeFileSync(join(root,'.gitignore'),'.shiftblame/\n');writeFileSync(join(root,'sub/app.js'),'x\n');
assert.equal(git('add','.gitignore','sub/app.js').status,0);
set('build');

// PowerShell 與 Bash 走同一套判斷。
let r=ps('git commit -m "fix: x"');assert.equal(r.status,2);assert.match(r.stderr,/缺少 commit 印章/);
assert.equal(ps('Remove-Item -Recurse -Force build').status,2);
assert.equal(ps(`Remove-Item -Recurse -Force ${join(root,'build')}`).status,0);
assert.equal(ps('Remove-Item -Path:build -Recurse').status,2);
assert.equal(ps('rm -r build').status,2,'PowerShell 的 rm 是 Remove-Item');
assert.equal(ps('Get-Date > out.txt').status,2);
for(const command of ['Get-Date > $null','npm test 2>&1','Write-Host "git commit -m x"',"Select-String -Pattern '=>' -Path src\\*.js"])assert.equal(ps(command).status,0,command);
assert.equal(ps('cmd /c "rd /s /q build"').status,2);
assert.equal(ps(`pwsh -NoProfile -Command "git commit -m 'x'"`).status,2);
assert.equal(ps(`pwsh -EncodedCommand ${Buffer.from("git commit -m 'x'",'utf16le').toString('base64')}`).status,2);
assert.equal(ps('iex "git commit -m x"').status,2);
r=ps('$m = "x"; git commit -m $m');assert.equal(r.status,2);assert.match(r.stderr,/字面值/);

// 引號內文字、運算子與唯讀查詢不是提交或覆寫。
for(const command of ['node -e "[1].map(x=>x)"',"echo 'git commit -m x'",'git log --grep=commit','git log --oneline | grep commit','npm test 2>&1',
 `printf '%s\\n' "a > b"`,"awk 'NR>=20' file.txt",'grep ">=" src/app.js','git rev-parse --git-dir && echo ok','command -v git','echo hi >> out.txt','make > /dev/null 2>&1'])
 assert.equal(sh(command).status,0,command);

// 巢狀 shell 內的提交同樣要印章；無法展開的巢狀一律拒絕。
for(const command of [`bash -c "git commit -m 'x'"`,"sh -c 'git commit -m x'",'echo "git commit -m x" | bash','bash <<EOF\ngit commit -m x\nEOF','eval "git commit -m x"','echo $(git commit -m x)','\\git commit -m x']){
 r=sh(command);assert.equal(r.status,2,command);assert.match(r.stderr,/缺少 commit 印章/,command);
}
for(const command of ['bash -c "git commit -m $msg"','git commit -m "$msg"']){r=sh(command);assert.equal(r.status,2);assert.match(r.stderr,/字面值/);}
r=sh('$GIT commit -m x');assert.equal(r.status,2);assert.match(r.stderr,/字面 git/);
let deep='git commit -m x';for(let i=0;i<6;i++)deep=`bash -c ${JSON.stringify(deep)}`;
r=sh(deep);assert.equal(r.status,2);assert.match(r.stderr,/巢狀 shell 超過/);
r=tool('Bash',{command:['git','commit','-m','fix: x']});assert.equal(r.status,2,'陣列形式的命令同樣檢查');

// 有印章時巢狀提交放行並消費印章；同一提交的重複候選只核對一次。
issue('fix: x');assert.equal(sh(`bash -c "git commit -m 'fix: x'"`).status,0);assert.ok(!existsSync(stamp));
issue('fix: x');assert.equal(sh('echo "git commit -m \'fix: x\'" | bash').status,0);assert.ok(!existsSync(stamp));
issue('fix: y');assert.equal(ps('git commit -m "fix: y"').status,0);assert.ok(!existsSync(stamp));
// 子目錄 cwd：往上找到專案根，印章與狀態都以專案根為準。
issue('fix: z');assert.equal(sh('git commit -m "fix: z"',join(root,'sub')).status,0);assert.ok(!existsSync(stamp));
assert.ok(!existsSync(join(root,'sub/.shiftblame')));
if(process.platform==='win32'){
 const msys='/'+root[0].toLowerCase()+root.slice(2).replace(/\\/g,'/');
 issue('fix: w');assert.equal(sh(`git -C ${msys} commit -m "fix: w"`,tmpdir()).status,0,'Git Bash 的 /c/… 路徑等於 C:/…');assert.ok(!existsSync(stamp));
}
writeFileSync(stamp,JSON.stringify({message:'fix: n',cwd:root,issuedAt:'not-a-date'}));
r=sh('git commit -m "fix: n"');assert.equal(r.status,2);assert.match(r.stderr,/逾期|時間無效/);assert.ok(existsSync(stamp));rmSync(stamp);

// 破壞性操作：目標須以絕對路徑錨定；根目錄一律拒絕。
for(const command of ['rm -rf build','rm -rf "$DIR"',"find . -name '*.tmp' -delete","find . -name '*.tmp' | xargs rm",'git clean -fdx','git reset --hard',`python -c "import shutil; shutil.rmtree('build')"`,'echo hi > out.txt'])
 assert.equal(sh(command).status,2,command);
r=sh('rm -rf /');assert.equal(r.status,2);assert.match(r.stderr,/根目錄/);
for(const command of ['rm -rf /tmp/abs/build','rm -rf /tmp/$x','rm build.log',"find /tmp/abs -name '*.tmp' -delete","find /tmp/abs -name '*.tmp' -print0 | xargs -0 rm -f",'git -C /tmp/abs clean -fdx'])
 assert.equal(sh(command).status,0,command);

// git alias 與路徑重定向。
for(const command of ['git -c alias.x=commit x -m y','GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.x GIT_CONFIG_VALUE_0=commit git x']){r=sh(command);assert.equal(r.status,2);assert.match(r.stderr,/git alias 定義攔截/);}
r=ps('$env:GIT_DIR="C:/x/.git"; git status');assert.equal(r.status,2);assert.match(r.stderr,/路徑重定向攔截/);

// 時點 1、2 的審查與判定期間可先行研究；提示與停靠訊息都說明範圍。
for(const [node,expect] of [['requirement',true],['verify',true],['build',false]]){
 set(node);r=run('SessionStart');assert.equal(r.status,0);
 assert.equal(/先行研究/.test(JSON.parse(r.stdout).hookSpecificOutput.additionalContext),expect,node);
}
set('requirement');r=sh('sb next research --adversarial');assert.equal(r.status,2);assert.match(r.stderr,/先行研究/);assert.match(r.stderr,/不改 G1/);

// 只有已註冊的事件寫紀錄；PowerShell 呼叫同樣計數。
set('build');const before=readFileSync(statePath,'utf8');
assert.equal(run('Notification').status,0);assert.equal(readFileSync(statePath,'utf8'),before,'未知事件不寫狀態');
assert.equal(ps('Get-Date').status,0);assert.equal(JSON.parse(readFileSync(statePath,'utf8')).turnUsage.requests,1);

// 驗收段的相對路徑以工具 cwd 展開。
set('verify');r=tool('Write',{file_path:'app.js'},join(root,'sub'));assert.equal(r.status,2);assert.match(r.stderr,/sub\/app\.js/);

// 接入異常：只放行 flow-state／tmp 修復；`..` 與尾端點不能把正式檔偽裝成修復目標。
writeFileSync(statePath,'{broken');
for(const path of ['.shiftblame/tmp/../../src/app.js','.shiftblame/tmp/.. /.. /src/app.js',join(root,'.shiftblame/tmp/../../src/app.js')])
 assert.equal(tool('Write',{file_path:path}).status,2,path);
for(const path of ['.shiftblame/tmp/notes.md',join(root,'.shiftblame/flow-state.json'),'.shiftblame/tmp/./a/../notes.md'])
 assert.equal(tool('Write',{file_path:path}).status,0,path);
r=ps('git add .');assert.equal(r.status,2);assert.match(r.stderr,/接入異常/);
assert.equal(readFileSync(statePath,'utf8'),'{broken');
console.log('sb-shell-coverage: pass');
