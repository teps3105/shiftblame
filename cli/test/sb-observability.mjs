// sb-observability：觀測紀律與回合治理——usage 事件、計數純觀測（無預算無上限零干預）、迴圈斷路器（4/7 門檻＋升級凍結＋CLI 兜底）、
// 產出遙測（git baseline 錨定）、SOP／ROADMAP 每 ms 審查閘、觀測流輪替（flow-state 恆有界）。
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
const hookBin = resolve(here, '../../hooks/shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-obsv-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const ms = join(root, '.shiftblame/demo/001');
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const usageFile = () => join(root, '.shiftblame/tmp/sb-usage.jsonl');
const usageLines = () => (existsSync(usageFile()) ? readFileSync(usageFile(), 'utf8').split('\n').filter(Boolean) : []);
const report = (n, extra = '') => { const f = join(root, '.shiftblame/tmp', `pt${n}${extra}.md`); writeFileSync(f, `# 時點${n}對抗\n外部子代理原文節錄${extra}內容足夠實質。\n審查模型：GLM-5.3\n對抗判定：通過`); return f; };
const pt = (n, extra = '') => run('adversarial', report(n, extra), '--point', n);
const commit = (file, message) => {
  assert.equal(git('add', file).status, 0);
  assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', message).status, 0);
  return git('rev-parse', 'HEAD').stdout.trim();
};

// —— 1. usage 事件：每次 sb 調用（含失敗調用）落 tmp JSONL，缺檔自動重建 ——
assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
git('add', '.gitignore', 'seed.txt');
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
const usageCount0 = usageLines().length; // init 前任意歷史＝0（新暫存區）
assert.equal(run('state').status, 0);
assert.ok(usageLines().length >= usageCount0 + 1, 'sb state 調用落 sb-usage.jsonl');
assert.equal(run('budget', '--requests', '5').status, 2, '已除命令照常 usage()（exit 2——解析器衛生）');
{
  const lines = usageLines();
  assert.ok(lines.length >= 2, '失敗調用（用法錯誤）也追加一行');
  const last = JSON.parse(lines.at(-1));
  assert.equal(last.cmd, 'budget', '子命令記錄正確（含失敗調用）');
  assert.match(last.args, /--requests 5/, '參數摘要記錄');
  assert.match(last.at, /^\d{4}-\d\d-\d\dT/, '時間戳記錄');
}
const baseline = git('rev-parse', 'HEAD').stdout.trim();
assert.equal(run('init', 'demo').status, 0);
assert.equal(state().baseCommit, baseline, 'init 錨定 git baseline（進入需求層前的時序錨點）');
assert.match(state().startedAt, /^\d{4}-\d\d-\d\dT/, 'init 記起始時間（耗時基準）');

// —— 2. 八段快走到執行段（test）——
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。');
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
assert.equal(run('next', 'research').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(pt('①').status, 0);
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0, '放行至執行段');

// —— 3. 迴圈斷路器：計數純觀測（無預算無上限零干預）；重複才擋（4/7 門檻）；死圈升級 ——
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '回合開始（回合計數歸零）' });
assert.equal(state().turnUsage, undefined, '老闆輸入＝回合邊界（計數重置）');
const u1 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls -la' } });
assert.equal(u1.status, 0, '工具調用放行（計數僅觀測）');
assert.equal(state().turnUsage.requests, 1, '回合計數（工具調用＝model 請求上界代理）');
assert.equal(state().usageTotals.requests >= 1, true, 'slug 累計計數');
assert.equal(hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pwd' } }).status, 0, '第 2 調用照常');
assert.equal(hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo step-three' } }).status, 0, '計數持續累積零干預——工作做到完成為止');
assert.equal(state().node, 'test', '純觀測不影響任何推進');
// 迴圈斷路器：同操作重複才是死圈特徵——第 4 次擋（要求改變策略）、第 7 次升級（凍結＋自動回 intent）
const loop = () => hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `node stuck-loop.mjs` } });
assert.equal(loop().status, 0, '同操作第 1 次放行');
assert.equal(loop().status, 0, '同操作第 2 次放行（迭代重試的合法空間）');
assert.equal(loop().status, 0, '同操作第 3 次仍放行（門檻 4——三次同命令屬正常迭代）');
const l4 = loop();
assert.equal(l4.status, 2, '同操作第 4 次即擋（迴圈斷路器——重跑同樣的失敗＝無限循環）');
assert.match(l4.stderr, /迴圈斷路器|改變策略/, '擋截訊息要求改變策略（修根因／換方法）');
assert.equal(state().node, 'test', '迴圈擋截不升級——換個操作即可續行');
assert.equal(loop().status, 2, '被擋後仍重複（第 5 次）續擋');
assert.equal(loop().status, 2, '第 6 次續擋');
const l7 = loop();
assert.equal(l7.status, 2, '第 7 次升級擋下');
{
  const st = state();
  assert.equal(st.node, 'intent', '升級＝自動回 intent（真死圈——被擋兩次後仍重複同一操作）');
  assert.equal(st.turnUsage.escalatedAt !== undefined, true, '升級時刻留痕');
  const last = st.history.at(-1);
  assert.equal(last.from, 'test', 'history 記錄撤退起點');
  assert.equal(last.to, 'intent', 'history 記錄撤退');
  assert.equal(last.budgetExhausted, true, 'budgetExhausted 留痕');
}
const u6 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, 'src/a.js'), old_string: 'a', new_string: 'b' } });
assert.equal(u6.status, 2, '升級後本回合凍結（後續工具全擋）');
assert.match(u6.stderr, /迴圈升級/);
const skillOk = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：迴圈升級凍結下理解宣告仍可落流驗證' } });
assert.equal(skillOk.status, 0, 'Skill 調用豁免（理解宣告落流）');
for (let i = 0; i < 6; i++) {
  const escapeRun = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb state' } });
  assert.equal(escapeRun.status, 0, `sb state 豁免於凍結與迴圈斷路器（第 ${i + 1} 次——逃生操作可重複使用）`);
}
// CLI 兜底（hooks 失效層）：升級凍結期間前進邊由 sb next 擋；→intent 保持自由
assert.match(run('next', 'requirement', '--boss-ok').stderr, /迴圈升級/, 'CLI 同判據兜底擋前進');
// 老闆下一則輸入＝新回合（計數重置、恢復推進）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '新回合：改變策略後續行' });
assert.equal(state().turnUsage, undefined, '新回合計數重置');
const u7 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls -la' } });
assert.equal(u7.status, 0, '新回合工具恢復（同操作指紋隨回合重置）');
assert.equal(state().turnUsage.requests, 1, '新回合從 1 重新計數');

// —— 4. 重走至 done（--rerun 直通＋返工外部協助），途中寫真實 commit 供遙測 diff ——
assert.equal(run('next', 'requirement', '--rerun', 'impl').status, 0, '返工直通（同 ms 曾達 test）');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'y' } }); // 返工外部協助
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0);
assert.equal(pt('①', 'r2').status, 0);
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);
writeFileSync(join(root, 'test-1.mjs'), 'import assert from "node:assert/strict";\nassert.equal(1, 1);\n');
commit('test-1.mjs', 'test: cover acceptance');
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with feature\n');
commit('seed.txt', 'feat: deliver feature');
assert.equal(run('next', 'verify').status, 0);
assert.equal(pt('③').status, 0);
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);

// —— 5. SOP／ROADMAP 每 ms 審查閘：有文件未審即 PASS 擋；sopreview 留痕後放行 ——
writeFileSync(join(root, '.shiftblame/SOP.md'), '# SOP\n本專案規範。\n');
assert.match(run('end', '--boss-ok').stderr, /每 ms 必審/, '本 ms 未審即 PASS 擋下');
assert.equal(run('sopreview').status, 0, '審查留痕（三問）');
assert.equal(state().sopReview.ms, '001', '戳記屬本 ms');
const endOut = run('end', '--boss-ok');
assert.equal(endOut.status, 0, endOut.stderr);

// —— 6. 產出遙測：git baseline 錨定＋對抗判定（含審查模型）＋計數＋耗時 ——
{
  const st = state();
  assert.equal(st.node, 'ended');
  const t = st.telemetry;
  assert.equal(t.baseCommit, baseline, '遙測記 baseline commit');
  assert.equal(t.headCommit, git('rev-parse', 'HEAD').stdout.trim(), '遙測記 HEAD');
  assert.equal(t.diff.files, 2, 'diff 統計＝baseline..HEAD 變更檔數（.gitignore 外的 test-1.mjs 與 seed.txt）');
  assert.ok(t.diff.additions >= 2, `additions 統計（實得 ${t.diff.additions}）`);
  assert.ok(t.diff.deletions >= 1, `deletions 統計（實得 ${t.diff.deletions}）`);
  assert.equal(t.adversarial.verdict, '通過', '最後對抗判定入遙測');
  assert.equal(t.adversarial.model, 'GLM-5.3', '審查模型（報告「審查模型：」行）入遙測');
  assert.ok(t.counts.toolCalls >= 5, `toolCalls 計數（實得 ${t.counts.toolCalls}）`);
  assert.ok(t.counts.inputs >= 2, `inputs 計數（實得 ${t.counts.inputs}）`);
  assert.ok(t.durationMinutes === null || t.durationMinutes >= 0, '耗時（分）或缺省');
  assert.equal(st.usageTotals, undefined, 'slug 邊界清理：累計計數');
  assert.equal(run('state').status, 0, 'ended 含 telemetry 仍合法（sb state 可讀）');
}

// —— 7. 觀測流輪替：inputs／understandings 超門檻輪替至 tmp，flow-state 恆有界、鏈仍可驗 ——
const rotRoot = mkdtempSync(join(tmpdir(), 'sb-rot-'));
process.on('exit', () => rmSync(rotRoot, { recursive: true, force: true }));
mkdirSync(join(rotRoot, '.shiftblame/tmp'), { recursive: true });
writeFileSync(join(rotRoot, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'build', history: [] }));
const rotHook = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: rotRoot, ...payload }), encoding: 'utf8' });
const rotState = () => JSON.parse(readFileSync(join(rotRoot, '.shiftblame/flow-state.json'), 'utf8'));
for (let i = 0; i < 60; i++) {
  rotHook({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: `理解：輪替壓力測試第 ${i} 號理解宣告內容` } });
  rotHook({ hook_event_name: 'UserPromptSubmit', prompt: `輪替壓力輸入 ${i}` });
}
{
  const st = rotState();
  assert.ok(st.inputs.length >= 20 && st.inputs.length <= 40, `inputs 輪替後有界（實得 ${st.inputs.length}——門檻 40、保留 20）`);
  assert.equal(st.inputsRotated, 21, '已輪替記至偏移欄位（41 筆時切至 20）');
  assert.ok(st.understandings.length >= 20 && st.understandings.length <= 40, `understandings 有界（實得 ${st.understandings.length}）`);
  assert.equal(st.understandingsRotated, 21, '已審理解輪替（未審理解永留檔內）');
  assert.match(st.understandingSeedHash ?? '', /^[0-9a-f]{16}$/, '理解鏈種子（已輪替前綴的接續錨）');
  const rotated = readFileSync(join(rotRoot, '.shiftblame/tmp/flow-rotated.jsonl'), 'utf8').split('\n').filter(Boolean);
  assert.ok(rotated.length >= 42, `輪替事實落 tmp（實得 ${rotated.length} 行——老闆清理 tmp 時隨之消失）`);
  JSON.parse(rotated[0]); // 每行可解析
  const stateRun = spawnSync(process.execPath, [cli, 'state'], { cwd: rotRoot, encoding: 'utf8' });
  assert.equal(stateRun.status, 0, '輪替後狀態仍合法（理解鏈自種子接續可驗）');
  assert.match(stateRun.stdout, /build/, '段位可讀');
}
// 指紋 128 鍵上限（對抗審查 M1 回歸）：多樣操作永不觸發死鎖——超過 128 種指紋時淘汰非當前的最小計數鍵，狀態恆合法
for (let i = 0; i < 130; i++) rotHook({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `echo distinct-operation-${i}` } });
{
  const st = rotState();
  const keyCount = Object.keys(st.turnUsage.fingerprints ?? {}).length;
  assert.ok(keyCount <= 128, `指紋鍵數 ≤128（實得 ${keyCount}）`);
  const stateRun2 = spawnSync(process.execPath, [cli, 'state'], { cwd: rotRoot, encoding: 'utf8' });
  assert.equal(stateRun2.status, 0, '多樣操作（130 種不同指紋）不觸發接入異常（M1：第 129 鍵寫入死鎖已除）');
}
// 輪替後新理解＝全域輸入編號（含已輪替前綴）——曝光對照不失真（對抗審查 M1 回歸）
rotHook({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：輪替後全域編號的最新理解宣告驗證內容' } });
{
  const st = rotState();
  assert.equal(st.understandings.at(-1).uptoInput, (st.inputsRotated ?? 0) + st.inputs.length - 1, 'uptoInput＝全域編號（局部編號即倒退）');
  const seen = rotHook({ hook_event_name: 'UserPromptSubmit', prompt: '覆蓋查證輸入' });
  const total = Number((seen.stdout.match(/共 (\d+) 則/) ?? [])[1]);
  const covered = Number((seen.stdout.match(/理解覆蓋至 #(\d+)/) ?? [])[1]);
  assert.equal(total - 1 - covered, 1, '曝光行 uncovered＝僅本則新輸入（輪替不產生假警報）');
}
console.log('sb-observability: PASS');
