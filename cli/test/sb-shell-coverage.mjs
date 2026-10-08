import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
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
assert.equal(ps(`pwsh -NoProfile -Command "git commit -m 'fix: x'"`).status,2);
assert.equal(ps(`pwsh -EncodedCommand ${Buffer.from("git commit -m 'fix: x'",'utf16le').toString('base64')}`).status,2);
assert.equal(ps(`iex "git commit -m 'fix: x'"`).status,2);
r=ps('$m = "x"; git commit -m $m');assert.equal(r.status,2);assert.match(r.stderr,/字面值/);

// 引號內文字、運算子與唯讀查詢不是提交或覆寫。
for(const command of ['node -e "[1].map(x=>x)"',"echo 'git commit -m x'",'git log --grep=commit','git log --oneline | grep commit','npm test 2>&1',
 `printf '%s\\n' "a > b"`,"awk 'NR>=20' file.txt",'grep ">=" src/app.js','git rev-parse --git-dir && echo ok','command -v git','echo hi >> out.txt','make > /dev/null 2>&1'])
 assert.equal(sh(command).status,0,command);

// 巢狀 shell 內的提交同樣要印章（訊息樣本帶合法 type——格式閘先於印章層，勿混入本段判準）；無法展開的巢狀一律拒絕。
for(const command of [`bash -c "git commit -m 'fix: x'"`,"sh -c 'git commit -m \"fix: x\"'",`echo "git commit -m 'fix: x'" | bash`,"bash <<EOF\ngit commit -m 'fix: x'\nEOF",`eval "git commit -m 'fix: x'"`,'echo $(git commit -m "fix: x")',`\\git commit -m 'fix: x'`]){
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

// 丟棄未提交變更或刪除分支的 git 操作：須以 -C <絕對路徑> 錨定 repo；只取消暫存、切換分支與安全刪除照常。
for(const command of ['git checkout -- .','git checkout -- sub/app.js','git checkout .','git checkout -f','git checkout --force main','git restore .','git restore -W sub',
 'git restore -SW .','git restore --source HEAD~1 sub','git switch --discard-changes main','git switch -f main','git stash drop','git stash clear',
 'git branch -D topic','git branch --delete --force topic','git branch -df topic']){
 r=sh(command);assert.equal(r.status,2,command);assert.match(r.stderr,/未以 -C <絕對路徑> 錨定/,command);
 assert.equal(sh(command.replace(/^git /,'git -C /tmp/abs ')).status,0,`${command}（-C 絕對路徑）`);
}
assert.equal(ps('git checkout -- .').status,2,'PowerShell 同樣檢查');
for(const command of ['git restore --staged .','git restore -S sub/app.js','git checkout main','git checkout -b topic','git switch topic','git stash','git stash pop','git branch -d topic','git branch topic'])
 assert.equal(sh(command).status,0,command);
// rsync --delete：本機目的地須以絕對路徑錨定；遠端目的地與不刪除的同步照常。
const slash=(p)=>p.replace(/\\/g,'/');
for(const command of ['rsync -a --delete src/ dst/','rsync -av --delete-after -e ssh src/ backup','echo x | rsync -a --del src/ "$DEST"'])
 assert.equal(sh(command).status,2,command);
for(const command of ['rsync -a --delete src/ /tmp/abs/dst/','rsync -a --delete src/ user@host:/srv/app','rsync -a --delete src/ rsync://host/mod','rsync -a src/ dst/'])
 assert.equal(sh(command).status,0,command);

// 根目錄、家目錄、專案根、它們的上層與系統頂層目錄：即使是絕對路徑也不可整個刪除或清空。
const home=homedir();
const sysTop=process.platform==='win32'?`${process.env.SystemDrive||'C:'}\\Windows`:'/usr';
for(const [fn,command,kind] of [[sh,`rm -rf ${slash(home)}`,'家目錄'],[sh,`rm -rf ${slash(dirname(home))}`,'家目錄的上層'],[sh,`rm -rf ${slash(root)}`,'專案根'],
 [sh,`rm -rf ${slash(root)}/*`,'專案根'],[sh,`rm -rf ${slash(root)}/`,'專案根'],[sh,`rm -rf ${slash(dirname(root))}`,'專案根的上層'],[sh,'rm -rf /usr','系統頂層目錄'],
 [ps,`Remove-Item -Recurse -Force '${home}'`,'家目錄'],[ps,`Remove-Item -Recurse -Force '${sysTop}'`,'系統頂層目錄'],[sh,`find ${slash(home)} -delete`,'家目錄'],
 [sh,`find ${slash(root)} -print0 | xargs -0 rm -rf`,'專案根'],[ps,`robocopy C:\\empty '${home}' /MIR`,'家目錄'],[sh,`rsync -a --delete /tmp/abs/src/ ${slash(root)}/`,'專案根']]){
 r=fn(command);assert.equal(r.status,2,command);assert.match(r.stderr,new RegExp(`目標是${kind}（`),command);
}
for(const [fn,command] of [[sh,`find ${slash(home)} -name '*.tmp' -delete`],[sh,`rm -rf ${slash(root)}/build`],[sh,`rm -rf ${slash(join(home,'proj-x','build'))}`],
 [ps,`Remove-Item -Recurse -Force '${join(root,'build')}'`],[sh,`find ${slash(root)} -name '*.log' -print0 | xargs -0 rm -f`]])
 assert.equal(fn(command).status,0,command);

// git alias 與路徑重定向。
for(const command of ['git -c alias.x=commit x -m y','GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.x GIT_CONFIG_VALUE_0=commit git x']){r=sh(command);assert.equal(r.status,2);assert.match(r.stderr,/git alias 定義攔截/);}
r=ps('$env:GIT_DIR="C:/x/.git"; git status');assert.equal(r.status,2);assert.match(r.stderr,/路徑重定向攔截/);

// 時點 1、2 的審查期間可先行研究；提示與停靠訊息都說明範圍。
for(const [node,expect] of [['research',true],['quality',true],['verify',true],['build',false]]){
 set(node);r=run('SessionStart');assert.equal(r.status,0);
 assert.equal(/先行研究/.test(JSON.parse(r.stdout).hookSpecificOutput.additionalContext),expect,node);
}
set('research');r=sh('sb next plan');assert.equal(r.status,2);assert.match(r.stderr,/先行研究/);assert.match(r.stderr,/不改 G1/);

// 只有已註冊的事件寫紀錄；PowerShell 呼叫同樣計數。
set('build');const records=join(root,'.shiftblame/tmp/hook-records.json');const before=readFileSync(records,'utf8');
assert.equal(run('Notification').status,0);assert.equal(readFileSync(records,'utf8'),before,'未知事件不寫紀錄');
const turnCount=()=>JSON.parse(readFileSync(records,'utf8')).turnUsage?.requests??0;const count0=turnCount();
assert.equal(ps('Get-Date').status,0);assert.equal(turnCount(),count0+1);
assert.equal(JSON.parse(readFileSync(statePath,'utf8')).turnUsage,undefined,'hooks 不寫 flow-state');

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
