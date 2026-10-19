// sb-feedback：失敗信號引導——同對話連續失敗 3 次起提示換假設或方法，6 次起要求向使用者取得裁示並對改動類工具詢問一次；
// 成功即歸零，換對話重新計數；舊版紀錄的段位與待重審標記讀取時剝除。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hook = join(repo, 'hooks/shiftblame-guard.mjs');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'sb-feedback-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
  const event = (payload) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, session_id: 's1', ...payload }), encoding: 'utf8' });
  const fail = (session = 's1') => event({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', session_id: session });
  const context = (r) => (r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext ?? '' : '');
  const records = () => JSON.parse(readFileSync(join(root, '.shiftblame/tmp/hook-records.json'), 'utf8'));
  return { root, event, fail, context, records };
}

test('連續失敗 3 次起注入引導，成功即歸零', (t) => {
  const f = fixture(t);
  assert.equal(f.context(f.fail()), '');
  assert.equal(f.context(f.fail()), '');
  const third = f.context(f.fail());
  assert.match(third, /\[失敗引導\] 已連續失敗 3 次（Bash）/);
  assert.match(third, /換方法/);
  assert.doesNotMatch(third, /段|時點|sb next/, '引導不帶流程段位');
  assert.equal(f.records().failureNudge.count, 3);
  assert.equal(f.records().failureNudge.node, undefined, '計數不記段位');
  f.event({ hook_event_name: 'PostToolUse', tool_name: 'Bash' });
  assert.equal(f.records().failureNudge, undefined, '成功歸零');
  assert.equal(f.context(f.fail()), '', '歸零後重新計數');
});

test('6 次起改為裁示，改動類工具詢問一次，唯讀工具不受閘', (t) => {
  const f = fixture(t);
  for (let i = 0; i < 5; i++) f.fail();
  assert.match(f.context(f.fail()), /\[失敗裁示\] 已連續失敗 6 次.*AskUserQuestion/);
  const read = f.event({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(f.root, 'a.txt') } });
  assert.ok(!read.stdout.includes('permissionDecision'), '唯讀工具不受閘');
  const write = f.event({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(f.root, 'a.txt') } });
  const out = JSON.parse(write.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'ask');
  assert.match(out.permissionDecisionReason, /已連續失敗 6 次/);
  assert.ok(f.records().failureNudge.askedAt, '記下已詢問');
  const again = f.event({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' } });
  assert.ok(!again.stdout.includes('permissionDecision'), '同一輪只問一次');
});

test('換對話重新計數；其他對話的失敗不觸發本對話的閘', (t) => {
  const f = fixture(t);
  for (let i = 0; i < 6; i++) f.fail('s1');
  assert.equal(f.context(f.fail('s2')), '', '新對話從 1 開始');
  const write = f.event({ hook_event_name: 'PreToolUse', tool_name: 'Write', session_id: 's1', tool_input: { file_path: join(f.root, 'a.txt') } });
  assert.ok(!write.stdout.includes('permissionDecision'), '計數已屬另一對話');
});

test('舊版紀錄的段位與待重審標記讀取時剝除，其他計數保留', (t) => {
  const f = fixture(t);
  const at = new Date().toISOString();
  writeFileSync(join(f.root, '.shiftblame/tmp/hook-records.json'), JSON.stringify({
    usageTotals: { firstAt: at, requests: 7 },
    failureNudge: { session: 's1', node: 'build', count: 2, at },
    suspect: { 2: at },
  }));
  assert.match(f.context(f.fail()), /已連續失敗 3 次/, '舊計數沿用');
  const st = f.records();
  assert.equal(st.suspect, undefined);
  assert.equal(st.failureNudge.node, undefined);
  assert.equal(st.usageTotals.requests, 7, '累計計數不因舊欄位歸零');
});

test('沒有工作區時不計數也不建立工作區', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'sb-feedback-bare-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, hook_event_name: 'PostToolUseFailure', tool_name: 'Bash' }), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
