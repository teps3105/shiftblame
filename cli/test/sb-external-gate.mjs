// sb-external-gate：外部性閘機械綁定已移除（2.7.2）——機械事實（工具名白名單標記）與真實使用脫鉤，
// 閘在真實流程中不觸發、只生誤擋。外部調用事實改由對話呈現承載（A2——對話承載、抽查承擔）：
// research→plan 邊零機械驗、hooks 不再標記、舊檔殘留鍵讀取即剝。
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'sb-ext-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const hookBin = resolve(dirname(fileURLToPath(import.meta.url)), '../../hooks/shiftblame-guard.mjs');
const ms = join(root, '.shiftblame/demo/001');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const statePath = join(root, '.shiftblame/flow-state.json');
const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
const setState = (mut) => { const st = state(); mut(st); writeFileSync(statePath, JSON.stringify(st, null, 2)); };
const extCall = (tool) => hookRun({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: {} });
const ptReport = (n) => { const f = join(root, '.shiftblame/tmp', `ext-pt${n}.md`); writeFileSync(f, `# 時點${n}對抗\n外部子代理原文節錄，實質內容足夠通過機械驗。\n對抗判定：通過`); return f; };

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴與新抽象層。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=t.mjs\n# 實作步驟\n沿用既有入口並驗證輸出。');

// —— 1. hooks 不再標記：外部工具調用不寫 externalEvidence 欄位（對話事實承載）——
extCall('WebSearch');
extCall('Agent');
extCall('mcp__web_reader__webReader');
assert.equal(state().externalEvidence, undefined, '外部工具調用零標記（機械綁定已移除）');
assert.ok(state().hooksHeartbeat, '心跳等其他紀錄不受影響');

// —— 2. research→plan 零機械驗：無外部調用紀錄也直接過（閘不觸發）——
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：確認意圖，推進 requirement' });
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
assert.equal(run('adversarial', ptReport('1'), '--point', '1').status, 0, '時點 1 對抗宣告');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯確認，推進研究' });
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, '時點 1 過邊');
let r = run('next', 'plan');
assert.equal(r.status, 0, '零外部調用紀錄推 plan 直接過（機械閘已除——外部性由對話事實承載）');
assert.doesNotMatch(r.stderr || '', /零外部調用/);

// —— 3. 舊檔殘留鍵讀取即剝（migrateStreams 兼容）：帶舊 externalEvidence 的 active state 正常分類與推進 ——
setState((st) => { st.node = 'research'; st.externalEvidence = { done: true, at: '2020-01-01T00:00:00.000Z', tool: 'WebSearch' }; });
assert.equal(run('state').status, 0, '殘留鍵不擋查詢');
r = run('next', 'plan');
assert.equal(r.status, 0, '殘留鍵不擋推進');
assert.equal(state().externalEvidence, undefined, '推進寫回即剝（舊鍵零殘留）');

// —— 4. 殘留異形值同樣剝除（原 schema 驗證的三形失效樣本——機制移除後不再是 invalid）——
for (const v of [
  { done: true, at: '2020-01-01T00:00:00.000Z', tool: 'functions.exec' },
  { done: true, at: '2020-01-01T00:00:00.000Z', tool: 'web.runX' },
  { done: false, at: '2020-01-01T00:00:00.000Z', tool: 'Agent' },
]) {
  setState((st) => { st.node = 'research'; st.externalEvidence = v; });
  assert.equal(run('state').status, 0, `異形殘留 ${v.tool ?? JSON.stringify(v)} 讀取即剝不擋`);
  assert.equal(run('next', 'plan').status, 0, '殘留異形值不擋推進');
  assert.equal(state().externalEvidence, undefined, '寫回即剝');
}

// —— 5. 重走 intent 循環照常：機制移除不影響其餘閘（老闆決策邊 --boss-ok 照擋）——
setState((st) => { st.node = 'intent'; });
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：定義級修正，重新確認需求' });
assert.equal(run('next', 'requirement', '--boss-ok').status, 0, '重走：老闆決策邊 --boss-ok');
assert.equal(run('next', 'requirement').status, 1, '決策邊缺 --boss-ok 仍擋（其餘閘不變）');
console.log('sb-external-gate: pass');
