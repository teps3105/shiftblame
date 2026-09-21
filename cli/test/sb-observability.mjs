// sb-observability：觀測紀律與回合治理——usage 事件、計數純觀測（無預算無上限零干預）、迴圈斷路器（行為模式判定：無變更重跑即擋＋逐字重發升級回 intent＋死操作本回合封禁＋寫入清表）、
// 產出遙測（git baseline 錨定）、SOP／ROADMAP 每 ms 審查閘、指紋 128 鍵上限（flow-state 恆有界——觀測流輪替已隨流拆除）。
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

// —— 2. 七段圓環快走到執行段（test）——
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：確認意圖，推進 requirement' }); // 老闆決策邊輸入（對話承載——旗標即章）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
assert.equal(pt('1').status, 0, '時點 1 對抗宣告');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯確認，推進研究' }); // 時點 1 老闆 pass 輸入（requirement＋對抗完成＝決策邊裁決通道——零推回，對話承載）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, '時點 1 過邊（審意圖→需求翻譯）');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(run('next', 'test').status, 0, 'plan→test 機械推進（中鏈零審核——2.4.0 取消老闆放行）');

// —— 3. 迴圈斷路器（行為模式判定——非數量）：計數純觀測；無變更重跑即擋；擋後逐字重發＝升級自動回 intent；升級後仍逐字重發＝本回合封禁 ——
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '繼續' }); // 中性續行（2.5.5 推回豁免）——回合邊界重置模式追蹤但不開新輪（隔離被測機制）
assert.equal(state().turnUsage, undefined, '老闆輸入＝回合邊界（模式追蹤重置）');
const u1 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls -la' } });
assert.equal(u1.status, 0, '工具調用放行（計數僅觀測）');
assert.equal(state().turnUsage.requests, 1, '回合計數（工具調用＝model 請求上界代理）');
assert.equal(state().usageTotals.requests >= 1, true, 'slug 累計計數');
assert.equal(hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'pwd' } }).status, 0, '第 2 調用照常（不同操作）');
assert.equal(hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'echo step-three' } }).status, 0, '計數持續累積零干預——工作做到完成為止');
assert.equal(state().node, 'test', '純觀測不影響任何推進');
// 模式①：同操作再現且期間無寫入即擋——世界未變，重跑結果必然相同
const loop = () => hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `node stuck-loop.mjs` } });
assert.equal(loop().status, 0, '同操作首見放行（記 seen）');
const l2 = loop();
assert.equal(l2.status, 2, '同操作再現即擋（模式①——無變更重跑）');
assert.match(l2.stderr, /迴圈斷路器/, '擋截訊息要求先實際變更再重試');
assert.equal(state().node, 'test', '模式①不升級——微調命令即新指紋放行');
// 模式②：擋後逐字重發＝忽視回饋——升級：自動重走 intent 開新輪（不凍結不停擺）
const l3 = loop();
assert.equal(l3.status, 2, '逐字重發升級擋下');
{
  const st = state();
  assert.equal(st.node, 'intent', '升級＝自動重走 intent（任何活動段——不凍結，工作續行）');
  assert.equal(st.turnUsage.escalatedAt !== undefined, true, '升級時刻留痕（純觀測）');
  assert.equal(st.turnUsage.escalations, 1, '升級次數留痕（純觀測）');
  assert.equal(st.edgeAt['test→intent'] !== undefined, true, '推進邊時戳記錄撤退（edgeAt 定長欄位）');
  assert.equal(Object.keys(st.turnUsage.fpEscalations ?? {}).length, 1, '升級指紋標記 fpEscalations（模式③鑰匙——值為 true）');
}
// 模式③：升級補正後仍逐字重發＝死操作——本回合封禁該操作，其他工作照常推進
const l4 = loop();
assert.equal(l4.status, 2, '升級後仍逐字重發＝死操作封禁');
assert.match(l4.stderr, /死操作/, '封禁訊息：變更操作內容後重試（其他工作照常推進）');
{
  const st = state();
  assert.equal(st.node, 'intent', '死操作封禁不再回退（已在 intent——防宏觀升級循環）');
  assert.equal(st.turnUsage.escalations, 1, '封禁不重複升級（escalations 留 1）');
}
const u6 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status --short' } });
assert.equal(u6.status, 0, '封禁不凍結——不同操作照常放行（工作不停止）');
// 寫入後重跑＝新基礎正當放行（test→edit→test 迭代空間——模式表隨寫入清空）
const writeProbe = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, '.shiftblame/tmp/iteration-note.md'), content: '迭代中的實際變更' } });
assert.equal(writeProbe.status, 0, '寫入操作放行（tmp 永遠可寫）');
assert.equal(loop().status, 0, '寫入後同操作重跑＝新基礎正當放行（世界已變——模式追蹤全清）');
const skillOk = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解：迴圈升級下理解宣告仍可對話揭露驗證' } });
assert.equal(skillOk.status, 0, 'Skill 調用豁免（理解宣告對話揭露）');
const escapeOk = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb state' } });
assert.equal(escapeOk.status, 0, 'sb state 豁免於迴圈斷路器（逃生操作可重複使用）');
assert.equal(hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sb next intent' } }).status, 0, 'sb next intent 同豁免（逃生通道）');
// 老闆下一則輸入＝新回合（模式追蹤重置、恢復推進）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '新回合：改變策略後續行' });
assert.equal(state().turnUsage, undefined, '新回合模式追蹤重置');
const u7 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls -la' } });
assert.equal(u7.status, 0, '新回合工具恢復（同操作指紋隨回合重置）');
assert.equal(state().turnUsage.requests, 1, '新回合從 1 重新計數');

// —— 4. 重走（老闆新輸入重走 intent→定義級同 ms 開新輪）至 verify，途中寫真實 commit 供遙測 diff ——
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：定義級修正，重新確認需求' }); // 老闆決策邊輸入（對話承載——旗標即章）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0, '重走：老闆決策邊 --boss-ok');
assert.match(run('next', 'research', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊時點 1 條目過期即擋（新鮮度）');
assert.equal(pt('1', 'r2').status, 0, '時點 1 條目重審（舊條目已隨重走過期）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯修正確認，推進研究' }); // 時點 1 老闆 pass 輸入（requirement＋對抗完成＝決策邊裁決通道——零推回，對話承載）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, '時點 1 重過（G1 重封存）');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'y' } }); // 外部證據（research→plan 邊驗——重走進段重置後重新驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(run('next', 'test').status, 0, 'plan→test 機械推進（中鏈零審核——2.4.0 取消老闆放行）');
writeFileSync(join(root, 'test-1.mjs'), 'import assert from "node:assert/strict";\nassert.equal(1, 1);\n');
commit('test-1.mjs', 'test: cover acceptance');
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with feature\n');
commit('seed.txt', 'feat: deliver feature');
assert.equal(run('next', 'verify').status, 0, 'build→verify 機械推進（中鏈零審核——樹淨即過）');
assert.equal(pt('2').status, 0, '時點 2 宣告（verify 內——驗收完成、G1 回指閉環後審驗收結果）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：驗收通過，準備收尾' }); // 老闆終審輸入（verify＋對抗完成＝決策邊裁決通道——零推回，對話承載）

// —— 5. SOP／ROADMAP 每 ms 審查閘（2.6.3）：有文件未審即出口擋；sopreview 逐檔三態計數留痕＋sha256 綁定
// （審後改檔即失效——堵「審了」橡皮章與只增不減）；機械基本功未過則戳記不發 ——
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(root, '.shiftblame/SOP.md'), '---\nupdated: ' + today + '\n---\n# SOP\n本專案規範。\n');
assert.match(run('end', '--adversarial', '--boss-ok').stderr, /每 ms 必審/, '本 ms 未審即出口擋下');
assert.match(run('sopreview').stderr, /三態計數|逐條重評估/, '結論未逐檔申報三態計數即擋（「審了」「三問全過」不是審查——刪／改／留計數可抽查）');
const triState = 'SOP 逐條重評估：刪1 改1 留3（增0）';
writeFileSync(join(root, '.shiftblame/SOP.md'), '---\nupdated: ' + today + '\n---\n# SOP\n本專案規範。\n本專案規範。\n2026-01-01 起改用新流程\n');
const dirty = run('sopreview', triState);
assert.equal(dirty.status, 1, '機械基本功未過——審查戳記不發');
assert.match(dirty.stderr, /重複行|日期開頭/, '違規清單指出重複與日期日誌行');
assert.equal(state().sopReview, undefined, '髒文件不發戳記');
writeFileSync(join(root, '.shiftblame/SOP.md'), '---\nupdated: ' + today + '\n---\n# SOP\n本專案規範，登入強化由 slug: hardening 系列承載並對照 AC-03 驗收條目。\n');
const coded = run('sopreview', triState);
assert.equal(coded.status, 1, '任務代號未清——審查戳記不發');
assert.match(coded.stderr, /任務工作項目識別字|驗收條目編號/, '違規清單指出任務代號');
assert.equal(state().sopReview, undefined, '含任務代號的文件不發戳記');
writeFileSync(join(root, '.shiftblame/SOP.md'), '---\nupdated: ' + today + '\n---\n# SOP\n本專案規範，開發流程依 shiftblame 七段推進，每次 commit 過 sb commitmsg 印章。\n');
const framed = run('sopreview', triState);
assert.equal(framed.status, 1, '框架重述未清——審查戳記不發');
assert.match(framed.stderr, /框架名稱|流程機制語彙|框架指令引用/, '違規清單指出框架重述');
assert.equal(state().sopReview, undefined, '含框架重述的文件不發戳記');
writeFileSync(join(root, '.shiftblame/SOP.md'), '---\nupdated: ' + today + '\n---\n# SOP\n本專案規範（重複句已合併）。\n');
assert.equal(run('sopreview', triState).status, 0, '基本功過——審查留痕（逐檔三態計數）');
assert.equal(state().sopReview.ms, '001', '戳記屬本 ms');
assert.match(state().sopReview.answers, /刪1 改1 留3/, '逐檔三態計數落檔（刪 0 可見——抽查對照）');
assert.match(state().sopReview.files['SOP.md'], /^[0-9a-f]{64}$/, '戳記綁定 SOP.md sha256（審後改檔即失效）');
writeFileSync(join(root, '.shiftblame/SOP.md'), '---\nupdated: ' + today + '\n---\n# SOP\n本專案規範（重複句已合併，審後偷改一行）。\n');
assert.match(run('end', '--adversarial', '--boss-ok').stderr, /已變更/, '審查後治理檔變更＝戳記失效——出口擋（堵先審後改窗口）');
assert.equal(run('sopreview', triState).status, 0, '變更後重跑 sb sopreview 重新綁定');
const endOut = run('end', '--adversarial', '--boss-ok');
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
  assert.equal(t.counts.inputs, undefined, 'inputs 計數已隨輸入流拆除（counts 僅 toolCalls）');
  assert.ok(t.durationMinutes === null || t.durationMinutes >= 0, '耗時（分）或缺省');
  assert.equal(st.usageTotals, undefined, 'slug 邊界清理：累計計數');
  assert.equal(run('state').status, 0, 'ended 含 telemetry 仍合法（sb state 可讀）');
}

// —— 7. 觀測流輪替已隨流拆除（對話不落檔＝零增長，無輪替必要）；指紋 128 鍵上限保留（對抗審查 M1 回歸）：
// 多樣操作永不觸發死鎖——超過 128 種指紋時淘汰最舊鍵，狀態恆合法 ——
const rotRoot = mkdtempSync(join(tmpdir(), 'sb-rot-'));
process.on('exit', () => rmSync(rotRoot, { recursive: true, force: true }));
mkdirSync(join(rotRoot, '.shiftblame/tmp'), { recursive: true });
writeFileSync(join(rotRoot, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'build', history: [] }));
const rotHook = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: rotRoot, ...payload }), encoding: 'utf8' });
const rotState = () => JSON.parse(readFileSync(join(rotRoot, '.shiftblame/flow-state.json'), 'utf8'));
for (let i = 0; i < 130; i++) rotHook({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `echo distinct-operation-${i}` } });
{
  const st = rotState();
  const keyCount = Object.keys(st.turnUsage.repeats ?? {}).length;
  assert.ok(keyCount <= 128, `指紋鍵數 ≤128（實得 ${keyCount}）`);
  const stateRun2 = spawnSync(process.execPath, [cli, 'state'], { cwd: rotRoot, encoding: 'utf8' });
  assert.equal(stateRun2.status, 0, '多樣操作（130 種不同指紋）不觸發接入異常（M1：第 129 鍵寫入死鎖已除）');
}
console.log('sb-observability: pass');
