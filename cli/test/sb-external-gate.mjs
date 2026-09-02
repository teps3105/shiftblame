// sb-external-gate：研究／返工外部性閘（1.6.0）——externalEvidence 標記（真實 hooks）、
// research→plan 邊驗（零外部推不過）、--rerun 返工重置＋pending 鏈（返工後首個推進邊驗）、回 intent 中止清
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
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const statePath = join(root, '.shiftblame/flow-state.json');
const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
const setState = (mut) => { const st = state(); mut(st); writeFileSync(statePath, JSON.stringify(st, null, 2)); };
const extCall = (tool) => hookRun({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: {} });

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=操作者 | 前置=系統啟動 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴與新抽象層。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=t.mjs\n# 實作步驟\n沿用既有入口並驗證輸出。');

// —— 1. audit→research 進段重置：預塞舊證據 → 進段即清（fail-closed，舊查證不沿用）——
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
setState((st) => { st.externalEvidence = { done: true, at: '2020-01-01T00:00:00Z', tool: 'WebSearch' }; });
assert.equal(run('next', 'research').status, 0);
assert.equal(state().externalEvidence, null, 'audit→research 進段重置');

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

// —— 4. 真外部調用標記後推進過 ——
assert.equal(extCall('WebSearch').status, 0);
assert.equal(state().externalEvidence.done, true, 'hooks 標記 externalEvidence');
assert.equal(state().externalEvidence.tool, 'WebSearch');
r = run('next', 'plan');
assert.equal(r.status, 0, '外部調用後 research→plan 過（規模自由：一次即底線）');

// —— 5. --rerun 返工（done→test 重修邊直通）：重置證據＋掛 pending ——
setState((st) => {
  st.node = 'done';
  st.history.push({ from: 'verify', to: 'done', at: new Date().toISOString(), ms: '001', bossOk: true }); // 同 ms 曾達 done（rerun 資格）
});
r = run('next', 'test', '--rerun', 'impl');
assert.equal(r.status, 0, 'rerun 直通（同 ms 曾達 test 及之後、非 verify 出發）');
assert.equal(state().externalEvidence, null, 'rerun 重置外部證據');
assert.equal(state().rerunExtPending, true, '掛返工 pending');

// —— 6. 返工後推進零外部擋（不得閉門自我檢驗）——
r = run('next', 'build');
assert.equal(r.status, 1, '返工期間零外部協助→擋');
assert.match(r.stderr, /零外部協助/);
assert.equal(state().node, 'test', '未推進（擋於 test→build 邊）');

// —— 7. 外部協助後過＋pending 消費即清 ——
assert.equal(extCall('Agent').status, 0);
r = run('next', 'build');
assert.equal(r.status, 0, '外部協助後返工推進過');
assert.equal(state().rerunExtPending, undefined, 'pending 消費即清');

// —— 8. 第二次 rerun：證據再次重置、pending 重掛（每次返工重新計次）——
setState((st) => { st.node = 'done'; });
r = run('next', 'test', '--rerun', 'impl');
assert.equal(r.status, 0, '第二次 rerun 直通');
assert.equal(state().externalEvidence, null, '每次 rerun 重置外部證據（重新計次）');
assert.equal(state().rerunExtPending, true, 'pending 重掛');

// —— 9. 回 intent 中止：pending 不帶入新線性 ——
r = run('next', 'intent', '--rerun', 'impl');
assert.equal(r.status, 1, '回頭邊不得帶 --rerun（不得攜帶返工 pending 回 intent）');
assert.match(r.stderr, /僅用於前進重走邊/);
assert.equal(run('next', 'intent').status, 0, '回 intent 免外部驗（返工中止——回頭邊）');
assert.equal(state().rerunExtPending, undefined, 'pending 不帶入新線性');
assert.equal(state().externalEvidence, null, '證據隨中止清空（重走 research 邊再驗）');

console.log('sb-external-gate: PASS');
