import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.5 八段全流程：intent→audit→research→plan→test→build→verify→done→（重修／開新 ms／PASS）
// 授權三層：--boss-ok 留痕、--adversarial×SLUG 對照、老闆詞印章（本測試直接寫 flow-state.stamps 模擬 hooks 偵測）
const root = mkdtempSync(join(tmpdir(), 'sb-eight-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
const slugDir = join(root, '.shiftblame/demo');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const commit = (file, message) => {
  assert.equal(git('add', file).status, 0);
  assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', message).status, 0);
  return git('rev-parse', 'HEAD').stdout.trim();
};

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
commit('.gitignore', 'test: initial');
assert.equal(run('init', 'demo').status, 0);
assert.equal(state().node, 'intent');

// 回頭自由：intent 自身不可回（無意義），其他段可。先走八段——
// intent→audit：--boss-ok 邊
assert.match(run('next', 'audit').stderr, /MUST 帶 --boss-ok/);
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
// audit→research：G1 假需求閘
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=送出資料的人 | 前置=資料合法 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR\n- AC-02 | 需求=R2 | 使用者=送出錯誤資料的人 | 前置=資料不合法 | 操作=送出資料 | 可觀察結果=看到明確錯誤 | 失敗邊界=不得誤報成功 | 證據=BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口處理合法與不合法輸入，保留真實輸出作為測試依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0);
// plan→test：--boss-ok＋--adversarial＋SLUG 時點①對照；G3 缺承接先擋
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n## 4. 目前段\n- 時點①對抗：攻擊 2 點、複核駁回 1 接受 1、反向對抗判定成立\n');
assert.match(run('next', 'test').stderr, /MUST 帶 --boss-ok/);
assert.match(run('next', 'test', '--boss-ok').stderr, /--adversarial/);
assert.match(run('next', 'test', '--boss-ok', '--adversarial').stderr, /G3 未逐項承接 G1：AC-02/);
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n- AC-02 | 驗收操作=送出不合法資料 | 通過判準=看到明確錯誤 | 需要的證據=實際錯誤輸出 | 測試=test-2.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
// SLUG 缺時點①記錄即擋（對照不一致）
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n## 4. 目前段\n（尚無對抗記錄）\n');
assert.match(run('next', 'test', '--boss-ok', '--adversarial').stderr, /SLUG\.md 缺「時點①對抗」/);
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n## 4. 目前段\n- 時點①對抗：攻擊 2 點、複核駁回 1 接受 1、反向對抗判定成立\n');
const rel = run('next', 'test', '--boss-ok', '--adversarial');
if (rel.status !== 0) { console.error('release gate:', rel.stderr); }
assert.equal(rel.status, 0);
const st1 = state();
assert.match(st1.g1Contract.sha256, /^[a-f0-9]{64}$/); // G1 於放行邊封存
assert.equal(st1.g1Contract.snapshot, undefined);

// G1 偏離→任何前進擋；回 intent 不擋（回頭自由）
writeFileSync(join(ms, 'G1.md'), '# 驗收\n被改動。');
assert.match(run('next', 'build').stderr, /G1 已偏離/);
assert.equal(run('next', 'intent').status, 0); // 回 intent 同 ms 重走，零旗標
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=送出資料的人 | 前置=資料合法 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR\n- AC-02 | 需求=R2 | 使用者=送出錯誤資料的人 | 前置=資料不合法 | 操作=送出資料 | 可觀察結果=看到明確錯誤 | 失敗邊界=不得誤報成功 | 證據=BEHAVIOR');
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0);
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n## 4. 目前段\n- 時點①對抗：重走後再次對抗完成，反向對抗判定成立\n');
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);

// 功能循環：test（定稿 commit）→build（存檔 commit）→verify（tree 乾淨）
writeFileSync(join(root, 'test-1.mjs'), 'import assert from "node:assert/strict";\nassert.equal("完整結果", "完整結果");\n');
commit('test-1.mjs', 'test: cover first acceptance');
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');
commit('seed.txt', 'feat: deliver first');
assert.equal(run('next', 'verify').status, 0);
// verify 唯讀：未存檔變更不得前進
writeFileSync(join(root, 'seed.txt'), '驗收中偷改\n');
assert.match(run('next', 'done', '--boss-ok', '--adversarial').stderr, /working tree 未乾淨|乾淨/);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');
// verify→done：完成印章（模擬老闆輸入 done 由 hooks 寫入）
{ const st = state(); st.stamps = { done: new Date().toISOString() }; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
assert.match(run('next', 'done', '--boss-ok', '--adversarial').stderr, /時點③對抗|SLUG/);
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n## 4. 目前段\n- 時點③對抗：ms 價值複驗對抗完成，反向對抗判定成立\n');
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
assert.equal(state().stamps.done, undefined); // 完成印章一次性消費
assert.equal(state().node, 'done');

// done→test 重修（零旗標，老闆不滿意）
assert.equal(run('next', 'test').status, 0);
assert.equal(state().node, 'test');
// 回 verify 再 done（循環後）
writeFileSync(join(root, 'seed.txt'), 'seed after rework fix\n');
commit('seed.txt', 'fix: touch for loop');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0);
{ const st = state(); st.stamps = { done: new Date().toISOString() }; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n## 4. 目前段\n- 時點③對抗：二輪完成\n');
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);

// done→intent：無印章＝同 ms；有開新 ms 印章＝ms++
assert.equal(run('next', 'intent').status, 0);
assert.equal(state().ms, '001'); // 同 ms
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0);
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點①對抗：重走後重新放行對抗\n');
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1 v2\n');
commit('seed.txt', 'feat: redo after rework');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0);
{ const st = state(); st.stamps = { done: new Date().toISOString() }; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點③對抗：三輪完成\n');
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
{ const st = state(); st.stamps = { newMs: new Date().toISOString() }; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
assert.equal(run('next', 'intent').status, 0);
assert.equal(state().ms, '002'); // 開新 ms 印章→ms++

// PASS：sb end 需 done 態＋PASS 印章＋--boss-ok
assert.match(run('end', '--boss-ok').stderr, /done 態|sb end 僅限/);
{ const st = state(); st.stamps = {}; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
// ms002 建檔後快走到 done（測 sb end 的 PASS 印章鏈）
mkdirSync(join(root, '.shiftblame/demo/002'), { recursive: true });
const ms2 = join(root, '.shiftblame/demo/002');
writeFileSync(join(ms2, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=u | 前置=p | 操作=o | 可觀察結果=r | 失敗邊界=f | 證據=BEHAVIOR');
writeFileSync(join(ms2, 'G2.md'), '# 技術\n沿用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴。');
writeFileSync(join(ms2, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=o | 通過判準=r | 需要的證據=實際輸出 | 測試=t.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果，這是真實的失敗點描述。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。');
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0);
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點①對抗：ms2 完成\n');
{ const dbg = run('next', 'test', '--boss-ok', '--adversarial'); if (dbg.status !== 0) console.error('MS2 GATE:', dbg.stderr); assert.equal(dbg.status, 0); }
writeFileSync(join(root, 'seed.txt'), 'seed for second ms feature\n');
commit('seed.txt', 'feat: second ms');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0);
assert.match(run('end', '--boss-ok').stderr, /缺 PASS 印章|僅限 done/);
{ const st = state(); st.stamps = { done: new Date().toISOString() }; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點③對抗：ms2 done\n');
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
assert.match(run('end', '--boss-ok').stderr, /缺 PASS 印章/);
{ const st = state(); st.stamps = { pass: new Date().toISOString() }; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
assert.equal(run('end', '--boss-ok').status, 0);
assert.equal(state().node, 'ended');
console.log('sb-user-acceptance: PASS');
