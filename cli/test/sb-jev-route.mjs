import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRouteRequest, createRouter, resolveRoute, judgeRoute } from '../bin/jev-route.mjs';

const model = 'jev-1.13.0';
const tools = [{ name: 'inspect', description: 'Inspect a named resource.', inputSchema: {
  type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false
} }];
const answer = (question, choice) => ({ type: 'choice', choice, confidence: 0.9,
  probabilities: Object.fromEntries(Object.keys(question.criteria).map(key => [key, key === choice ? 1 : 0])) });

test('dynamic observed IDs can execute repeatedly without a generator between operations', async () => {
  let calls = 0, providerRequests = 0, executions = 0, permissionChecks = 0;
  const seen = [];
  const route = createRouter({ model, accept: () => true, ask: async request => {
    calls++;
    seen.push(request.state);
    return { model, answers: { operation: answer(request.questions.operation, calls <= 3 ? 'c0' : 'generate') }, usage: { input_tokens: 100, output_tokens: 10 } };
  } });
  // 宿主迴圈固定重用候選抽取與執行器；沒有每步呼叫大型模型整理請求。
  let state = { id: 'scene/root', inspected: [] };
  for (;;) {
    const decision = await route({ tools, state, candidates: [{
      name: 'inspect', input: { id: state.id }, description: 'Inspect the next observed resource.'
    }] });
    if (decision.mode !== 'direct') { providerRequests++; break; }
    permissionChecks++;
    const call = decision.response.toolCalls[0];
    assert.equal(call.name, 'inspect');
    assert.equal(call.input.id, state.id);
    assert.equal(call.providerExecuted, undefined);
    executions++;
    state = { id: `observed-child-${executions}`, inspected: [...state.inspected, call.input.id] };
  }
  assert.equal(calls, 4);
  assert.equal(executions, 3);
  assert.equal(permissionChecks, 3);
  assert.equal(providerRequests, 1);
  assert.equal(seen[2].id, 'observed-child-2');
});

test('candidate mutation during inference cannot redirect the selected operation', async () => {
  const candidates = [{ name: 'inspect', input: { id: 'original' }, description: 'Inspect original resource.' }];
  const batch = buildRouteRequest({ tools, state: {}, model, candidates });
  candidates[0].input.id = 'replaced';
  const result = resolveRoute(batch, { model, answers: { operation: answer(batch.request.questions.operation, 'c0') } });
  assert.equal(result.call.input.id, 'original');
});

test('unknown tools never become candidates and no uncalibrated default accepts a call', () => {
  assert.equal(buildRouteRequest({ tools, state: {}, model, candidates: [{ name: 'shell', input: {}, description: 'Run arbitrary command.' }] }), null);
  assert.throws(() => createRouter({ model }), /採用策略/);
});

test('only chosen branch arguments affect the call; unused ambiguity does not cause voting or fallback', () => {
  const closed = ['first', 'second'].map(name => ({ name, inputSchema: {
    type: 'object', properties: { mode: { enum: ['read', 'check'] } }, required: ['mode'], additionalProperties: false
  } }));
  const batch = buildRouteRequest({ tools: closed, state: {}, model });
  const result = resolveRoute(batch, { model, answers: {
    operation: answer(batch.request.questions.operation, 't0'),
    a0_0: answer(batch.request.questions.a0_0, 'v1'),
    a1_0: { type: 'choice', choice: 'insufficient', confidence: 0 }
  } });
  assert.deepEqual(result.call, { name: 'first', input: { mode: 'check' } });
  assert.equal(result.judgments.length, 2);
});

test('cancellation after inference cannot trigger either tool or provider fallback', async () => {
  const controller = new AbortController();
  const route = createRouter({ model, accept: () => true, ask: async () => { controller.abort(); return null; } });
  await assert.rejects(route({ tools, state: {}, candidates: [{ name: 'inspect', input: { id: 'a' }, description: 'Inspect a.' }], signal: controller.signal }), { name: 'AbortError' });
});

test('malformed probability distributions and changed models cannot produce a direct call', () => {
  const batch = buildRouteRequest({ tools, state: {}, model, candidates: [{ name: 'inspect', input: { id: 'a' }, description: 'Inspect a.' }] });
  const good = answer(batch.request.questions.operation, 'c0');
  assert.equal(resolveRoute(batch, { model: 'different', answers: { operation: good } }).mode, 'fallback');
  assert.equal(resolveRoute(batch, { model, answers: { operation: { ...good, probabilities: { c0: 1 } } } }).mode, 'fallback');
  assert.equal(resolveRoute(batch, { model, answers: { operation: { ...answer(batch.request.questions.operation, 'generate'), choice: ['generate'] } } }).mode, 'fallback');
});

test('asynchronous rejection and non-boolean policy results cannot authorize direct delivery', async () => {
  for (const accept of [async () => false, () => 'true', () => ({ accepted: true })]) {
    const route = createRouter({ model, accept, ask: async request => ({ model, answers: { operation: answer(request.questions.operation, 'c0') } }) });
    const result = await route({ tools, state: {}, candidates: [{ name: 'inspect', input: { id: 'a' }, description: 'Inspect a.' }] });
    assert.equal(result.mode, 'fallback');
  }
});

test('missing credentials cause zero transport attempts and retain their actual failure reason', async () => {
  let fetchCalls = 0;
  const result = await judgeRoute({ model, tools, state: {}, candidates: [{ name: 'inspect', input: { id: 'a' }, description: 'Inspect a.' }] }, {
    getKey: () => null, fetch: async () => { fetchCalls++; }
  });
  assert.equal(result.reason, 'credential_unavailable');
  assert.equal(result.metrics.transportAttempts, 0);
  assert.equal(fetchCalls, 0);
});

test('cancellation during policy evaluation cannot produce a call', async () => {
  const controller = new AbortController();
  const route = createRouter({ model, accept: async () => { controller.abort(); return true; },
    ask: async request => ({ model, answers: { operation: answer(request.questions.operation, 'c0') } })
  });
  await assert.rejects(route({ tools, state: {}, candidates: [{ name: 'inspect', input: { id: 'a' }, description: 'Inspect a.' }], signal: controller.signal }), { name: 'AbortError' });
});
