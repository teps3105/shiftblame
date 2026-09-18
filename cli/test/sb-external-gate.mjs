// sb-external-gate：研究外部性閘——externalEvidence 標記（真實 hooks）、
// research→plan 邊驗（零外部推不過）、重走 intent 開新輪（老闆決策邊）＋進 research 段重置（每次重走重新驗）
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
// 流程目錄由 init 建立；接入前只準備 tmp。
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
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴與新抽象層。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=t.mjs\n# 實作步驟\n沿用既有入口並驗證輸出。');

// —— 1. requirement→research 進段重置：預塞舊證據 → 進段即清（fail-closed，舊查證不沿用）——
// （requirement→research＝時點 1 邊——2.4.0 審意圖→需求翻譯，推進需 --boss-ok＋--adversarial＋point 1 條目）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：確認意圖，推進 requirement' }); // 老闆輸入新鮮度（intent→requirement 邊）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
setState((st) => { st.externalEvidence = { done: true, at: '2020-01-01T00:00:00.000Z', tool: 'WebSearch' }; });
assert.equal(run('adversarial', ptReport('1'), '--point', '1').status, 0, '時點 1 對抗宣告');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯確認，推進研究' }); // 時點 1 老闆輸入（2.4.2——晚於本次對抗條目：老闆章錨定對抗報告之後）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, '時點 1 過邊');
assert.equal(state().externalEvidence, null, 'requirement→research 進段重置');

// —— 2. research→plan 零外部推不過 ——
let r = run('next', 'plan');
assert.equal(r.status, 1, '零外部調用推 plan→擋');
assert.match(r.stderr, /零外部調用/);

// —— 3. 冒名不標記：相近名、大小寫變體、非外部工具、Bash 內嵌字串 ——
extCall('WebSearchX');
extCall('websearch');
extCall('mcp__x__WebSearch');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'WebSearch' } });
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'Agent' } });
assert.equal(state().externalEvidence, null, '冒名／相近名／Bash 內嵌／Skill 夾帶皆不標記（精確錨定工具名）');

// Codex 平台事件：實際跑 hook → CLI 推進；近似名稱及包裝器不算。
for (const tool of ['web.runX', 'webrunX', 'mcp__x__webrun', 'collaborationspawn_agentX', 'collaborationfollowup_taskX', 'collaborationwait_agent', 'mcp__unknown__web__run', 'collaboration.wait_agent', 'functions.exec']) {
  hookRun({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { code: 'await tools.web__run({search_query:[{q:"x"}]})' } });
  assert.equal(state().externalEvidence, null, `${tool} 不得誤記外部證據`);
  assert.equal(run('next', 'plan').status, 1);
}
for (const tool of ['WebSearch', 'WebFetch', 'Agent', 'Task', 'mcp__web_reader__webReader', 'web.run', 'web__run', 'functions.web__run', 'spawn_agent', 'collaboration.spawn_agent', 'functions.spawn_agent', 'webrun', 'collaborationspawn_agent', 'collaborationfollowup_task']) {
  const before = state();
  assert.equal(extCall(tool).status, 0);
  assert.equal(state().externalEvidence?.tool, tool, `${tool} 的真實事件名稱必須留痕`);
  assert.equal(run('next', 'plan').status, 0, `${tool} 查證後可推進 plan`);
  writeFileSync(statePath, JSON.stringify(before));
}

// —— 4. 真外部調用標記後推進過 ——
assert.equal(extCall('WebSearch').status, 0);
assert.equal(state().externalEvidence.done, true, 'hooks 標記 externalEvidence');
assert.equal(state().externalEvidence.tool, 'WebSearch');
r = run('next', 'plan');
assert.equal(r.status, 0, '外部調用後 research→plan 過（規模自由：一次即底線）');

// —— 5. 重走（老闆新輸入重走 intent→定義級同 ms 開新輪）：重走＝老闆決策邊 --boss-ok ——
setState((st) => { st.node = 'intent'; });
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：定義級修正，重新確認需求' }); // 老闆輸入新鮮度（intent→requirement 決策邊——晚於上次同邊推進）
r = run('next', 'requirement', '--boss-ok');
assert.equal(r.status, 0, '重走：老闆決策邊 --boss-ok（重走必經 intent 環首）');
assert.equal(run('next', 'research', '--rerun', 'impl').status, 2, '已退役旗標被解析器 usage 擋（退役驗證——旗標本身須存在才能證明已死）');

// —— 6. 重走後外部證據重新驗（進 research 段重置——每次重走重新計次；時點 1 重過＝新鮮條目）——
assert.match(run('next', 'research', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊時點 1 條目過期即擋（新鮮度）');
assert.equal(run('adversarial', ptReport('1'), '--point', '1').status, 0, '重走後新鮮時點 1 條目');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯修正確認，推進研究' }); // 時點 1 老闆輸入（2.4.2——晚於本次對抗條目）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, '進 research——外部證據閘進段重置');
r = run('next', 'plan');
assert.equal(r.status, 1, '重走後零外部調用→擋（不得閉門自我檢驗）');
assert.match(r.stderr, /零外部調用/);
assert.equal(state().node, 'research', '未推進（擋於 research→plan 邊）');

// —— 7. 外部協助後過 ——
assert.equal(extCall('Agent').status, 0);
r = run('next', 'plan');
assert.equal(r.status, 0, '外部協助後重走推進過');

// —— 8. 回 intent 中止：回頭邊免外部驗——重置責任在再進 research 的進段邊 ——
r = run('next', 'intent');
assert.equal(r.status, 0, '重走 intent 免外部驗（回頭邊）');
assert.equal(run('next', 'requirement').status, 1, 'intent→requirement 決策邊缺 --boss-ok 擋');
console.log('sb-external-gate: pass');
