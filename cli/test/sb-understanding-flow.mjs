// sb-understanding-flow：對話承載（流不落檔）——回合邊界重置與舊流鍵冪等剝除、理解宣告由 Skill args 於對話揭露（零檔案寫入）、
// sb unlock 不存在命令處理、--new-ms 開新里程碑（老形 fixture 經讀取端遷移為 lastAdv／edgeAt 判定）。
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFlowState } from '../bin/flow-state.mjs';

const sb = process.execPath;
const sbBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sb.mjs');
const hookBin = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks', 'shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-flow-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, '.shiftblame'), { recursive: true });
const statePath = join(root, '.shiftblame', 'flow-state.json');
const recordsPath = join(root, '.shiftblame', 'tmp', 'hook-records.json');
const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
const records = () => JSON.parse(readFileSync(recordsPath, 'utf8'));
const hookRun = (payload) => spawnSync(sb, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
// 真實 hooks 串接：UserPromptSubmit＝回合邊界（零內容寫入）；Skill(shiftblame:think)+args＝對話揭露的理解宣告
const boss = (prompt) => hookRun({ hook_event_name: 'UserPromptSubmit', prompt });
const think = (as) => hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: as } });

// —— 1. 流不落檔：連續三則輸入零內容寫入（對話事實由平台承載——唯增流與雜湊鏈已拆） ——
boss('你去想吧');
boss('另外注意路徑展開');
boss('就這樣做');
assert.equal(existsSync(statePath), false, 'hooks 不建立 flow-state');
assert.deepEqual(Object.keys(records()), ['hooksHeartbeat'], '輸入不落檔：hooks 紀錄只有心跳');

// —— 2. 理解宣告＝對話揭露：Skill(shiftblame:think) args 放行且零檔案寫入 ——
let r = think('理解：授權以對話承載模型落地，理解宣告於對話流揭露');
assert.equal(r.status, 0, 'Skill 調用放行');
assert.equal(existsSync(statePath), false, '理解宣告零檔案寫入（無落檔、無雜湊、無曝光標記——老闆讀對話即審）');
assert.deepEqual(Object.keys(records()).sort(), ['hooksHeartbeat', 'turnUsage', 'usageTotals'], 'PreToolUse 只留觀測計數');

// —— 3. 回合邊界：hooks 只重置自己的回合計數，不改寫 flow-state；舊版流鍵由讀取端剝除（與 migrateStreams 老鍵清單對齊），下次 sb 寫入即瘦身 ——
writeFileSync(statePath, JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify',
  inputs: [{ at: '2026-09-07T00:00:00.000Z', text: '舊輸入' }],
  understandings: [{ at: '2026-09-07T00:00:00.000Z', uptoInput: 0, as: '舊理解', reviewed: true, hash: 'x' }],
  understandingHold: { at: '2026-09-07T00:00:00.000Z' }, dialogueLock: true, thinkRouted: true,
  stamps: {}, unlockLog: [],
  turnUsage: { startedAt: '2026-09-07T00:00:00.000Z', requests: 9, repeats: { x: 'denied' } },
}));
const legacyRaw = readFileSync(statePath, 'utf8');
boss('帶舊鍵的回合');
assert.equal(readFileSync(statePath, 'utf8'), legacyRaw, 'hooks 不改寫 flow-state');
assert.equal(records().turnUsage, undefined, '回合邊界重置 hooks 的回合計數');
const st2 = readFlowState(root).state;
assert.equal(st2.inputs, undefined, 'inputs 冪等剝除');
assert.equal(st2.understandings, undefined, 'understandings 冪等剝除');
assert.equal(st2.understandingHold, undefined, 'understandingHold 冪等剝除（停等凍結已拆）');
assert.equal(st2.dialogueLock, undefined, 'dialogueLock 冪等剝除');
assert.equal(st2.thinkRouted, undefined, 'thinkRouted 冪等剝除');
assert.equal(st2.stamps, undefined, 'stamps 冪等剝除（2.0x 舊鍵）');
assert.equal(st2.unlockLog, undefined, 'unlockLog 冪等剝除');
assert.deepEqual(Object.keys(st2.turnUsage).sort(), ['requests', 'startedAt'], '舊回合計數的模式追蹤欄位（repeats／fpEscalations）讀取即剝');
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
