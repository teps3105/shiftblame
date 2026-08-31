// sb-hooks：對話鎖＋機械過濾（時序元規則）＋sb unlock 通道放行＋曝光＋Stop＋寫入矩陣＋停靠鎖＋commit 印章＋破壞性防護
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import assert from 'node:assert/strict';

const hook = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks', 'shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-hooks-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
const run = (payload) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
const setNode = (n) => writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: n, history: [] }));

// —— 1. 對話鎖＋機械過濾（UserPromptSubmit；覆蓋式當前輸入＋候選掃描＋否定標記＋清印章）——
const up = (prompt) => run({ hook_event_name: 'UserPromptSubmit', prompt });
let r = up('隨便做點什麼');
assert.equal(r.status, 0);
assert.equal(state().dialogueLock, true, '每則老闆輸入上鎖');
assert.equal(state().input.text, '隨便做點什麼', '當前輸入記錄');
assert.equal(state().input.candidates.length, 0, '無候選詞');
assert.ok(r.stdout.includes('無（fail-closed'), '過濾產物回流：無候選提示');

r = up('還沒開始，先別動');
assert.equal(state().input.text, '還沒開始，先別動', '覆蓋：最新輸入取代舊則');
const negCand = state().input.candidates.find((c) => c.word === '開始');
assert.ok(negCand && negCand.negated, '否定共現標記（還沒＋開始同句）');
assert.ok(r.stdout.includes('否定'), '注入含否定標記');

r = up('繼續');
const goCand = state().input.candidates.find((c) => c.word === '繼續');
assert.ok(goCand && !goCand.negated && goCand.type === 'go', '非否定候選（go 類）');
assert.deepEqual(state().stamps, {}, '新輸入清未用印章');

// —— 1b. 掃描層攻擊面：否定詞／肯定複合／lastIndex／英文邊界 ——
up('不行');
assert.ok(state().input.candidates.some((c) => c.word === '行' && c.negated), '「不行」→行 標否定（含「不」）');
up('沒錯');
const mm = state().input.candidates.filter((c) => c.word === '沒錯');
assert.ok(mm.length === 1 && !mm[0].negated, '「沒錯」肯定複合先剔除→非否定 nod 候選');
up('好久不見');
assert.ok(state().input.candidates.some((c) => c.word === '好' && c.negated), '「好久不見」→好 標否定');
up('對不起，我打錯字了');
assert.ok(state().input.candidates.some((c) => c.word === '對' && c.negated), '「對不起」→對 標否定');
up('好。好。好。');
assert.equal(state().input.candidates.filter((c) => c.word === '好').length, 3, 'lastIndex 不污染——每句各標一次');
up('這樣 ok 嗎？先把 book 拿走再說');
assert.ok(state().input.candidates.some((c) => c.word === 'ok' && !c.negated), 'ok 候選');
assert.ok(!state().input.candidates.some((c) => /book|拿走/.test(c.word)), 'book 不產生候選（\\b 邊界）');
up('繼續'); // 回到可解鎖基線

// —— 2. 鎖定期寫入矩陣：唯「單體」sb unlock 命令放行；借道全擋 ——
assert.equal(state().dialogueLock, true);
const lockedBash = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } });
assert.equal(lockedBash.status, 2, '鎖定期一般 Bash 擋');
const unlockPass = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb unlock --quoted "繼續"' } });
assert.equal(unlockPass.status, 0, '單體解鎖命令放行');
const unlockPass2 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node cli/bin/sb.mjs unlock --quoted 繼續' } });
assert.equal(unlockPass2.status, 0, 'node sb.mjs unlock 單體放行');
// 借道攻擊（對抗第一輪 A1）：複合、註解、字串內嵌全擋
const hijack1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb unlock --quoted "繼續" && node -e "require(\'fs\').writeFileSync(\'pwn.txt\',\'x\')"' } });
assert.equal(hijack1.status, 2, '&& 借道擋');
const hijack2 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb unlock --quoted 繼續; node -e "x"' } });
assert.equal(hijack2.status, 2, '; 借道擋');
const hijack3 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb unlock --quoted 繼續 | node -e "x"' } });
assert.equal(hijack3.status, 2, '| 借道擋');
const hijack4 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: '# sb unlock --quoted x\nnode -e "x"' } });
assert.equal(hijack4.status, 2, '註解偽裝擋');
const hijack5 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo "sb unlock --quoted 繼續" && node -e "x"' } });
assert.equal(hijack5.status, 2, '字串內嵌偽裝擋');
// 命令代入穿透（1.5.1 複核必修 1）：$()／反引號／<() 於解鎖段內即非單體，擋
const hijack6 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb unlock --quoted "$(node -e \'require("fs").writeFileSync("pwn.txt","x")\')"' } });
assert.equal(hijack6.status, 2, '$() 命令代入擋');
const hijack7 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb unlock --quoted "`node -e x`"' } });
assert.equal(hijack7.status, 2, '反引號代入擋');
const hijack8 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb unlock --quoted <(node -e x)' } });
assert.equal(hijack8.status, 2, '<() 進程代入擋');
// 冒名檔名（複核必修 2）：.shiftblame 髒區與非 sb.mjs 檔名不取得解鎖豁免
const hijack9 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node .shiftblame/tmp/pwn_sb unlock --quoted 繼續' } });
assert.equal(hijack9.status, 2, '.shiftblame 冒名路徑擋');
const hijack10 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node x_sb.mjs unlock --quoted 繼續' } });
assert.equal(hijack10.status, 2, '非 sb.mjs 檔名擋');
// 數字內標點保護：3.14 不偽句界——「ok 3.14 沒過」ok 與否定詞同句
up('ok 3.14 沒過');
assert.ok(state().input.candidates.some((c) => c.word === 'ok' && c.negated), '數字小數點不分句——否定同句標記');
const lockedWrite = run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, 'app.js') } });
assert.equal(lockedWrite.status, 2, '鎖定期寫檔擋');
const readOnly = run({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(root, 'app.js') } });
assert.equal(readOnly.status, 0, '唯讀工具不攔');

// —— 3. 曝光：unlockLog 未審引句於老闆下則輸入展示並標記已審 ——
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: true, input: { at: new Date().toISOString(), text: '繼續', candidates: [{ word: '繼續', type: 'go', negated: false }], consumed: false },
  unlockLog: [{ at: new Date().toISOString(), quoted: '繼續', stamp: null, node: 'verify', reviewed: false }],
}));
r = up('下一則輸入');
assert.ok(r.stdout.includes('解鎖審視') && r.stdout.includes('繼續'), '未審解鎖引句曝光');
assert.equal(state().unlockLog[0].reviewed, true, '展示即標記已審');
r = up('再下一則');
assert.ok(!r.stdout.includes('解鎖審視'), '已審不再重複曝光');

// —— 4. SessionStart 動態狀態卡（壓縮後回流：段位＋鎖態＋當前輸入＋未審引句；不搶曝光標記）——
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({
  slug: 'demo', ms: '001', node: 'plan', history: [], dialogueLock: true,
  input: { at: new Date().toISOString(), text: '繼續', candidates: [{ word: '繼續', type: 'go', negated: false }], consumed: false },
  unlockLog: [{ at: new Date().toISOString(), quoted: '繼續', stamp: null, node: 'plan', reviewed: false }],
}));
const ss = run({ hook_event_name: 'SessionStart' });
assert.equal(ss.status, 0);
assert.ok(ss.stdout.includes('冷啟動載入'), '靜態卡');
assert.ok(ss.stdout.includes('@ plan'), '段位');
assert.ok(ss.stdout.includes('當前輸入') && ss.stdout.includes('繼續'), '當前輸入回流');
assert.ok(ss.stdout.includes('解鎖審視'), '未審引句展示');
assert.equal(JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8')).unlockLog[0].reviewed, false, 'SessionStart 不搶曝光標記（保留老闆輸入時曝光）');

// —— 5. Stop：agent 輸出含〔待確認〕→上鎖（字串形與 blocks 形；多訊息取最後一則）——
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: false }));
const stop = run({ hook_event_name: 'Stop', last_message: '設計如下……〔待確認〕' });
assert.equal(stop.status, 0);
assert.equal(state().dialogueLock, true, '呈現待確認自動上鎖');
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: false }));
const stopBlocks = run({ hook_event_name: 'Stop', messages: [
  { role: 'assistant', content: [{ type: 'text', text: '前情提要' }] },
  { role: 'assistant', content: [{ type: 'text', text: '方案B〔待確認〕' }] },
] });
assert.equal(state().dialogueLock, true, 'blocks 形最後一則含待確認→上鎖');
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: false }));
const stopNested = run({ hook_event_name: 'Stop', messages: [{ role: 'assistant', content: [{ text: '外層', content: [{ text: '嵌套〔待確認〕' }] }] }] });
assert.equal(state().dialogueLock, true, '嵌套 content 形攤平後偵測');
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: false }));
const stopClean = run({ hook_event_name: 'Stop', messages: [{ role: 'assistant', content: [{ type: 'text', text: '一切正常' }] }] });
assert.equal(state().dialogueLock, false, 'blocks 形無待確認→不上鎖');

// —— 6. 八段寫入矩陣 ——
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

// —— 7. 層間停靠雙重鎖：plan 段 sb next test 缺 --boss-ok 即擋；--rerun 直通與 CLI 同判據 ——
setNode('plan');
const st1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --adversarial' } });
assert.equal(st1.status, 2);
assert.match(st1.stderr, /plan→test|老闆決策邊/);
const st2 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --boss-ok --adversarial' } });
assert.equal(st2.status, 0, '帶 --boss-ok 放行');
// --rerun：本 ms 未達 test（history 無本 ms 記錄）→擋
const st3 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --rerun impl --adversarial' } });
assert.equal(st3.status, 2, '首走 --rerun 擋（hooks 同判據）');
assert.match(st3.stderr, /--rerun 僅限同 ms/);
// --rerun：本 ms 曾達 test →直通放行（兩層判據一致）
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'plan', history: [{ from: 'plan', to: 'test', at: '2026-01-01T00:00:00Z', ms: '001', bossOk: true }] }));
const st4 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --rerun impl --adversarial' } });
assert.equal(st4.status, 0, '同 ms 返工直通放行（hooks 同判據）');
// --rerun：history 達 test 但屬他 ms →擋（跨 ms 繞過防線）
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '002', node: 'plan', history: [{ from: 'plan', to: 'test', at: '2026-01-01T00:00:00Z', ms: '001', bossOk: true }] }));
const st5 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next test --rerun impl --adversarial' } });
assert.equal(st5.status, 2, '跨 ms --rerun 擋');

// —— 8. commit 印章＋提交對抗閘（hooks 端：手寫印章不得繞過對抗閘）——
setNode('build');
const noStamp = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
assert.equal(noStamp.status, 2);
assert.match(noStamp.stderr, /缺少 commit 印章/);
writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: x', cwd: root, issuedAt: new Date().toISOString() }));
const forgedStamp = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
assert.equal(forgedStamp.status, 2, '手寫印章但無對抗宣告→擋');
assert.match(forgedStamp.stderr, /提交前需對抗記錄/);
{ // 有未消費對抗宣告→過（且一併消費）
  const stv = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
  stv.adversarialAt = new Date().toISOString(); stv.adversarialConsumed = false;
  writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify(stv));
}
writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: x', cwd: root, issuedAt: new Date().toISOString() }));
const ok = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
assert.equal(ok.status, 0);
assert.equal(JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8')).adversarialConsumed, true, 'hooks 消費印章時一併消費對抗宣告');

// —— 9. 破壞性命令：相對路徑＋重定向截斷 ——
const bad = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo hi > out.txt' } });
assert.equal(bad.status, 2);
assert.match(bad.stderr, /破壞性操作/);
console.log('sb-hooks: PASS');
