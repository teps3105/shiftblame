// sb-hooks：對話承載（流不落檔——回合邊界＋零內容寫入）＋外部證據＋寫入矩陣＋停靠鎖＋commit 印章＋破壞性防護＋心跳＋inject 歸因
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
const setNode = (n) => writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: n, history: [], ...(n === 'ended' ? { endedAt: new Date().toISOString() } : {}) }));

// —— 1. 對話承載（2.5.2 流不落檔）：UserPromptSubmit＝回合邊界（模式追蹤重置、零內容寫入）；理解宣告由對話承載 ——
const up = (prompt) => run({ hook_event_name: 'UserPromptSubmit', prompt });
let r = up('隨便說什麼都行');
assert.equal(r.status, 0);
assert.equal(state().inputs, undefined, '輸入不落檔（對話事實由平台承載）');
assert.equal(state().dialogueLock, undefined, '無對話鎖欄位');
// 理解宣告：Skill(shiftblame:think) args 於對話揭露——state 不長 understandings
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：這是對話承載模型的測試輸入序列' } });
assert.equal(r.status, 0, 'Skill 調用放行');
assert.equal(state().understandings, undefined, '理解宣告不落檔（對話承載——老闆讀對話即審）');
r = run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'fake-think-evil', args: '理解：偽技能名的假理解宣告內容' } });
assert.equal(r.status, 0, 'Skill 調用一律放行（機械不判定語義——路由紀律由對話曝光承擔）');
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

// —— 3. 必然曝光已隨理解流拆除（2.5.2 對話承載）：UserPromptSubmit 注入＝不變量卡＋段位＋停點申報——無檔案側理解審視行 ——
r = up('曝光驗證輸入');
assert.equal(r.status, 0);
const upCtx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
assert.ok(upCtx.includes('[shiftblame 不變量]'), '不變量卡注入');
assert.ok(!upCtx.includes('理解審視'), '無檔案側曝光行（理解宣告由 think args 於對話揭露——老闆讀對話即審）');

// —— 4. SessionStart 動態狀態卡（壓縮後回流：段位＋停點申報——機械事實；對話過程由平台摘要承載） ——
setNode('plan');
const ss2 = run({ hook_event_name: 'SessionStart', source: 'compact' });
assert.equal(ss2.status, 0);
assert.ok(ss2.stdout.includes('冷啟動載入'), '靜態卡');
assert.ok(ss2.stdout.includes('@ plan'), '段位');

// —— 5. 回合接續契約在輸入／重啟時注入；Stop 不代改流程或反覆喚醒 ——
for (const payload of [
  { hook_event_name: 'SessionStart' },
  { hook_event_name: 'UserPromptSubmit', prompt: '先解釋這個疑問' },
]) {
  const result = run(payload);
  assert.equal(result.status, 0);
  const context = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(context.hookEventName, payload.hook_event_name);
  for (const rule of ['回合結束≠流程完成', 'commentary 解答後接續已授權未完工作', 'sb next intent', 'sb state 查證', '應分發者已分發', '主動 think 停等', '明確暫停／取消', '停點偵測（防偷懶停）', 'sb stop-report']) {
    assert.ok(context.additionalContext.includes(rule), `${payload.hook_event_name} 注入接續規則：${rule}`);
  }
}
// Stop＝停點偵測：活動流程（intent~verify）無本回合申報即停＝擋停一次（條件式、單次、不代做路由）；
// 有申報／stop_hook_active／停等／done／ended／無流程放行。
for (const node of ['intent', 'plan', 'build', 'verify']) {
  setNode(node);
  up('停點偵測回合輸入（回合邊界——申報新鮮度基準 turnUsage 於回合內第一個工具調用重建）');
  const before = state();
  delete before.hooksHeartbeat; // 心跳隨每次 hook 執行更新——比對事實面時排除
  const blocked = run({ hook_event_name: 'Stop', last_assistant_message: '先停在這' });
  assert.equal(blocked.status, 2, node + '：無申報之停擋停一次（停點偵測）');
  assert.match(blocked.stderr, /停點偵測/, '擋停訊息要求「續行或申報」');
  assert.equal(state().stopBlockedAt !== undefined, true, '擋停寫自限標記（本回合至多擋一次）');
  const pass2 = run({ hook_event_name: 'Stop', last_assistant_message: '再停一次' });
  assert.equal(pass2.status, 0, node + '：第二次停走自限放行（單次——不無限循環擋停）');
  const st2 = state();
  delete st2.hooksHeartbeat; delete st2.stopBlockedAt;
  assert.deepEqual(st2, before, 'Stop 不改流程節點與狀態事實（不代做路由）');
  // 本回合申報：放行（新鮮度＝at 晚於 turnUsage.startedAt；up 已刪 turnUsage → startedAt 缺省＝恆新鮮）
  const stNow = state();
  stNow.stopReport = { at: new Date().toISOString(), node, question: '需要老闆決定是否引入新依賴以完成此功能', reviewed: false };
  delete stNow.stopBlockedAt;
  writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify(stNow));
  const declared = run({ hook_event_name: 'Stop', last_assistant_message: '已申報待決，停' });
  assert.equal(declared.status, 0, node + '：有本回合申報放行');
  // stop_hook_active：放行（平台自限雙保險）
  const stH = state();
  delete stH.stopReport; delete stH.stopBlockedAt;
  writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify(stH));
  const hookActive = run({ hook_event_name: 'Stop', stop_hook_active: true, last_assistant_message: '平台已擋過一次' });
  assert.equal(hookActive.status, 0, node + '：stop_hook_active 放行');
}
for (const node of ['done', 'ended']) {
  setNode(node);
  const result = run({ hook_event_name: 'Stop', last_assistant_message: '完成態停' });
  assert.equal(result.status, 0, node + '：done／ended 停點本就合法放行');
}
setNode('ended');
r = run({ hook_event_name: 'Stop', last_message: '方案〔待確認〕' });
assert.equal(r.status, 0, 'Stop 放行（ended——非活動流程不偵測）');
assert.equal(state().dialogueLock, undefined, '無上鎖動作（撤鎖）');

// —— 6. 段-檔寫入矩陣 ——
const W = (node, tool, target) => {
  setNode(node);
  return run({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { file_path: target } });
};
assert.equal(W('verify', 'Edit', 'src/app.js').status, 2, 'verify 段 repo 唯讀');
assert.equal(W('verify', 'Edit', join(root, '.shiftblame', 'demo', 'SLUG.md')).status, 0, '.shiftblame 永遠可寫');
assert.equal(W('build', 'Edit', 'src/app.js').status, 0, 'build 段寫實作');
assert.equal(W('ended', 'Edit', 'docs/guide.md').status, 0, 'ended 收尾歸檔');
assert.equal(W('test', 'Edit', 'test/app.test.js').status, 0, 'test 段寫測試碼');
assert.equal(W('build', 'Edit', 'test/app.test.js').status, 0, 'build 段寫測試碼放行（測試碼寫入權 test＋build——隨功能實作同 commit 定稿）');
assert.equal(W('plan', 'Edit', 'test/app.test.js').status, 2, '測試碼寫入權屬 test＋build 段（實作層）——定義層擋');

// —— 7. 層間停靠雙重鎖：requirement 段 sb next research 缺 --boss-ok 即擋（hooks 同判據——時點 1 對抗在前老闆判定在後）——
setNode('requirement');
const st1 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next research --adversarial' } });
assert.equal(st1.status, 2);
assert.match(st1.stderr, /老闆決策邊/);
const st2 = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next research --boss-ok --adversarial' } });
assert.equal(st2.status, 0, '帶 --boss-ok 放行');

// —— 8. commit 印章閘（hooks 端：驗章焚章——印章唯一憑證）——
setNode('build');
const noStamp = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
assert.equal(noStamp.status, 2);
assert.match(noStamp.stderr, /缺少 commit 印章/);
writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: x', cwd: root, issuedAt: new Date().toISOString() }));
// 發章＝寫入類流程命令（SHELL_WRITE_HINT_RE 含 sb 子命令）：斷路器模式追蹤全清——被擋的 commit 重跑有了新基礎
run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb commitmsg "feat: x"' } });
const ok = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
assert.equal(ok.status, 0, '發章後同命令 commit 放行（寫入清表——真實流程「擋→發章→commit」不被模式①誤擋）');
assert.equal(existsSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json')), false, '驗章後焚章——印章一次性');

// —— 8.5 文件鐵律：框架 repo 的 .md 純追加（零刪改）不得 commit；實質重寫（有刪有改）與新增檔放行 ——
{
  mkdirSync(join(root, 'skills', 'shiftblame'), { recursive: true });
  mkdirSync(join(root, 'hooks'), { recursive: true });
  writeFileSync(join(root, 'skills', 'shiftblame', 'SKILL.md'), '# framework\n');
  writeFileSync(join(root, 'hooks', 'shiftblame-guard.mjs'), '// anchor\n'); // 文件鐵律雙錨定
  writeFileSync(join(root, 'README.md'), '# 專案\n說明。\n');
  spawnSync('git', ['init'], { cwd: root });
  writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
  spawnSync('git', ['add', '.'], { cwd: root });
  spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'init'], { cwd: root });
  const issue = (msg) => writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: msg, cwd: root, issuedAt: new Date().toISOString() }));
  // 純追加：擋（README.md 已在 HEAD——修改檔新增＞0 刪除＝0；且不消費印章——擋截在印章驗證前）
  writeFileSync(join(root, 'README.md'), '# 專案\n說明。\n追加段（未理順舊文）。\n');
  spawnSync('git', ['add', 'README.md'], { cwd: root });
  issue('feat: 測試文件鐵律');
  const blocked = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 測試文件鐵律"' } });
  assert.equal(blocked.status, 2, '框架 repo 的 .md 純追加 commit 擋下');
  assert.match(blocked.stderr, /文件鐵律/, '擋截訊息要求理順邏輯實質重寫');
  assert.equal(existsSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json')), true, '擋停在印章驗證前——印章不消費');
  // 實質重寫（有刪有改）：放行（印章一併消費；發章＝寫入類命令清斷路器模式表——同命令 commit 為新基礎）
  writeFileSync(join(root, 'README.md'), '# 專案（理順後）\n說明改寫。\n');
  spawnSync('git', ['add', 'README.md'], { cwd: root });
  issue('feat: 測試文件鐵律');
  run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb commitmsg "feat: 測試文件鐵律"' } });
  const rewritten = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 測試文件鐵律"' } });
  assert.equal(rewritten.status, 0, '實質重寫（有刪有改）放行');
  assert.equal(existsSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json')), false, '印章已消費');
  // 新增檔豁免：放行（skills 下新 .md——HEAD 無此檔）
  writeFileSync(join(root, 'skills', 'shiftblame', 'new-doc.md'), '# 新文件\n全新內容。\n');
  spawnSync('git', ['add', 'new-doc.md'], { cwd: root });
  issue('feat: 測試文件鐵律新增檔');
  const added = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 測試文件鐵律新增檔"' } });
  assert.equal(added.status, 0, '新增檔（HEAD 無此檔）豁免——放行');
  // 清理：移除框架錨定與 git，還原共享沙箱
  rmSync(join(root, 'skills'), { recursive: true, force: true });
  rmSync(join(root, '.git'), { recursive: true, force: true });
  rmSync(join(root, 'README.md'), { force: true });
}

// —— 9. 破壞性命令：相對路徑＋重定向截斷 ——
const bad = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo hi > out.txt' } });
assert.equal(bad.status, 2);
assert.match(bad.stderr, /破壞性操作/);

// —— 10. 主動觸發停等已隨理解流拆除（2.5.2 對話承載）：/shiftblame:think 輸入＝回合邊界如常——機械零凍結，寫入回到段位矩陣判定；停等紀律由對話層（think 揭露＋老闆終審＋sb stop-report 申報）承擔 ——
setNode('build');
const activeSlash = up('/shiftblame:think 幫我做理解呈現');
assert.equal(activeSlash.status, 0, '主動觸發輸入照常處理');
assert.equal(state().understandingHold, undefined, '零機械凍結（understandingHold 已拆——對話承載）');
const holdEdit = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, 'src/a.js'), old_string: 'a', new_string: 'b' } });
assert.equal(holdEdit.status, 0, '寫入由段位矩陣判定（build 段放行——停等屬對話層紀律非機械閘）');
const holdSb = run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node cli/bin/sb.mjs state' } });
assert.equal(holdSb.status, 0, 'sb state 唯讀照常放行');
// —— 11. G 檔寫入矩陣（RAM/ROM 分區） ——
mkdirSync(join(root, '.shiftblame', 'demo', '001'), { recursive: true });
const setNode2 = (n) => writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: n, history: [], ...(n === 'ended' ? { endedAt: new Date().toISOString() } : {}) }));
// requirement 段 Read repo 檔不寫任何標記（零殘留行為驗證）
mkdirSync(join(root, 'src'), { recursive: true });
setNode2('requirement');
const beforeRead = readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8');
run({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(root, 'src/a.js') } });
run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git log --oneline -3' } });
// hooksHeartbeat／回合計數（turnUsage／usageTotals）寫入 flow-state 是獲准的觀測狀態寫入；剝除後必須零殘留
const stripHb = (raw) => { const o = JSON.parse(raw); delete o.hooksHeartbeat; delete o.turnUsage; delete o.usageTotals; return JSON.stringify(o); };
assert.equal(stripHb(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8')), stripHb(beforeRead), '查證動作不寫狀態（RAM/ROM）');
const hbAfter = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8')).hooksHeartbeat;
assert.ok(hbAfter && hbAfter.at && hbAfter.event, 'hooksHeartbeat 落 flow-state（at＋event）');
// G 寫入矩陣：定義邊寫、落地邊唯讀
setNode2('requirement');
assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } }).status, 0, 'requirement 段寫 G1 放行（定義邊）');
const gKidnap = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G2.md'), old_string: 'a', new_string: 'b' } });
assert.equal(gKidnap.status, 2, 'requirement 段寫 G2 擋（G2 寫入權屬 research）');
assert.match(gKidnap.stderr, /G2|寫入權屬|無寫入權/, '綁架訊息指向重走 intent 開新輪');
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
// —— 11b. 返工輪 rewrite 載入閘：修正輪（rev 有值）寫 G 前必須本輪已調用 shiftblame:rewrite ——
// 文件陳述錨（SKILL §1：MUST 級機制的行為測試 MUST 附文件陳述錨——機制拆除時測試與錨同拆）
assert.ok(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'shiftblame', 'SKILL.md'), 'utf8').includes('返工輪 rewrite 載入閘'), '陳述錨：主 SKILL §1.7 仍述 rewrite 載入閘');
assert.ok(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'README.md'), 'utf8').includes('返工輪（rev 有值）hooks 驗本輪已調用本技能'), '陳述錨：README 技能條目仍述機械承載');
{
  const setRev = (n, extra = {}) => writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'requirement', history: [], ...(n != null ? { rev: n } : {}), ...extra }));
  setRev(null);
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } }).status, 0, '首輪（無 rev）寫 G1 放行——全新定義無堆疊風險');
  setRev(1);
  const blocked = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } });
  assert.equal(blocked.status, 2, '修正輪 r1 未載入 rewrite 寫 G1 擋');
  assert.match(blocked.stderr, /shiftblame:rewrite/, '擋訊息指向調用 shiftblame:rewrite');
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/demo/SLUG.md'), content: 'x' } }).status, 0, 'SLUG.md 不在 rewrite 載入閘（秘書層恆可寫——SLUG 紀律由技能承載）');
  for (const bad of ['rewrite', 'Rewrite', 'Shiftblame:Rewrite', 'shiftblame:rewrite-evil', 'xx_rewrite_yy', 'shiftblame:rerite']) {
    run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: bad } });
    assert.equal(state().rewriteSeen, undefined, `偽名／裸名／大小寫變體 ${bad} 不落 rewriteSeen（閘鑰匙全名大小寫敏感錨定）`);
  }
  run({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:rewrite' } });
  assert.equal(state().rewriteSeen.rev, 1, '全名調用落 rewriteSeen（rev 對齊當前輪）');
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } }).status, 0, '載入後本輪寫 G1 放行（同輪已載入即放行，免雙重設防）');
  setRev(2);
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } }).status, 2, '再返工（r2）須重新載入——每輪重驗');
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/archive/demo/001/G1.md'), content: 'x' } }).status, 0, '真歸檔形（.shiftblame/archive/<slug>/<ms>/G1.md——4 段）不匹配 G_FILE_RE／不在 rewrite 閘（路徑形不匹配即放行）');
  assert.equal(run({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `echo x > "${join(root, '.shiftblame/demo/001/G1.md')}"` } }).status, 0, 'Bash 直寫不在此層（既有殘餘面，如實標註）');
  writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'research', rev: 2, history: [] }));
  const kidnapRw = run({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } });
  assert.equal(kidnapRw.status, 2);
  assert.match(kidnapRw.stderr, /寫入權/, '段位違規優先報（G 矩陣在前、rewrite 閘在後）');
}
// —— 12. 接入異常模式：修復自由＋封閉面（git 寫入／sb 流程命令；唯讀白名單已除——修復是異常模式的目的）——
{
  const brokenRoot = mkdtempSync(join(tmpdir(), 'sb-health-'));
  process.on('exit', () => rmSync(brokenRoot, { recursive: true, force: true }));
  mkdirSync(join(brokenRoot, '.shiftblame', 'tmp'), { recursive: true });
  // 2.4.0 directState 放寬：{slug:null,node:null} 屬合法直接實行態（非異常）——異常面改用未知節點 fixture。
  writeFileSync(join(brokenRoot, '.shiftblame', 'flow-state.json'), JSON.stringify({ node: 'mystery', history: [] }));
  const hr = (payload) => spawnSync(process.execPath, [hook], { input: JSON.stringify({ cwd: brokenRoot, ...payload }), encoding: 'utf8' });
  const bash = (command) => hr({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
  assert.equal(bash('node repair-state.mjs').status, 0, '修復腳本放行');
  assert.equal(bash('rg -n "a|b|c" .').status, 0, '唯讀查證放行（正則 alternation 的管線字元在引號內——舊白名單誤擋實例）');
  assert.equal(bash('git status --porcelain').status, 0, 'git 唯讀診斷放行');
  const addDenied = bash('git add x.txt');
  assert.equal(addDenied.status, 2, 'git 寫入封閉');
  assert.match(addDenied.stderr, /接入異常/);
  assert.equal(bash('git -c user.name=t commit -m "x"').status, 2, '提交封閉');
  assert.equal(bash('node sb.mjs adversarial r.md --point 1').status, 2, 'sb 對抗宣告封閉（流程寫入——異常模式封閉）');
  assert.equal(bash('node sb.mjs state').status, 0, 'sb state 診斷放行');
  assert.equal(bash('sb init demo').status, 2, 'sb 流程命令（init）同封閉');
  assert.equal(hr({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(brokenRoot, '.shiftblame', 'flow-state.json'), content: '{"hooksHeartbeat":{"at":"2026-09-11T00:00:00.000Z","event":"SessionStart"}}' } }).status, 0, '寫入工具對 flow-state 修復放行');
  assert.equal(hr({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(brokenRoot, 'README.md'), content: 'x' } }).status, 2, '寫入工具對正式文件封閉');
  writeFileSync(join(brokenRoot, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'intent', history: [] }));
  assert.equal(bash('git add x.txt').status, 0, '修復完成（狀態可辨識）後 git 寫入恢復');
}
console.log('sb-hooks: pass');
