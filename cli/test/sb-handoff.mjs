import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync,
  renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const at = '2026-09-25T00:00:00.000Z';
const ok = result => { assert.equal(result.status, 0, result.stderr || result.stdout); return result; };
const bad = (result, pattern) => { assert.equal(result.status, 1, result.stderr || result.stdout); if (pattern) assert.match(result.stderr, pattern); return result; };
function fixture(t, { initial = true, gitRepo = true } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'sb-handoff-'));
  t.after(() => {
    assert.ok(resolve(temp).startsWith(resolve(tmpdir()) + sep));
    rmSync(temp, { recursive: true, force: true });
  });
  const root = join(temp, 'repo'); mkdirSync(root);
  const git = (...args) => ok(spawnSync('git', args, { cwd: root, encoding: 'utf8' }));
  const runAt = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  const run = (...args) => runAt(root, ...args);
  const put = (path, body) => {
    const file = join(root, path);
    mkdirSync(resolve(file, '..'), { recursive: true }); writeFileSync(file, body); return file;
  };
  const notes = join(temp, 'notes.md'); writeFileSync(notes, '交接原文\r\n自由 Markdown；不強制模板。\r\n');
  const state = join(root, '.shiftblame/flow-state.json');
  const setState = value => put('.shiftblame/flow-state.json', typeof value === 'string' ? value : JSON.stringify(value));
  const path = task => join(root, '.shiftblame/tmp/main', task, 'handoff.json');
  const read = task => JSON.parse(readFileSync(path(task), 'utf8'));
  const save = (task = 'alpha', source = notes) => ok(run('handoff', 'save', task, source));
  const commit = message => git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', message);
  if (gitRepo) {
    git('init', '--initial-branch=main');
    git('config', 'core.autocrlf', 'false');
    git('config', 'core.hooksPath', join(temp, 'no-hooks'));
    if (initial) {
      put('.gitignore', '*.ignored\n'); put('product.txt', 'baseline\n');
      git('add', '.gitignore', 'product.txt'); commit('test fixture baseline');
    }
  }
  return { temp, root, notes, state, git, run, runAt, put, setState, path, read, save, commit };
}
const indexBytes = f => existsSync(join(f.root, '.git/index')) ? readFileSync(join(f.root, '.git/index')) : null;
function rehash(snapshot) {
  const { sha256: _old, ...body } = snapshot;
  snapshot.sha256 = hash(JSON.stringify(body));
  return snapshot;
}

test('fresh unborn roundtrip：原樣 notes、null HEAD、無 flow-state／索引寫入', t => {
  const f = fixture(t, { initial: false });
  writeFileSync(f.notes, '\ufeff# 任務\r\n  原樣內容\r\n');
  assert.equal(existsSync(join(f.root, '.shiftblame')), false);
  t.diagnostic(f.save('全新工作').stdout);
  const snapshot = f.read('全新工作');
  assert.equal(snapshot.schema, 1);
  assert.equal(snapshot.repoRoot, realpathSync(f.root));
  assert.equal(snapshot.branch, 'main'); assert.equal(snapshot.head, null);
  assert.equal(snapshot.notes, readFileSync(f.notes, 'utf8'));
  assert.equal(snapshot.notesSha256, hash(readFileSync(f.notes)));
  assert.deepEqual(snapshot.index.entries, []);
  assert.equal(existsSync(f.state), false); assert.equal(indexBytes(f), null);
  const shown = ok(f.run('handoff', 'show', '全新工作')).stdout;
  t.diagnostic(shown);
  assert.match(shown, /指紋相同/); assert.match(shown, /null（初始無提交）/);
  assert.ok(shown.includes(snapshot.notes)); assert.match(shown, /snapshot 不是授權/);
  const listed = ok(f.run('handoff', 'list')).stdout;
  t.diagnostic(listed);
  assert.match(listed, /全新工作/);
  assert.equal(existsSync(f.state), false); assert.equal(indexBytes(f), null);
  assert.equal(existsSync(join(f.root, '.shiftblame/tmp/sb-usage.jsonl')), false);
});

test('dirty roundtrip 與兩個具名 task 各自保存；快照只含檔案路徑與指紋', t => {
  const f = fixture(t);
  f.put('product.txt', 'private-product-content-934857\n');
  f.put('new.txt', 'private-untracked-content-72983\n');
  const beforeIndex = indexBytes(f), head = f.git('rev-parse', 'HEAD').stdout;
  f.save('alpha'); const original = readFileSync(f.path('alpha'));
  assert.match(ok(f.run('handoff', 'show', 'alpha')).stdout, /指紋相同/);
  assert.equal(f.read('alpha').status.length, 2);
  writeFileSync(f.notes, '第二項工作\n'); f.save('beta');
  assert.deepEqual(readFileSync(f.path('alpha')), original);
  assert.equal(f.read('beta').notes, '第二項工作\n');
  const listed = ok(f.run('handoff', 'list')).stdout;
  assert.match(listed, /alpha/); assert.match(listed, /beta/);
  assert.doesNotMatch(original.toString(), /private-product-content|private-untracked-content|bossOk|g1Contract|concludedAt/);
  assert.deepEqual(indexBytes(f), beforeIndex);
  assert.equal(f.git('rev-parse', 'HEAD').stdout, head);
  assert.equal(f.git('branch', '--show-current').stdout.trim(), 'main');
  assert.equal(readFileSync(join(f.root, 'product.txt'), 'utf8'), 'private-product-content-934857\n');
  assert.equal(existsSync(f.state), false);
});

test('同樣 M 狀態與同樣長度的內容漂移仍可辨識，後續 save 原子更新', t => {
  const f = fixture(t);
  f.put('product.txt', 'changed-A\n'); f.save();
  const before = f.read('alpha');
  f.put('product.txt', 'changed-B\n');
  const shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.match(shown, /worktree: 差異/); assert.match(shown, /變更 "product.txt"/);
  assert.match(shown, /dirty: 保存 1 筆 → 目前 1 筆/); assert.match(shown, /差異需.*語義核對/);
  assert.deepEqual(f.read('alpha'), before, 'show 不改快照');
  f.save(); assert.notEqual(f.read('alpha').worktree.sha256, before.worktree.sha256);
  assert.match(ok(f.run('handoff', 'show', 'alpha')).stdout, /指紋相同/);
  assert.deepEqual(readdirSync(resolve(f.path('alpha'), '..')), ['handoff.json']);
});

test('stage／unstage 個別報索引差異且 show 不刷新 index', t => {
  const f = fixture(t); f.put('product.txt', 'staged edit\n'); f.save();
  f.git('add', 'product.txt');
  let bytes = indexBytes(f);
  let shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.match(shown, /index: 差異/); assert.match(shown, /worktree: 相同/);
  assert.deepEqual(indexBytes(f), bytes);
  f.save(); f.git('reset', 'HEAD', '--', 'product.txt');
  bytes = indexBytes(f); shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.match(shown, /index: 差異/); assert.deepEqual(indexBytes(f), bytes);
});

test('untracked 內容漂移、刪除及新增；ignored 與所有 .shiftblame 觀測不干擾', t => {
  const f = fixture(t); f.put('draft.txt', 'draft A\n'); f.put('cache.ignored', 'ignored A\n');
  f.put('.shiftblame/tmp/source.md', '# tmp notes\n');
  f.save('alpha', '.shiftblame/tmp/source.md');
  assert.deepEqual(f.read('alpha').untracked.entries.map(entry => entry.path), ['draft.txt']);
  f.put('cache.ignored', 'ignored B\n'); f.put('.shiftblame/tmp/sb-usage.jsonl', '{}\n');
  f.put('.shiftblame/tmp/arbitrary.log', 'changed\n');
  f.setState({ hooksHeartbeat: { at, event: 'SessionStart' } });
  assert.match(ok(f.run('handoff', 'show', 'alpha')).stdout, /指紋相同/);
  f.put('draft.txt', 'draft B\n');
  assert.match(ok(f.run('handoff', 'show', 'alpha')).stdout, /untracked: 差異\n  變更 "draft.txt"/);
  rmSync(join(f.root, 'draft.txt')); f.put('new draft.txt', 'new\n');
  const shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.match(shown, /移除 "draft.txt"/); assert.match(shown, /新增 "new draft.txt"/);
});

test('誤追蹤的 .shiftblame 觀測內容與索引也排除', t => {
  const f = fixture(t);
  f.put('.shiftblame/tmp/observed.log', 'v1\n'); f.git('add', '.shiftblame/tmp/observed.log'); f.save();
  f.put('.shiftblame/tmp/observed.log', 'v2\n'); f.git('add', '.shiftblame/tmp/observed.log');
  assert.match(ok(f.run('handoff', 'show', 'alpha')).stdout, /指紋相同/);
  for (const key of ['index', 'worktree', 'untracked']) assert.ok(f.read('alpha')[key].entries.every(entry => !entry.path.startsWith('.shiftblame/')));
});

test('僅排除根目錄小寫 .shiftblame；大小寫不同的索引路徑及巢狀同名目錄仍查證', t => {
  const f = fixture(t);
  f.put('.shiftblame/tmp/draft.md', 'observations\n');
  f.put('.SHIFTBLAME/product.txt', 'case-sensitive product A\n');
  f.put('src/.shiftblame/product.txt', 'nested product A\n');
  const blob = f.git('rev-parse', 'HEAD:product.txt').stdout.trim();
  // Git 的索引路徑保留大小寫；此案例也能在 Windows 檔案系統驗證不遺漏索引輸入。
  f.git('update-index', '--add', '--cacheinfo', '100644', blob, '.SHIFTBLAME/product.txt');
  f.save();
  assert.ok(f.read('alpha').worktree.entries.some(entry => entry.path === '.SHIFTBLAME/product.txt'));
  assert.ok(f.read('alpha').untracked.entries.some(entry => entry.path === 'src/.shiftblame/product.txt'));
  f.put('.SHIFTBLAME/product.txt', 'case-sensitive product B\n');
  f.put('src/.shiftblame/product.txt', 'nested product B\n');
  const shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.match(shown, /worktree: 差異/);
  assert.match(shown, /變更 ".SHIFTBLAME\/product.txt"/);
  assert.match(shown, /變更 "src\/.shiftblame\/product.txt"/);
});

test('branch／HEAD 漂移顯示但不切回；detached 可診斷而不可 save', t => {
  const f = fixture(t); f.save(); const original = readFileSync(f.path('alpha'));
  const head = f.read('alpha').head;
  f.git('checkout', '-b', 'authorized-direct');
  f.put('product.txt', 'second commit\n'); f.git('add', 'product.txt'); f.commit('test fixture next');
  let shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.match(shown, /branch: 保存 main → 目前 authorized-direct/);
  assert.ok(shown.includes(`HEAD: 保存 ${head} → 目前 ${f.git('rev-parse', 'HEAD').stdout.trim()}`));
  assert.equal(f.git('branch', '--show-current').stdout.trim(), 'authorized-direct');
  f.save('other-branch'); assert.equal(f.read('other-branch').branch, 'authorized-direct');
  f.git('checkout', '--detach');
  bad(f.run('handoff', 'save', 'alpha', f.notes), /detached HEAD/);
  assert.deepEqual(readFileSync(f.path('alpha')), original);
  shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.match(shown, /目前 detached HEAD/); ok(f.run('handoff', 'list'));
});

test('狀態白名單保存，active／invalid／未完結 ended 拒絕且保護 flow 與舊快照', t => {
  const f = fixture(t); f.save();
  const ended = { slug: 'old', ms: '001', node: 'ended', endedAt: at };
  const allowed = [{ hooksHeartbeat: { at, event: 'SessionStart' } }, {}, { slug: null, ms: null, node: null }, { ...ended, concludedAt: at }];
  for (const state of allowed) {
    f.setState(state); const bytes = readFileSync(f.state); f.save();
    assert.deepEqual(readFileSync(f.state), bytes); assert.match(ok(f.run('state')).stdout, /sb handoff list/);
  }
  const original = readFileSync(f.path('alpha'));
  for (const state of [{ slug: 'demo', ms: '001', node: 'build' }, { ...ended }, { ...ended, concludedAt: 'broken' }, '{broken', { slug: null }]) {
    f.setState(state); const bytes = readFileSync(f.state);
    bad(f.run('handoff', 'save', 'alpha', f.notes), /拒絕/);
    assert.deepEqual(readFileSync(f.path('alpha')), original); assert.deepEqual(readFileSync(f.state), bytes);
    ok(f.run('handoff', 'show', 'alpha')); ok(f.run('handoff', 'list'));
  }
  f.setState({}); f.put('.shiftblame/orphan/001/G1.md', '正式需求不可碰\n');
  bad(f.run('handoff', 'save', 'alpha', f.notes), /invalid/);
  assert.equal(readFileSync(join(f.root, '.shiftblame/orphan/001/G1.md'), 'utf8'), '正式需求不可碰\n');
});

test('空白／缺失／無效 UTF-8 notes 失敗保舊；不強迫 notes 格式', t => {
  const f = fixture(t); f.save(); const before = readFileSync(f.path('alpha'));
  for (const value of ['', ' \r\n\t', Buffer.from([0xff])]) {
    writeFileSync(f.notes, value); bad(f.run('handoff', 'save', 'alpha', f.notes));
    assert.deepEqual(readFileSync(f.path('alpha')), before);
  }
  bad(f.run('handoff', 'save', 'alpha', join(f.temp, 'missing.md')), /ENOENT/);
  bad(f.run('handoff', 'save', 'alpha', f.path('alpha')), /來源不可與輸出/);
  assert.deepEqual(readFileSync(f.path('alpha')), before);
  assert.deepEqual(readdirSync(resolve(f.path('alpha'), '..')), ['handoff.json']);
  writeFileSync(f.notes, 'x'); f.save(); assert.equal(f.read('alpha').notes, 'x');
});

test('大份 notes 透過 stdout 管線仍完整輸出', t => {
  const f = fixture(t);
  const notes = '原樣 Markdown\r\n'.repeat(14000) + 'END-OF-NOTES';
  writeFileSync(f.notes, notes); f.save();
  const shown = ok(f.run('handoff', 'show', 'alpha')).stdout;
  assert.ok(shown.endsWith(notes + '\n'));
});

test('snapshot schema、notes/hash、路徑、repo 身份損壞均明確失敗；list 繼續顯示有效 task', t => {
  const f = fixture(t); f.save(); f.save('healthy'); const original = f.read('alpha');
  const mutations = [
    s => { s.schema = 7; }, s => { s.notes += 'changed'; }, s => { s.sha256 = '0'.repeat(64); },
    s => { s.repoRoot = f.temp; rehash(s); }, s => { s.task = 'healthy'; rehash(s); },
    s => { s.worktree.entries[0].path = '../escape'; s.worktree.sha256 = hash(JSON.stringify(s.worktree.entries)); rehash(s); },
    s => { s.index.entries[0].oid = 'wrong'; s.index.sha256 = hash(JSON.stringify(s.index.entries)); rehash(s); },
    s => { s.status = [{ path: '.shiftblame/tmp/notes.md', xy: '??' }]; rehash(s); },
    s => { s.bossOk = true; rehash(s); },
  ];
  for (const mutate of mutations) {
    const broken = structuredClone(original); mutate(broken); writeFileSync(f.path('alpha'), JSON.stringify(broken));
    bad(f.run('handoff', 'show', 'alpha'), /損壞|不相符/);
    const listed = bad(f.run('handoff', 'list'), /alpha/); assert.match(listed.stdout, /healthy/);
    const bytes = readFileSync(f.path('alpha')); bad(f.run('handoff', 'save', 'alpha', f.notes));
    assert.deepEqual(readFileSync(f.path('alpha')), bytes);
  }
  writeFileSync(f.path('alpha'), '{broken'); bad(f.run('handoff', 'show', 'alpha'), /JSON/);
  rmSync(f.path('alpha')); bad(f.run('handoff', 'show', 'alpha'), /不存在/);
  assert.match(bad(f.run('handoff', 'list'), /alpha/).stdout, /healthy/);
});

test('缺失 list／show 不猜最新且不建立觀測目錄；固定用法與 help', t => {
  const f = fixture(t);
  bad(f.run('handoff', 'list'), /不存在/); bad(f.run('handoff', 'show', 'unknown'), /不存在/);
  assert.equal(existsSync(join(f.root, '.shiftblame')), false);
  for (const args of [[], ['show'], ['save', 'alpha'], ['list', 'alpha'], ['show', 'alpha', 'extra'], ['save', 'alpha', f.notes, '--boss-ok']]) {
    assert.equal(f.run('handoff', ...args).status, 2);
  }
  f.save(); bad(f.run('handoff', 'show', 'missing'), /不存在/);
  const help = ok(f.run('--help')).stdout;
  for (const text of ['sb handoff save <task> <notes.md>', 'sb handoff list', 'sb handoff show <task>']) assert.ok(help.includes(text));
});

test('task 越界、Windows 保留名與尾點拒絕，外部 notes 只讀', t => {
  const f = fixture(t); const bytes = readFileSync(f.notes);
  for (const task of ['../escape', '..', '/absolute', 'a/b', 'a\\b', 'C:escape', 'CON', 'con.md', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT9.txt', 'COM¹', 'name.', 'trailing ', '-task']) {
    bad(f.run('handoff', 'save', task, f.notes), /task/);
    bad(f.run('handoff', 'show', task), /task/);
  }
  assert.equal(existsSync(join(f.root, '.shiftblame')), false);
  f.save('named.task_2'); assert.deepEqual(readFileSync(f.notes), bytes);
  assert.equal(existsSync(join(f.temp, 'escape')), false);
});

function linkOrSkip(t, target, path, directory = true) {
  try { symlinkSync(target, path, directory ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file'); return true; }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip(`目前環境不能建立符號連結：${error.code}`); return false; } throw error; }
}
for (const parts of [['.shiftblame'], ['.shiftblame', 'tmp'], ['.shiftblame', 'tmp', 'main'], ['.shiftblame', 'tmp', 'main', 'alpha']]) {
  test(`拒絕外指目錄 ${parts.join('/')}，讀寫皆不穿越`, t => {
    const f = fixture(t); const external = join(f.temp, 'outside'); mkdirSync(external);
    const target = join(f.root, ...parts); mkdirSync(resolve(target, '..'), { recursive: true });
    if (!linkOrSkip(t, external, target)) return;
    bad(f.run('handoff', 'save', 'alpha', f.notes), /不安全/);
    bad(f.run('handoff', 'show', 'alpha'), /不安全/);
    bad(f.run('handoff', 'list'), /不安全/);
    assert.deepEqual(readdirSync(external), [], '包括遙測也不得寫到外部目錄');
  });
}
test('snapshot 檔案連結與 dangling 連結均拒絕', t => {
  const f = fixture(t); f.save(); const external = join(f.temp, 'outside.json');
  renameSync(f.path('alpha'), external);
  if (!linkOrSkip(t, external, f.path('alpha'), false)) return;
  const bytes = readFileSync(external);
  bad(f.run('handoff', 'save', 'alpha', f.notes), /不安全/); bad(f.run('handoff', 'show', 'alpha'), /不安全/);
  assert.deepEqual(readFileSync(external), bytes);
  rmSync(external); bad(f.run('handoff', 'show', 'alpha'), /不安全/);
});

test('子目錄內有 .shiftblame 仍由 Git 定位 canonical repo，notes 相對 cwd', t => {
  const f = fixture(t); const sub = join(f.root, 'src/deep'); mkdirSync(join(sub, '.shiftblame'), { recursive: true });
  writeFileSync(join(sub, 'notes.md'), '子目錄來源\n');
  const index = indexBytes(f);
  ok(f.runAt(sub, 'handoff', 'save', 'alpha', 'notes.md'));
  assert.equal(f.read('alpha').repoRoot, realpathSync(f.root));
  assert.equal(f.read('alpha').notes, '子目錄來源\n');
  assert.equal(existsSync(join(sub, '.shiftblame/tmp')), false);
  ok(f.runAt(sub, 'handoff', 'show', 'alpha')); ok(f.runAt(sub, 'handoff', 'list'));
  assert.deepEqual(indexBytes(f), index);
});

test('繼承的 Git repo／index 環境覆寫不混用其他工作的事實', t => {
  const f = fixture(t), other = fixture(t);
  other.git('checkout', '-b', 'foreign-branch');
  other.put('foreign.txt', 'other repository\n'); other.git('add', 'foreign.txt'); other.commit('foreign work');
  const expected = f.git('rev-parse', 'HEAD').stdout.trim(), beforeIndex = indexBytes(f);
  for (const lower of [false, true]) {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|OPTIONAL_LOCKS)$/i.test(key)) delete env[key];
    const key = name => lower ? name.toLowerCase() : name;
    env[key('GIT_DIR')] = join(other.root, '.git');
    env[key('GIT_INDEX_FILE')] = join(other.root, '.git/index');
    env[key('GIT_OPTIONAL_LOCKS')] = '1';
    const task = lower ? 'lowercase-env' : 'uppercase-env';
    ok(spawnSync(process.execPath, [cli, 'handoff', 'save', task, f.notes], { cwd: f.root, env, encoding: 'utf8' }));
    const snapshot = f.read(task);
    assert.equal(snapshot.repoRoot, realpathSync(f.root));
    assert.equal(snapshot.branch, 'main'); assert.equal(snapshot.head, expected);
    assert.equal(snapshot.index.entries.some(entry => entry.path === 'foreign.txt'), false);
    assert.equal(existsSync(other.path(task)), false);
    assert.deepEqual(indexBytes(f), beforeIndex);
  }
});

test('非 Git 工作區與損壞 HEAD 拒絕 save，不產生成功快照', t => {
  const f = fixture(t, { gitRepo: false });
  bad(f.run('handoff', 'save', 'alpha', f.notes), /Git 無法查證/);
  assert.equal(existsSync(join(f.root, '.shiftblame')), false);
  const g = fixture(t); g.save(); const before = readFileSync(g.path('alpha'));
  writeFileSync(join(g.root, '.git/refs/heads/main'), '0'.repeat(40) + '\n');
  bad(g.run('handoff', 'save', 'alpha', g.notes), /Git 無法查證|HEAD 無法查證/);
  assert.deepEqual(readFileSync(g.path('alpha')), before);
});

test('同 task 並行保存明確拒絕覆蓋，舊快照在 pending／lock 期間仍完整可讀', async t => {
  const f = fixture(t); f.save(); const before = readFileSync(f.path('alpha'));
  // 真實大檔使第一個 CLI 在鎖內停留足夠時間；不替換 CLI 模組或注入測試旗標。
  f.put('large.bin', Buffer.alloc(48 * 1024 * 1024, 7));
  const child = spawn(process.execPath, [cli, 'handoff', 'save', 'alpha', f.notes], { cwd: f.root, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  const completed = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', status => resolve({ status, stdout, stderr })); });
  const lock = join(resolve(f.path('alpha'), '..'), '.save.lock');
  const deadline = Date.now() + 15000;
  while (!existsSync(lock) && child.exitCode === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(existsSync(lock), '第一個公開 CLI 已取得同 task 鎖');
  assert.deepEqual(readFileSync(f.path('alpha')), before);
  bad(f.run('handoff', 'save', 'alpha', f.notes), /正在保存|save.lock/);
  ok(await completed);
  assert.ok(f.read('alpha').untracked.entries.some(entry => entry.path === 'large.bin'));
  assert.equal(existsSync(lock), false);
  // 失去原程序的鎖不會被自動猜測為可覆寫。
  const after = readFileSync(f.path('alpha')); writeFileSync(lock, '');
  bad(f.run('handoff', 'save', 'alpha', f.notes), /save.lock/);
  assert.deepEqual(readFileSync(f.path('alpha')), after);
  ok(f.run('handoff', 'show', 'alpha')); ok(f.run('handoff', 'list'));
});

test('原子保存成功後鎖檔清理失敗：回報成功與殘留警告，快照仍可讀', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(t); f.save();
  f.put('large.bin', Buffer.alloc(48 * 1024 * 1024, 6));
  writeFileSync(f.notes, '已成功保存的新交接\n');
  // 以真實 Windows handle 允許讀寫但禁止刪除，不替換檔案 API 或注入 CLI 測試模式。
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = $env:SB_TEST_NODE
$start.WorkingDirectory = $env:SB_TEST_ROOT
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$start.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$start.StandardErrorEncoding = [System.Text.Encoding]::UTF8
$start.Arguments = '"' + $env:SB_TEST_CLI + '" handoff save alpha "' + $env:SB_TEST_NOTES + '"'
$child = New-Object System.Diagnostics.Process
$child.StartInfo = $start
[void]$child.Start()
$out = $child.StandardOutput.ReadToEndAsync()
$err = $child.StandardError.ReadToEndAsync()
$watch = [System.Diagnostics.Stopwatch]::StartNew()
$held = $null
try {
  while (-not $child.HasExited -and $watch.ElapsedMilliseconds -lt 15000 -and $null -eq $held) {
    if ([System.IO.File]::Exists($env:SB_TEST_LOCK)) {
      try { $held = [System.IO.File]::Open($env:SB_TEST_LOCK, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite) } catch {}
    }
    if ($null -eq $held) { Start-Sleep -Milliseconds 2 }
  }
  if ($null -eq $held) { throw 'Did not acquire the real lock handle' }
  if (-not $child.WaitForExit(20000)) { throw 'Save timed out' }
  @{ status = $child.ExitCode; stdout = $out.Result; stderr = $err.Result } | ConvertTo-Json -Compress
} finally {
  if ($null -ne $held) { $held.Dispose() }
  if (-not $child.HasExited) { $child.Kill(); $child.WaitForExit() }
  $child.Dispose()
}`;
  const lock = join(resolve(f.path('alpha'), '..'), '.save.lock');
  const probe = ok(spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    env: { ...process.env, SB_TEST_NODE: process.execPath, SB_TEST_ROOT: f.root, SB_TEST_CLI: cli, SB_TEST_NOTES: f.notes, SB_TEST_LOCK: lock },
    encoding: 'utf8', windowsHide: true, timeout: 45000,
  }));
  const saved = ok(JSON.parse(probe.stdout.trim()));
  assert.match(saved.stdout, /handoff 已保存/);
  assert.match(saved.stderr, /交接已保存.*清理失敗/);
  assert.doesNotMatch(saved.stderr, /FAIL/);
  assert.equal(f.read('alpha').notes, '已成功保存的新交接\n');
  assert.equal(existsSync(lock), true);
  assert.match(ok(f.run('handoff', 'show', 'alpha')).stdout, /指紋相同/);
  bad(f.run('handoff', 'save', 'alpha', f.notes), /save.lock/);
  rmSync(lock); f.save();
});

for (const change of ['active', 'pending']) test(`pending 已落檔後 ${change} 改動：拒絕替換並清理 pending，原快照完整保留`, async t => {
  const f = fixture(t); f.save(); const before = readFileSync(f.path('alpha'));
  f.put('large.bin', Buffer.alloc(48 * 1024 * 1024, 8));
  const child = spawn(process.execPath, [cli, 'handoff', 'save', 'alpha', f.notes], { cwd: f.root, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  const completed = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', status => resolve({ status, stdout, stderr })); });
  const dir = resolve(f.path('alpha'), '..'), deadline = Date.now() + 15000;
  while (!readdirSync(dir).some(name => name.endsWith('.pending')) && child.exitCode === null && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(readdirSync(dir).some(name => name.endsWith('.pending')), '已觀察到真實 pending 檔');
  assert.deepEqual(readFileSync(f.path('alpha')), before);
  if (change === 'active') f.setState({ slug: 'new-work', ms: '001', node: 'build' });
  else writeFileSync(join(dir, readdirSync(dir).find(name => name.endsWith('.pending'))), '{broken');
  bad(await completed, /active|pending|快照損壞/);
  assert.deepEqual(readFileSync(f.path('alpha')), before);
  assert.deepEqual(readdirSync(dir), ['handoff.json']);
});
