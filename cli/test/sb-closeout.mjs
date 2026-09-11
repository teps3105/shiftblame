import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-closeout-'));
process.on('exit', () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); rmSync(root, { recursive: true, force: true }); });
const cwd = join(root, 'repo');
const remote = join(root, 'published.git');
mkdirSync(cwd);
const git = (...args) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
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
save({ ...state(), node: 'done' });
ok(run('end', '--boss-ok')); // sb end 已機械化歸檔移動（slug 目錄 → archive/）
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
ok(git('reset', '--hard', initial));
ok(git('merge', '--no-ff', 'fix/old')); // 非協作倉庫一律 --no-ff（slug 邊界合併提交）
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
