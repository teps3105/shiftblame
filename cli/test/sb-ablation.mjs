// sb-ablation：框架本體消融矩陣——消融原則的治理層落地（SKILL §1.8）
//
// 每個 MUST 級機制執行消融實驗：
//   ① intact 對照——原始源碼上跑 probe，期待防護在（擋下／記錄發生）；
//   ② neutralize ——把機制源碼字串替換拆掉，寫臨時檔；
//   ③ ablated probe——同一操作指向臨時檔，期待防護消失（放行／記錄不發生）。
// 兩者都成立＝該機制是行為的唯一因果源（消融證明）；
// 拆掉仍擋／仍記錄＝殘留或貢獻歸屬錯誤——列退役審查（老闆拍板）。
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

function mkSandbox({ state = {}, files = {}, git = false, flow = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sb-abl-'));
  mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
  for (const [p, c] of Object.entries(files)) {
    const full = join(root, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, c);
  }
  const s0 = { slug: 'demo', ms: '001', node: 'build', history: [], ...state };
  if (!['ended', 'done'].includes(s0.node)) { // 老闆輸入新鮮度對照組播種；ended/done 態輸入流已清（slug 邊界）不播
    s0.startedAt = s0.startedAt ?? new Date(Date.now() - 60000).toISOString();
    s0.inputs = s0.inputs ?? [{ at: new Date().toISOString(), text: '老闆：確認推進' }];
    // 未覆蓋即凍結對照組：理解宣告（正確雜湊鏈）覆蓋全部播種輸入——凍結閘不設防，消融隔離各機制自身；
    // state 明帶 understandings 者不播（recordUnderstanding 消融須從空理解流出發）
    if (s0.inputs.length > 0 && s0.understandings === undefined) {
      let prev = s0.understandingSeedHash ?? '';
      s0.understandings = s0.inputs.map((inp, i) => {
        const at = new Date(new Date(inp.at).getTime() + 1000).toISOString();
        const as = '理解宣告：老闆確認推進——消融對照組覆蓋輸入';
        const hash = createHash('sha256').update(prev + String(i) + as + at).digest('hex').slice(0, 16);
        prev = hash;
        return { at, uptoInput: i, as, reviewed: true, hash };
      });
    }
  }
  writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify(flow ? s0 : { inputs: [], ...state }));
  if (flow) {
    mkdirSync(join(root, '.shiftblame', 'demo'), { recursive: true });
    writeFileSync(join(root, '.shiftblame', 'demo', 'SLUG.md'), `---\nslug: demo\n---\n\n# demo\n`);
  }
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

function relocateShared(text) {
  return text.replace(/from ['"](?:\.\/|\.\.\/cli\/bin\/)flow-state\.mjs['"]/g, `from '${new URL('../../cli/bin/flow-state.mjs', import.meta.url).href}'`);
}

function neutralize(srcPath, pairs) {
  let t = readFileSync(srcPath, 'utf8');
  const crlf = t.includes('\r\n'); // 行尾自適應——消融配對字串以 \n 撰寫，源碼 CRLF／LF 皆命中（環境敏感缺陷修正）
  const fix = (x) => (crlf ? x.replace(/(?<!\r)\n/g, '\r\n') : x);
  for (const [o, n] of pairs) {
    const os = fix(o), ns = fix(n);
    if (!t.includes(os)) throw new Error(`neutralize 未命中：${o.slice(0, 60)}`);
    t = t.split(os).join(ns);
  }
  const dir = mkdtempSync(join(tmpdir(), 'sb-neu-'));
  NEU_DIRS.push(dir);
  const out = join(dir, 'ablated.mjs');
  // 消融檔在隔離目錄執行，仍指向同一份狀態分類實作。
  const shared = new URL('../../cli/bin/flow-state.mjs', import.meta.url).href;
  t = t.replace(/from ['"](?:\.\/|\.\.\/cli\/bin\/)flow-state\.mjs['"]/g, `from '${shared}'`);
  writeFileSync(out, t);
  return out;
}

// 消融結構守衛：neutralize 後的檔案仍須定義關鍵函數——否則 probe 綠燈是 hook 崩潰的 fail-open（偽因果）
const cutDefinesFunctions = (src) => /function absPath\(/.test(src) && /function checkStateWriteMatrix\(/.test(src) && /function checkGFileMatrix\(/.test(src);

const ABLATIONS = [];
const ablation = (name, fn) => ABLATIONS.push({ name, fn });

ablation('對抗報告落點（僅 tmp，含實體路徑）', () => {
  const broadWorkspace = neutralize(SB, [
    ['const rel = relative(TMP, file);', 'const rel = relative(SB_DIR, file);'],
    ['relative(realpathSync(TMP), realpathSync(file))', 'relative(realpathSync(SB_DIR), realpathSync(file))'],
  ]);
  const probe = (script) => {
    const root = mkSandbox({ files: { '.shiftblame/review.md': '對抗判定：通過\n' } });
    const result = cliRun(script, root, 'adversarial', '.shiftblame/review.md', '--point', '1');
    rmSync(root, { recursive: true, force: true });
    return result.status;
  };
  assert.equal(probe(SB), 1, 'intact：tmp 外工作報告拒絕');
  assert.equal(probe(broadWorkspace), 0, 'ablated：放寬回工作區即接受錯誤落點');
});

// —— hooks 機制（guard.mjs）——
ablation('接入健康閘（異常不降級為無流程）', () => {
  const broken = { slug: 'demo', ms: '001', node: null, history: [] }; // slug 殘缺流程＝健康閘 invalid、nodeOf null（寫入矩陣不接手——隔離健康閘自身因果；2.4.0 directState 放寬：全 null 骨架屬合法直接實行態）
  const hookProbe = (script) => {
    const r = mkSandbox({ state: broken });
    const result = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(r, 'README.md'), content: 'x' } });
    rmSync(r, { recursive: true, force: true });
    return result.status;
  };
  const noHookHealth = neutralize(GUARD, [['function checkStateHealth(root, tool, command, input) {', 'function checkStateHealth(root, tool, command, input) {\n  return null; // ABLATED']]);
  assert.equal(hookProbe(GUARD), 2, 'intact：異常狀態擋正式寫入');
  assert.equal(hookProbe(noHookHealth), 0, 'ablated：移除健康閘後 null 段位再次放行');
  const cliProbe = (script) => {
    const r = mkSandbox({ state: broken, files: { '.shiftblame/tmp/review-health.md': '對抗判定：通過\n' } });
    const result = cliRun(script, r, 'adversarial', '.shiftblame/tmp/review-health.md', '--point', '1');
    rmSync(r, { recursive: true, force: true });
    return result.status;
  };
  const noCliHealth = neutralize(SB, [
    ['function requireHealthyState() {', 'function requireHealthyState() {\n  return readFlowState(ROOT); // ABLATED'],
    ["if (current.kind !== 'active') die(['時點對抗需要有效 slug 流程；不開 slug 的直接實行無時點對抗（時點屬六段流程）']);", "if (false) die(['時點對抗需要有效 slug 流程；不開 slug 的直接實行無時點對抗（時點屬六段流程）']); // ABLATED"],
  ]);
  assert.equal(cliProbe(SB), 1, 'intact：異常狀態擋提交對抗宣告');
  assert.equal(cliProbe(noCliHealth), 0, 'ablated：移除健康閘後可在異常狀態宣告對抗');
});

ablation('停等凍結 checkHoldFreeze（主動觸發停等）', () => {
  const neu = neutralize(GUARD, [['function checkHoldFreeze(root, tool, cmd, toolInput) {\n  if (!root) return null;', 'function checkHoldFreeze(root, tool, cmd, toolInput) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'build', inputs: [{ at: '2026-09-09T00:00:00.000Z', text: '/shiftblame:think' }], understandingHold: { inputIdx: 0, at: '2026-09-09T00:00:00.000Z' } } }); mkdirSync(join(r, 'src'), { recursive: true }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(r, 'src/a.js'), old_string: 'a', new_string: 'b' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：hold 期間 repo Edit 被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉凍結後放行（防護消失）');
});

ablation('G 檔寫入矩陣 checkGFileMatrix（RAM/ROM 分區）', () => {
  const neu = neutralize(GUARD, [['function checkGFileMatrix(root, toolInput) {\n  if (!root) return null;', 'function checkGFileMatrix(root, toolInput) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'requirement' }, files: { '.shiftblame/demo/001/G2.md': 'x' } }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(r, '.shiftblame/demo/001/G2.md'), old_string: 'a', new_string: 'b' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：requirement 段寫 G2 被擋（G2 寫入權屬 research/build——跨區死路）');
  assert.equal(payload(neu), 0, 'ablated：拆掉矩陣後綁架上游放行');
});

ablation('返工輪 rewrite 載入閘 checkRewriteGate（修正輪寫 G 前必須本輪已調用 shiftblame:rewrite）', () => {
  const neu = neutralize(GUARD, [['function checkRewriteGate(root, toolInput) {\n  if (!root) return null;', 'function checkRewriteGate(root, toolInput) {\n  return null; // ABLATED\n  if (!root) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'requirement', rev: 1 }, files: { '.shiftblame/demo/001/G1.md': 'x' } }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(r, '.shiftblame/demo/001/G1.md'), old_string: 'a', new_string: 'b' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(GUARD), 2, 'intact：修正輪 r1 未載入 rewrite 寫 G1 被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉閘後未載入即可寫（機械強制失效）');
});

ablation('rewrite 載入記錄 recordRewriteSeen（閘鑰匙）', () => {
  const neu = neutralize(GUARD, [['function recordRewriteSeen(root, tool, toolInput) {\n  if (!root || !/^skill$/i.test(String(tool ?? \'\'))) return;', 'function recordRewriteSeen(root, tool, toolInput) {\n  return; // ABLATED\n  if (!root || !/^skill$/i.test(String(tool ?? \'\'))) return;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'requirement', rev: 1 } }); hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:rewrite' } }); const v = stateOf(r).rewriteSeen?.rev; rmSync(r, { recursive: true, force: true }); return v; };
  assert.equal(payload(GUARD), 1, 'intact：全名調用落 rewriteSeen（rev 對齊當前輪）');
  assert.equal(payload(neu), undefined, 'ablated：拆掉後調用不落檔（載入事實無法被閘看見）');
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
  const neu = neutralize(GUARD, [['function checkCommitStamp(root, seg) {', 'function checkCommitStamp(root, seg) {\n  return null; // ABLATED']]);
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

ablation('輸入流 recordInput（雙流模型——唯增事實）', () => {
  const neu = neutralize(GUARD, [['function recordInput(root, prompt) {\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return null;', 'function recordInput(root, prompt) {\n  return null; // ABLATED\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return null;']]);
  const payload = (script) => { const r = mkSandbox({ state: { inputs: [] } }); hookRun(script, { cwd: r, hook_event_name: 'UserPromptSubmit', prompt: '消融實驗輸入' }); const n = stateOf(r).inputs?.length ?? 0; rmSync(r, { recursive: true, force: true }); return n; };
  assert.equal(payload(GUARD), 1, 'intact：輸入落流（唯增）');
  assert.equal(payload(neu), 0, 'ablated：拆掉後輸入不落流（曝光鏈斷）');
});

ablation('停等狀態機（recordInput 內 understandingHold 設置）', () => {
  const neu = neutralize(GUARD, [['if (ACTIVE_TRIGGER_RE.test(String(prompt ?? \'\'))) {', 'if (false && ACTIVE_TRIGGER_RE.test(String(prompt ?? \'\'))) { // ABLATED']]);
  const payload = (script) => { const r = mkSandbox(); hookRun(script, { cwd: r, hook_event_name: 'UserPromptSubmit', prompt: '/shiftblame:think 開新需求理解' }); const has = !!stateOf(r).understandingHold; rmSync(r, { recursive: true, force: true }); return has; };
  assert.equal(payload(GUARD), true, 'intact：主動觸發設 hold');
  assert.equal(payload(neu), false, 'ablated：拆掉後主動觸發不設 hold（停等失效）');
});

ablation('理解流 recordUnderstanding（shiftblame:think args＝理解宣告）', () => {
  const neu = neutralize(GUARD, [['function recordUnderstanding(root, tool, toolInput) {\n  if (!root || !/^skill$/i.test(String(tool ?? \'\'))) return;', 'function recordUnderstanding(root, tool, toolInput) {\n  return; // ABLATED\n  if (!root || !/^skill$/i.test(String(tool ?? \'\'))) return;']]);
  const payload = (script) => { const r = mkSandbox({ state: { understandings: [] } }); hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：消融實驗的理解宣告驗證輸入' } }); const n = stateOf(r).understandings?.length ?? 0; rmSync(r, { recursive: true, force: true }); return n; };
  assert.equal(payload(GUARD), 1, 'intact：理解宣告落流');
  assert.equal(payload(neu), 0, 'ablated：拆掉後理解宣告不落流（行動正當性載體失效）');
});


ablation('外部證據標記 markExternalEvidence（外部性閘鑰匙）', () => {
  const neu = neutralize(GUARD, [['function markExternalEvidence(root, tool) {\n  if (!root) return;', 'function markExternalEvidence(root, tool) {\n  return; // ABLATED\n  if (!root) return;']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'research' } }); hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); const d = !!stateOf(r).externalEvidence?.done; rmSync(r, { recursive: true, force: true }); return d; };
  assert.equal(payload(GUARD), true, 'intact：外部調用標記 externalEvidence');
  assert.equal(payload(neu), false, 'ablated：拆掉後外部調用不標記（外部性閘鑰匙失效）');
});

ablation('hooks 心跳 beatHeartbeat（診斷）', () => {
  const neu = neutralize(GUARD, [['function beatHeartbeat(root, event) {\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return;', 'function beatHeartbeat(root, event) {\n  return; // ABLATED\n  if (!root || !existsSync(join(root, \'.shiftblame\'))) return;']]);
  const payload = (script) => { const r = mkSandbox(); hookRun(script, { cwd: r, hook_event_name: 'SessionStart', source: 'startup' }); const ok = !!(JSON.parse(readFileSync(join(r, '.shiftblame', 'flow-state.json'), 'utf8')).hooksHeartbeat) && !existsSync(join(r, '.shiftblame/tmp/hooks-heartbeat.json')); rmSync(r, { recursive: true, force: true }); return ok; };
  assert.equal(payload(GUARD), true, 'intact：hooks 成功執行更新 flow-state 心跳欄位（零散落 tmp 檔）');
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
  const neu = neutralize(SB, [["const needsBossOk = (from, to) =>\n  (from === 'intent' && to === 'requirement') || (from === 'requirement' && to === 'research') || (from === 'build' && to === 'verify');", "const needsBossOk = (from, to) =>\n  false && ((from === 'intent' && to === 'requirement') || (from === 'requirement' && to === 'research') || (from === 'build' && to === 'verify')); // ABLATED"]]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'intent' }, files: { '.shiftblame/demo/001/G1.md': BDD_G1 } }); const h = cliRun(script, r, 'next', 'requirement'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：intent→requirement 缺 --boss-ok 被 CLI 擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉後 CLI 層繞過決策邊（hooks 層獨撐）');
});

ablation('CLI 時點對抗宣告閘 adversarialEdge×adversarialLog point 對照（CARD③ CLI 層，RAM/ROM）', () => {
  const neu = neutralize(SB, [['  const adv = adversarialEdge(st.node, target);\n  if (adv) {', '  const adv = adversarialEdge(st.node, target);\n  if (false && adv) { // ABLATED']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'requirement' }, files: { '.shiftblame/demo/001/G1.md': BDD_G1 } }); const h = cliRun(script, r, 'next', 'research', '--boss-ok'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：requirement→research 缺 --adversarial 宣告被 CLI 擋（時點 1 對抗前置）');
  assert.equal(payload(neu), 0, 'ablated：拆掉後無對抗宣告即放行');
});

ablation('時點對抗 point 條目對照（--adversarial 對照源＝adversarialLog）', () => {
  const neu = neutralize(SB, [['      const entry = (st.adversarialLog ?? []).filter((e) => e.point === adv.point).at(-1);', '      const entry = null; // ABLATED']]);
  const mk = (script, withPt) => { const r = mkSandbox({ state: { node: 'requirement', adversarialLog: withPt ? [{ at: new Date().toISOString(), report: 'x', verdict: '通過', node: 'requirement', point: '1' }] : [] }, files: { '.shiftblame/demo/001/G1.md': BDD_G1 } }); const h = cliRun(script, r, 'next', 'research', '--boss-ok', '--adversarial'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(mk(SB, false), 1, 'intact：無 point 條目即擋（RAM 對照源）');
  assert.equal(mk(SB, true), 0, 'intact：point 條目存在→過（新鮮度：無前次同邊推進）');
  assert.equal(mk(neu, true), 1, 'ablated：拆掉條目對照後仍擋於其他閘或放行不一致（條目存在卻被當無）');
});

ablation('外部證據閘（research→plan 邊驗）', () => {
  const neu = neutralize(SB, [['if (st.node === \'research\' && target === \'plan\' && !st.externalEvidence?.done) {', 'if (false && st.node === \'research\' && target === \'plan\' && !st.externalEvidence?.done) { // ABLATED']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'research' }, files: { '.shiftblame/demo/001/G2.md': G2, '.shiftblame/demo/001/G3.md': G3 } }); const h = cliRun(script, r, 'next', 'plan'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：零外部調用推進被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉外部性閘後閉門推進放行');
});

ablation('老闆輸入新鮮度閘 bossFresh 主邊（--boss-ok 由老闆輸入承載——對抗章不替代老闆章）', () => {
  const neu = neutralize(SB, [['    if (!bossFresh(st, target)) {', '    if (false) { // ABLATED']]);
  const probe = (script) => { const r = mkSandbox({ state: { node: 'intent', inputs: [] } }); const h = cliRun(script, r, 'next', 'requirement', '--boss-ok'); rmSync(r, { recursive: true, force: true }); return h.stderr; };
  assert.match(probe(SB), /缺新鮮老闆輸入/, 'intact：無新鮮老闆輸入即擋（stop-report 申報停等路徑）');
  assert.doesNotMatch(probe(neu), /缺新鮮老闆輸入/, 'ablated：拆掉新鮮度閘——自蓋老闆章（僅旗標留痕）復活');
});

ablation('老闆輸入新鮮度閘 bossFresh pass 出口（next/end 鑰匙鏈同源）', () => {
  const neu = neutralize(SB, [['if (!bossFresh(st, \'ended\', { passExit: true })) die(', 'if (false) die( // ABLATED']]);
  const probe = (script) => { const r = mkSandbox({ state: { node: 'verify', inputs: [], adversarialLog: [{ at: new Date().toISOString(), report: 'x', verdict: '通過', node: 'verify', point: '2' }] } }); const h = cliRun(script, r, 'end', '--boss-ok'); rmSync(r, { recursive: true, force: true }); return h.stderr; };
  assert.match(probe(SB), /pass 結束缺新鮮老闆輸入/, 'intact：過期輸入不承載 pass 出口老闆決策');
  assert.doesNotMatch(probe(neu), /pass 結束缺新鮮老闆輸入/, 'ablated：拆掉出口新鮮度檢');
});


ablation('BDD 行為規格閘 validateG1Acceptance（消融鍵）', () => {
  const neu = neutralize(SB, [['function validateG1Acceptance(g1, problems, passes) {\n  const rows = acRows(g1);', 'function validateG1Acceptance(g1, problems, passes) {\n  return []; // ABLATED\n  const rows = acRows(g1);']]);
  const badG1 = BDD_G1.replace('- 消融：拿掉則無法送出且看不到結果\n', ''); // 僅刪消融行——第六鍵的隔離擋下證明（其餘五鍵完好）
  const payload = (script) => { const r = mkSandbox({ state: { node: 'requirement', adversarialLog: [{ at: new Date().toISOString(), report: 'x', verdict: '通過', node: 'requirement', point: '1' }] }, files: { '.shiftblame/demo/001/G1.md': badG1 } }); const h = cliRun(script, r, 'next', 'research', '--boss-ok', '--adversarial'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：BDD 缺第六鍵消融被擋（其餘五鍵完好——隔離證明）');
  assert.equal(payload(neu), 0, 'ablated：拆掉規格閘後模板照抄即過');
});

ablation('G1 契約核對（放行後偏離即擋）', () => {
  const neu = neutralize(SB, [["if (st.g1Contract?.ms === st.ms && target !== 'intent' && !(st.node === 'requirement' && target === 'research')) {", "if (false && st.g1Contract?.ms === st.ms && target !== 'intent' && !(st.node === 'requirement' && target === 'research')) { // ABLATED"]]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'build', inputs: [{ at: new Date().toISOString(), text: '老闆：時點 2 pass，開始驗收' }], adversarialLog: [{ at: new Date().toISOString(), report: 'x', verdict: '通過', node: 'build', point: '2' }], g1Contract: { ms: '001', file: join(r_placeholder(), 'G1.md'), sha256: 'deadbeef'.repeat(8) } }, files: { '.shiftblame/demo/001/G1.md': '# 驗收\n被改動。' } }); const h = cliRun(script, r, 'next', 'verify', '--boss-ok', '--adversarial'); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(payload(SB), 1, 'intact：G1 偏離放行契約被擋');
  assert.equal(payload(neu), 0, 'ablated：拆掉核對後契約漂移放行');
  function r_placeholder() { return '.shiftblame/demo/001'; }
});

ablation('陳述對照閘（commitmsg 內永續層機制引用驗）', () => {
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

ablation('註釋座標結構樣式閘（staged 新增行掃——框架機制檔豁免）', () => {
  const neu = neutralize(SB, [['    if (coordHits.length) die(', '    if (coordHits.length && false) die(']]);
  const staged = (script, path, content) => {
    const r = mkSandbox({ state: { node: 'build', adversarialAt: new Date().toISOString(), adversarialConsumed: false }, git: true });
    mkdirSync(dirname(join(r, path)), { recursive: true });
    writeFileSync(join(r, path), content);
    spawnSync('git', ['add', path], { cwd: r });
    const h = cliRun(script, r, 'commitmsg', 'feat: 消融實驗的提交訊息長度合格');
    rmSync(r, { recursive: true, force: true });
    return h.status;
  };
  assert.equal(staged(SB, 'src.js', '// 時點②修復的註釋座標\nconst a = 1;\n'), 1, 'intact：staged 註釋含時點座標被擋');
  assert.equal(staged(SB, 'src.js', '// 第 3 輪重寫的遺留說明\nconst a = 1;\n'), 1, 'intact：staged 註釋含輪次座標被擋');
  assert.equal(staged(SB, 'hooks/x.js', '// 時點②修復註釋（框架機制檔講流程語言正當）\n'), 0, 'intact：框架機制檔路徑豁免');
  assert.equal(staged(neu, 'src.js', '// 時點②修復的註釋座標\nconst a = 1;\n'), 0, 'ablated：拆掉座標掃描後流程座標入庫放行');
});


ablation('輪次計數 countRev（零檔案寫入）', () => {
  const neu = neutralize(SB, [['function countRev(st) {', 'function countRev(st) {\n  return null; // ABLATED']]);
  const payload = (script) => { const r = mkSandbox({ state: { node: 'plan' }, files: { '.shiftblame/demo/001/G1.md': BDD_G1 } }); cliRun(script, r, 'next', 'intent'); const st = JSON.parse(readFileSync(join(r, '.shiftblame/flow-state.json'), 'utf8')); const noRev = !existsSync(join(r, '.shiftblame/demo/001/rev')); rmSync(r, { recursive: true, force: true }); return st.rev === 1 && noRev; };
  assert.equal(payload(SB), true, 'intact：回 intent 計輪 +1 且零快照目錄');
  assert.equal(payload(neu), false, 'ablated：拆掉後不計輪（history 仍在，僅計數缺失）');
});

// —— 執行矩陣——
let pass = 0;
const fails = [];
ablation('commitmsg 詞彙閘（追蹤編號／流程時序語／非繁中開頭）', () => {
  const BAD = ['fix: 修正r24殘留問題描述內容', 'feat: 斷言先行的重寫驗證流程', 'fix: MS001 規格文檔同步修正'];
  const probe = (script, msg) => { const r = mkSandbox({ git: true }); writeFileSync(join(r, '.shiftblame', 'tmp', 'r.md'), '# 對抗\n\n對抗判定：通過\n'); cliRun(script, r, 'adversarial', join(r, '.shiftblame', 'tmp', 'r.md')); const out = cliRun(script, r, 'commitmsg', msg); rmSync(r, { recursive: true, force: true }); return out.status; };
  for (const m of BAD) assert.equal(probe(SB, m), 1, `intact：詞彙閘擋「${m}」`);
  const src = readFileSync(SB, 'utf8').replace(/\r\n/g, '\n');
  const cut = src
    .replace("    if (/\\b[a-zA-Z]{1,4}-?\\d+\\b|#\\d+/.test(body)) problems.push('含追蹤編號（r24、F4、MS001、G7、#123 等）——commit 訊息純描述變更本身，版本代號以繁中描述（如「第 2 版」），正式名稱表達功能語義，工作紀錄歸 tmp');\n", '')
    .replace("    if (/第\\s*[0-9０-９一二三四五六七八九十]+\\s*[組段輪]|[組段輪]\\s*[0-9０-９]/.test(body)) problems.push('含中文流程編號（第 X 組/段/輪）——流程座標屬 G 檔與 SLUG，訊息純描述變更本身');\n", '')
    .replace("    if (!/^[\\u4e00-\\u9fff]/.test(body)) problems.push('描述以繁中開頭——<type>: 後為繁中變更描述（檔名/代號可出現在句中，非句首）');\n", '')
    .replace("    if (/斷言先行|測試先行|待終審|量化驗收|開新輪|返工直通/.test(body)) problems.push('含流程時序語——訊息純描述變更本身，開發過程語（斷言先行/測試先行/待終審等）屬 tmp');\n", '');
  assert.notEqual(cut, src, 'neutralize 目標存在');
  const dir = mkdtempSync(join(tmpdir(), 'sb-neu2-'));
  NEU_DIRS.push(dir);
  writeFileSync(join(dir, 'ablated.mjs'), relocateShared(cut));
  for (const m of BAD) assert.equal(probe(join(dir, 'ablated.mjs'), m), 0, `ablated：拆閘後放行「${m}」`);
});

ablation('SLUG 存在性閘（骨架不完整擋前進）', () => {
  const probe = (script) => { const r = mkSandbox({ state: { node: 'intent' } }); rmSync(join(r, '.shiftblame', 'demo', 'SLUG.md')); const out = cliRun(script, r, 'next', 'requirement', '--boss-ok'); const st = out.status; rmSync(r, { recursive: true, force: true }); return st; };
  assert.equal(probe(SB), 1, 'intact：無 SLUG.md 前進邊擋');
  const src = readFileSync(SB, 'utf8').replace(/\r\n/g, '\n');
  const cut = src.replace("  if (st.slug && target !== 'intent' && !existsSync(join(SB_DIR, st.slug, 'SLUG.md'))) {\n    problems.push(`骨架不完整：${join(SB_DIR, st.slug, 'SLUG.md')} 不存在——由秘書手建（.shiftblame/ 永遠可寫；重跑 init 會覆蓋 flow-state，既有工作區禁止）`);\n  }\n", '');
  assert.notEqual(cut, src, 'neutralize 目標存在');
  const dir = mkdtempSync(join(tmpdir(), 'sb-neu3-'));
  NEU_DIRS.push(dir);
  writeFileSync(join(dir, 'ablated.mjs'), relocateShared(cut));
  assert.equal(probe(join(dir, 'ablated.mjs')), 0, 'ablated：拆閘後放行（boss-ok 邊）');
});


ablation('ROM 區雜檔閘（ms 目錄僅承載 G 檔）', () => {
  const probe = (script) => { const r = mkSandbox({ state: { node: 'build' } }); const h = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(r, '.shiftblame/demo/001/intent.md'), content: 'x' } }); rmSync(r, { recursive: true, force: true }); return h.status; };
  assert.equal(probe(GUARD), 2, 'intact：ROM 區雜檔擋');
  const src = readFileSync(GUARD, 'utf8').replace(/\r\n/g, '\n');
  const k = src.indexOf('ROM 區雜檔閘');
  assert(k >= 0, 'neutralize 目標存在');
  const blockStart = src.indexOf('      if (', k);
  const blockEnd = src.indexOf('      continue; // 工作區其餘永遠可寫', k);
  assert(blockEnd > blockStart, 'block 邊界');
  assert(cutDefinesFunctions(src), 'neutralize 前結構完整（守衛）');
  assert(blockEnd > blockStart, 'block 邊界');
  const cut = src.slice(0, blockStart) + src.slice(blockEnd);
  assert(cut !== src, 'cut 生效');
  const dir = mkdtempSync(join(tmpdir(), 'sb-neu4-'));
  NEU_DIRS.push(dir);
  writeFileSync(join(dir, 'ablated.mjs'), relocateShared(cut));
  assert(cutDefinesFunctions(cut), 'ablated 檔仍定義 absPath/checkStateWriteMatrix（非崩潰 fail-open）');
  assert.equal(probe(join(dir, 'ablated.mjs')), 0, 'ablated：拆閘後雜檔寫入放行');
});

ablation('文件陳述錨（governance assert.match 錨行——刪除漂移攔截）', () => {
  // 真消融：複製 repo 結構到 tmp，SKILL 副本關鍵陳述漂移（兩層文件模型→兩層文檔模型）
  // → 副本 governance 錨紅（攔截力存在）；neutralize 該錨 → 同漂移下紅燈消失（攔截歸零）
  const driftedRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'sb-anchor-'));
    NEU_DIRS.push(dir);
    cpSync(repo, dir, { recursive: true, filter: (p) => !/[\\/](?:\.git|\.shiftblame|node_modules)(?:[\\/]|$)/.test(p) });
    const sk = join(dir, 'skills', 'shiftblame', 'SKILL.md');
    writeFileSync(sk, readFileSync(sk, 'utf8').replace(/兩層文件模型/g, '兩層文檔模型'));
    return dir;
  };
  const runGov = (dir) => spawnSync(process.execPath, [join(dir, 'cli', 'test', 'sb-agent-governance.mjs')], { encoding: 'utf8' });
  const intactDir = driftedRepo();
  assert.notEqual(runGov(intactDir).status, 0, 'intact：文件漂移被錨攔（governance 紅）');
  // neutralize：拆掉 governance 對該陳述的錨（L「兩層文件模型條文」斷言行）
  const gov = readFileSync(join(repo, 'cli', 'test', 'sb-agent-governance.mjs'), 'utf8');
  const ablated = gov.replace("assert.match(skill, /兩層文件模型/, '兩層文件模型條文（永續層對照義務／當下層用後即弃）');\n", '');
  assert.notEqual(ablated, gov, 'neutralize 錨存在於源碼');
  const dir2 = driftedRepo();
  writeFileSync(join(dir2, 'cli', 'test', 'sb-agent-governance.mjs'), ablated);
  assert.equal(runGov(dir2).status, 0, 'ablated：拆掉錨後同漂移無紅燈（攔截消失）');
});

ablation('ended 初始化入口（移除即重現結束後死路）', () => {
  const neu = neutralize(SB, [['const ended = endedState(prior);', 'const ended = false;']]);
  const probe = (script) => {
    const r = mkSandbox({ state: { node: 'ended', endedAt: '2026-09-08T01:00:00.000Z' } });
    mkdirSync(join(r, '.shiftblame/archive'));
    renameSync(join(r, '.shiftblame/demo'), join(r, '.shiftblame/archive/demo'));
    const result = cliRun(script, r, 'init', 'next');
    rmSync(r, { recursive: true, force: true });
    return result;
  };
  assert.equal(probe(SB).status, 0);
  assert.match(probe(neu).stderr, /非合法未初始化／直接實行紀錄或 ended/);
});
ablation('ended 初始化歸檔前置條件', () => {
  const neu = neutralize(SB, [['function endedInitProblems(st) {', 'function endedInitProblems(st) { return []; // ABLATED']]);
  const probe = (script) => {
    const r = mkSandbox({ state: { node: 'ended', endedAt: '2026-09-08T01:00:00.000Z' } });
    const result = cliRun(script, r, 'init', 'next');
    rmSync(r, { recursive: true, force: true });
    return result;
  };
  assert.match(probe(SB).stderr, /先完成收尾歸檔/);
  assert.equal(probe(neu).status, 0);
});

ablation('有效 Git 忽略免重複追加', () => {
  const neu = neutralize(SB, [['if (check.status === 0) return;', '// ABLATED: 已忽略仍往下追加']]);
  const probe = (script) => {
    const r = mkSandbox({ git: true, flow: false });
    const initial = '.shiftblame/\r\n';
    writeFileSync(join(r, '.gitignore'), initial);
    // 純 hooks 紀錄初始化；驗證 init 對 CRLF 忽略檔的行為。
    writeFileSync(join(r, '.shiftblame/flow-state.json'), JSON.stringify({ inputs: [] }));
    const result = cliRun(script, r, 'init', 'next');
    assert.equal(result.status, 0, result.stderr);
    const actual = readFileSync(join(r, '.gitignore'), 'utf8');
    rmSync(r, { recursive: true, force: true });
    return actual;
  };
  assert.equal(probe(SB), '.shiftblame/\r\n');
  assert.equal(probe(neu), '.shiftblame/\r\n.shiftblame/\r\n');
});

ablation('pass 後合併與清理查證（移除即從舊 HEAD 初始化）', () => {
  const neu = neutralize(SB, [['const gitPlan = ended ? closedGitPlan(prior) : { problems: [], baseCommit: null };', 'const gitPlan = { problems: [], baseCommit: null }; // ABLATED']]);
  const probe = (script) => {
    const r = mkSandbox({ git: true, state: { node: 'ended', endedAt: '2026-09-08T01:00:00.000Z' } });
    mkdirSync(join(r, '.shiftblame/archive'));
    renameSync(join(r, '.shiftblame/demo'), join(r, '.shiftblame/archive/demo'));
    const result = cliRun(script, r, 'init', 'next');
    rmSync(r, { recursive: true, force: true });
    return result;
  };
  assert.match(probe(SB).stderr, /尚未完成合併查證/);
  assert.equal(probe(neu).status, 0);
});

// —— 2.0.3/2.0.4 機制群：迴圈斷路器與 SOP／ROADMAP 每 ms 審查閘 ——
ablation('迴圈斷路器（同操作重複即擋＋死圈升級）', () => {
  const neu = neutralize(GUARD, [['prints[fp] = (prints[fp] ?? 0) + 1;', 'prints[fp] = 1; // ABLATED']]);
  const probe = (script) => {
    const r = mkSandbox({ state: { node: 'test' } });
    hookRun(script, { cwd: r, hook_event_name: 'UserPromptSubmit', prompt: '回合開始' });
    const run = () => hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node rerun-failing-test.mjs' } });
    run(); run(); run();
    const fourth = run();
    const st = stateOf(r);
    rmSync(r, { recursive: true, force: true });
    return { denied: fourth.status === 2, node: st.node };
  };
  const intact = probe(GUARD);
  assert.equal(intact.denied, true, 'intact：同操作第 4 次重複被擋（要求改變策略——3 次內為合法迭代空間）');
  assert.equal(intact.node, 'test', 'intact：擋截不中斷工作（換操作即續行）');
  const gone = probe(neu);
  assert.equal(gone.denied, false, 'ablated：拆掉指紋計數即放行（無限重跑復活）');
  assert.equal(gone.node, 'test', 'ablated：不升級');
});

ablation('迴圈升級自動回 intent（不凍結續行）', () => {
  const neu = neutralize(GUARD, [["const r = spawnSync(process.execPath, [sbPath, 'next', 'intent'], { cwd: root, encoding: 'utf8', timeout: 20000 });", 'const r = { status: 1, stderr: "ABLATED" }; // ABLATED']]);
  const probe = (script) => {
    const r = mkSandbox({ state: { node: 'test' } });
    hookRun(script, { cwd: r, hook_event_name: 'UserPromptSubmit', prompt: '回合開始' });
    const run = () => hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'node dead-op.mjs' } });
    let last;
    for (let i = 0; i < 7; i++) last = run();
    const st = stateOf(r);
    rmSync(r, { recursive: true, force: true });
    return { denied: last.status === 2, node: st.node };
  };
  const intact = probe(GUARD);
  assert.equal(intact.denied, true, 'intact：第 7 次升級擋下');
  assert.equal(intact.node, 'intent', 'intact：升級自動回 intent（撤退發生——工作不停止）');
  const gone = probe(neu);
  assert.equal(gone.denied, true, 'ablated：第 7 次仍擋（擋截不屬撤退機制）');
  assert.equal(gone.node, 'test', 'ablated：拆掉撤退 spawn 即不自動回 intent（防護消失——停擺風險復活）');
});

ablation('停點偵測（無申報之停擋停一次）', () => {
  const neu = neutralize(GUARD, [["否則續行已授權未完工作。偷懶停由曝光＋老闆終審承擔。\\n');\n      process.exit(2);", "否則續行已授權未完工作。偷懶停由曝光＋老闆終審承擔。\\n');\n      process.exit(0); // ABLATED"]]);
  const probe = (script) => {
    const r = mkSandbox({ state: { node: 'test' } });
    hookRun(script, { cwd: r, hook_event_name: 'UserPromptSubmit', prompt: '回合開始' });
    const result = hookRun(script, { cwd: r, hook_event_name: 'Stop', last_assistant_message: '停在這裡' });
    const st = stateOf(r);
    rmSync(r, { recursive: true, force: true });
    return { status: result.status, blocked: st.stopBlockedAt !== undefined };
  };
  const intact = probe(GUARD);
  assert.equal(intact.status, 2, 'intact：活動流程無申報之停擋停一次（防偷懶停）');
  assert.equal(intact.blocked, true, 'intact：自限標記落檔（單次擋停）');
  const gone = probe(neu);
  assert.equal(gone.status, 0, 'ablated：拆掉擋停判準即無申報之停放行（防護消失——偷懶停復活）');
});

ablation('文件鐵律（框架 .md 純追加不得 commit）', () => {
  const neu = neutralize(GUARD, [["if (offenders.length) return '文件鐵律：", "// ABLATED: if (offenders.length) return '文件鐵律："]]);
  const probe = (script) => {
    const r = mkSandbox({ git: true, state: { node: 'build' } });
    mkdirSync(join(r, 'skills', 'shiftblame'), { recursive: true });
    mkdirSync(join(r, 'hooks'), { recursive: true });
    writeFileSync(join(r, 'skills', 'shiftblame', 'SKILL.md'), '# framework\n');
    writeFileSync(join(r, 'hooks', 'shiftblame-guard.mjs'), '// anchor\n');
    writeFileSync(join(r, 'README.md'), '# 專案\n說明。\n');
    spawnSync('git', ['add', '.'], { cwd: r });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'init'], { cwd: r });
    writeFileSync(join(r, 'README.md'), '# 專案\n說明。\n追加。\n');
    spawnSync('git', ['add', 'README.md'], { cwd: r });
    const st = stateOf(r);
    st.adversarialAt = new Date().toISOString(); st.adversarialConsumed = false;
    writeFileSync(join(r, '.shiftblame', 'flow-state.json'), JSON.stringify(st));
    writeFileSync(join(r, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: x', cwd: r, issuedAt: new Date().toISOString() }));
    const result = hookRun(script, { cwd: r, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: x"' } });
    rmSync(r, { recursive: true, force: true });
    return { status: result.status, msg: result.stderr || '' };
  };
  const intact = probe(GUARD);
  assert.equal(intact.status, 2, 'intact：框架 .md 純追加 commit 擋下');
  assert.match(intact.msg, /文件鐵律/, 'intact：訊息要求理順邏輯實質重寫');
  const gone = probe(neu);
  assert.equal(gone.status, 0, 'ablated：拆掉鐵律即純追加照樣 commit（防護消失——補釘堆疊復活）');
});

ablation('SOP／ROADMAP 機械基本功檢查（日期類＋重複類——髒文件不發審查戳記）', () => {
  const neu = neutralize(SB, [['const docProblems = hasDocs ? sopDocProblems() : [];', 'const docProblems = []; // ABLATED']]);
  const probe = (script) => {
    const r = mkSandbox({ state: { node: 'done' }, files: { '.shiftblame/SOP.md': '---\nupdated: 2020-01-01\n---\n# SOP\n規範甲。\n規範甲。\n' } });
    const result = cliRun(script, r, 'sopreview', '三問全過：無基質重複、無退役規則、無死規則');
    const st = stateOf(r);
    rmSync(r, { recursive: true, force: true });
    return { status: result.status, stamped: st.sopReview?.ms === '001' };
  };
  const intact = probe(SB);
  assert.equal(intact.status, 1, 'intact：重複行等基本功未過——審查戳記不發');
  assert.equal(intact.stamped, false, 'intact：髒文件無戳記');
  const gone = probe(neu);
  assert.equal(gone.status, 0, 'ablated：拆掉機械檢查即髒文件照樣發戳記（防護消失）');
  assert.equal(gone.stamped, true, 'ablated：戳記已發');
});

ablation('SOP／ROADMAP 每 ms 審查閘（pass 前機械驗本 ms 已審）', () => {
  const neu = neutralize(SB, [['if (sopProblem) die([sopProblem]);', '// ABLATED']]);
  const probe = (script) => {
    const r = mkSandbox({ state: { node: 'verify', adversarialLog: [{ at: new Date().toISOString(), report: '.shiftblame/tmp/p3.md', verdict: '通過', node: 'verify', point: '2' }] }, files: { '.shiftblame/SOP.md': '# SOP\n本專案規範。\n' } });
    const result = cliRun(script, r, 'end', '--boss-ok', '--adversarial');
    rmSync(r, { recursive: true, force: true });
    return result;
  };
  assert.match(probe(SB).stderr, /每 ms 必審/, 'intact：本 ms 未審即 pass 擋下');
  assert.equal(probe(neu).status, 0, 'ablated：拆掉審查閘即放行');
});

ablation('--no-ff 合併提交證據 noFfMergeEvidence（快轉不過 closeout）', () => {
  const neu = neutralize(SB, [['function noFfMergeEvidence(workCommit, baseCommit, slug) {', 'function noFfMergeEvidence(workCommit, baseCommit, slug) {\n  return baseCommit; // ABLATED']]);
  const probe = (script) => {
    const r = mkSandbox({ git: true, state: { node: 'verify', adversarialLog: [{ at: new Date().toISOString(), report: '.shiftblame/tmp/p3.md', verdict: '通過', node: 'verify', point: '2' }] } });
    const base = spawnSync('git', ['branch', '--show-current'], { cwd: r, encoding: 'utf8' }).stdout.trim();
    spawnSync('git', ['checkout', '-b', 'feat/demo'], { cwd: r });
    writeFileSync(join(r, 'work.txt'), 'w\n');
    spawnSync('git', ['add', 'work.txt'], { cwd: r });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: work'], { cwd: r });
    const st = stateOf(r);
    st.workBranch = 'feat/demo';
    writeFileSync(join(r, '.shiftblame/flow-state.json'), JSON.stringify(st));
    cliRun(SB, r, 'end', '--boss-ok', '--adversarial'); // pass 出口＋機械歸檔（與被消融函數無關——end 固定用原版）
    spawnSync('git', ['checkout', base], { cwd: r });
    spawnSync('git', ['merge', '--ff-only', 'feat/demo'], { cwd: r });
    const result = cliRun(script, r, 'closeout', '--base', base);
    rmSync(r, { recursive: true, force: true });
    return result.status;
  };
  assert.equal(probe(SB), 1, 'intact：快轉合併無證據——closeout 擋下（slug 邊界死守）');
  assert.equal(probe(neu), 0, 'ablated：證據檢查拆除即放行（快轉收尾復活）');
});

for (const { name, fn } of ABLATIONS) {
  try { fn(); pass++; console.log(`pass [消融] ${name}`); }
  catch (e) { fails.push(name); console.error(`FAIL [消融] ${name}：${e.message}`); }
}
assert.equal(fails.length, 0, `消融矩陣 ${fails.length} 項失敗：${fails.join('；')}`);
console.log(`sb-ablation: pass（${pass}/${ABLATIONS.length} 機制——intact 對照＋拆掉→防護消失成對成立）`);
