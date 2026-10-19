// sb-state-lock：紀錄寫入的鎖與原子寫入——排他鎖、殘鎖清除、多程序讀改寫不遺失；並行的 hook 各自計數。
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireLock } from '../bin/state-io.mjs';

const here = dirname(fileURLToPath(import.meta.url));
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

// —— 4. 並行的 hook 各自計數：hook 紀錄在鎖下讀改寫，不互相覆蓋 ——
const repo = join(root, 'repo');
mkdirSync(join(repo, '.shiftblame', 'tmp'), { recursive: true });
assert.equal(spawnSync('git', ['init', '-q'], { cwd: repo }).status, 0);
const N = 10;
const hookRun = () => {
  const c = spawn(process.execPath, [hook], { stdio: ['pipe', 'ignore', 'ignore'] });
  c.stdin.end(JSON.stringify({ cwd: repo, hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(repo, 'x') } }));
  return exitOf(c);
};
const results = await Promise.all(Array.from({ length: N }, hookRun));
assert.deepEqual(results, Array(N).fill(0));
const records = JSON.parse(readFileSync(join(repo, '.shiftblame', 'tmp', 'hook-records.json'), 'utf8'));
assert.equal(records.usageTotals.requests, N, '並行的 hook 各自計數');

console.log('sb-state-lock: pass');
