// sb-init-bootstrap：沒有任何資料的專案初始化——空資料夾建庫、unborn repo 補起始提交、
// 已有內容的非 Git 資料夾交由使用者選擇（先建庫或 --no-git），失敗時不留下半套 Git 或流程骨架。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-boot-'));
process.on('exit', () => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); rmSync(root, { recursive: true, force: true }); });
// 前提：暫存根的上層沒有 .git／.shiftblame，空資料夾才不會向上錨定。
for (let dir = dirname(root); ;) {
  assert.ok(!existsSync(join(dir, '.git')) && !existsSync(join(dir, '.shiftblame')), `暫存根上層含 Git 或工作區：${dir}`);
  const up = dirname(dir);
  if (up === dir) break;
  dir = up;
}

// Git 設定全由環境注入：不讀使用者的全域與系統設定，身分有無可控。
const baseEnv = { ...process.env, GIT_CONFIG_GLOBAL: join(root, 'absent-global-config'), GIT_CONFIG_NOSYSTEM: '1' };
for (const key of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete baseEnv[key];
const gitConfig = (pairs) => ({ ...baseEnv, GIT_CONFIG_COUNT: String(pairs.length), ...Object.fromEntries(pairs.flatMap(([k, v], i) => [[`GIT_CONFIG_KEY_${i}`, k], [`GIT_CONFIG_VALUE_${i}`, v]])) });
const withIdentity = gitConfig([['init.defaultBranch', 'trunk'], ['user.name', 'fixture'], ['user.email', 'fixture@example.invalid']]);
const noIdentity = gitConfig([['init.defaultBranch', 'trunk'], ['user.useConfigOnly', 'true']]);

let serial = 0;
function fixture(env = withIdentity) {
  const cwd = join(root, String(serial++));
  mkdirSync(cwd, { recursive: true });
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8' });
  const git = (...args) => spawnSync('git', ['-C', cwd, ...args], { env, encoding: 'utf8' });
  const stateFile = join(cwd, '.shiftblame/flow-state.json');
  const state = () => JSON.parse(readFileSync(stateFile, 'utf8'));
  const setState = (st) => writeFileSync(stateFile, JSON.stringify(st, null, 2));
  return { cwd, run, git, state, setState };
}
const emptyTree = (f) => spawnSync('git', ['-C', f.cwd, 'hash-object', '-t', 'tree', '--stdin'], { env: withIdentity, input: '', encoding: 'utf8' }).stdout.trim();
const absent = (f, ...names) => { for (const n of names) assert.equal(existsSync(join(f.cwd, n)), false, `${n} 不應存在`); };

// 1. 空資料夾：建庫＋只含 .gitignore 的起始提交，工作分支可 --no-ff 合併回基底。
{
  const f = fixture();
  const r = f.run('init', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /建立 Git 儲存庫/);
  assert.match(r.stdout, /開發分支：feat\/demo（已建立並切換）/);
  assert.equal(readFileSync(join(f.cwd, '.gitignore'), 'utf8'), '.shiftblame/\n');
  const base = f.git('rev-parse', 'trunk').stdout.trim();
  assert.equal(f.state().baseCommit, base, 'baseCommit 錨定起始提交');
  assert.equal(f.state().workBranch, 'feat/demo');
  assert.equal(f.git('log', '--format=%s', 'trunk').stdout.trim(), 'chore: 初始化專案', '基底只有一個起始提交');
  assert.equal(f.git('ls-tree', '--name-only', 'trunk').stdout.trim(), '.gitignore', '起始提交只含 .gitignore');
  assert.equal(f.git('branch', '--show-current').stdout.trim(), 'feat/demo');
  assert.equal(f.git('status', '--porcelain').stdout, '', '建庫後工作樹乾淨');
  writeFileSync(join(f.cwd, 'app.txt'), 'feature\n');
  assert.equal(f.git('add', 'app.txt').status, 0);
  assert.equal(f.git('commit', '-q', '-m', 'feat: demo').status, 0);
  const st = f.state();
  f.setState({ ...st, node: 'verify', lastAdv: { '2': { at: new Date(Date.parse(st.startedAt) + 1000).toISOString(), report: '.shiftblame/tmp/r.md', verdict: '通過', node: 'verify' } } });
  const end = f.run('end', '--adversarial', '--boss-ok');
  assert.equal(end.status, 0, end.stderr);
  assert.equal(f.git('log', '-1', '--format=%s', 'trunk').stdout.trim(), 'merge demo', '收尾自動偵測到起始提交所在的基底');
  assert.equal(f.git('branch', '--show-current').stdout.trim(), 'trunk');
}

// 2. 只有系統雜檔的資料夾視為空，雜檔同步列入忽略。
{
  const f = fixture();
  writeFileSync(join(f.cwd, '.DS_Store'), 'junk');
  const r = f.run('init', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(f.cwd, '.gitignore'), 'utf8'), '.shiftblame/\n.DS_Store\n');
  assert.equal(f.git('status', '--porcelain').stdout, '', '系統雜檔不讓工作樹變髒');
}

// 3. unborn repo：補空樹起始提交，不動使用者的暫存。
{
  const f = fixture();
  assert.equal(f.git('init', '-q').status, 0);
  writeFileSync(join(f.cwd, 'a.txt'), 'staged\n');
  assert.equal(f.git('add', 'a.txt').status, 0);
  const r = f.run('init', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /補上起始提交 [0-9a-f]{12}（空樹）於 trunk/);
  assert.equal(f.state().baseCommit, f.git('rev-parse', 'trunk').stdout.trim());
  assert.equal(f.git('rev-parse', 'trunk^{tree}').stdout.trim(), emptyTree(f), '起始提交為空樹');
  assert.equal(f.git('diff', '--cached', '--name-only').stdout.trim(), 'a.txt', '既有暫存保留');
  assert.equal(f.git('branch', '--show-current').stdout.trim(), 'feat/demo');
}

// 4. 沒有提交身分：不建庫、不補提交、不建工作區。
{
  const f = fixture(noIdentity);
  assert.equal(f.git('init', '-q').status, 0);
  const r = f.run('init', 'demo');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Git 提交身分未設定[\s\S]*--no-git/);
  assert.equal(f.git('rev-parse', '--verify', '-q', 'HEAD').status, 1, 'HEAD 仍無提交');
  absent(f, '.shiftblame');
}
{
  const f = fixture(noIdentity);
  const r = f.run('init', 'demo');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Git 提交身分未設定/);
  absent(f, '.git', '.gitignore', '.shiftblame');
}

// 5. 已有內容的非 Git 資料夾：不代為提交，提示兩條路。
{
  const f = fixture();
  writeFileSync(join(f.cwd, 'notes.txt'), 'keep\n');
  const r = f.run('init', 'demo');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /不是 Git 儲存庫且已有內容（notes\.txt）/);
  assert.match(r.stderr, /git init/);
  assert.match(r.stderr, /--no-git/);
  absent(f, '.git', '.gitignore', '.shiftblame');
  const plain = f.run('init', 'demo', '--no-git');
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /非 Git 模式（--no-git）/);
  assert.equal(f.state().baseCommit, null);
  assert.equal(f.state().workBranch, undefined);
  absent(f, '.git');
}

// 6. --no-git 只用於非 Git 工作區；旗標只屬於 init。
{
  const f = fixture();
  assert.equal(f.git('init', '-q').status, 0);
  const r = f.run('init', 'demo', '--no-git');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--no-git 只用於非 Git 工作區/);
  absent(f, '.shiftblame');
  assert.equal(f.run('init', '--main', '--no-git').status, 2);
  assert.equal(f.run('state', '--no-git').status, 2);
}

// 7. 空的子資料夾不向上錨定到上層專案。
{
  const f = fixture();
  assert.equal(f.git('init', '-q').status, 0);
  const child = join(f.cwd, 'child');
  mkdirSync(child);
  const r = spawnSync(process.execPath, [cli, 'init', 'demo'], { cwd: child, env: withIdentity, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /目前資料夾是空的/);
  absent(f, '.shiftblame', 'child/.shiftblame');
}

// 8. 建庫中途失敗：移除本次建立的 .git 與 .gitignore，不留流程骨架。
{
  const f = fixture(gitConfig([['init.defaultBranch', 'bad..name'], ['user.name', 'fixture'], ['user.email', 'fixture@example.invalid']]));
  const r = f.run('init', 'demo');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /建立 Git 儲存庫失敗/);
  absent(f, '.git', '.gitignore', '.shiftblame');
}

// 9. 既有工作分支沿用；--no-git 以外的 born repo 照舊建立分支。
{
  const f = fixture();
  assert.equal(f.git('init', '-q').status, 0);
  writeFileSync(join(f.cwd, '.gitignore'), '.shiftblame/\n');
  assert.equal(f.git('add', '.gitignore').status, 0);
  assert.equal(f.git('commit', '-q', '-m', 'chore: base').status, 0);
  assert.equal(f.git('branch', 'feat/demo').status, 0);
  const r = f.run('init', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /開發分支：feat\/demo（已存在，切換過去）/);
  assert.equal(f.git('branch', '--show-current').stdout.trim(), 'feat/demo');
}

// 10. sb state 印出先行研究的比對基準：requirement 為 G1 定義區 hash，verify 為受驗 HEAD。
{
  const f = fixture();
  assert.equal(f.run('init', 'demo').status, 0);
  writeFileSync(join(f.cwd, '.shiftblame/demo/001/G1.md'), '# 需求\n定義內容\n## 回指記錄\n');
  const st = f.state();
  f.setState({ ...st, node: 'requirement' });
  const hash = createHash('sha256').update('# 需求\n定義內容\n', 'utf8').digest('hex');
  assert.match(f.run('state').stdout, new RegExp(`G1 定義區 hash（目前）：${hash}`));
  f.setState({ ...st, node: 'verify' });
  assert.match(f.run('state').stdout, new RegExp(`受驗提交（HEAD）：${f.git('rev-parse', 'HEAD').stdout.trim()}`));
  f.setState({ ...st, node: 'build' });
  assert.doesNotMatch(f.run('state').stdout, /先行研究筆記/, '其他段不印比對基準');
  // 上層已有進行中流程時，空子資料夾同樣先得到錨定提示，而不是上層的狀態錯誤。
  const child = join(f.cwd, 'fresh-child');
  mkdirSync(child);
  const r = spawnSync(process.execPath, [cli, 'init', 'other'], { cwd: child, env: withIdentity, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /目前資料夾是空的/);
  assert.deepEqual(f.state(), { ...st, node: 'build' }, '上層流程狀態不變');
}

// 11. 身分只寫在 includeIf "gitdir:" 條件設定：建庫後才檢查身分，空資料夾照常初始化。
{
  const env = gitConfig([['init.defaultBranch', 'trunk'], ['user.useConfigOnly', 'true']]);
  const f = fixture(env);
  const slash = (p) => p.replace(/\\/g, '/');
  const identityFile = join(root, 'identity.gitconfig');
  writeFileSync(identityFile, '[user]\n\tname = conditional\n\temail = conditional@example.invalid\n');
  env.GIT_CONFIG_GLOBAL = join(root, 'conditional-global.gitconfig');
  writeFileSync(env.GIT_CONFIG_GLOBAL, `[includeIf "gitdir/i:${slash(realpathSync(f.cwd))}/"]\n\tpath = ${slash(identityFile)}\n`);
  const r = f.run('init', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(f.git('log', '-1', '--format=%an', 'trunk').stdout.trim(), 'conditional', '起始提交採用條件設定的身分');
}

// 12. 非 Git 且尚無工作區的資料夾：查詢不建立 .shiftblame，其下子資料夾之後才不會向上錨定到這裡。
{
  const f = fixture();
  writeFileSync(join(f.cwd, 'notes.txt'), 'keep\n');
  const r = f.run('state');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /尚未初始化/);
  absent(f, '.shiftblame');
}

console.log('sb-init-bootstrap: pass');
