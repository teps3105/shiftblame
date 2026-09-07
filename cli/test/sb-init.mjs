import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
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
const invalid = [null, [], {}, { slug: null }, { node: 'mystery' }, { history: [] },
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
console.log('sb-init: 純紀錄保留、正常初始化、拒絕邊界與唯讀診斷通過');
