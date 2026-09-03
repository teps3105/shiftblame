// sb-ablation：框架本體消融矩陣（1.8.0）——消融原則的治理層落地（SKILL §1.8）
//
// 每個 MUST 級機制執行消融實驗：
//   ① intact 對照——原始源碼上跑 probe，期待防護在（擋下／記錄發生）；
//   ② neutralize ——把機制源碼字串替換拆掉，寫臨時檔；
//   ③ ablated probe——同一操作指向臨時檔，期待防護消失（放行／記錄不發生）。
// 兩者都成立＝該機制是行為的唯一因果源（消融證明）；
// 拆掉仍擋／仍記錄＝殘留或貢獻歸屬錯誤——列退役審查（老闆拍板）。
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARD = join(repo, 'hooks', 'shiftblame-guard.mjs');
const SB = join(repo, 'cli', 'bin', 'sb.mjs');

const BDD_G1 = '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n';
const G2 = '# 技術\n使用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴。';
const G3 = '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=畫面顯示完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。';

function mkSandbox({ state = {}, files = {}, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sb-abl-'));
  mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
  for (const [p, c] of Object.entries(files)) {
    const full = join(root, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, c);
  }
  writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', history: [], ...state }));
  if (git) {
    spawnSync('git', ['init'], { cwd: root });
    writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
    writeFileSync(join(root, 'app.txt'), 'x\n');
    spawnSync('git', ['add', '.'], { cwd: root });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: init'], { cwd: root });
  }
  return root;
}
const hookRun = (script, payload) => spawnSync(process.execPath, [script], { input: JSON.stringify(payload), encoding: 'utf8' });
const cliRun = (script, root, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
const stateOf = (root) => JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));

const NEU_DIRS = [];
process.on('exit', () => { for (const d of NEU_DIRS) rmSync(d, { recursive: true, force: true }); });

function neutralize(srcPath, pairs) {
  let t = readFileSync(srcPath, 'utf8');
  for (const [o, n] of pairs) {
    if (!t.includes(o)) throw new Error(`neutralize 未命中：${o.slice(0, 60)}`);
    t = t.split(o).join(n);
  }
  const dir = mkdtempSync(join(tmpdir(), 'sb-neu-'));
  NEU_DIRS.push(dir);
  const out = join(dir, 'ablated.mjs');
  writeFileSync(out, t);
  return out;
}

const ABLATIONS = [];
const ablation = (name, fn) => ABLATIONS.push({ name, fn });

// —— hooks 機制（guard.mjs）——
ablation('停等凍結 checkHoldFreeze（1.7.2 主動觸發停等）', () => {
  const neu = neutralize(GUARD, [['function checkHoldFreeze(root, tool, cmd, toolInput) {\n  if (!root) return null;', 'function checkHoldFreeze(root, tool, cmd, toolInput) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'build', understandingHold: { inputIdx: 0 } } }); mkdirSync(join(r, 'src'), { recursive: true }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(r, 'src/a.js'), old_string: 'a', new_string: 'b' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：hold 期間 repo Edit 被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉凍結後放行（防護消失）');
});

ablation('G 檔寫入矩陣 checkGFileMatrix（1.8.1 RAM/ROM 分區）', () => {
  const neu = neutralize(GUARD, [['function checkGFileMatrix(root, toolInput) {\n  if (!root) return null;', 'function checkGFileMatrix(root, toolInput) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'requirement' }, files: { '.shiftblame/demo/001/G2.md': 'x' } }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(r, '.shiftblame/demo/001/G2.md'), old_string: 'a', new_string: 'b' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：requirement 段寫 G2 被擋（G2 寫入權屬 research/build——跨區死路）');
  assert.equal(payload(neu), 0, 'ablated：拆掉矩陣後綁架上游放行');
});

ablation('狀態寫入矩陣 checkStateWriteMatrix（測試/實作碼段位）', () => {
  const neu = neutralize(GUARD, [['function checkStateWriteMatrix(root, toolInput) {\n  if (!root) return null;', 'function checkStateWriteMatrix(root, toolInput) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'intent' } }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(r, 'src/a.js'), old_string: 'a', new_string: 'b' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：intent 段寫 repo 實作檔被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉段位矩陣後放行');
});

ablation('層間停靠鎖 checkLayerStopover（老闆決策邊 --boss-ok）', () => {
  const neu = neutralize(GUARD, [['function checkLayerStopover(root, cmd) {\n  if (!root) return null;', 'function checkLayerStopover(root, cmd) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'intent' } }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next requirement' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：intent→requirement 缺 --boss-ok 被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉停靠鎖後繞過推進');
});

ablation('commit 印章閘 checkCommitStamp（提交流痕）', () => {
  const neu = neutralize(GUARD, [['function checkCommitStamp(root, seg) {\n  const extracted = extractCommitMessage(seg);', 'function checkCommitStamp(root, seg) {\n  return null; // ABLATED\n  const extracted = extractCommitMessage(seg);']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'build' }, git: true }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：無章 git commit 被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉印章閘後無章提交放行');
});

ablation('破壞性命令防護 scanInlineDestructive（相對路徑遞迴刪除）', () => {
  const neu = neutralize(GUARD, [['function scanInlineDestructive(cmd) {', 'function scanInlineDestructive(cmd) {\n  return null; // ABLATED']]);
  const payload = (script) => { const r = mkSandbox(); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf somedir' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：相對路徑 rm -rf 被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉防護後危險命令放行');
});

ablation('輸入流 recordInput（雙流模型 1.7.0——唯增事實）', () => {
  const neu = neutralize(GUARD, [['function recordInput(root, prompt) {\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return null;', 'function recordInput(root, prompt) {\n  return null; // ABLATED\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return null;']]);
  const payload = (script) => { const r = mkSandbox(); hookRun(script, { cwd: r, hook_event_name: 'UserPromptSubmit', prompt: '消融實驗輸入' }); const n = stateOf(r).inputs?.length ?? 0; rmSync(r, { recursive: true, force: true }); return n; };
  assert.equal(payload(GUARD), 1, 'intact：輸入落流（唯增）');
  assert.equal(payload(neu), 0, 'ablated：拆掉後輸入不落流（曝光鏈斷）');
});

ablation('停等狀態機（recordInput 內 understandingHold 設置，1.7.2）', () => {
  const neu = neutralize(GUARD, [['if (ACTIVE_TRIGGER_RE.test(String(prompt ?? \'\'))) {', 'if (false && ACTIVE_TRIGGER_RE.test(String(prompt ?? \'\'))) { // ABLATED']]);
  const payload = (script) => { const r = mkSandbox(); hookRun(script, { cwd: r, hook_event_name: 'UserPromptSubmit', prompt: '/sb-think 開新需求理解' }); const has = !!stateOf(r).understandingHold; rmSync(r, { recursive: true, force: true }); return has; };
  assert.equal(payload(GUARD), true, 'intact：主動觸發設 hold');
  assert.equal(payload(neu), false, 'ablated：拆掉後主動觸發不設 hold（停等失效）');
});

ablation('理解流 recordUnderstanding（sb-think args＝理解宣告）', () => {
  const neu = neutralize(GUARD, [['function recordUnderstanding(root, tool, toolInput) {\n  if (!root || !/^skill$/i.test(String(tool ?? \'\'))) return;', 'function recordUnderstanding(root, tool, toolInput) {\n  return; // ABLATED\n  if (!root || !/^skill$/i.test(String(tool ?? \'\'))) return;']]);
  const payload = (script) => { const r = mkSandbox(); hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:sb-think', args: '理解：消融實驗的理解宣告驗證輸入' } }); const n = stateOf(r).understandings?.length ?? 0; rmSync(r, { recursive: true, force: true }); return n; };
  assert.equal(payload(GUARD), 1, 'intact：理解宣告落流');
  assert.equal(payload(neu), 0, 'ablated：拆掉後理解宣告不落流（行動正當性載體失效）');
});

// 1.8.1 退役：markAuditEvidence（auditEvidence 機制整個拆除——老闆裁定；本條目為消融實績記錄：拆掉→requirement 段查證不再寫狀態，流程不變）

ablation('外部證據標記 markExternalEvidence（1.6.0 外部性閘鑰匙）', () => {
  const neu = neutralize(GUARD, [['function markExternalEvidence(root, tool) {\n  if (!root) return;', 'function markExternalEvidence(root, tool) {\n  return; // ABLATED\n  if (!root) return;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'research' } }); hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); const d = !!stateOf(r).externalEvidence?.done; rmSync(r, { recursive: true, force: true }); return d; };
  assert.equal(payload(GUARD), true, 'intact：外部調用標記 externalEvidence');
  assert.equal(payload(neu), false, 'ablated：拆掉後外部調用不標記（外部性閘鑰匙失效）');
});

ablation('hooks 心跳 beatHeartbeat（1.6.1 診斷）', () => {
  const neu = neutralize(GUARD, [['function beatHeartbeat(root, event) {\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return;', 'function beatHeartbeat(root, event) {\n  return; // ABLATED\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return;']]);
  const payload = (script) => { const r = mkSandbox(); hookRun(script, { cwd: r, hook_event_name: 'SessionStart', source: 'startup' }); const ok = existsSync(join(r, '.shiftblame/tmp/hooks-heartbeat.json')); rmSync(r, { recursive: true, force: true }); return ok; };
  assert.equal(payload(GUARD), true, 'intact：hooks 成功執行寫心跳');
  assert.equal(payload(neu), false, 'ablated：拆掉後無心跳（健康診斷失效）');
});

ablation('staged 系統檔不入庫 checkStaged（CARD⑥）', () => {
  const neu = neutralize(GUARD, [['function checkStaged(root) {\n  if (!root) return null;', 'function checkStaged(root) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => {
    const r = mkSandbox({ state: { node: 'build', adversarialAt: new Date().toISOString(), adversarialConsumed: false }, git: true });
    writeFileSync(join(r, '.shiftblame/tmp/commit-stamp.json'), JSON.stringify({ message: 'feat: 消融實驗的提交訊息長度合格', cwd: r, issuedAt: new Date().toISOString() }));
    spawnSync('git', ['add', '-f', '.shiftblame/flow-state.json'], { cwd: r });
    const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: 消融實驗的提交訊息長度合格"' } });
    rmSync(r, { recursive: true, force: true });
    return h.status;
  };
  assert.equal(payload(GUARD), 2, 'intact：staged 含 .shiftblame 系統檔被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉後系統檔入庫放行');
});

ablation('提交期暫存繞過 checkCommitTimeStaging（-a/--only/pathspec）', () => {
  const neu = neutralize(GUARD, [['function checkCommitTimeStaging(seg) {', 'function checkCommitTimeStaging(seg) {\n  return null; // ABLATED']]);
  const payload = (script) => {
    const r = mkSandbox({ state: { node: 'build', adversarialAt: new Date().toISOString(), adversarialConsumed: false }, git: true });
    writeFileSync(join(r, '.shiftblame/tmp/commit-stamp.json'), JSON.stringify({ message: 'feat: 消融實驗的提交訊息長度合格', cwd: r, issuedAt: new Date().toISOString() }));
    const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -a -m "feat: 消融實驗的提交訊息長度合格"' } });
    rmSync(r, { recursive: true, force: true });
    return h.status;
  };
  assert.equal(payload(GUARD), 2, 'intact：commit -a 提交期暫存繞過被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉後繞過 staged 事實清單提交');
});

ablation('git alias 定義攔截 checkGitAliasWrite', () => {
  const neu = neutralize(GUARD, [['function checkGitAliasWrite(cmd) {', 'function checkGitAliasWrite(cmd) {\n  return null; // ABLATED']]);
  const payload = (script) => {
    const r = mkSandbox({ state: { node: 'build', adversarialAt: new Date().toISOString(), adversarialConsumed: false }, git: true });
    writeFileSync(join(r, '.shiftblame/tmp/commit-stamp.json'), JSON.stringify({ message: 'feat: 消融實驗的提交訊息長度合格', cwd: r, issuedAt: new Date().toISOString() }));
    const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: "git config alias.z 'status'" } });
    rmSync(r, { recursive: true, force: true });
    return h.status;
  };
  assert.equal(payload(GUARD), 2, 'intact：alias 定義（可包裝 commit 繞閘）被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉後 alias 繞過通道開啟');
});

ablation('git 路徑重定向攔截 checkGitRedirect（GIT_DIR/--git-dir）', () => {
  const neu = neutralize(GUARD, [['function checkGitRedirect(cmd) {', 'function checkGitRedirect(cmd) {\n  return null; // ABLATED']]);
  const payload = (script) => {
    const r = mkSandbox({ state: { node: 'build', adversarialAt: new Date().toISOString(), adversarialConsumed: false }, git: true });
    writeFileSync(join(r, '.shiftblame/tmp/commit-stamp.json'), JSON.stringify({ message: 'feat: 消融實驗的提交訊息長度合格', cwd: r, issuedAt: new Date().toISOString() }));
    const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'GIT_DIR=elsewhere git commit -m "feat: 消融實驗的提交訊息長度合格"' } });
    rmSync(r, { recursive: true, force: true });
    return h.status;
  };
  assert.equal(payload(GUARD), 2, 'intact：GIT_DIR 重定向（root 錨定失效）被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉後重定向繞過 root 錨定');
});

// —— CLI 機制（sb.mjs）——
ablation('CLI 老闆決策邊鑰匙閘 needsBossOk（CARD②③ CLI 層）', () => {
  const neu = neutralize(SB, [["const needsBossOk = (from, to) =>\n  (from === 'intent' && to === 'requirement') || (from === 'plan' && to === 'test') || (from === 'verify' && to === 'done');", "const needsBossOk = (from, to) =>\n  false && ((from === 'intent' && to === 'requirement') || (from === 'plan' && to === 'test') || (from === 'verify' && to === 'done')); // ABLATED"]]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'intent' }, files: { '.shiftblame/demo/001/G1.md': BDD_G1 } }); const h = cliRun(script, r, 'next', 'requirement'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：intent→requirement 缺 --boss-ok 被 CLI 擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉後 CLI 層繞過決策邊（hooks 層獨撐）');
});

ablation('CLI 時點對抗宣告閘 adversarialEdge×adversarialLog point 對照（CARD③ CLI 層，1.8.1 RAM/ROM）', () => {
  const neu = neutralize(SB, [['  const adv = adversarialEdge(st.node, target);\n  if (adv) {', '  const adv = adversarialEdge(st.node, target);\n  if (false && adv) { // ABLATED']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'plan' }, files: { '.shiftblame/demo/001/G1.md': BDD_G1, '.shiftblame/demo/001/G2.md': G2, '.shiftblame/demo/001/G3.md': G3 } }); const h = cliRun(script, r, 'next', 'test', '--boss-ok'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：plan→test 缺 --adversarial 宣告被 CLI 擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉後無對抗宣告即放行');
});

ablation('時點對抗 point 條目對照（--adversarial 對照源＝adversarialLog，1.8.1）', () => {
  const neu = neutralize(SB, [['      const entry = (st.adversarialLog ?? []).filter((e) => e.point === adv.point).at(-1);', '      const entry = null; // ABLATED']]);
  const mk = (script, withPt) => { const r = mkSandbox({ state: { node: 'plan', adversarialLog: withPt ? [{ at: '2026-01-01T00:00:00Z', report: 'x', verdict: '通過', node: 'plan', point: '①' }] : [] }, files: { '.shiftblame/demo/001/G1.md': BDD_G1, '.shiftblame/demo/001/G2.md': G2, '.shiftblame/demo/001/G3.md': G3 } }); const h = cliRun(script, r, 'next', 'test', '--boss-ok', '--adversarial'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(mk(SB, false), 1, 'intact：無 point 條目即擋（RAM 對照源）');
  assert.equal(mk(SB, true), 0, 'intact：point 條目存在→過（新鮮度：無前次同邊推進）');
  assert.equal(mk(neu, true), 1, 'ablated：拆掉條目對照後仍擋於其他閘或放行不一致（條目存在卻被當無）');
});

ablation('外部證據閘（research→plan 邊驗，1.6.0）', () => {
  const neu = neutralize(SB, [['if (st.node === \'research\' && target === \'plan\' && !st.externalEvidence?.done) {', 'if (false && st.node === \'research\' && target === \'plan\' && !st.externalEvidence?.done) { // ABLATED']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'research' }, files: { '.shiftblame/demo/001/G2.md': G2, '.shiftblame/demo/001/G3.md': G3 } }); const h = cliRun(script, r, 'next', 'plan'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：零外部調用推進被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉外部性閘後閉門推進放行');
});

// 1.8.1 退役：CLI 審計痕跡閘（requirement→research 邊驗 auditEvidence——機制拆除；該邊由 BDD 格式閘把關）

ablation('BDD 行為規格閘 validateG1Acceptance（1.7.3＋1.8.0 消融鍵）', () => {
  const neu = neutralize(SB, [['function validateG1Acceptance(g1, problems, passes) {\n  const rows = acRows(g1);', 'function validateG1Acceptance(g1, problems, passes) {\n  return []; // ABLATED\n  const rows = acRows(g1);']]);
  const badG1 = BDD_G1.replace('- 消融：拿掉則無法送出且看不到結果\n', ''); // 僅刪消融行——第六鍵的隔離擋下證明（其餘五鍵完好）
  const payload = (script) => { const r = mkSandbox({ state: { node: 'requirement' }, files: { '.shiftblame/demo/001/G1.md': badG1 } }); const h = cliRun(script, r, 'next', 'research'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：BDD 缺第六鍵消融被擋（其餘五鍵完好——隔離證明）');
  assert.equal(payload(neu), 0, 'ablated：拆掉規格閘後模板照抄即過');
});

ablation('G1 契約核對（放行後偏離即擋，1.5.x）', () => {
  const neu = neutralize(SB, [['if (st.g1Contract?.ms === st.ms && target !== \'intent\') {', 'if (false && st.g1Contract?.ms === st.ms && target !== \'intent\') { // ABLATED']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'build', g1Contract: { ms: '001', file: join(r_placeholder(), 'G1.md'), sha256: 'deadbeef'.repeat(8) } }, files: { '.shiftblame/demo/001/G1.md': '# 驗收\n被改動。' } }); const h = cliRun(script, r, 'next', 'verify'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：G1 偏離放行契約被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉核對後契約漂移放行');
  function r_placeholder() { return '.shiftblame/demo/001'; }
});

ablation('陳述對照閘（commitmsg 內永續層機制引用驗，1.7.1）', () => {
  const neu = neutralize(SB, [['    if (eternal.length) {', '    if (false && eternal.length) { // ABLATED']]);
  const payload = (script) => {
    const r = mkSandbox({ state: { node: 'build', adversarialAt: new Date().toISOString(), adversarialConsumed: false }, git: true });
    mkdirSync(join(r, 'docs'), { recursive: true });
    writeFileSync(join(r, 'docs/guide.md'), '執行 sb fakecmd --notexist 開始\n');
    spawnSync('git', ['add', 'docs/guide.md'], { cwd: r });
    const h = cliRun(script, r, 'commitmsg', 'feat: 消融實驗的提交訊息長度合格');
    rmSync(r, { recursive: true, force: true });
    return h.status;
  };
  assert.equal(payload(SB), 1, 'intact：永續層虛構命令被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉對照閘後過時假設入庫放行');
});

ablation('輪次快照 snapshotRev（1.7.3 修正輪基線凍結）', () => {
  const neu = neutralize(SB, [['function snapshotRev(st) {\n  const dir = msDir(st);', 'function snapshotRev(st) {\n  return null; // ABLATED\n  const dir = msDir(st);']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'plan' }, files: { '.shiftblame/demo/001/G1.md': BDD_G1 } }); cliRun(script, r, 'next', 'intent'); const ok = existsSync(join(r, '.shiftblame/demo/001/rev/r01/G1.md')); rmSync(r, { recursive: true, force: true }); return ok; };
  assert.equal(payload(SB), true, 'intact：回 intent 凍結 rev/r01 基線');
  assert.equal(payload(neu), false, 'ablated：拆掉後多輪疊加無時序錨');
});

// —— 執行矩陣——
let pass = 0;
const fails = [];
for (const { name, fn } of ABLATIONS) {
  try { fn(); pass++; console.log(`PASS [消融] ${name}`); }
  catch (e) { fails.push(name); console.error(`FAIL [消融] ${name}：${e.message}`); }
}
assert.equal(fails.length, 0, `消融矩陣 ${fails.length} 項失敗：${fails.join('；')}`);
console.log(`sb-ablation: PASS（${pass}/${ABLATIONS.length} 機制——intact 對照＋拆掉→防護消失成對成立）`);
