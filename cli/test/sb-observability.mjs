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

// Identical external observations remain legal and count only as attempts.
for(let i=0;i<5;i++) assert.equal(hookRun({hook_event_name:'PreToolUse',tool_name:'Bash',tool_input:{command:'git status --porcelain'}}).status,0);
assert.equal(state().node,'test');
assert.equal(state().turnUsage.repeats,undefined);
assert.equal(run('next','intent').status,0);

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

// Optional review records do not block an otherwise valid exit.
writeFileSync(join(root,'.shiftblame/SOP.md'),'# 環境\n本次無環境變更\n');
assert.equal(run('sopreview','已核對').status,0);
assert.equal(run('state').status,0,'短而具體的審查結論不破壞狀態');
writeFileSync(join(root,'.shiftblame/SOP.md'),'# 環境\n已更新環境說明\n');

assert.equal(run('end','--adversarial','--boss-ok').status,0);

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

console.log('sb-observability: pass');
