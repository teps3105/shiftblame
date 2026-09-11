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
  const initialized = JSON.parse(readFileSync(f.file, 'utf8'));
  const { startedAt, baseCommit, ...rest } = initialized;
  assert.deepEqual(rest, { ...initial, slug: 'demo', ms: '001', node: 'intent', history: [] });
  assert.match(startedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, 'init 錨定流程起始時間（遙測耗時基準）');
  assert.equal(baseCommit, null, '非 git 工作區 baseline 記 null（遙測 diff 缺省）');
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
  const reinitialized = JSON.parse(readFileSync(f.file, 'utf8'));
  const { startedAt: reStartedAt, ...reRest } = reinitialized;
  assert.deepEqual(reRest, { ...record, slug: 'next', ms: '001', node: 'intent', history: [], baseCommit: null });
  assert.match(reStartedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(readFileSync(join(f.cwd, '.shiftblame/archive/old/SLUG.md'), 'utf8'), oldDoc);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/archive/INDEX.md')), false, '歸檔清單機制已除——archive 僅承載 slug 目錄');
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
// 有效 Git 忽略來源與換行：已忽略時逐位元保留，未忽略才追加。
for (const spec of [
  { name: 'LF', before: '# rules\n.shiftblame/\n' },
  { name: 'CRLF', before: '# rules\r\n.shiftblame/\r\n' },
  { name: 'root prefix', before: '/.shiftblame/\r\n' },
  { name: 'no final newline', before: '.shiftblame/' },
  { name: 'info exclude', before: '# unrelated\r\n', info: '.shiftblame/\n' },
  { name: 'info without gitignore', info: '.shiftblame/\n' },
  { name: 'global exclude', before: '# unrelated\n', global: '.shiftblame/\n' },
  { name: 'global without gitignore', global: '.shiftblame/\n' },
  { name: 'glob', before: '.shift*/\n' },
  { name: 'missing', after: '.shiftblame/\n' },
  { name: 'append CRLF', before: '# rules\r\nother', after: '# rules\r\nother\r\n.shiftblame/\r\n' },
  { name: 'negated', before: '.shiftblame/\n!.shiftblame/\n', after: '.shiftblame/\n!.shiftblame/\n.shiftblame/\n' },
  { name: 'comment', before: '# .shiftblame/\n', after: '# .shiftblame/\n.shiftblame/\n' },
]) {
  const f = fixture();
  const git = (...args) => spawnSync('git', ['-C', f.cwd, ...args], { encoding: 'utf8' });
  assert.equal(git('init').status, 0);
  const excludes = join(f.cwd, 'global-ignore');
  writeFileSync(excludes, spec.global ?? '');
  assert.equal(git('config', 'core.excludesFile', excludes).status, 0);
  if (spec.info) writeFileSync(join(f.cwd, '.git/info/exclude'), spec.info);
  const gi = join(f.cwd, '.gitignore');
  if (spec.before !== undefined) writeFileSync(gi, spec.before);
  const run = f.run('init', 'demo');
  assert.equal(run.status, 0, spec.name + run.stderr);
  const expected = spec.after ?? spec.before;
  if (expected === undefined) assert.equal(existsSync(gi), false, spec.name);
  else assert.deepEqual(readFileSync(gi), Buffer.from(expected), spec.name);
  assert.equal(git('check-ignore', '--quiet', '--', '.shiftblame/').status, 0, spec.name);
}
// Git 失敗不能冒充未忽略；已追蹤檔案的索引也不由 init 改動。
for (const broken of [false, true]) {
  const f = fixture();
  const git = (...args) => spawnSync('git', ['-C', f.cwd, ...args], { encoding: 'utf8' });
  assert.equal(git('init').status, 0);
  const gi = join(f.cwd, '.gitignore');
  const original = broken ? '# keep\r\n' : '.shiftblame/\r\n';
  writeFileSync(gi, original);
  writeFileSync(join(f.cwd, '.shiftblame/tracked.txt'), 'keep index');
  assert.equal(git('add', '-f', '.shiftblame/tracked.txt').status, 0);
  const indexBefore = readFileSync(join(f.cwd, '.git/index'));
  if (broken) writeFileSync(join(f.cwd, '.git/config'), '[broken');
  const run = f.run('init', 'demo');
  assert.equal(run.status, 0, run.stderr);
  if (broken) assert.match(run.stdout, /Git 查詢失敗/);
  assert.deepEqual(readFileSync(gi), Buffer.from(original));
  if (broken) assert.deepEqual(readFileSync(join(f.cwd, '.git/index')), indexBefore);
  else assert.equal(git('ls-files', '.shiftblame/tracked.txt').stdout.trim(), '.shiftblame/tracked.txt');
}
for (const original of ['.shiftblame/\r\n', '/.shiftblame/\n', '# rules\r\n.shiftblame/']) {
  const f = fixture();
  writeFileSync(join(f.cwd, '.gitignore'), original);
  assert.equal(f.run('init', 'demo').status, 0);
  assert.deepEqual(readFileSync(join(f.cwd, '.gitignore')), Buffer.from(original));
}
console.log('sb-init: 初始化閉環、拒絕邊界、Git 忽略來源與原檔保留通過');
