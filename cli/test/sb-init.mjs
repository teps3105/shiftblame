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
const record = {
  hooksHeartbeat: { at, event: 'SessionStart' },
};
for (const initial of [undefined, record]) {
  const f = fixture(initial === undefined ? undefined : JSON.stringify(initial));
  if (initial) {
    const before = readFileSync(f.file, 'utf8');
    const diagnostic = f.run('state');
    assert.equal(diagnostic.status, 0, diagnostic.stderr);
    assert.match(diagnostic.stdout, /尚未初始化/);
    assert.equal(readFileSync(f.file, 'utf8'), before);
  }
  const r = f.run('init', 'demo', '--no-git');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /非 Git 模式（--no-git）/);
  const initialized = JSON.parse(readFileSync(f.file, 'utf8'));
  const { startedAt, baseCommit, ...rest } = initialized;
  assert.deepEqual(rest, { ...initial, slug: 'demo', ms: '001', node: 'intent' });
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
// 殘留 externalEvidence（外部性閘已除——2.7.2）隨 init 寫回剝除，hooks 紀錄本體保留。
{
  const initial = { ...record, externalEvidence: { done: true, at, tool: 'Agent' } };
  const f = fixture(JSON.stringify(initial));
  assert.equal(f.run('init', 'demo', '--no-git').status, 0);
  const st = JSON.parse(readFileSync(f.file, 'utf8'));
  assert.equal(st.externalEvidence, undefined, '殘留外部證據鍵隨 init 剝除（機械綁定已移除）');
  assert.deepEqual(st.hooksHeartbeat, initial.hooksHeartbeat, 'hooks 紀錄本體由 init 保留');
}
// 純紀錄檔含 2.0x 老流鍵（stamps／unlockLog）——讀取端 migrateStreams 剝除後歸 direct 態：init 成功、寫回即瘦身（舊鍵零殘留）。
{
  const f = fixture(JSON.stringify({ slug: null, ms: null, node: null, stamps: {}, unlockLog: [] }));
  assert.equal(f.run('init', 'demo', '--no-git').status, 0);
  const st = JSON.parse(readFileSync(f.file, 'utf8'));
  assert.equal(st.stamps, undefined, 'stamps 隨 init 剝除');
  assert.equal(st.unlockLog, undefined, 'unlockLog 隨 init 剝除');
  assert.equal(st.slug, 'demo');
}
const invalid = [
  null, [], { slug: null }, { node: 'mystery' },
  { ...record, unknown: true }, { hooksHeartbeat: {} }, { turnUsage: 'bad' },
  { turnUsage: { startedAt: 'bad' } },
  { hooksHeartbeat: { at: '2026-02-30T05:20:59.219Z', event: 'SessionStart' } },
  { slug: 'old', ms: '001', node: 'intent' },
  { slug: 'old', ms: '001', node: 'ended' }];
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
  assert.equal(f.run('init', 'old', '--no-git').status, 0);
  const st = JSON.parse(readFileSync(f.file, 'utf8'));
  // 出口時序：時點 2 對抗條目（lastAdv 定長欄位）＋--boss-ok 旗標即章（2.5.2——機械不驗時戳，語義由對話揭露＋老闆終審承擔）
  const t0 = Date.parse(st.startedAt);
  const advAt = new Date(t0 + 60_000).toISOString();
  writeFileSync(f.file, JSON.stringify({ ...st, node: 'verify', lastAdv: { '2': { at: advAt, report: '.shiftblame/tmp/r3.md', verdict: '通過', node: 'verify' } } }));
  const end = f.run('end', '--adversarial', '--boss-ok');
  assert.equal(end.status, 0, end.stderr);
  return f;
}
{
  const f = endedFixture();
  // sb end 已機械化歸檔移動（聲稱與實做一致）：slug 目錄實際移至 archive/
  assert.ok(existsSync(join(f.cwd, '.shiftblame/archive/old/SLUG.md')), 'end 實際執行歸檔移動');
  assert.equal(existsSync(join(f.cwd, '.shiftblame/old')), false, '原位已移出');
  const oldDoc = readFileSync(join(f.cwd, '.shiftblame/archive/old/SLUG.md'), 'utf8');
  const review = join(f.cwd, '.shiftblame/tmp/review.md');
  writeFileSync(review, '對抗判定：通過\n');
  assert.equal(f.run('adversarial', review).status, 1, 'ended 不再收新對抗條目（時點屬七段圓環流程——slug 已結束）');
  // end 已清空舊流，模擬其後由 hooks 寫入的新紀錄。
  writeFileSync(f.file, JSON.stringify({ ...JSON.parse(readFileSync(f.file, 'utf8')), ...record }));
  const before = readFileSync(f.file, 'utf8');
  assert.match(f.run('state').stdout, /下一步：.*sb init/);
  assert.equal(readFileSync(f.file, 'utf8'), before, 'state 唯讀');
  assert.equal(f.run('init', 'old').status, 1, '歸檔 slug 重名拒絕');
  mkdirSync(join(f.cwd, '.shiftblame/taken'));
  assert.equal(f.run('init', 'taken').status, 1, '工作路徑碰撞拒絕');
  assert.equal(readFileSync(f.file, 'utf8'), before);
  const r = f.run('init', 'next', 'fix', '--no-git');
  assert.equal(r.status, 0, r.stderr);
  const reinitialized = JSON.parse(readFileSync(f.file, 'utf8'));
  const { startedAt: reStartedAt, ...reRest } = reinitialized;
  assert.deepEqual(reRest, { ...record, slug: 'next', ms: '001', node: 'intent', baseCommit: null });
  assert.match(reStartedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(readFileSync(join(f.cwd, '.shiftblame/archive/old/SLUG.md'), 'utf8'), oldDoc);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/archive/INDEX.md')), false, '歸檔清單機制已除——archive 僅承載 slug 目錄');
  assert.ok(existsSync(join(f.cwd, '.shiftblame/next/001')));
  assert.equal(f.run('state').status, 0);
  assert.equal(f.run('commitmsg', 'fix: 收尾提交走機械格式閘').status, 0);
}
for (const mutate of [
  st => ({ ...st, node: 'done' }),
  st => ({ ...st, node: 'build' }),
  st => ({ ...st, endedAt: 'bad' }),
  st => ({ ...st, slug: '../outside' }),
  st => ({ ...st, ms: null }),
  st => ({ ...st, edgeAt: { 'build→verify': 'bad' } }),
  st => ({ ...st, unknown: true }),
  st => ({ ...st, ...record, hooksHeartbeat: { at: 'bad', event: 'SessionStart' } }),
]) {
  const f = endedFixture();
  const raw = JSON.stringify(mutate(JSON.parse(readFileSync(f.file, 'utf8'))));
  writeFileSync(f.file, raw);
  assert.equal(f.run('init', 'next').status, 1, raw);
  assert.equal(readFileSync(f.file, 'utf8'), raw);
  assert.equal(existsSync(join(f.cwd, '.shiftblame/next')), false);
}
// 歸檔目標占用：die 於寫檔前——狀態仍 verify、雙方目錄原樣（可重試）。
{
  const f = fixture(JSON.stringify({ slug: 'old', ms: '001', node: 'verify', lastAdv: { '2': { at: '2026-09-07T05:20:59.219Z', report: '.shiftblame/tmp/r3.md', verdict: '通過', node: 'verify' } } }));
  mkdirSync(join(f.cwd, '.shiftblame/old'), { recursive: true });
  writeFileSync(join(f.cwd, '.shiftblame/old/SLUG.md'), 'doc\n');
  mkdirSync(join(f.cwd, '.shiftblame/archive/old'), { recursive: true });
  const before = readFileSync(f.file, 'utf8');
  const endRun = f.run('end', '--adversarial', '--boss-ok');
  assert.equal(endRun.status, 1, '歸檔目標占用即擋');
  assert.match(endRun.stderr, /歸檔目標已占用/);
  assert.equal(readFileSync(f.file, 'utf8'), before, 'die 於寫檔前——狀態仍 verify 可重試');
  assert.ok(existsSync(join(f.cwd, '.shiftblame/old/SLUG.md')), '原目錄原樣');
}
// node:done 按驗收出口相容處理；查詢維持原檔，正式結束時儲存 ended 狀態。
{
  const f = fixture(JSON.stringify({ slug: 'legacy', ms: '001', node: 'done', history: [{ from: 'build', to: 'verify', at, ms: '001' }, { from: 'verify', to: 'done', at, ms: '001' }], lastAdv: { '2': { at: '2026-09-07T05:21:00.000Z', report: '.shiftblame/tmp/r3.md', verdict: '通過', node: 'done' } } }));
  const beforeQuery = readFileSync(f.file, 'utf8');
  assert.match(f.run('state').stdout, /段: done/, 'state 顯示相容節點');
  assert.equal(readFileSync(f.file, 'utf8'), beforeQuery, 'state 查詢保持原檔');
  const endRun = f.run('end', '--adversarial', '--boss-ok');
  assert.equal(endRun.status, 0, endRun.stderr);
  const ended = JSON.parse(readFileSync(f.file, 'utf8'));
  assert.equal(ended.node, 'ended', '舊 done 態經 end 遷移為 ended');
  assert.ok(existsSync(join(f.cwd, '.shiftblame/archive/legacy/SLUG.md')) === false, '無 slug 目錄時跳過歸檔移動');
}
{
  const f = fixture(JSON.stringify({ slug: 'legacy', ms: '001', node: 'done', history: [], inputs: [{ at: '2026-09-07T05:21:01.000Z', text: '老闆：開下一里程碑' }], adversarialLog: [{ at: '2026-09-07T05:21:00.000Z', report: '.shiftblame/tmp/r3.md', verdict: '通過', node: 'done', point: '2' }], rewriteSeen: { rev: 1, at: '2026-09-07T05:21:01.000Z' } }));
  const r = f.run('next', 'intent', '--new-ms', '--adversarial', '--boss-ok');
  assert.equal(r.status, 0, r.stderr);
  const st = JSON.parse(readFileSync(f.file, 'utf8'));
  assert.equal(st.node, 'intent');
  assert.equal(st.ms, '002', '舊 done 態經 --new-ms 開新 ms');
  assert.deepEqual(Object.keys(st.edgeAt ?? {}), ['verify→intent'], '新 ms 邊時戳淨空重計——舊 ms 邊不帶入，只留本推進邊');
  assert.equal(st.rewriteSeen, undefined, '新 ms 不帶入舊 ms 的 rewrite 載入鑰匙（rev per-ms 從 1 重算——殘留 seen 會自動解鎖新 ms 首個修正輪）');
}
// 僅刪除舊目錄而沒有歸檔，不會被當作已收尾。
{
  const f = endedFixture();
  renameSync(join(f.cwd, '.shiftblame/archive/old'), join(f.cwd, '.shiftblame/misplaced'));
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
  assert.equal(git('config', 'user.name', 'fixture').status, 0);
  assert.equal(git('config', 'user.email', 'fixture@example.invalid').status, 0);
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
  assert.equal(git('branch', '--show-current').stdout.trim(), 'feat/demo', spec.name + '：unborn repo 補起始提交後建立工作分支');
}
// Git 失敗不能冒充未忽略；已追蹤檔案的索引也不由 init 改動。
for (const broken of [false, true]) {
  const f = fixture();
  const git = (...args) => spawnSync('git', ['-C', f.cwd, ...args], { encoding: 'utf8' });
  assert.equal(git('init').status, 0);
  assert.equal(git('config', 'user.name', 'fixture').status, 0);
  assert.equal(git('config', 'user.email', 'fixture@example.invalid').status, 0);
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
  assert.equal(f.run('init', 'demo', '--no-git').status, 0);
  assert.deepEqual(readFileSync(join(f.cwd, '.gitignore')), Buffer.from(original));
}
console.log('sb-init: 初始化閉環、拒絕邊界、Git 忽略來源與原檔保留通過');
