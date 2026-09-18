import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const hook = fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs', import.meta.url));
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
assert.match(readme, /僅在合法 ended 狀態接受目前 slug 的精確 `merge <slug>`/);
const root = mkdtempSync(join(tmpdir(), 'sb-closeout-'));
process.on('exit', () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); rmSync(root, { recursive: true, force: true }); });
const cwd = join(root, 'repo');
const remote = join(root, 'published.git');
mkdirSync(cwd);
const git = (...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
const commitHook = (message) => spawnSync(process.execPath, [hook], { encoding: 'utf8', input: JSON.stringify({ cwd, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git commit -m '${message}'` } }) });
const ok = (r) => assert.equal(r.status, 0, r.stderr || r.stdout);
const stateFile = join(cwd, '.shiftblame/flow-state.json');
const state = () => JSON.parse(readFileSync(stateFile, 'utf8'));
const save = (s) => writeFileSync(stateFile, JSON.stringify(s));
const tip = () => git('rev-parse', 'HEAD').stdout.trim();
const commit = (file, text) => { writeFileSync(join(cwd, file), text); ok(git('add', file)); ok(git('commit', '-m', 'test: fixture')); };
ok(git('init'));
ok(git('symbolic-ref', 'HEAD', 'refs/heads/trunk'));
ok(git('config', 'user.name', 'test'));
ok(git('config', 'user.email', 'test@example.invalid'));
commit('.gitignore', '.shiftblame/\n');
const initial = tip();
ok(run('init', 'old', 'fix'));
commit('old.txt', 'old feature\n');
const workTip = tip();
ok(git('init', '--bare', remote));
ok(git('remote', 'add', 'published', remote));
ok(git('push', '-u', 'published', 'HEAD:refs/heads/review/old'));
ok(git('config', 'remote.published.push', 'refs/heads/fix/old:refs/heads/push-only'));
ok(git('push', 'published'));
ok(git('push', 'published', `${initial}:refs/heads/obsolete`));
ok(git('config', '--add', 'remote.published.push', 'refs/tags/*:refs/tags/*'));
ok(git('config', '--add', 'remote.published.push', ':obsolete'));
// 以下報告與狀態只屬隔離 fixture；驗證格式例外不延伸至未歸檔工作。
const report = join(cwd, '.shiftblame/tmp/merge-review.md');
writeFileSync(report, '# 隔離測試報告\n此為合併提交閘的合成測試資料，不代表真實外部檢閱或產品驗收。\n對抗判定：通過\n');
assert.equal(run('commitmsg', 'merge old').status, 1, 'intent 不接受合併格式');
save({ ...state(), node: 'done' });
assert.equal(run('commitmsg', 'merge old').status, 1, 'done 尚未歸檔不接受合併格式');
const withoutDeclaration = state();
withoutDeclaration.adversarialLog = [{ at: new Date().toISOString(), report: '.shiftblame/tmp/p3.md', verdict: '通過', node: 'done', point: '2' }];
withoutDeclaration.inputs = [{ at: new Date().toISOString(), text: '老闆：確認收尾' }];
save(withoutDeclaration); // 合成 fixture；出口僅驗老闆終審章（--boss-ok）——對抗已在 build→verify 進段前，出口不重驗對抗。
ok(run('end', '--boss-ok')); // sb end 機械化歸檔移動（slug 目錄 → archive/）；舊 done 態遷移為 ended
ok(run('commitmsg', 'merge old')); // 2.4.0：ended 接受固定合併訊息——提交審核已移除，僅格式＋印章
const rejectInit = (pattern) => {
  const before = readFileSync(stateFile);
  const head = tip();
  const branch = git('branch', '--show-current').stdout;
  const r = run('init', 'next', 'feat');
  assert.equal(r.status, 1, r.stdout);
  if (pattern) assert.match(r.stderr, pattern);
  assert.deepEqual(readFileSync(stateFile), before);
  assert.equal(tip(), head);
  assert.equal(git('branch', '--show-current').stdout, branch);
  assert.equal(existsSync(join(cwd, '.shiftblame/next')), false);
};
rejectInit(/closeout/);
assert.equal(run('closeout', '--base', 'trunk').status, 1, '未合併拒絕');
assert.equal(run('closeout', '--base', 'fix/old').status, 1, '基底不可等於舊分支');
assert.equal(run('closeout', '--base', 'missing').status, 1);
ok(git('checkout', 'trunk'));
// 快轉（fast-forward）合併：無合併提交證據——closeout 擋下並指引 --no-ff 重併。
ok(git('merge', '--ff-only', 'fix/old'));
assert.equal(run('closeout', '--base', 'trunk').status, 1, '快轉合併拒絕');
assert.match(run('closeout', '--base', 'trunk').stderr, /--no-ff/, '指引 --no-ff 重併');
// 回復合併前基底後以 --no-ff 重併——證據成立。
// 訊息不符的合併：證據成立但訊息錯——closeout 擋並指引重併。
ok(git('reset', '--hard', initial));
ok(git('merge', '--no-ff', 'fix/old', '-m', 'wrong message'));
assert.equal(run('closeout', '--base', 'trunk').status, 1, '合併訊息不符擋下');
assert.match(run('closeout', '--base', 'trunk').stderr, /merge /, '指引固定訊息重併');
// 回復後以正確訊息重併——證據與訊息皆成立。
ok(git('reset', '--hard', initial));
ok(git('merge', '--no-ff', '--no-commit', 'fix/old'));
for (const message of ['merge other', 'merge: old', 'merge old extra', 'merge old\n', 'merge old\r']) {
  assert.equal(run('commitmsg', message).status, 1, `拒絕非精確合併訊息 ${JSON.stringify(message)}`);
}
ok(run('commitmsg', 'merge old'));
const stampFile = join(cwd, '.shiftblame/tmp/commit-stamp.json');
assert.equal(JSON.parse(readFileSync(stampFile, 'utf8')).message, 'merge old');
assert.equal(commitHook('merge other').status, 2, '實際提交仍須匹配訊息印章');
ok(commitHook('merge old'));
assert.equal(existsSync(stampFile), false, '提交 hook 焚章');
ok(git('commit', '-m', 'merge old'));
ok(run('commitmsg', 'merge old')); // 焚章後可重新發章——印章一次性（2.4.0 無對抗消費概念）。
assert.equal(git('log', '-1', '--format=%s', 'trunk').stdout.trim(), 'merge old', '合併提交訊息＝merge <slug>');
commit('base.txt', 'base-only commit\n');
const baseTip = tip();
ok(git('checkout', 'fix/old'));
assert.equal(tip(), workTip);
// workBranch 舊版缺失仍可由唯一 type/slug 分支恢復來源。
const legacy = state(); delete legacy.workBranch; save(legacy);
ok(run('closeout', '--base', 'trunk'));
assert.equal(state().closeout.workCommit, workTip);
assert.equal(state().closeout.workBranch, 'fix/old');
assert.ok(state().closeout.remotes.some(r => r.ref === 'refs/heads/review/old'));
assert.ok(state().closeout.remotes.some(r => r.ref === 'refs/heads/push-only'));
assert.equal(state().closeout.remotes.some(r => r.ref === 'refs/heads/obsolete'), false, '無關刪除refspec不是舊工作清理目標');
rejectInit(/舊本機分支尚未清除/);
ok(git('checkout', 'trunk'));
ok(git('branch', '-d', 'fix/old'));
rejectInit(/舊遠端分支尚未清除/);
// 伺服器不可達不是已清除，且本機 remote-tracking 快取無法代替查證。
renameSync(remote, remote + '.offline');
rejectInit(/遠端.*查詢失敗/);
renameSync(remote + '.offline', remote);
ok(git('push', 'published', '--delete', 'review/old'));
rejectInit(/push-only/);
ok(git('push', 'published', '--delete', 'push-only'));
ok(git('update-ref', 'refs/remotes/published/review/old', workTip));
// 記錄來源不可刪除或改成別的伺服器來放行。
ok(git('config', 'remote.published.pushurl', remote + '.different'));
rejectInit(/設定已變更/);
ok(git('config', '--unset', 'remote.published.pushurl'));
const remoteConfig = git('config', '--get', 'remote.published.url').stdout.trim();
ok(git('config', '--unset', 'remote.published.url'));
rejectInit(/無法解析|設定已變更/);
ok(git('config', 'remote.published.url', remoteConfig));
// —— sb init --main：完結 ended 生命週期——留在 closeout 基底分支直接作業（不開 slug 不建分支）——
assert.equal(run('init', '--main', 'oops').status, 2, '--main 不接受 slug 參數');
assert.equal(state().concludedAt, undefined, 'usage 失敗不留完結戳');
{
  const fresh = mkdtempSync(join(tmpdir(), 'sb-main-fresh-'));
  try {
    mkdirSync(join(fresh, '.shiftblame'), { recursive: true });
    const rf = spawnSync(process.execPath, [cli, 'init', '--main'], { cwd: fresh, encoding: 'utf8' });
    assert.equal(rf.status, 1, '無流程不可完結');
    assert.match(rf.stderr, /完結僅接受合法 ended 狀態/);
  } finally { rmSync(fresh, { recursive: true, force: true }); }
}
ok(git('checkout', '-b', 'sidebase'));
assert.equal(run('init', '--main').status, 1, '未停於 closeout 基底分支不可完結');
assert.match(run('init', '--main').stderr, /完結須停於 closeout 基底分支 trunk/);
ok(git('checkout', 'trunk'));
ok(run('init', '--main'));
assert.ok(state().concludedAt, '完結戳寫入');
assert.equal(state().node, 'ended', '完結維持 ended 分類（歸檔與 closeout 證據保留）');
assert.match(run('state').stdout, /ended＋已完結/, 'state 讀出完結態');
assert.equal(run('init', '--main').status, 1, '重複完結即拒');
assert.match(run('init', '--main').stderr, /已完結/);
// 完結後提交紀律：merge <slug> 固定訊息失效（合併證據已由 closeout 查證）；正常 type 訊息走格式閘＋發章。
assert.equal(run('commitmsg', 'merge old').status, 1, '完結後固定合併訊息失效');
assert.match(run('commitmsg', 'merge old').stderr, /已完結/);
assert.equal(run('commitmsg', 'feat: 完結後直接作業提交').status, 0, '完結後正常 type 訊息可發章');
assert.equal(commitHook('feat: 完結後直接作業提交').status, 0, '完結後正常訊息 commit 過 hook');
assert.equal(existsSync(stampFile), false, '完結態 commit 焚章');
commit('base2.txt', 'later base\n');
const latestBase = tip();
assert.notEqual(latestBase, baseTip);
writeFileSync(join(cwd, 'base2.txt'), 'dirty\n');
rejectInit(/工作樹未乾淨/);
writeFileSync(join(cwd, 'base2.txt'), 'later base\n');
ok(git('branch', 'feat/next', initial));
rejectInit(/新分支已存在/);
ok(git('branch', '-d', 'feat/next'));
// closeout 與 slug 綁定，偽接其他工作的證據不放行。
const valid = state();
save({ ...valid, closeout: { ...valid.closeout, slug: 'different' } });
rejectInit(/接入異常/); // 不屬於同一 slug 的 closeout 在統一狀態檢查即拒絕。
save(valid);
renameSync(join(cwd, '.git'), join(cwd, '.git.hidden'));
const lostGit = run('init', 'next', 'feat');
assert.equal(lostGit.status, 1);
assert.match(lostGit.stderr, /Git metadata 缺失/);
assert.equal(existsSync(join(cwd, '.shiftblame/next')), false);
renameSync(join(cwd, '.git.hidden'), join(cwd, '.git'));
// base 改寫失去工作提交，即使分支均已清除仍拒絕。
ok(git('update-ref', 'refs/heads/trunk', initial));
rejectInit(/--no-ff 合併提交證據/);
ok(git('update-ref', 'refs/heads/trunk', latestBase));
// 当前停在其他功能分支也只能從查證的基底出發。
ok(git('checkout', '-b', 'unrelated', initial));
ok(run('init', 'next', 'feat'));
assert.equal(tip(), latestBase);
assert.equal(git('branch', '--show-current').stdout.trim(), 'feat/next');
assert.equal(state().closeout, undefined);
assert.equal(state().workBranch, 'feat/next');
console.log('sb-closeout: 合併、基底起點、本機與遠端清除及失敗原樣保留通過');
