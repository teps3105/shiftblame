// sb-unlock-gate：解鎖驗證鏈（時序元規則）——逐字錨定／候選覆蓋（含英文邊界）／否定擋／覆蓋式當前輸入／消費即失效／--stamp／真實掃描串接／雜湊鏈
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
// 模擬 hooks 寫入的當前輸入（覆蓋式）：{ at, text, candidates, consumed }
const boss = (text, candidates) => writeFileSync(statePath, JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: true, stamps: {},
  input: { at: new Date().toISOString(), text, candidates, consumed: false },
}));
// 真實掃描串接：跑 hooks UserPromptSubmit 產生 input（candidates 來自 scanConsent，非手寫）
const bossReal = (prompt) => {
  spawnSync(sb, [hookBin], { input: JSON.stringify({ cwd: root, hook_event_name: 'UserPromptSubmit', prompt }), encoding: 'utf8' });
  return state().input;
};
const unlock = (args) => spawnSync(sb, [sbBin, 'unlock', ...args], { cwd: root, encoding: 'utf8' });

// 正例：真實候選、逐字引句
boss('這輪做完，繼續', [{ word: '繼續', type: 'go', negated: false }]);
let r = unlock(['--quoted', '繼續']);
assert.equal(r.status, 0, '引句覆蓋非否定候選→解鎖');
assert.equal(state().dialogueLock, false);
assert.equal(state().input.consumed, true, '消費即失效');
assert.ok(state().unlockLog.at(-1).quoted === '繼續' && state().unlockLog.at(-1).reviewed === false, '留痕待曝光');

// 同則二次消費擋
r = unlock(['--quoted', '繼續']);
assert.equal(r.status, 1, '已消費不得再引');
assert.match(r.stderr, /已消費/);

// 無候選引句擋（斷章：引非授權語義）
boss('你這是在把系統複雜化，太蠢了', []);
r = unlock(['--quoted', '太蠢了']);
assert.equal(r.status, 1, '無候選→fail-closed');
assert.match(r.stderr, /未覆蓋任何候選/);

// 否定候選擋
boss('還沒開始，先別動', [{ word: '開始', type: 'go', negated: true }]);
r = unlock(['--quoted', '開始']);
assert.equal(r.status, 1, '引否定候選→擋');
assert.match(r.stderr, /否定標記/);

// 混合句：否定候選與非否定候選並存——引非否定部分過
boss('先不要繼續，就這樣收掉', [
  { word: '繼續', type: 'go', negated: true },
  { word: '就這樣', type: 'go', negated: false },
]);
r = unlock(['--quoted', '就這樣']);
assert.equal(r.status, 0, '引同則非否定候選過（否定候選不影響其他候選）');

// 捏造擋（引句非當前輸入子串）
boss('繼續', [{ word: '繼續', type: 'go', negated: false }]);
r = unlock(['--quoted', '開工']);
assert.equal(r.status, 1, '引句非當前輸入→捏造/跳時序擋');
assert.match(r.stderr, /逐字/);

// 覆蓋式時序：舊則被新輸入覆蓋後不可引
boss('繼續', [{ word: '繼續', type: 'go', negated: false }]);
boss('不好，再想想', []);
r = unlock(['--quoted', '繼續']);
assert.equal(r.status, 1, '舊則已被覆蓋→跳時序擋（引句非當前輸入）');

// 無當前輸入（input 空）擋
writeFileSync(statePath, JSON.stringify({ slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: true, stamps: {} }));
r = unlock(['--quoted', '繼續']);
assert.equal(r.status, 1, '無當前輸入→翻舊帳擋');
assert.match(r.stderr, /無當前輸入/);

// --stamp 類型對照
boss('這輪就到這裡，完成', [{ word: '完成', type: 'done', negated: false }]);
r = unlock(['--quoted', '完成', '--stamp', 'done']);
assert.equal(r.status, 0, 'done 候選支撐 done 印章');
assert.ok(state().stamps.done, 'done 印章寫入');
boss('這輪就到這裡，完成', [{ word: '完成', type: 'done', negated: false }]);
r = unlock(['--quoted', '完成', '--stamp', 'pass']);
assert.equal(r.status, 1, 'done 候選不支撐 pass 印章');
assert.match(r.stderr, /類型不符/);

// go 類候選通用支撐（老闆說「繼續」語境上授權完成——印章類型由引句候選語義支撐；go/nod 為通用類）
boss('好，繼續，這樣收掉', [{ word: '繼續', type: 'go', negated: false }, { word: '好', type: 'nod', negated: false }]);
r = unlock(['--quoted', '繼續', '--stamp', 'newMs']);
assert.equal(r.status, 0, 'go/nod 通用候選不限制印章類型（fail-open 於類型、fail-closed 於候選）');

// 缺 --quoted
boss('繼續', [{ word: '繼續', type: 'go', negated: false }]);
r = unlock([]);
assert.equal(r.status, 1);
assert.match(r.stderr, /--quoted/);

// —— 串八段：unlock --stamp done 驅動 verify→done（與 CLI 印章消費接軌）——
writeFileSync(statePath, JSON.stringify({
  slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: true, stamps: {},
  input: { at: new Date().toISOString(), text: '完成', candidates: [{ word: '完成', type: 'done', negated: false }], consumed: false },
}));
mkdirSync(join(root, '.shiftblame', 'demo'), { recursive: true });
writeFileSync(join(root, '.shiftblame', 'demo', 'SLUG.md'), '# SLUG\n時點③對抗\n');
r = unlock(['--quoted', '完成', '--stamp', 'done']);
assert.equal(r.status, 0);
const next = spawnSync(sb, [sbBin, 'next', 'done', '--boss-ok', '--adversarial'], { cwd: root, encoding: 'utf8' });
assert.equal(next.status, 0, 'done 印章消費→verify→done 放行');
assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).node, 'done');

// —— 真實掃描串接（candidates 出自 scanConsent，攻擊面案例走全鏈）——
bossReal('不行');
r = unlock(['--quoted', '不行']);
assert.equal(r.status, 1, '「不行」（真實掃描：行 標否定）→擋');
bossReal('沒錯');
r = unlock(['--quoted', '沒錯']);
assert.equal(r.status, 0, '「沒錯」（肯定複合先剔除）→可解鎖');
bossReal('這樣 ok 嗎？先把 book 拿走再說');
r = unlock(['--quoted', '先把 book 拿走再說']);
assert.equal(r.status, 1, '引 book（無 \\b 邊界命中）→擋');
r = unlock(['--quoted', '這樣 ok 嗎']);
assert.equal(r.status, 0, '引 ok 所在句→可解鎖');

// —— 雜湊鏈：unlockLog 中間條目刪改（曝光洗除）→斷鏈擋死 ——
boss('繼續', [{ word: '繼續', type: 'go', negated: false }]);
r = unlock(['--quoted', '繼續']);
assert.equal(r.status, 0);
const withLog = state();
assert.ok(withLog.unlockLog.length >= 1 && withLog.unlockLog.at(-1).hash, '鏈條 hash 寫入');
// 偽造記錄後刪最舊條目（洗除曝光）——直接寫完整 state（boss 模板會覆寫掉 unlockLog）
const tampered = JSON.parse(JSON.stringify(withLog));
tampered.unlockLog.push({ at: '2026-01-01T00:00:00Z', quoted: '繼續', stamp: null, node: 'verify', reviewed: false, hash: 'deadbeefdeadbeef' });
tampered.unlockLog.splice(0, 1); // 刪真實條目——鏈斷
tampered.input = { at: new Date().toISOString(), text: '繼續', candidates: [{ word: '繼續', type: 'go', negated: false }], consumed: false };
writeFileSync(statePath, JSON.stringify(tampered, null, 2));
r = unlock(['--quoted', '繼續']);
assert.equal(r.status, 1, 'unlockLog 被刪改→斷鏈擋');
assert.match(r.stderr, /雜湊鏈斷裂/);

console.log('sb-unlock-gate: PASS');
