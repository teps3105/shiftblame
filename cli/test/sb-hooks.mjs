import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.5 hooks：對話鎖（令行靜止）、老闆詞印章、八段寫入矩陣、層間停靠雙重鎖、commit 印章、破壞性防護
const hook = resolve(dirname(fileURLToPath(import.meta.url)), '../../hooks/shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-hooks-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
const run = (payload) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
const setNode = (n) => writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: n, history: [] }));

// —— 1. 對話鎖與老闆詞印章（UserPromptSubmit；授權詞 MUST 獨立成行）——
const up = (prompt) => run({ hook_event_name: 'UserPromptSubmit', prompt });
assert.equal(up('隨便做點什麼').status, 0);
assert.equal(state().dialogueLock, true, '每則老闆輸入上鎖');
assert.equal(up('還沒開工，先別動').status, 0);
assert.equal(state().dialogueLock, true, '否定句不解鎖（獨立成行才算）');
assert.equal(up('開工').status, 0);
assert.equal(state().dialogueLock, false, '獨立行「開工」解鎖');
assert.deepEqual(state().stamps, {}, '開工行無新印章詞→舊印章保留（此時為空）');
up('這輪可以 done 了');
assert.equal(state().stamps.done, undefined, '句中 done 不算（非獨立行）');
assert.equal(state().dialogueLock, true, '非開工輸入再上鎖');
up('還沒 done\n繼續修');
assert.equal(state().stamps.done, undefined, '否定句不產生印章');
up('done');
assert.ok(state().stamps.done, '獨立行「done」→完成印章');
up('開工');
assert.ok(state().stamps.done, '開工行保留未用 done 印章（兩句式可通）');
assert.equal(state().dialogueLock, false);
up('測試 PASS 一下');
assert.equal(state().stamps.pass, undefined, '句中 PASS 不算');
up('PASS');
assert.ok(state().stamps.pass, '獨立行「PASS」→印章');
assert.equal(state().stamps.done, undefined, '非開工輸入清未用印章');
up('開工');
up('開新 ms');
assert.ok(state().stamps.newMs, '獨立行「開新 ms」→印章');

// —— 2. 鎖定期間擋一切寫入（PreToolUse；唯讀工具不攔）——
up('補充個需求');
assert.equal(state().dialogueLock, true);
const lockedWrite = run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, 'app.js') } });
assert.equal(lockedWrite.status, 2);
assert.match(lockedWrite.stderr, /對話鎖/);
const lockedBash = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } });
assert.equal(lockedBash.status, 2);
assert.match(lockedBash.stderr, /對話鎖/);
const readOnly = run({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(root, 'app.js') } });
assert.equal(readOnly.status, 0, '唯讀工具不攔');
up('開工');

// —— 3. Stop：agent 輸出含〔待確認〕→上鎖（字串形與 blocks 形；多訊息取最後一則）——
up('開工');
assert.equal(state().dialogueLock, false);
const stop = run({ hook_event_name: 'Stop', last_message: '設計如下……〔待確認〕' });
assert.equal(stop.status, 0);
assert.equal(state().dialogueLock, true, '呈現待確認自動上鎖');
up('開工');
const stopBlocks = run({ hook_event_name: 'Stop', messages: [
  { role: 'assistant', content: [{ type: 'text', text: '前情提要' }] },
  { role: 'assistant', content: [{ type: 'text', text: '方案B〔待確認〕' }] },
] });
assert.equal(stopBlocks.status, 0);
assert.equal(state().dialogueLock, true, 'blocks 形最後一則含待確認→上鎖');
up('開工');
const stopNested = run({ hook_event_name: 'Stop', messages: [{ role: 'assistant', content: [{ text: '外層', content: [{ text: '嵌套〔待確認〕' }] }] }] });
assert.equal(state().dialogueLock, true, '嵌套 content 形攤平後偵測');
up('開工');
const stopClean = run({ hook_event_name: 'Stop', messages: [{ role: 'assistant', content: [{ type: 'text', text: '一切正常' }] }] });
assert.equal(state().dialogueLock, false, 'blocks 形無待確認→不上鎖');

// —— 4. 八段寫入矩陣 ——
const W = (node, tool, target) => {
  setNode(node);
  return run({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { file_path: target } });
};
assert.equal(W('verify', 'Edit', 'src/app.js').status, 2, 'verify 段 repo 唯讀');
assert.equal(W('verify', 'Edit', join(root, '.shiftblame', 'demo', 'SLUG.md')).status, 0, '.shiftblame 永遠可寫');
assert.equal(W('build', 'Edit', 'src/app.js').status, 0, 'build 段寫實作');
assert.equal(W('ended', 'Edit', 'docs/guide.md').status, 0, 'ended 收尾保鮮');
assert.equal(W('test', 'Edit', 'test/app.test.js').status, 0, 'test 段寫測試碼');
assert.equal(W('build', 'Edit', 'test/app.test.js').status, 2, '非 test 段改測試碼即擋');

// —— 5. 層間停靠雙重鎖：plan 段 sb next test 無 --boss-ok 即擋 ——
setNode('plan');
const st1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --adversarial' } });
assert.equal(st1.status, 2);
assert.match(st1.stderr, /plan→test|老闆確認點/);
const st2 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --boss-ok --adversarial' } });
assert.equal(st2.status, 0, '帶 --boss-ok 放行');

// —— 6. commit 印章（既有）——
setNode('build');
const noStamp = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
assert.equal(noStamp.status, 2);
assert.match(noStamp.stderr, /缺少 commit 印章/);
writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: x', cwd: root, issuedAt: new Date().toISOString() }));
const ok = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
assert.equal(ok.status, 0);

// —— 7. 破壞性命令（既有）：相對路徑＋重定向截斷 ——
const bad = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo hi > out.txt' } });
assert.equal(bad.status, 2);
assert.match(bad.stderr, /破壞性操作/);
console.log('sb-hooks: PASS');
