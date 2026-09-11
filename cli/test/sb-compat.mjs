// sb-compat：flow-state 向後相容——2.0.2 前舊格式讀取全過、新欄位（預算／遙測／計數／輪替偏移）一律可缺省、
// 現存十個專案的 flow-state 實機回歸（分類與升級前一致）、缺失檔自動創建（老闆隨時可清理 json）。
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFlowState } from '../bin/flow-state.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/sb.mjs');
const roots = [];
process.on('exit', () => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
const scratch = () => { const r = mkdtempSync(join(tmpdir(), 'sb-compat-')); roots.push(r); return r; };
const at = '2026-09-07T05:20:59.219Z';
const as = '理解：相容性驗證的理解宣告';
const chain = (prev, idx) => createHash('sha256').update(prev + String(idx) + as + at).digest('hex').slice(0, 16);

// —— 1. 舊格式（2.0.2 前形狀，無任何新欄位）讀取全過 ——
function classify(state, kind, note) {
  const root = scratch();
  mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
  writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(state));
  assert.equal(readFlowState(root).kind, kind, note);
}
classify({ hooksHeartbeat: { at, event: 'SessionStart' }, inputs: [{ at, text: '舊輸入' }] }, 'uninitialized', '舊未初始化紀錄');
classify({
  slug: null, ms: null, node: null, history: [], hooksHeartbeat: { at, event: 'PreToolUse' },
  adversarialLog: [{ at, report: '.shiftblame/tmp/review-old.md', verdict: '通過', node: null }],
  adversarialAt: at, adversarialConsumed: false,
}, 'direct', '舊直接實行紀錄');
classify({
  slug: 'demo', ms: '001', node: 'build', history: [{ from: 'test', to: 'build', at, ms: '001', bossOk: false, adversarial: false }],
  hooksHeartbeat: { at, event: 'PreToolUse' }, inputs: [{ at, text: '舊輸入' }, { at, text: '第二則' }],
  understandings: [{ at, uptoInput: 1, as, reviewed: true, hash: chain('', 1) }],
  externalEvidence: { done: true, at, tool: 'WebSearch' },
}, 'active', '舊八段流程（含 g1Contract/rev 等額外欄位由現場寫入，新欄位全缺省）');
classify({ slug: 'demo', ms: '001', node: 'ended', endedAt: at, history: [] }, 'ended', '舊 ended 態');
classify({
  slug: 'demo', ms: '001', node: 'ended', endedAt: at, history: [], workBranch: 'feat/demo',
  closeout: { slug: 'demo', workBranch: 'feat/demo', workCommit: 'a'.repeat(40), baseBranch: 'main', at, remotes: [] },
}, 'ended', '舊 ended＋closeout 態');
classify({ slug: 'demo', ms: '001', node: 'intent', history: [] }, 'active', '舊最小 active（無 hooks 紀錄）');

// —— 2. 新欄位存在時的形狀驗證（缺省自由＋損壞即 invalid） ———
classify({
  slug: 'demo', ms: '001', node: 'test', history: [],
  budget: { requests: 40, minutes: 30, at, ms: '001' },
  sopReview: { ms: '001', at }, baseCommit: 'b'.repeat(40), startedAt: at,
  turnUsage: { startedAt: at, requests: 3 }, usageTotals: { firstAt: at, requests: 12 }, budgetBreaches: 1,
  inputsRotated: 4, understandingsRotated: 2, understandingSeedHash: chain('', 0), adversarialRotated: 1, historyRotated: 0,
  inputs: [{ at, text: '新輸入' }],
  understandings: [{ at, uptoInput: 4, as, reviewed: false, hash: chain(chain('', 0), 4) }],
}, 'active', '新欄位齊備的 active（輪替偏移＋全域輸入編號＋鏈自種子接續）');
classify({
  slug: 'demo', ms: '001', node: 'ended', endedAt: at, history: [],
  telemetry: {
    diff: { additions: 10, deletions: 2, files: 3 }, baseCommit: 'b'.repeat(40), headCommit: 'c'.repeat(40),
    adversarial: { verdict: '通過', model: 'GLM-5.3' },
    counts: { inputs: 8, understandings: 6, adversarial: 4, toolCalls: 90 }, durationMinutes: 41.5, budgetBreaches: 0,
  },
}, 'ended', 'ended＋telemetry（model 缺省 null 亦合法——另驗）');
classify({
  slug: 'demo', ms: '001', node: 'ended', endedAt: at, history: [],
  telemetry: { diff: null, baseCommit: null, headCommit: null, adversarial: null, counts: { inputs: 1, understandings: 0, adversarial: 0, toolCalls: null }, durationMinutes: null, budgetBreaches: null },
}, 'ended', 'telemetry 全缺省（無 git／舊流程）');
classify({ slug: 'demo', ms: '001', node: 'test', history: [], budget: { requests: 'x', minutes: 30, at, ms: '001' } }, 'invalid', '預算形狀損壞即 invalid');
classify({ slug: 'demo', ms: '001', node: 'test', history: [], turnUsage: { startedAt: 'bad', requests: 1 } }, 'invalid', '回合計數形狀損壞即 invalid');
classify({ slug: 'demo', ms: '002', node: 'test', history: [], budget: { requests: 5, minutes: 5, at, ms: '001' } }, 'invalid', '跨 ms 預算（--new-ms 未清）即 invalid');

// —— 3. 十專案實機回歸：分類與升級前基準一致（舊檔讀取不改變判定） ——
// 基準＝升級當下以 2.0.2 驗證器量測的分類快照；已 invalid 者屬既有事實（恢復程序另行承擔），相容性要求＝分類不變。
const TEN_PROJECT_BASELINE = {
  'CF-Simulator-Godot': 'invalid',
  FantasticLight: 'active',
  SpriteWeave: 'direct',
  'Trickster-Web': 'active',
  Varellune: 'active',
  Varellune_Document: 'invalid',
  'dnd-prototype': 'active',
  'moffee-pos': 'invalid',
  'palserver-gui': 'ended',
  shiftblame: 'direct',
};
let scanned = 0;
for (const [name, expected] of Object.entries(TEN_PROJECT_BASELINE)) {
  const dir = join('D:/', name);
  if (!existsSync(dir)) { console.log(`  （略）${name} 不在本機——fixture 承擔格式相容`); continue; }
  const result = readFlowState(dir);
  assert.equal(result.kind, expected, `${name} 分類與升級前一致（${expected}）`);
  scanned += 1;
}
assert.ok(scanned >= 1, '至少完成一個實機專案的回歸');

// —— 4. 缺失自動創建：老闆清理 json 後，sb 命令重建觀測檔且狀態判定不受影響 ——
{
  const root = scratch();
  mkdirSync(join(root, '.shiftblame'), { recursive: true }); // 錨定工作區（root 錨定元規則——不向上漂移）
  const out = spawnSync(process.execPath, [cli, 'state'], { cwd: root, encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /尚未初始化/, '無 flow-state 的目錄 sb state 正常判定');
  const usage = join(root, '.shiftblame/tmp/sb-usage.jsonl');
  assert.ok(existsSync(usage), 'sb-usage.jsonl 缺失自動創建');
  const lines1 = readFileSync(usage, 'utf8').split('\n').filter(Boolean).length;
  spawnSync(process.execPath, [cli, 'state'], { cwd: root, encoding: 'utf8' });
  assert.equal(readFileSync(usage, 'utf8').split('\n').filter(Boolean).length, lines1 + 1, '每次調用增行（可重複清理後重建）');
  rmSync(usage, { force: true });
  spawnSync(process.execPath, [cli, 'state'], { cwd: root, encoding: 'utf8' });
  assert.ok(existsSync(usage), '清理後再調用自動重建');
}
console.log(`sb-compat: PASS（實機回歸 ${scanned}/10 專案）`);
