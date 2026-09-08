import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-init-'));
// 本測試只清理自己建立、位於系統暫存根內的絕對路徑。
process.on('exit', () => { assert.equal(resolve(root).startsWith(resolve(tmpdir()) + sep), true); rmSync(root, { recursive: true, force: true }); });
let serial = 0;
function fixture(raw) {
  const cwd = join(root, String(serial++));
  mkdirSync(join(cwd, '.shiftblame'), { recursive: true });
  const file = join(cwd, '.shiftblame/flow-state.json');
  if (raw !== undefined) writeFileSync(file, raw);
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { cwd, file, run };
}
const at = '2026-09-07T05:20:59.219Z';
const as = '理解：測試保留輸入與理解原值';
const record = {
  hooksHeartbeat: { at, event: 'SessionStart' },
  inputs: [{ at, text: '原始輸入\n保留換行' }],
  understandings: [{ at, uptoInput: 0, as, reviewed: false, hash: createHash('sha256').update('0' + as + at).digest('hex').slice(0, 16) }],
  externalEvidence: { done: true, at, tool: 'Agent' },
};
for (const initial of [undefined, { hooksHeartbeat: record.hooksHeartbeat }, record]) {
  const f = fixture(initial === undefined ? undefined : JSON.stringify(initial));
  if (initial) {
    const before = readFileSync(f.file, 'utf8');
    const diagnostic = f.run('state');
    assert.equal(diagnostic.status, 0, diagnostic.stderr);
    assert.match(diagnostic.stdout, /尚未初始化/);
    assert.equal(readFileSync(f.file, 'utf8'), before);
  }
  const r = f.run('init', 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(f.file, 'utf8')), { ...initial, slug: 'demo', ms: '001', node: 'intent', history: [] });
  assert.ok(existsSync(join(f.cwd, '.shiftblame/demo/SLUG.md')));
  assert.ok(existsSync(join(f.cwd, '.shiftblame/demo/001')));
  assert.ok(existsSync(join(f.cwd, '.shiftblame/archive')));
  assert.equal(f.run('state').status, 0);
  const before = readFileSync(f.file, 'utf8');
  assert.equal(f.run('init', 'other').status, 1);
  assert.equal(readFileSync(f.file, 'utf8'), before);
}
// hooks 相容工具紀錄皆可由 init 保留。
for (const tool of ['WebSearch', 'WebFetch', 'Agent', 'Task', 'mcp__web_reader__webReader', 'web.run', 'web__run', 'functions.web__run', 'spawn_agent', 'collaboration.spawn_agent', 'functions.spawn_agent', 'webrun', 'collaborationspawn_agent', 'collaborationfollowup_task']) {
  const initial = { ...record, externalEvidence: { done: true, at, tool } };
  const f = fixture(JSON.stringify(initial));
  assert.equal(f.run('init', 'demo').status, 0, tool);
  assert.deepEqual(JSON.parse(readFileSync(f.file, 'utf8')).externalEvidence, initial.externalEvidence);
}
const invalid = [
  { ...record, externalEvidence: { done: true, at, tool: 'functions.exec' } },
  { ...record, externalEvidence: { done: true, at, tool: 'web.runX' } },null, [], {}, { slug: null }, { node: 'mystery' }, { history: [] },
  { ...record, unknown: true }, { hooksHeartbeat: {} }, { inputs: 'bad' },
  { inputs: [{ at, text: 1 }] }, { inputs: [{ at: 'bad', text: 'x' }] },
  { hooksHeartbeat: { at: '2026-02-30T05:20:59.219Z', event: 'SessionStart' } },
  { ...record, understandings: [{ ...record.understandings[0], hash: 'bad' }] },
  { ...record, externalEvidence: { done: false, at, tool: 'Agent' } },
  { ...record, understandingHold: { at, inputIdx: 0 } },
  { slug: 'old', ms: '001', node: 'intent', history: [] },
  { slug: 'old', ms: '001', node: 'ended', history: [] }];
for (const raw of [...invalid.map(x => JSON.stringify(x)), '{broken']) {
  const f = fixture(raw);
  assert.equal(f.run('init', 'demo').status, 1, raw);
  assert.equal(readFileSync(f.file, 'utf8'), raw);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/demo')), false);
  const diagnostic = f.run('state');
  assert.doesNotMatch(diagnostic.stderr, /TypeError|SyntaxError|at cmdState/);
  assert.equal(readFileSync(f.file, 'utf8'), raw);
}
// 真實 end → 歸檔 → init 閉環，保留結束後的新紀錄而非整包繼承舊流程。
function endedFixture() {
  const f = fixture();
  assert.equal(f.run('init', 'old').status, 0);
  const st = JSON.parse(readFileSync(f.file, 'utf8'));
  writeFileSync(f.file, JSON.stringify({ ...st, node: 'done', adversarialAt: at, adversarialConsumed: false, rerunExtPending: true }));
  const end = f.run('end', '--boss-ok');
  assert.equal(end.status, 0, end.stderr);
  return f;
}
function archiveOld(f) {
  renameSync(join(f.cwd, '.shiftblame/old'), join(f.cwd, '.shiftblame/archive/old'));
  writeFileSync(join(f.cwd, '.shiftblame/archive/INDEX.md'), '2026-09-08 old 舊工作\n');
}
{
  const f = endedFixture();
  const beforeArchive = readFileSync(f.file, 'utf8');
  assert.match(f.run('state').stdout, /先完成收尾歸檔/);
  assert.equal(f.run('init', 'next').status, 1);
  assert.equal(readFileSync(f.file, 'utf8'), beforeArchive);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/next')), false);
  archiveOld(f);
  const oldDoc = readFileSync(join(f.cwd, '.shiftblame/archive/old/SLUG.md'), 'utf8');
  const review = join(f.cwd, '.shiftblame/tmp/review.md');
  writeFileSync(review, '對抗判定：通過\n');
  assert.equal(f.run('adversarial', review).status, 0, 'ended 收尾提交可留下新對抗紀錄');
  // end 已清空舊流，模擬其後由 hooks 寫入的新紀錄。
  writeFileSync(f.file, JSON.stringify({ ...JSON.parse(readFileSync(f.file, 'utf8')), ...record }));
  const before = readFileSync(f.file, 'utf8');
  assert.match(f.run('state').stdout, /下一步：.*sb init/);
  assert.equal(readFileSync(f.file, 'utf8'), before, 'state 唯讀');
  assert.equal(f.run('init', 'old').status, 1, '歸檔 slug 重名拒絕');
  mkdirSync(join(f.cwd, '.shiftblame/taken'));
  assert.equal(f.run('init', 'taken').status, 1, '工作路徑碰撞拒絕');
  assert.equal(readFileSync(f.file, 'utf8'), before);
  const r = f.run('init', 'next', 'fix');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(f.file, 'utf8')), { ...record, slug: 'next', ms: '001', node: 'intent', history: [] });
  assert.equal(readFileSync(join(f.cwd, '.shiftblame/archive/old/SLUG.md'), 'utf8'), oldDoc);
  assert.equal(readFileSync(join(f.cwd, '.shiftblame/archive/INDEX.md'), 'utf8'), '2026-09-08 old 舊工作\n');
  assert.ok(existsSync(join(f.cwd, '.shiftblame/next/001')));
  assert.equal(f.run('state').status, 0);
  assert.equal(f.run('commitmsg', 'fix: 新工作不可沿用舊對抗').status, 1);
}
for (const mutate of [
  st => ({ ...st, node: 'done' }),
  st => ({ ...st, node: 'build' }),
  st => ({ ...st, endedAt: 'bad' }),
  st => ({ ...st, slug: '../outside' }),
  st => ({ ...st, ms: null }),
  st => ({ ...st, history: [{}] }),
  st => ({ ...st, unknown: true }),
  st => ({ ...st, ...record, understandings: [{ ...record.understandings[0], hash: 'bad' }] }),
  st => ({ ...st, ...record, understandingHold: { at, inputIdx: 0 } }),
]) {
  const f = endedFixture();
  archiveOld(f);
  const raw = JSON.stringify(mutate(JSON.parse(readFileSync(f.file, 'utf8'))));
  writeFileSync(f.file, raw);
  assert.equal(f.run('init', 'next').status, 1, raw);
  assert.equal(readFileSync(f.file, 'utf8'), raw);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/next')), false);
}
// 僅刪除舊目錄而沒有歸檔，不會被當作已收尾。
{
  const f = endedFixture();
  renameSync(join(f.cwd, '.shiftblame/old'), join(f.cwd, '.shiftblame/misplaced'));
  const before = readFileSync(f.file, 'utf8');
  assert.match(f.run('state').stdout, /歸檔缺失/);
  assert.equal(f.run('init', 'next').status, 1);
  assert.equal(readFileSync(f.file, 'utf8'), before);
}
console.log('sb-init: 純紀錄、end→歸檔→init 閉環、碰撞與異常拒絕、唯讀診斷通過');
