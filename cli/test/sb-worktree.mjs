// sb-worktree：多代理工作樹——生命週期（open→report→verify→merge→done/drop）＋worker 沙箱閘＋
// worktree 內禁 sb（hooks＋CLI 自衛）＋merge 拒測試 diff＋end/--new-ms 擋未清＋注入狀態＋schema 分類。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const hook = fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs', import.meta.url));
// 文件陳述錨（SKILL §1：MUST 級機制的行為測試 MUST 附文件陳述錨——機制拆除時測試與錨同拆）
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
assert.ok(readFileSync(join(repoRoot, 'skills/shiftblame/SKILL.md'), 'utf8').includes('多代理工作樹放行條款'), '陳述錨：主 SKILL 寫入矩陣段仍述 worktree 放行條款');
assert.ok(readFileSync(join(repoRoot, 'skills/shiftblame/SKILL.md'), 'utf8').includes('受治理寫入 worker'), '陳述錨：主 SKILL §3 仍述受治理寫入 worker');
assert.ok(readFileSync(join(repoRoot, 'README.md'), 'utf8').includes('sb wt open'), '陳述錨：README 仍述 wt 命令');

const root = mkdtempSync(join(tmpdir(), 'sb-wt-'));
process.on('exit', () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); rmSync(root, { recursive: true, force: true }); });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const gate = (payload) => spawnSync(process.execPath, [hook], { cwd: root, input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const gateAt = (cwd, payload) => spawnSync(process.execPath, [hook], { cwd, input: JSON.stringify({ cwd, ...payload }), encoding: 'utf8' });
const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const setState = (patch) => writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'build', history: [], inputs: [{ at: new Date().toISOString(), text: '老闆：開工' }], ...patch }));

git('init', '-q');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'base.txt'), 'x\n');
git('add', '.');
git('-c', 'user.name=t', '-c', 'user.email=t@x.invalid', 'commit', '-q', '-m', 'test: base');

// —— 1. open：段位檢查＋建樹建分支＋帳本 ——
setState({ node: 'intent' });
assert.equal(run('wt', 'open', 'fa', '--task', '實作 A 模組').status, 1, 'intent 段開工作樹擋（限 research/build）');
setState({});
assert.equal(run('wt', 'open', 'Bad_Name', '--task', '實作 A 模組').status, 1, '名稱不合規擋');
assert.equal(run('wt', 'open', 'fa', '--task', '短').status, 1, '任務卡過短擋');
const openR = run('wt', 'open', 'fa', '--task', '實作 A 模組（AC-01 對應，檔案邊界 src/a/）');
assert.equal(openR.status, 0, openR.stderr);
assert.ok(existsSync(join(root, '.shiftblame/worktree/fa/base.txt')), 'worktree checkout 存在（共享 repo 檔案）');
assert.equal(git('rev-parse', '--verify', 'refs/heads/wt/fa').status, 0, '分支 wt/fa 已建');
assert.equal(state().worktrees.fa.status, 'open', '帳本記錄 open');
assert.equal(run('wt', 'open', 'fa', '--task', '同名重開').status, 1, '同名占用擋');

// —— 2. worker 沙箱閘：build 段放行、intent 段擋；worktree 內禁 sb ——
const wtRoot = join(root, '.shiftblame/worktree/fa');
let r = gateAt(wtRoot, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(wtRoot, 'src/a.js'), content: 'x' } });
assert.equal(r.status, 0, 'build 段 worker 在沙箱寫入放行（worktree 錨定解析回主 repo 治理＋放行條款）');
r = gateAt(wtRoot, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node sb.mjs state' } });
assert.equal(r.status, 2, '工作樹內跑 sb 擋（hooks 層——防自簽車道）');
assert.match(r.stderr, /禁跑 sb/, '擋訊息指向主 repo');
setState({ node: 'intent', worktrees: state().worktrees });
r = gateAt(wtRoot, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(wtRoot, 'src/b.js'), content: 'x' } });
assert.equal(r.status, 2, 'intent 段對工作樹唯讀擋');
assert.match(r.stderr, /限 research／build/, '放行條款段位訊息');
setState({ node: 'build', worktrees: state().worktrees });
// 主 repo 側寫沙箱路徑（協調者事件 cwd=主 root）同受放行條款
r = gate({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(wtRoot, 'src/c.js'), content: 'x' } });
assert.equal(r.status, 0, '協調者（主 root）寫沙箱路徑放行（build 段）');

// —— 3. worker 模擬：沙箱內 commit 到自己分支 ——
mkdirSync(join(wtRoot, 'src'), { recursive: true });
writeFileSync(join(wtRoot, 'src/a.js'), 'export const a = 1;\n');
spawnSync('git', ['-C', wtRoot, 'add', '.'], { encoding: 'utf8' });
spawnSync('git', ['-C', wtRoot, '-c', 'user.name=w', '-c', 'user.email=w@x.invalid', 'commit', '-q', '-m', 'feat: A 模組'], { encoding: 'utf8' });

// —— 4. report→verify：fail 退回、pass 進 ready ——
assert.equal(run('wt', 'verify', 'fa', '--verdict', 'pass').status, 1, '未 report 直接 verify pass 擋（verifying 窗口）');
assert.equal(run('wt', 'report', 'fa').status, 0);
assert.equal(state().worktrees.fa.status, 'verifying', '回報進驗證窗口');
assert.equal(run('wt', 'verify', 'fa', '--verdict', 'fail').status, 0);
assert.equal(state().worktrees.fa.status, 'open', '驗證未過退回 worker');
run('wt', 'report', 'fa');
assert.equal(run('wt', 'verify', 'fa', '--verdict', 'pass', '--report', '.shiftblame/tmp/verify-fa.md').status, 0);
assert.equal(state().worktrees.fa.status, 'ready', '驗證通過進 ready');
assert.equal(state().worktrees.fa.verdict, 'pass');

// —— 5. merge：非 ready 擋（另開一樹驗）、拒測試 diff、套用效果 ——
run('wt', 'open', 'fb', '--task', '測試碼走私防護驗證');
const wtB = join(root, '.shiftblame/worktree/fb');
assert.equal(run('wt', 'merge', 'fb').status, 1, '非 ready（未驗證）merge 擋');
mkdirSync(join(wtB, 'tests'), { recursive: true });
writeFileSync(join(wtB, 'tests/a.test.js'), 'test();\n');
spawnSync('git', ['-C', wtB, 'add', '.'], { encoding: 'utf8' });
spawnSync('git', ['-C', wtB, '-c', 'user.name=w', '-c', 'user.email=w@x.invalid', 'commit', '-q', '-m', 'test: 夾帶'], { encoding: 'utf8' });
run('wt', 'report', 'fb');
run('wt', 'verify', 'fb', '--verdict', 'pass');
const mB = run('wt', 'merge', 'fb');
assert.equal(mB.status, 1, 'merge 拒測試碼 diff（單一寫入者＝主對話 test 段）');
assert.match((mB.stderr || '') + (mB.stdout || ''), /測試碼/);
run('wt', 'drop', 'fb');
assert.equal(existsSync(wtB), false, 'drop 移除工作樹');
assert.equal(git('rev-parse', '--verify', 'refs/heads/wt/fb').status !== 0, true, 'drop 刪分支');
assert.equal(state().worktrees.fb, undefined, 'drop 清帳目');

assert.equal(run('wt', 'merge', 'fa').status, 0, 'fa（ready）merge 過');
assert.equal(state().worktrees.fa.status, 'merged');
assert.ok(existsSync(join(root, 'src/a.js')), 'diff 已套用至主 repo 工作區');

// —— 6. done：收工移除 ——
assert.equal(run('wt', 'done', 'fa').status, 0);
assert.equal(existsSync(wtRoot), false, 'done 移除工作樹');
assert.equal(git('rev-parse', '--verify', 'refs/heads/wt/fa').status !== 0, true, 'done 刪分支');
assert.equal(state().worktrees, undefined, '帳目清空（worktrees 鍵刪）');

// —— 7. end／--new-ms 擋未清；注入狀態行 ——
run('wt', 'open', 'fc', '--task', '清場檢查用');
const at = new Date().toISOString();
const atLater = new Date(Date.now() + 5000).toISOString();
setState({
  node: 'verify', worktrees: state().worktrees,
  history: [{ from: 'build', to: 'verify', at, ms: '001', bossOk: false, adversarial: false }],
  adversarialAt: atLater, adversarialConsumed: true,
  adversarialLog: [{ at: atLater, report: '.shiftblame/tmp/p3.md', verdict: '通過', node: 'verify', point: '③' }],
  inputs: [{ at: new Date(Date.now() + 6000).toISOString(), text: '老闆：通過結束' }],
});
const endBlocked = run('end', '--boss-ok', '--adversarial');
assert.equal(endBlocked.status, 1);
assert.match((endBlocked.stderr || '') + (endBlocked.stdout || ''), /工作樹未清/);
const up = gate({ hook_event_name: 'UserPromptSubmit', prompt: '狀態' });
assert.match(up.stdout, /\[工作樹\].*fc\[build\/open\]/, '輸入注入各組狀態行');
run('wt', 'drop', 'fc');

// —— 8. schema 分類：合法 worktrees＝active；非法形狀＝invalid ——
setState({ worktrees: { ok1: { phase: 'build', branch: 'wt/ok1', task: '合法條目', status: 'open', openedAt: new Date().toISOString() } } });
assert.equal(run('state').status, 0, '合法 worktrees 分類 active');
setState({ worktrees: { bad: { phase: 'deploy', branch: 'wt/bad', task: '非法 phase', status: 'open', openedAt: new Date().toISOString() } } });
assert.equal(run('state').status, 1, '非法 phase 形狀拒（invalid）');
setState({ worktrees: { bad: { phase: 'build', branch: 'wt/bad', task: '非法 status', status: 'running', openedAt: new Date().toISOString() } } });
assert.equal(run('state').status, 1, '非法 status 形狀拒');

// —— 9. 對抗必修回歸：hold 凍結 wt、merge 段位閘、porcelain 契約、merged 不再判定、大小寫路徑 ——
setState({});
run('wt', 'open', 'fd', '--task', '回歸驗證用');
setState({ understandingHold: { inputIdx: 1, at: new Date().toISOString() }, worktrees: state().worktrees });
assert.equal(run('wt', 'list').status, 1, '停等凍結期 wt 全組禁用（CLI 層）');
r = gate({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb wt merge fd' } });
assert.equal(r.status, 2, '停等凍結期 wt 命令擋（hooks 層）');
setState({ worktrees: state().worktrees });
run('wt', 'report', 'fd');
run('wt', 'verify', 'fd', '--verdict', 'pass');
setState({ node: 'verify', worktrees: state().worktrees });
assert.equal(run('wt', 'merge', 'fd').status, 1, 'verify 段 merge 擋（段位閘——verify 對 repo 唯讀）');
setState({ node: 'build', worktrees: state().worktrees });
// porcelain 契約：worker 留 untracked 未 commit → merge 擋
writeFileSync(join(root, '.shiftblame/worktree/fd/untracked.txt'), 'x');
const mDirty = run('wt', 'merge', 'fd');
assert.equal(mDirty.status, 1, '工作樹有未 commit 變更 merge 擋（MUST commit 至 wt 分支的契約機械化）');
assert.match((mDirty.stderr || '') + (mDirty.stdout || ''), /未 commit/);
// 乾淨後 merge；merged 樹 verify 再判定擋
spawnSync('git', ['-C', join(root, '.shiftblame/worktree/fd'), 'add', '.'], { encoding: 'utf8' });
spawnSync('git', ['-C', join(root, '.shiftblame/worktree/fd'), '-c', 'user.name=w', '-c', 'user.email=w@x.invalid', 'commit', '-q', '-m', 'feat: fd'], { encoding: 'utf8' });
assert.equal(run('wt', 'merge', 'fd').status, 0, '乾淨工作樹 merge 過');
run('wt', 'report', 'fd');
assert.equal(run('wt', 'verify', 'fd', '--verdict', 'fail').status, 1, 'merged 樹不再判定擋（狀態機洞修補）');
run('wt', 'done', 'fd');
// 大小寫路徑：WorkTree 變體在 intent 段仍被擋（放行條款 toLowerCase）
run('wt', 'open', 'fe', '--task', '大小寫回歸');
setState({ node: 'intent', worktrees: state().worktrees });
r = gateAt(join(root, '.shiftblame/WorkTree/fe'), { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/WorkTree/fe/x.js'), content: 'x' } });
assert.equal(r.status, 2, '大小寫變體路徑不放行（.shiftblame/WorkTree/ 命中 ROM 閘）');
setState({ node: 'build', worktrees: state().worktrees });
// --new-ms 擋未清（gate 造心跳＋新鮮輸入後，patch 保留既有流）
gate({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：開新里程碑' });
{
  const cur = state();
  const histAt = new Date(Date.now() - 60000).toISOString();
  const p3At = new Date(Date.now() - 30000).toISOString();
  cur.node = 'verify';
  cur.history = [{ from: 'build', to: 'verify', at: histAt, ms: '001', bossOk: false, adversarial: false }];
  cur.adversarialAt = p3At;
  cur.adversarialLog = [{ at: p3At, report: '.shiftblame/tmp/p3.md', verdict: '通過', node: 'verify', point: '③' }];
  writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(cur, null, 2));
}
const nm = run('next', 'intent', '--new-ms', '--boss-ok', '--adversarial');
assert.equal(nm.status, 1);
assert.match((nm.stderr || '') + (nm.stdout || ''), /工作樹未清/);
run('wt', 'drop', 'fe');

console.log('sb-worktree: pass');
