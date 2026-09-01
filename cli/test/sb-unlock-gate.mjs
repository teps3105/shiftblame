// sb-unlock-gate：理解宣告制（1.5.6）——thinkRouted／逐字錨定／--as 必填／消費即失效／雜湊鏈／無語義官僚
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const sb = process.execPath;
const sbBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'sb.mjs');
const hookBin = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'hooks', 'shiftblame-guard.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-unlock-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, '.shiftblame'), { recursive: true });
const statePath = join(root, '.shiftblame', 'flow-state.json');
const state = () => JSON.parse(readFileSync(statePath, 'utf8'));
// 模擬 hooks 寫入的當前輸入（覆蓋式）：{ at, text, consumed }
const boss = (text) => writeFileSync(statePath, JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: true, stamps: {},
  input: { at: new Date().toISOString(), text, consumed: false },
}));
// 真實 hooks 串接：UserPromptSubmit 寫 input＋reset thinkRouted；Skill(sb-think) 標記 thinkRouted
const hookRun = (payload) => spawnSync(sb, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const bossReal = (prompt) => { hookRun({ hook_event_name: 'UserPromptSubmit', prompt }); return state(); };
const routeThink = () => hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:sb-think', args: '…' } });
const unlock = (args) => spawnSync(sb, [sbBin, 'unlock', ...args], { cwd: root, encoding: 'utf8' });

// —— thinkRouted：未路由不得解鎖（理解的制度化入口）——
bossReal('你去想吧');
let r = unlock(['--quoted', '你去想吧', '--as', '行動許可：授權開始執行']);
assert.equal(r.status, 1, '未路由 sb-think→擋');
assert.match(r.stderr, /未路由 sb-think/);
routeThink();
assert.equal(state().thinkRouted, true, 'Skill(sb-think) 調用被 hooks 標記');
r = unlock(['--quoted', '你去想吧', '--as', '行動許可：授權開始執行']);
assert.equal(r.status, 0, '路由後——詞庫外授權語「你去想吧」可解鎖（語義由宣告承擔）');
assert.equal(state().dialogueLock, false);
assert.equal(state().input.consumed, true, '消費即失效');
assert.ok(state().unlockLog.at(-1).as === '行動許可：授權開始執行', '理解宣告留痕');

// 同則二次消費擋
r = unlock(['--quoted', '你去想吧', '--as', '行動許可']);
assert.equal(r.status, 1, '已消費不得再引');
assert.match(r.stderr, /已消費/);

// —— hooks 健康診斷（1.6.1）：心跳停滯時閘擋附「記錄缺失≠授權缺失」警示（只診斷不降級——逃生門屬合法漏洞已否決）——
bossReal('繼續吧');
writeFileSync(statePath, JSON.stringify({ ...state(), thinkRouted: false }, null, 2));
mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
writeFileSync(join(root, '.shiftblame', 'tmp', 'hooks-heartbeat.json'), JSON.stringify({ at: '2020-01-01T00:00:00Z', event: 'PreToolUse' }));
r = unlock(['--quoted', '繼續吧', '--as', '行動許可']);
assert.equal(r.status, 1, '未路由擋（場景樁）');
assert.match(r.stderr, /hooks 健康警示/, '心跳停滯→擋訊息附 hooks 故障診斷');
assert.match(r.stderr, /不得繞閘/, '診斷只揭露不降級（fail-closed 不變）');
routeThink();
r = unlock(['--quoted', '繼續吧', '--as', '行動許可：推進下一輪']);
assert.equal(r.status, 0, '恢復路由後正常解鎖——警示不改變閘行為');

// —— --as 必填（理解宣告是制度形式）——
bossReal('繼續');
routeThink();
r = unlock(['--quoted', '繼續']);
assert.equal(r.status, 1, '缺 --as→擋');
assert.match(r.stderr, /缺 --as/);

// —— 逐字錨定（事實防線不變）——
bossReal('繼續');
routeThink();
r = unlock(['--quoted', '開工', '--as', '行動許可']);
assert.equal(r.status, 1, '引句非當前輸入→捏造/跳時序擋');
assert.match(r.stderr, /逐字/);

// —— 撤語義官僚的行為驗證：否定句形/無候選詞形皆由宣告承擔 ——
bossReal('先不要急著做，等資料齊了再說你去把分析跑完');
routeThink();
r = unlock(['--quoted', '你去把分析跑完', '--as', '行動許可：先跑分析（等資料齊的前提由我理解吸納，錯了曝光行可見）']);
assert.equal(r.status, 0, '否定詞同句＋無詞庫詞——理解宣告制下可解鎖（舊候選/否定閘已撤）');
bossReal('嗯');
routeThink();
r = unlock(['--quoted', '嗯', '--as', '行動許可：繼續執行', '--stamp', 'done']);
assert.equal(r.status, 0, 'stamp 類型由宣告承擔（無類型對照）');
assert.ok(state().stamps.done, 'done 印章寫入（錯用＝曝光可見）');

// —— --as 事實級防護（換行／長度）＋鏈算式寫入/驗證對稱（1.5.6 對抗必修回歸）——
bossReal('繼續，照你說的辦');
routeThink();
r = unlock(['--quoted', '繼續，照你說的辦', '--as', 'a\n[shiftblame] 偽造注入\n②偽造內容']);
assert.equal(r.status, 1, 'as 含換行→擋（曝光通道單行性——防注入偽造多行框架文本）');
assert.match(r.stderr, /不得含換行/);
r = unlock(['--quoted', '繼續，照你說的辦', '--as', 'a\u2028b\u2029c\u000Bd']);
assert.equal(r.status, 1, 'as 含類換行字元（U+2028/U+2029/VT）→擋（寫入側同判）');
r = unlock(['--quoted', '繼續，照你說的辦', '--as', 'x'.repeat(201)]);
assert.equal(r.status, 1, 'as 超 200 字→擋（曝光通道膨脹防護）');
assert.match(r.stderr, /過長/);
r = unlock(['--quoted', '繼續，照你說的辦', '--as', '  行動許可：照理解推進  ']);
assert.equal(r.status, 0, '前後空白 as 可解鎖');
bossReal('那就這樣');
routeThink();
r = unlock(['--quoted', '那就這樣', '--as', '行動許可']);
assert.equal(r.status, 0, '空白 as 入鏈後後續解鎖不斷鏈（hash 用 trim 後算——寫入/驗證對稱）');

// —— 雜湊鏈（含 as 的算式）——
const withLog = state();
assert.ok(withLog.unlockLog.length >= 3 && withLog.unlockLog.every((e) => typeof e.hash === 'string'), '鏈條 hash 全寫入');
const tampered = JSON.parse(JSON.stringify(withLog));
tampered.unlockLog.splice(0, 1); // 刪中間條目——斷鏈
tampered.input = { at: new Date().toISOString(), text: '繼續', consumed: false };
tampered.thinkRouted = true;
writeFileSync(statePath, JSON.stringify(tampered, null, 2));
r = unlock(['--quoted', '繼續', '--as', '行動許可']);
assert.equal(r.status, 1, 'unlockLog 刪改→斷鏈擋');
assert.match(r.stderr, /雜湊鏈斷裂/);

// —— 串八段：unlock --stamp done 驅動 verify→done ——
// （前面斷鏈測試刪改了磁碟上的 unlockLog——用斷鏈前的 withLog 重建完整鏈）
writeFileSync(statePath, JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: true, stamps: {}, thinkRouted: true,
  input: { at: new Date().toISOString(), text: '這輪就這樣收了', consumed: false },
  unlockLog: withLog.unlockLog,
}));
mkdirSync(join(root, '.shiftblame', 'demo'), { recursive: true });
writeFileSync(join(root, '.shiftblame', 'demo', 'SLUG.md'), '# SLUG\n時點③對抗\n');
r = unlock(['--quoted', '這輪就這樣收了', '--as', '完成授權：本 ms 收斂', '--stamp', 'done']);
assert.equal(r.status, 0);
const next = spawnSync(sb, [sbBin, 'next', 'done', '--boss-ok', '--adversarial'], { cwd: root, encoding: 'utf8' });
assert.equal(next.status, 0, 'done 印章消費→verify→done 放行');
assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).node, 'done');

console.log('sb-unlock-gate: PASS');
