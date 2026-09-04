// sb-understanding-flow：雙流模型——輸入流唯增、理解流（Skill args）落檔＋雜湊鏈、
// 必然曝光、無鎖、sb unlock 不存在命令處理、--new-ms 開新里程碑。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
// 真實 hooks 串接：UserPromptSubmit 唯增輸入流；Skill(shiftblame:think)+args 落理解流
const boss = (prompt) => { hookRun({ hook_event_name: 'UserPromptSubmit', prompt }); return state(); };
const think = (as) => hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: as } });

// —— 1. 輸入流唯增：連續三則不覆蓋（連續串＝同一事實流，無挑引句問題）——
boss('你去想吧');
boss('另外注意路徑展開');
boss('就這樣做');
assert.equal(state().inputs.length, 3, '三則輸入全部保留（唯增——永不覆蓋）');
assert.equal(state().inputs[0].text, '你去想吧', '第一則原文永久在流中（無翻舊帳概念——無需引用）');
assert.equal(state().dialogueLock, undefined, '無對話鎖欄位');
assert.equal(state().thinkRouted, undefined, '無 thinkRouted（理解流本身是路由證據）');

// —— 2. 理解流：Skill(shiftblame:think) 調用 args＝理解宣告——實質才落檔 ——
let r = think('短');
assert.equal(state().understandings, undefined, 'args 過短不落檔（理解必須有實質——該輸入保持未覆蓋曝光）');
r = think('理解：授權以雙流模型落地，撤除全部鎖機制');
const us = state().understandings;
assert.equal(us.length, 1, '理解宣告落檔');
assert.equal(us[0].uptoInput, 2, '涵蓋至最新輸入（#2）');
assert.ok(/撤除全部鎖機制/.test(us[0].as), 'args 即理解宣告');
assert.equal(us[0].reviewed, false, '未審——待曝光');

// —— 3. 雜湊鏈（唯增）：刪改中間條目斷鏈——寫入側驗證由 hooks 內部算式承擔，此處驗算式對稱 ——
const expect = createHash('sha256').update('' + String(us[0].uptoInput) + us[0].as + us[0].at).digest('hex').slice(0, 16);
assert.equal(us[0].hash, expect, '鏈算式 sha256(prev+idx+as+at)');

// —— 4. 必然曝光：下則輸入時未審理解展示＋標記已審 ——
think('理解：曝光驗證的第二份理解宣告內容');
r = hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '下一則輸入' });
assert.ok(r.stdout.includes('理解審視') && r.stdout.includes('曝光驗證的第二份理解宣告'), '未審理解於老闆輸入時曝光');
assert.equal(state().understandings.filter((e) => !e.reviewed).length, 0, '展示即標記已審');

// —— 5. sb unlock：明確 die——
r = spawnSync(sb, [sbBin, 'unlock'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 1, 'sb unlock 擋');
assert.match(r.stderr, /sb unlock 不存在/);
r = spawnSync(sb, [sbBin, 'unlock', '--quoted', '你去想吧', '--as', 'x'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 2, '舊旗標形（--quoted/--as 已撤）→usage 擋');

// —— 6. 八段鑰匙：--boss-ok＋時點對抗（無印章）；--new-ms 開新里程碑 ——
writeFileSync(statePath, JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify', history: [], stamps: {}, inputs: state().inputs, understandings: state().understandings,
}));
mkdirSync(join(root, '.shiftblame', 'demo'), { recursive: true });
mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
writeFileSync(join(root, '.shiftblame', 'tmp', 'pt3.md'), '# p\n對抗判定：通過');
spawnSync(sb, [sbBin, 'adversarial', join(root, '.shiftblame/tmp/pt3.md'), '--point', '③'], { cwd: root, encoding: 'utf8' });
r = spawnSync(sb, [sbBin, 'next', 'done', '--boss-ok', '--adversarial'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 0, 'verify→done：--boss-ok＋時點③對抗即鑰匙（無 done 印章）');
r = spawnSync(sb, [sbBin, 'next', 'intent', '--new-ms'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 0, 'done→intent --new-ms 開新里程碑');
assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).ms, '002', 'ms++');
writeFileSync(statePath, JSON.stringify({ ...state(), node: 'test' }));
r = spawnSync(sb, [sbBin, 'next', 'build', '--new-ms'], { cwd: root, encoding: 'utf8' });
assert.equal(r.status, 1, '--new-ms 誤用（非 done→intent 邊）擋');
assert.match(r.stderr, /僅限 done→intent/);

console.log('sb-understanding-flow: PASS');
