// sb-state-lock：狀態寫入的鎖與原子寫入——排他鎖、殘鎖清除、多程序讀改寫不遺失；sb 的狀態寫入命令在鎖被占用時明確失敗；
// hooks 紀錄另存 tmp，並行的 hook 與 sb 寫入互不覆蓋。
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireLock } from '../bin/state-io.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
const hook = resolve(here, '../../hooks/shiftblame-guard.mjs');
const stateIo = pathToFileURL(resolve(here, '../bin/state-io.mjs')).href;
const root = mkdtempSync(join(tmpdir(), 'sb-lock-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const exitOf = (child) => new Promise((res) => child.on('exit', (code) => res(code)));

// —— 1. 排他鎖：持有中再取會等到逾時；釋放後可再取；釋放函式只刪自己的鎖 ——
const file = join(root, 'counter.json');
const lock = `${file}.lock`;
let release = acquireLock(file, { waitMs: 100 });
assert.ok(release);
const t0 = Date.now();
assert.equal(acquireLock(file, { waitMs: 80 }), null, '持有中再次取鎖逾時回傳 null');
assert.ok(Date.now() - t0 >= 70, '逾時前持續等待');
release();
assert.equal(existsSync(lock), false, '釋放後鎖檔移除');
release = acquireLock(file, { waitMs: 50 });
assert.ok(release, '釋放後可再取得');
writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now(), token: 'other' }));
release();
assert.ok(existsSync(lock), '釋放函式不刪別人的鎖');
rmSync(lock);

// —— 2. 殘鎖：持有程序已結束、持有逾時、內容損毀且已存在一段時間 → 清除；剛建立的損毀鎖（內容寫入中）→ 等待 ——
const dead = spawnSync(process.execPath, ['-e', '']).pid;
for (const [label, setup] of [
  ['持有程序已結束', () => writeFileSync(lock, JSON.stringify({ pid: dead, at: Date.now(), token: 'x' }))],
  ['持有逾時', () => writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() - 120000, token: 'x' }))],
  ['內容損毀且已存在', () => { writeFileSync(lock, '{'); const old = new Date(Date.now() - 10000); utimesSync(lock, old, old); }],
]) {
  setup();
  const rel = acquireLock(file, { waitMs: 50, staleMs: 60000 });
  assert.ok(rel, `殘鎖清除：${label}`);
  rel();
}
writeFileSync(lock, '{');
assert.equal(acquireLock(file, { waitMs: 50 }), null, '剛建立、內容尚未寫入的鎖不當成殘鎖');
rmSync(lock);

// —— 3. 多程序在鎖下讀改寫：計數不遺失 ——
const worker = join(root, 'worker.mjs');
writeFileSync(worker, `import { readFileSync } from 'node:fs';
import { acquireLock, writeAtomic } from ${JSON.stringify(stateIo)};
const [file, times] = process.argv.slice(2);
const read = () => {
  for (let k = 0; ; k++) {
    try { return JSON.parse(readFileSync(file, 'utf8')).n; }
    catch (error) { if (error.code === 'ENOENT') return 0; if (k > 20) throw error; }
  }
};
for (let i = 0; i < Number(times); i++) {
  const release = acquireLock(file, { waitMs: 30000 });
  if (!release) process.exit(3);
  try { writeAtomic(file, JSON.stringify({ n: read() + 1 })); } finally { release(); }
}
`);
const K = 4, M = 40;
const codes = await Promise.all(Array.from({ length: K }, () => exitOf(spawn(process.execPath, [worker, file, String(M)], { stdio: 'inherit' }))));
assert.deepEqual(codes, Array(K).fill(0));
assert.equal(JSON.parse(readFileSync(file, 'utf8')).n, K * M, '並行讀改寫不遺失');

// —— 4. sb 的狀態寫入命令：flow-state 鎖被占用時明確失敗且不寫狀態；唯讀命令照常；結束時釋放鎖 ——
const repo = join(root, 'repo');
mkdirSync(repo);
const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
const sb = (args, env = {}) => spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...env } });
assert.equal(git('init', '-q').status, 0);
writeFileSync(join(repo, '.gitignore'), '.shiftblame/\n');
assert.equal(git('add', '.gitignore').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-q', '-m', 'test: initial').status, 0);
assert.equal(sb(['init', 'demo']).status, 0);
const statePath = join(repo, '.shiftblame', 'flow-state.json');
const before = readFileSync(statePath, 'utf8');
const held = acquireLock(statePath, { waitMs: 100 });
let r = sb(['sopreview', '已核對'], { SB_LOCK_WAIT_MS: '200' });
assert.equal(r.status, 1);
assert.match(r.stderr, /flow-state 正由另一個 sb 命令修改/);
assert.equal(readFileSync(statePath, 'utf8'), before, '取不到鎖就不寫狀態');
assert.equal(sb(['state']).status, 0, '唯讀命令不需要鎖');
held();
assert.equal(sb(['sopreview', '已核對']).status, 0, '鎖釋放後照常寫入');
assert.equal(existsSync(`${statePath}.lock`), false, 'sb 結束時釋放鎖');

// —— 5. hooks 與 sb 並行：hooks 的計數另存 tmp，sb 的審查紀錄不被覆蓋，並行的 hook 各自計數 ——
const N = 10;
const hookRun = () => {
  const c = spawn(process.execPath, [hook], { stdio: ['pipe', 'ignore', 'ignore'] });
  c.stdin.end(JSON.stringify({ cwd: repo, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(repo, 'x') } }));
  return exitOf(c);
};
const sbAsync = (args) => exitOf(spawn(process.execPath, [cli, ...args], { cwd: repo, stdio: 'ignore' }));
const results = await Promise.all([...Array.from({ length: N }, hookRun), sbAsync(['sopreview', '並行寫入核對'])]);
assert.deepEqual(results, Array(N + 1).fill(0));
assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).sopReview?.answers, '並行寫入核對', 'sb 的審查紀錄沒有被 hook 覆蓋');
const records = JSON.parse(readFileSync(join(repo, '.shiftblame', 'tmp', 'hook-records.json'), 'utf8'));
assert.equal(records.usageTotals.requests, N, '並行的 hook 各自計數');
assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).usageTotals, undefined, 'hook 不寫 flow-state');

console.log('sb-state-lock: pass');
