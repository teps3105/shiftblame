// sb-understanding-flow：對話承載（流不落檔）——回合邊界重置與舊流鍵冪等剝除、理解宣告由 Skill args 於對話揭露（零檔案寫入）、
// sb unlock 不存在命令處理、--new-ms 開新里程碑（老形 fixture 經讀取端遷移為 lastAdv／edgeAt 判定）。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const sb = process.execPath;
const sbBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sb.mjs');
const hookBin = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks', 'shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-flow-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, '.shiftblame'), { recursive: true });
const statePath = join(root, '.shiftblame', 'flow-state.json');
const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
const hookRun = (payload) => spawnSync(sb, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
// 真實 hooks 串接：UserPromptSubmit＝回合邊界（零內容寫入）；Skill(shiftblame:think)+args＝對話揭露的理解宣告
const boss = (prompt) => { hookRun({ hook_event_name: 'UserPromptSubmit', prompt }); return state(); };
const think = (as) => hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: as } });

// —— 1. 流不落檔：連續三則輸入零內容寫入（對話事實由平台承載——唯增流與雜湊鏈已拆） ——
boss('你去想吧');
boss('另外注意路徑展開');
boss('就這樣做');
const st1 = state();
assert.equal(st1.inputs, undefined, '輸入不落檔');
assert.equal(st1.understandings, undefined, '理解流不存在');
assert.equal(st1.dialogueLock, undefined, '無對話鎖欄位');
assert.equal(st1.thinkRouted, undefined, '無 thinkRouted');

// —— 2. 理解宣告＝對話揭露：Skill(shiftblame:think) args 放行且零檔案寫入 ——
const before = JSON.parse(readFileSync(statePath, 'utf8'));
delete before.hooksHeartbeat;
let r = think('理解：授權以對話承載模型落地，理解宣告於對話流揭露');
assert.equal(r.status, 0, 'Skill 調用放行');
const after = JSON.parse(readFileSync(statePath, 'utf8'));
delete after.hooksHeartbeat;
delete after.turnUsage; delete after.usageTotals; // PreToolUse 觀測計數屬合法狀態寫入（剝除後比對事實面）
assert.deepEqual(after, before, '理解宣告零檔案寫入（無落檔、無雜湊、無曝光標記——老闆讀對話即審）');

// —— 3. 回合邊界：模式追蹤重置＋舊版流鍵冪等剝除（舊檔升級即瘦身——與 migrateStreams 老鍵清單對齊） ——
writeFileSync(statePath, JSON.stringify({
  ...after, slug: 'demo', ms: '001', node: 'verify',
  inputs: [{ at: '2026-09-07T00:00:00.000Z', text: '舊輸入' }],
  understandings: [{ at: '2026-09-07T00:00:00.000Z', uptoInput: 0, as: '舊理解', reviewed: true, hash: 'x' }],
  understandingHold: { at: '2026-09-07T00:00:00.000Z' }, dialogueLock: true, thinkRouted: true,
  stamps: {}, unlockLog: [],
  turnUsage: { startedAt: '2026-09-07T00:00:00.000Z', requests: 9, repeats: { x: 'denied' } },
}));
boss('帶舊鍵的回合');
const st2 = state();
delete st2.hooksHeartbeat;
assert.equal(st2.inputs, undefined, 'inputs 冪等剝除');
assert.equal(st2.understandings, undefined, 'understandings 冪等剝除');
assert.equal(st2.understandingHold, undefined, 'understandingHold 冪等剝除（停等凍結已拆）');
assert.equal(st2.dialogueLock, undefined, 'dialogueLock 冪等剝除');
assert.equal(st2.thinkRouted, undefined, 'thinkRouted 冪等剝除');
assert.equal(st2.stamps, undefined, 'stamps 冪等剝除（2.0x 舊鍵）');
assert.equal(st2.unlockLog, undefined, 'unlockLog 冪等剝除');
assert.equal(st2.turnUsage, undefined, '回合邊界重置模式追蹤（repeats／fpEscalations 清）');
assert.equal(st2.slug, 'demo', '流程欄位保留（只剝流鍵，不動流程狀態）');

// —— 4. sb unlock：明確 die——
r = spawnSync(sb, [sbBin, 'unlock'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 1, 'sb unlock 擋');
assert.match(r.stderr, /sb unlock 不存在/);
r = spawnSync(sb, [sbBin, 'unlock', '--quoted', '你去想吧', '--as', 'x'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 2, '舊旗標形（--quoted/--as 已撤）→usage 擋');

// —— 5. pass 出口鑰匙：時點 2 對抗條目＋--boss-ok 旗標即章同一邊；老形 fixture（adversarialLog／history）經讀取端遷移判定 ——
mkdirSync(join(root, '.shiftblame', 'demo'), { recursive: true });
writeFileSync(join(root, '.shiftblame', 'demo', 'SLUG.md'), `---\nslug: demo\n---\n\n# demo\n`);
writeFileSync(statePath, JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify',
  history: [{ from: 'build', to: 'verify', at: '2026-09-07T05:00:00.000Z' }],
  adversarialLog: [{ at: '2026-09-07T05:20:00.000Z', report: '.shiftblame/tmp/r.md', verdict: '通過', node: 'verify', point: '2' }],
}));
mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
r = spawnSync(sb, [sbBin, 'next', 'intent', '--new-ms', '--adversarial', '--boss-ok'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 0, 'pass 出口一：verify→intent --new-ms（時點 2 對抗條件＋旗標即章——老形條目經 migrateStreams 轉 lastAdv 後判定新鮮）');
const stExit = JSON.parse(readFileSync(statePath, 'utf8'));
assert.equal(stExit.ms, '002', 'ms++');
assert.equal(stExit.adversarialLog, undefined, '寫回即新形（adversarialLog 已轉 lastAdv）');
assert.equal(stExit.history, undefined, '寫回即新形（history 已轉 edgeAt）');
writeFileSync(statePath, JSON.stringify({ ...state(), node: 'test' }));
r = spawnSync(sb, [sbBin, 'next', 'build', '--new-ms'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 1, '--new-ms 誤用（非 verify→intent pass 出口）擋');
assert.match(r.stderr, /僅限 verify→intent/);

console.log('sb-understanding-flow: pass');
