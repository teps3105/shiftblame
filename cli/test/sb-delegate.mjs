import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { delegate } from '../bin/jev.mjs';

const root = mkdtempSync(join(tmpdir(), 'sb-delegate-'));
const outside = mkdtempSync(join(tmpdir(), 'sb-delegate-outside-'));
process.on('exit', () => {
  for (const p of [root, outside]) {
    assert.ok(p.startsWith(join(tmpdir(), 'sb-delegate-')));
    rmSync(p, { recursive: true, force: true });
  }
});
const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
const statePath = join(root, '.shiftblame/flow-state.json');
writeFileSync(statePath, JSON.stringify({ hooksHeartbeat: { at: new Date().toISOString(), event: 'SessionStart' } }));
const before = readFileSync(statePath, 'utf8');
writeFileSync(join(root, 'source.txt'), '原始觀察');
const question = { type: 'choice', instructions: 'Select a matching repair from the evidence.',
  criteria: { repair: 'Repairs the described defect.', no_match: 'No matching repair.', insufficient: 'Insufficient or ambiguous evidence.' } };
const item = (id, value = '原始觀察') => ({ id, state: value, question,
  sourceRefs: [{ path: 'source.txt', quote: value }] });
const input = { scope: 'work', model: 'jev-1.13.0', items: [item('a'), item('b')] };
let calls = 0;
const answer = (q, choice = 'repair') => ({ type: 'choice', choice, confidence: 0.95,
  probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === choice ? 1 : 0])) });
const mock = async (url, options) => {
  calls++;
  assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(options.redirect, 'error');
  const request = JSON.parse(options.body);
  assert.equal(typeof request.state, 'string');
  assert.ok(!request.state.includes('原始觀察'));
  assert.ok(JSON.stringify(request.questions.q0.instructions.item).includes('原始觀察'));
  return { ok: true, json: async () => ({ model: 'jev-1.13.0', usage: { input_tokens: 100, output_tokens: 10 },
    answers: Object.fromEntries(Object.entries(request.questions).map(([k, q]) => [k, answer(q)])) }) };
};
const options = { fetch: mock, getKey: () => 'test-only' };
let report = await delegate(root, input, options);
assert.equal(calls, 1);
assert.equal(report.metrics.remoteQuestions, 1, '同批重複工作只問一次，ID 不丟失');
assert.deepEqual(report.items.map(i => i.id), ['a', 'b']);
assert.equal(report.complete, true);
report = await delegate(root, input, { getKey: () => null, fetch: () => assert.fail('快取不應呼叫服務') });
assert.equal(report.metrics.requests, 0);
assert.equal(report.metrics.cacheHits, 2);
assert.equal(report.metrics.usage.input_tokens, 0);
assert.equal(report.items[0].answer.choice, 'repair');

const changedCriterion = structuredClone(input);
changedCriterion.items = [item('a')];
changedCriterion.items[0].question.instructions += ' Consider a changed requirement.';
assert.equal((await delegate(root, changedCriterion, options)).metrics.requests, 1, '準則改變失效');
writeFileSync(join(root, 'source.txt'), '原始觀察\n新增觀察');
assert.equal((await delegate(root, input, options)).metrics.requests, 1, '引文未變但來源變更仍重算');

const partial = { ...input, items: [item('good'), item('missing', '不存在引文')] };
report = await delegate(root, partial, options);
assert.equal(report.complete, false);
assert.deepEqual(report.reviewIds, ['missing']);
assert.equal(report.items[1].status, 'source_missing');
assert.equal(report.metrics.requests, 0, '缺證不問模型，有效項可重用');

const fresh = scope => ({ ...input, scope, items: [item('a')] });
report = await delegate(root, fresh('missing-key'), { getKey: () => null });
assert.equal(report.items[0].status, 'credential_unavailable');
assert.equal(report.complete, false);
assert.equal(report.metrics.requests, 0);
report = await delegate(root, fresh('service-down'), { getKey: () => 'test', fetch: async () => ({ ok: false, status: 429 }) });
assert.equal(report.items[0].status, 'http_429');
assert.equal(report.metrics.requests, 1);
report = await delegate(root, fresh('transport'), { getKey: () => 'test', fetch: async () => { throw Error('PRIVATE'); } });
assert.equal(report.items[0].status, 'transport_failure');
assert.ok(!JSON.stringify(report).includes('PRIVATE'));

for (const bad of [
  { type: 'choice', choice: ['repair'], confidence: 1, probabilities: { repair: 1, no_match: 0, insufficient: 0 } },
  { type: 'choice', choice: ['insufficient'], confidence: 1, probabilities: { repair: 0, no_match: 0, insufficient: 1 } },
  { type: 'choice', choice: 'repair', confidence: 1, probabilities: { repair: 1 } },
  { type: 'choice', choice: 'repair', confidence: 2, probabilities: { repair: 1, no_match: 0, insufficient: 0 } },
  { type: 'choice', choice: 'repair', confidence: 0.9, probabilities: { repair: 0, no_match: 1, insufficient: 0 } },
]) {
  report = await delegate(root, fresh('bad-answer'), { getKey: () => 'test', fetch: async () => ({ ok: true,
    json: async () => ({ model: input.model, answers: { q0: bad }, usage: { input_tokens: 2, output_tokens: 1 } }) }) });
  assert.equal(report.items[0].status, 'invalid_response');
  assert.equal(report.complete, false);
}
assert.equal((await delegate(root, fresh('bad-answer'), options)).metrics.requests, 1, '壞答案沒有快取');

const exceptionMock = async (_, request) => ({ ok: true, json: async () => ({ model: input.model,
  usage: { input_tokens: 1, output_tokens: 1 }, answers: { q0: answer(JSON.parse(request.body).questions.q0, 'no_match') } }) });
report = await delegate(root, fresh('no-match'), { getKey: () => 'test', fetch: exceptionMock });
assert.equal(report.complete, true, '取得無對應答案仍交回主代理，不代判通過');
assert.deepEqual(report.reviewIds, ['a']);
report = await delegate(root, { ...fresh('threshold'), items: [{ ...item('a'), minConfidence: 0.98 }] }, options);
assert.deepEqual(report.reviewIds, ['a']);

const alias = { ...fresh('alias'), model: 'jev-latest' };
await delegate(root, alias, options);
assert.equal((await delegate(root, alias, options)).metrics.requests, 1, '別名每次重算');
writeFileSync(join(root, '.shiftblame/tmp/jev/corrupt.cache.json'), '{broken');
assert.equal((await delegate(root, fresh('corrupt'), options)).metrics.requests, 1);

report = await delegate(root, fresh('source-race'), { getKey: () => 'test', fetch: async (...args) => {
  const r = await mock(...args);
  writeFileSync(join(root, 'source.txt'), '原始觀察\n呼叫中改變');
  return r;
} });
assert.equal(report.items[0].status, 'source_changed');
assert.deepEqual(report.reviewIds, ['a']);
assert.equal((await delegate(root, fresh('source-race'), options)).metrics.requests, 1);

writeFileSync(join(root, 'moving.txt'), '原始觀察');
const moving = { ...fresh('directory-race'), items: [item('steady'), { ...item('moving'), sourceRefs: [{ path: 'moving.txt', quote: '原始觀察' }] }] };
report = await delegate(root, moving, { getKey: () => 'test', fetch: async (...args) => {
  const r = await mock(...args);
  rmSync(join(root, 'moving.txt'));
  mkdirSync(join(root, 'moving.txt'));
  return r;
} });
assert.deepEqual(report.items.map(r => r.id), ['steady', 'moving']);
assert.equal(report.items[0].status, 'answered');
assert.equal(report.items[1].status, 'source_changed');

const changedOne = { ...input, items: [item('a'), { ...item('b'), state: { observation: '原始觀察', condition: 'another condition' } }] };
await delegate(root, input, options);
report = await delegate(root, changedOne, options);
assert.equal(report.metrics.cacheHits, 1, '只重算改變的工作');
assert.equal(report.metrics.remoteQuestions, 1);

for (const bad of [
  { ...input, scope: '../outside' },
  { ...input, items: [item('a'), item('a')] },
  { ...input, items: [{ ...item('a'), minConfidence: '0.5' }] },
  { ...input, items: [{ ...item('a'), sourceRefs: [{ path: join(outside, 'secret'), quote: 'x' }] }] },
]) await assert.rejects(delegate(root, bad, options));
symlinkSync(outside, join(root, 'linked'), 'junction');
await assert.rejects(delegate(root, { ...input, items: [{ ...item('a'), sourceRefs: [{ path: 'linked/missing', quote: 'x' }] }] }, options));
symlinkSync(outside, join(root, '.shiftblame/tmp/jev/escape.cache.json'), 'junction');
await assert.rejects(delegate(root, fresh('escape'), options));

writeFileSync(join(root, 'request.json'), JSON.stringify({ ...input, items: [item('a', '未驗證的引文')] }));
const run = spawnSync(process.execPath, [cli, 'delegate', 'request.json'], { cwd: root, encoding: 'utf8' });
assert.equal(run.status, 1, run.stderr);
assert.deepEqual(JSON.parse(run.stdout).reviewIds, ['a']);
const compact = JSON.parse(run.stdout);
assert.equal(compact.items[0].choice, null);
assert.equal(JSON.parse(readFileSync(compact.reportPath, 'utf8')).items[0].status, 'source_missing');
assert.equal(readFileSync(statePath, 'utf8'), before, 'CLI 委派不改流程、章或驗收判斷');
const doc = readFileSync(resolve(here, '../../skills/shiftblame/references/JEV.md'), 'utf8');
for (const anchor of ['同批重複', 'CJK', '退出碼 0', '不更改流程']) assert.ok(doc.includes(anchor), anchor);
console.log('PASS delegate：批次去重、來源失效、局部失敗、快取、模型回應、路徑與流程無副作用');
