// sb-hooks：雙流模型——輸入流唯增＋理解流落檔＋曝光＋無鎖＋寫入矩陣＋停靠鎖＋commit 印章＋破壞性防護＋心跳＋inject 歸因
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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

// —— 1. 雙流模型：輸入流唯增＋理解流（Skill args）；無鎖無 thinkRouted ——
const up = (prompt) => run({ hook_event_name: 'UserPromptSubmit', prompt });
let r = up('隨便說什麼都行');
assert.equal(r.status, 0);
assert.equal(state().inputs.length, 1, '輸入流記錄（唯增）');
assert.equal(state().inputs[0].text, '隨便說什麼都行', '原文事實');
assert.equal(state().dialogueLock, undefined, '無對話鎖欄位');
assert.ok(r.stdout.includes('輸入流'), 'flowLine 狀態回流');
r = up('第二則輸入');
assert.equal(state().inputs.length, 2, '連續輸入不覆蓋（唯增——連續串＝同一事實流）');
// 理解流：Skill(shiftblame:think) 調用 args＝理解宣告
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：這是雙流模型的測試輸入序列' } });
assert.equal(r.status, 0, 'Skill 調用放行');
assert.equal(state().understandings.length, 1, '理解宣告落檔');
assert.equal(state().understandings[0].uptoInput, 1, '涵蓋至最新輸入');
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'save', args: 'x' } });
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'fake-think-evil', args: '理解：偽技能名的假理解宣告內容' } });
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'xx_think_yy', args: '理解：中綴技能名的假理解宣告內容' } });
assert.equal(state().understandings.length, 1, '非完整拼寫／偽名／中綴不落理解流（錨定 ^(?:shiftblame:)?think$）');
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { name: 'shiftblame:think', args: '理解：name fallback 的理解宣告測試內容' } });
assert.equal(state().understandings.length, 2, 'name fallback 錨定匹配落檔');
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'think', args: '短' } });
assert.equal(state().understandings.length, 2, 'args 過短不落檔（理解必須有實質——該輸入保持未覆蓋曝光）');
// 外部證據標記
r = run({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } });
assert.equal(state().externalEvidence?.done, true, 'WebSearch 調用標記 externalEvidence');
r = up('又一則');
r = run({ hook_event_name: 'PreToolUse', tool_name: 'mcp__web_reader__webReader', tool_input: { url: 'https://x' } });
assert.equal(state().externalEvidence?.tool, 'mcp__web_reader__webReader', 'webReader MCP 調用標記');
r = up('再一則');
r = run({ hook_event_name: 'PreToolUse', tool_name: 'WebSearchX', tool_input: {} });
r = run({ hook_event_name: 'PreToolUse', tool_name: 'websearch', tool_input: {} });
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'WebSearch' } });
assert.equal(state().externalEvidence?.tool, 'mcp__web_reader__webReader', '冒名／大小寫變體／Bash 內嵌不覆寫既有標記（精確錨定）');
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt: 'x' } });
assert.equal(state().externalEvidence?.tool, 'Agent', 'Agent 外部子代理調用標記');
// hooks 心跳（flow-state hooksHeartbeat 欄位）
const hb = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8')).hooksHeartbeat;
assert.equal(hb.event, 'PreToolUse', '心跳記錄最後事件');
assert.ok(new Date(hb.at).getTime() > Date.now() - 60000, '心跳時間戳新鮮');
// inject 格式（hookEventName 歸因防回歸）
const ssOut = run({ hook_event_name: 'SessionStart', source: 'startup' });
const ssJson = JSON.parse(ssOut.stdout);
assert.equal(ssJson.hookSpecificOutput.hookEventName, 'SessionStart', 'SessionStart 注入歸因正確事件名');
assert.ok(ssJson.hookSpecificOutput.additionalContext.length > 50, 'SessionStart 注入實質內容（載入程序＋不變量卡）');
const upOut = up('inject 格式驗證輸入');
const upJson = JSON.parse(upOut.stdout);
assert.equal(upJson.hookSpecificOutput.hookEventName, 'UserPromptSubmit', 'UserPromptSubmit 注入歸因正確事件名');
assert.ok(upJson.hookSpecificOutput.additionalContext.includes('[shiftblame 不變量]'), '不變量卡經 additionalContext 真正注入');
// 心跳守門：無 .shiftblame 的 cwd 不得長出流浪工作區
const strayRoot = mkdtempSync(join(tmpdir(), 'sb-stray-'));
process.on('exit', () => rmSync(strayRoot, { recursive: true, force: true }));
const strayRun = spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: strayRoot, hook_event_name: 'SessionStart', source: 'startup' }), encoding: 'utf8' });
assert.equal(strayRun.status, 0, '流浪 cwd 下 hooks 靜默放行');
assert.equal(existsSync(join(strayRoot, '.shiftblame')), false, '不得創建流浪 .shiftblame（框架元規則——findRoot 錨錯根防護）');

// —— 2. 無鎖：一般 Bash／Write 不因對話鎖被擋——段位矩陣與 commit 攔截仍在（節 6-9）——
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } });
assert.equal(r.status, 0, '一般 Bash 不攔（無對話鎖）');

// —— 3. 必然曝光：未審理解於老闆下則輸入展示並標記已審 ——
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：節三曝光驗證的專屬理解宣告' } });
r = up('曝光驗證輸入');
assert.ok(r.stdout.includes('理解審視') && r.stdout.includes('節三曝光驗證的專屬理解宣告'), '未審理解曝光');
assert.equal(state().understandings.at(-1).reviewed, true, '展示即標記已審');
r = up('再一則不應重複曝光');
assert.ok(!(r.stdout.includes('理解審視') && r.stdout.includes('節三曝光驗證的專屬理解宣告')), '已審不再重複曝光');

// —— 4. SessionStart 動態狀態卡（壓縮後回流：段位＋輸入流＋未審理解；不搶曝光標記）——
setNode('plan');
const ss2 = run({ hook_event_name: 'SessionStart', source: 'compact' });
assert.equal(ss2.status, 0);
assert.ok(ss2.stdout.includes('冷啟動載入'), '靜態卡');
assert.ok(ss2.stdout.includes('@ plan'), '段位');
assert.ok(ss2.stdout.includes('輸入流'), '輸入流狀態回流');

// —— 5. Stop：撤鎖後靜默（無防護動作，理解流曝光承擔審視）——
r = run({ hook_event_name: 'Stop', last_message: '方案〔待確認〕' });
assert.equal(r.status, 0, 'Stop 靜默放行');
assert.equal(state().dialogueLock, undefined, '無上鎖動作（撤鎖）');

// —— 6. 八段寫入矩陣 ——
const W = (node, tool, target) => {
  setNode(node);
  return run({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { file_path: target } });
};
assert.equal(W('verify', 'Edit', 'src/app.js').status, 2, 'verify 段 repo 唯讀');
assert.equal(W('verify', 'Edit', join(root, '.shiftblame', 'demo', 'SLUG.md')).status, 0, '.shiftblame 永遠可寫');
assert.equal(W('build', 'Edit', 'src/app.js').status, 0, 'build 段寫實作');
assert.equal(W('ended', 'Edit', 'docs/guide.md').status, 0, 'ended 收尾歸檔');
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

// —— 10. 兩種觸發樣態：主動觸發停等——hold 設置／凍結硬擋／唯讀放行／回覆解凍 ——
setNode('build'); // build 段正常可寫（對照組）
const editOkBefore = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, 'src/a.js'), old_string: 'a', new_string: 'b' } });
assert.equal(editOkBefore.status, 0, '對照組：無 hold 時 build 段 Edit 放行');
// 主動觸發：/shiftblame:think 與 $shiftblame:think 開頭皆設 hold；注入卡顯示停等行
const activeSlash = up('/shiftblame:think 幫我做停等機制的理解呈現');
assert.ok(state().understandingHold, '主動觸發（/shiftblame:think 開頭）設 understandingHold');
assert.equal(state().understandingHold.inputIdx, state().inputs.length - 1, 'hold 錨定本則輸入');
assert.ok(activeSlash.stdout.includes('[停等理解]'), '注入卡顯示停等行');
const activeLink = up('$shiftblame:think markdown 連結形式的觸發');
assert.ok(state().understandingHold, '主動觸發（$shiftblame:think 連結）覆設 hold');
assert.ok(activeLink.stdout.includes('[停等理解]'), '連結形式同樣停等');
// hold 期間：Skill（理解宣告落流）放行
const holdSkill = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：停等機制的理解宣告落流驗證' } });
assert.equal(holdSkill.status, 0, 'Skill 調用（shiftblame:think 理解宣告）放行');
assert.ok(state().understandings.length > 0, '理解流照常落檔');
// hold 期間：唯讀與外部查證放行
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(root, 'README.md') } }).status, 0, 'Read 放行');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }).status, 0, 'WebSearch 放行');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git log --oneline -3' } }).status, 0, 'git log 唯讀放行');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node -e "console.log(1)"' } }).status, 0, 'node 探針放行');
// hold 期間：寫入與推進硬擋
const frozenEdit = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, 'src/a.js'), old_string: 'a', new_string: 'b' } });
assert.equal(frozenEdit.status, 2, 'repo Edit 凍結');
assert.match(frozenEdit.stderr, /停等凍結/);
const frozenWrite = run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, 'src/new.js'), content: 'x' } });
assert.equal(frozenWrite.status, 2, 'repo Write 凍結');
const tmpWrite = run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/tmp/evidence.md'), content: 'x' } });
assert.equal(tmpWrite.status, 0, 'tmp 證據傾倒放行');
const frozenGit = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git add src/a.js' } });
assert.equal(frozenGit.status, 2, 'git add 凍結');
const frozenSb = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node cli/bin/sb.mjs next test --boss-ok --adversarial' } });
assert.equal(frozenSb.status, 2, 'sb next 推進凍結');
const readonlySb = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node cli/bin/sb.mjs state' } });
assert.equal(readonlySb.status, 0, 'sb state 唯讀放行');
// 老闆回覆＝解凍：hold 清除＋注入 [停等解除]；寫入回到段矩陣判定
const release = up('確認理解正確，開工');
assert.equal(state().understandingHold, undefined, '老闆回覆解除 hold');
assert.ok(release.stdout.includes('[停等解除]'), '注入卡顯示解除行');
const editOkAfter = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, 'src/a.js'), old_string: 'a', new_string: 'b' } });
assert.equal(editOkAfter.status, 0, '解凍後回到段矩陣判定（build 段放行）');
// —— 11. G 檔寫入矩陣（RAM/ROM 分區） ——
mkdirSync(join(root, '.shiftblame', 'demo', '001'), { recursive: true });
const setNode2 = (n) => writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: n, history: [] }));
// requirement 段 Read repo 檔不寫任何標記（零殘留行為驗證）
mkdirSync(join(root, 'src'), { recursive: true });
setNode2('requirement');
const beforeRead = readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8');
run({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(root, 'src/a.js') } });
run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git log --oneline -3' } });
// hooksHeartbeat 寫入 flow-state 是唯一獲准的狀態寫入；剝除後必須零殘留
const stripHb = (raw) => { const o = JSON.parse(raw); delete o.hooksHeartbeat; return JSON.stringify(o); };
assert.equal(stripHb(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8')), stripHb(beforeRead), '查證動作不寫狀態（RAM/ROM）');
const hbAfter = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8')).hooksHeartbeat;
assert.ok(hbAfter && hbAfter.at && hbAfter.event, 'hooksHeartbeat 落 flow-state（at＋event）');
// G 寫入矩陣：定義邊寫、落地邊唯讀
setNode2('requirement');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } }).status, 0, 'requirement 段寫 G1 放行（定義邊）');
const gKidnap = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G2.md'), old_string: 'a', new_string: 'b' } });
assert.equal(gKidnap.status, 2, 'requirement 段寫 G2 擋（G2 寫入權屬 research）');
assert.match(gKidnap.stderr, /G2|寫入權屬|無寫入權/, '綁架訊息指向回 intent 開新輪');
setNode2('research');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/demo/001/G2.md'), content: 'x' } }).status, 0, 'research 段寫 G2 放行');
setNode2('test');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G3.md'), old_string: 'a', new_string: 'b' } }).status, 0, 'test 段寫 G3 回指區放行（RAM/ROM：落地段獲回指區寫入權）');
setNode2('requirement');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/g2.md'), old_string: 'a', new_string: 'b' } }).status, 2, '小寫 g2.md 繞過死路（Windows 大小寫不敏感 FS：requirement 對 G2 無寫入權）');
setNode2('plan');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/demo/001/G3.md'), content: 'x' } }).status, 0, 'plan 段寫 G3 放行');
setNode2('verify');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } }).status, 0, 'verify 段寫 G1 回指區放行（AC 判定收斂寫入；定義區由 CLI 分區 hash 兜底）');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, 'src/b.js'), content: 'x' } }).status, 2, 'verify 段寫 repo 實作檔仍由寫入矩陣攔（G 矩陣不影響既有矩陣）');
// ROM 區雜檔閘：<slug>/<nnn>/ 僅承載 G1~G3.md
const romJunk = run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/demo/001/intent.md'), content: 'x' } });
assert.equal(romJunk.status, 2, 'ROM 區雜檔（intent.md）擋——中間產物一律 tmp');
assert.match(romJunk.stderr, /ROM 區|tmp/);
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/archive/demo/001/notes.md'), content: 'x' } }).status, 2, 'archive 區雜檔同擋');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/tmp/evidence.md'), content: 'x' } }).status, 0, 'tmp 傾倒放行');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/tmp/x/y.md'), content: 'x' } }).status, 0, 'tmp 巢狀子目錄放行（RAM 區格式不做規範）');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/demo/SLUG.md'), content: 'x' } }).status, 0, 'SLUG.md（<slug>/ 層）放行');
console.log('sb-hooks: PASS');
