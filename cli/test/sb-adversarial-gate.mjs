import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.5 對抗對照與完成印章：--adversarial 邊（plan→test①、verify→test②、verify→done③）×SLUG 逐字對照；
// 完成印章（老闆詞）＝verify→done 唯一鑰匙；非對抗邊帶旗標即擋。
const root = mkdtempSync(join(tmpdir(), 'sb-adv-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
const slugDir = join(root, '.shiftblame/demo');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const setStamps = (obj) => { const st = state(); st.stamps = obj; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); };

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=操作者 | 前置=系統啟動 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴與新抽象層。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=t.mjs\n# 失敗模式\n邊界漏驗造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出。');
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0);

// 1. SLUG 缺時點①記錄即擋
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n（無對抗記錄）\n');
assert.match(run('next', 'test', '--boss-ok', '--adversarial').stderr, /SLUG\.md 缺「時點①對抗」/);
// 2. 非對抗邊帶 --adversarial 即擋
assert.match(run('next', 'research', '--adversarial').stderr, /不是對抗邊|不合法推進/);
// 3. 補記錄→過
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點①對抗：完成，判定成立\n');
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);

// 循環到 verify
writeFileSync(join(root, 't.mjs'), 'import assert from "node:assert/strict";\nassert.equal(1, 1);\n');
assert.equal(git('add', 't.mjs').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: cover').status, 0);
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'v2\n');
assert.equal(git('add', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'feat: deliver').status, 0);
assert.equal(run('next', 'verify').status, 0);

// 4. verify→done：缺完成印章即擋（老闆沒說 done，agent 旗標無效）
assert.match(run('next', 'done', '--boss-ok', '--adversarial').stderr, /缺完成印章/);
// 5. 有印章＋SLUG 時點③→過；印章一次性
setStamps({ done: new Date().toISOString() });
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點③對抗：完成，判定成立\n');
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
assert.equal(state().stamps.done, undefined);
// 6. verify→test 循環邊：時點②對照（done→test 重修後再走）
assert.equal(run('next', 'test').status, 0);
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'v3\n');
assert.equal(git('add', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'feat: second').status, 0);
assert.equal(run('next', 'verify').status, 0);
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點③對抗：舊記錄\n');
assert.match(run('next', 'test', '--adversarial').stderr, /SLUG\.md 缺「時點②對抗」/);
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點②對抗：功能循環對抗完成\n');
assert.equal(run('next', 'test', '--adversarial').status, 0);
// —— 提交對抗閘（1.5.3）：MUST 子代理報告檔——存在＋判定行＋「通過」才可發章 ——
const tmpDir = join(root, '.shiftblame', 'tmp');
const reportPath = join(tmpDir, 'review-test.md');
let r;
// --self-attack 無合法介面：解析層拒絕（未知旗標 usage——合法命令邊驗證，非僥倖擋）
r = run('adversarial', '--self-attack', reportPath);
assert.equal(r.status, 2, '--self-attack 已移除（解析器對未知旗標 usage 擋）');
r = run('adversarial', '--unknown-flag');
assert.equal(r.status, 2, '拼錯旗標同樣 usage 擋（解析器衛生）');
// 前綴繞過回歸：.shiftblame-evil 目錄不得通過（startsWith 無分隔符邊界缺陷已修——relative 判定）
mkdirSync(join(root, '.shiftblame-evil'), { recursive: true });
writeFileSync(join(root, '.shiftblame-evil', 'review.md'), '# 對抗報告\n對抗判定：通過（零必修）');
r = run('adversarial', join('.shiftblame-evil', 'review.md'));
assert.equal(r.status, 1, '.shiftblame-evil 前綴繞過擋');
// 報告指向目錄擋（非檔案）
r = run('adversarial', '.shiftblame/tmp');
assert.equal(r.status, 1, '目錄非報告檔擋');
// 多判定行取最後（多輪引用舊判定以最終為準）
writeFileSync(reportPath, '# 對抗報告\n前次對抗判定：不通過（2 必修）\n修復後本次對抗判定：通過（零必修）');
r = run('adversarial', reportPath);
assert.equal(r.status, 0, '多判定行取最後（最終判定：通過）');
{ const st = state(); st.adversarialConsumed = true; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); } // 恢復無未消費宣告狀態
// 無報告檔→commitmsg 擋（無宣告）
r = run('commitmsg', 'feat: 對抗閘測試提交');
assert.equal(r.status, 1, '無宣告→commitmsg 擋');
assert.match(r.stderr, /提交前需對抗記錄/);
// 缺報告參數擋
r = run('adversarial');
assert.equal(r.status, 1);
assert.match(r.stderr, /缺報告檔/);
// 報告不存在擋
r = run('adversarial', 'review-missing.md');
assert.equal(r.status, 1);
assert.match(r.stderr, /報告檔不存在/);
// 報告缺判定行擋
writeFileSync(reportPath, '# 對抗報告\n有些攻擊內容但沒有判定行。');
r = run('adversarial', reportPath);
assert.equal(r.status, 1, '缺判定行擋');
assert.match(r.stderr, /缺判定行/);
// 判定「不通過」擋（必修未清不得發章）
writeFileSync(reportPath, '# 對抗報告\n攻擊點……\n對抗判定：不通過（2 必修）');
r = run('adversarial', reportPath);
assert.equal(r.status, 1, '不通過擋——閘環零必修機械化');
assert.match(r.stderr, /必修未清/);
// 判定「通過」→宣告→發章（不消費；hooks 消費）
writeFileSync(reportPath, '# 對抗報告\n攻擊點……\n對抗判定：通過（零必修）');
r = run('adversarial', reportPath);
assert.equal(r.status, 0, '通過→宣告留痕');
assert.ok(state().adversarialLog.at(-1).report === reportPath && state().adversarialLog.at(-1).verdict === '通過');
r = run('commitmsg', 'feat: 對抗閘測試提交');
assert.equal(r.status, 0, '有未消費宣告→發章');
assert.equal(state().adversarialConsumed, false, '發章不消費（hooks 消費點）');
// 模擬 hooks 已消費→再 commitmsg 擋（每 commit 一對一）
{ const st = state(); st.adversarialConsumed = true; writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st)); }
r = run('commitmsg', 'feat: 對抗閘測試提交');
assert.equal(r.status, 1, '消費後再 commitmsg→擋');
// 返工修復後（新報告＋新宣告）再提交可過
writeFileSync(reportPath, '# 對抗報告\n修復後再對抗。\n對抗判定：通過（零必修）');
r = run('adversarial', reportPath);
assert.equal(r.status, 0);
r = run('commitmsg', 'feat: 對抗閘測試提交');
assert.equal(r.status, 0, '返工後重新對抗→可提交');

// —— 全鏈串接：adversarial→commitmsg→hooks commit 放行且一併消費 ——
const hookBin = resolve(dirname(fileURLToPath(import.meta.url)), '../../hooks/shiftblame-guard.mjs');
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
writeFileSync(reportPath, '# 對抗報告\n全鏈時點對抗。\n對抗判定：通過（零必修）');
r = run('adversarial', reportPath);
assert.equal(r.status, 0);
r = run('commitmsg', 'feat: 全鏈提交驗證訊息');
assert.equal(r.status, 0, '發章（不消費）');
const hc = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 全鏈提交驗證訊息"` } });
assert.equal(hc.status, 0, '全鏈：hooks commit 放行——單次宣告單次 commit');
assert.equal(state().adversarialConsumed, true, 'hooks 於 commit 時消費對抗宣告');
const hc2 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 全鏈提交驗證訊息"` } });
assert.equal(hc2.status, 2, '印章已焚→再 commit 擋');

console.log('sb-adversarial-gate: PASS');
