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
const hookBin = resolve(dirname(fileURLToPath(import.meta.url)), '../../hooks/shiftblame-guard.mjs');
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });

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
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 1.6.0 外部證據標記（research→plan 邊驗）
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

// 4. verify→done：缺 SLUG 時點③記錄即擋（1.7.0 撤印章——--boss-ok＋時點③即鑰匙）
assert.match(run('next', 'done', '--boss-ok', '--adversarial').stderr, /時點③對抗|SLUG/);
// 5. 補時點③記錄→過
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點③對抗：完成，判定成立\n');
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
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

// —— staged 系統檔不入庫（1.5.5：禁入僅系統檔 .shiftblame/——其他位置一律放行，回歸鎖定禁入範圍）——
writeFileSync(reportPath, '# 對抗報告\nstaged 閘測試。\n對抗判定：通過（零必修）');
r = run('adversarial', reportPath);
assert.equal(r.status, 0);
// staged 含 .shiftblame/ → commitmsg 不發章
assert.equal(git('add', '-f', join(root, '.shiftblame', 'flow-state.json')).status, 0, '強制 add .shiftblame（模擬繞過 gitignore）');
r = run('commitmsg', 'feat: 系統檔攔截驗證訊息');
assert.equal(r.status, 1, 'staged 含 .shiftblame/ → commitmsg 擋');
assert.match(r.stderr, /系統檔不入庫/);
// hooks 端同判據（手寫章繞過 commitmsg 的路徑也被此層攔）
writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: 系統檔攔截驗證訊息', cwd: root, issuedAt: new Date().toISOString() }));
const hs = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 系統檔攔截驗證訊息"` } });
assert.equal(hs.status, 2, 'staged 含 .shiftblame/ → hooks commit 擋（髒內容先擋，不燒印章）');
assert.match(hs.stderr, /系統檔不入庫/);
// 非系統位置 staged → 放行（回歸鎖定：禁入清單僅系統檔，不得擴及任意位置）
assert.equal(git('restore', '--staged', join(root, '.shiftblame', 'flow-state.json')).status, 0);
mkdirSync(join(root, 'tmp'), { recursive: true });
writeFileSync(join(root, 'tmp', 'junk.txt'), 'junk\n');
assert.equal(git('add', 'tmp/junk.txt').status, 0);
r = run('commitmsg', 'feat: 系統檔攔截驗證訊息');
assert.equal(r.status, 0, '非系統位置 staged →放行（禁入僅系統檔）');
// 清空 staged
assert.equal(git('restore', '--staged', 'tmp/junk.txt').status, 0);


// —— 攻擊面回歸 ——
// -a 提交期繞過：已追蹤檔修改不 add，commit -a——hooks 擋（diff --cached 看不見提交期展開）
writeFileSync(join(root, 'seed.txt'), 'seed modified for -a test\n'); // 已追蹤檔（initial commit 含 seed.txt）
{ const st = state(); st.adversarialConsumed = false; writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify(st)); }
writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: 提交期繞過嘗試', cwd: root, issuedAt: new Date().toISOString() }));
const ha = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -a -m "feat: 提交期繞過嘗試"` } });
assert.equal(ha.status, 2, 'commit -a（提交期暫存）→hooks 擋');
assert.match(ha.stderr, /commit-time 暫存繞過/);
const hp = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit --only seed.txt -m "feat: 提交期繞過嘗試"` } });
assert.equal(hp.status, 2, 'commit --only <path> →hooks 擋');
// CJK 檔名（.shiftblame 內）：quotePath 引號逃逸——關閉後原樣輸出命中
writeFileSync(join(root, '.shiftblame', '狀態.txt'), '中\n');
assert.equal(git('add', '-f', '.shiftblame/狀態.txt').status, 0);
r = run('commitmsg', 'feat: CJK 檔名繞過驗證');
assert.equal(r.status, 1, 'staged 含 .shiftblame/狀態.txt（quotePath=false）→commitmsg 擋');
// 清理通道：git rm --cached（純刪除 D）放行
assert.equal(git('rm', '--cached', '.shiftblame/狀態.txt').status, 0);
r = run('commitmsg', 'feat: 清理通道驗證');
assert.equal(r.status, 0, '純刪除（git rm --cached）→清理通道放行');
// —— tokenizer 白名單制回歸 ——
// -m 之後的 pathspec → 擋（提交期繞過）
const hm1 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 提交期繞過嘗試" seed.txt` } });
assert.equal(hm1.status, 2, 'pathspec 在 -m 之後→hooks 擋');
assert.match(hm1.stderr, /commit-time 暫存繞過/);
const hm2 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 提交期繞過嘗試" -- seed.txt` } });
assert.equal(hm2.status, 2, '-- 之後 pathspec→hooks 擋');
// 引號訊息內含旗標字樣 → 不誤傷（訊息是單一引號 token 整體跳過）；前置獨立宣告＋章
const armHook = (msg) => {
  writeFileSync(reportPath, '# r\n對抗判定：通過');
  assert.equal(run('adversarial', reportPath).status, 0);
  writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: msg, cwd: root, issuedAt: new Date().toISOString() }));
};
armHook('fix: 擋下 -a 提交期繞過');
const hm3 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "fix: 擋下 -a 提交期繞過"` } });
assert.equal(hm3.status, 0, '訊息含 -a 字樣→不誤傷（印章相符放行）');
// -c 鍵名含 commit（commit.gpgsign）→ 不誤傷（commit 定位只認獨立 token）
armHook('fix: gpgsign 鍵名驗證');
const hm4 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} -c commit.gpgsign=false commit -m "fix: gpgsign 鍵名驗證"` } });
assert.equal(hm4.status, 0, '-c commit.gpgsign 鍵名→不誤傷');
// git alias 定義 → 擋（alias 可包裝 commit 繞過四閘）
const ha1 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} config alias.z "commit -a"` } });
assert.equal(ha1.status, 2, 'git alias 定義→hooks 擋');
assert.match(ha1.stderr, /git alias 定義攔截/);
// —— 1.5.5 路徑展開元規則：GIT_DIR／--git-dir 重定向即擋 ——
const hr1 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `GIT_DIR=${root}/.git git commit -m "feat: 重定向繞過嘗試"` } });
assert.equal(hr1.status, 2, 'GIT_DIR= 重定向→hooks 擋');
assert.match(hr1.stderr, /路徑重定向攔截/);
const hr2 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} --git-dir ${root}/.git commit -m "feat: 重定向繞過嘗試"` } });
assert.equal(hr2.status, 2, '--git-dir 重定向→hooks 擋');
// —— 相對路徑 root 錨定展開回歸：寫入矩陣對相對 file_path 正確展開至 repo 內 ——
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'verify', history: [], dialogueLock: false }));
const relWrite = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'seed.txt' } });
assert.equal(relWrite.status, 2, '相對 file_path（seed.txt）→root 錨定展開→verify 段寬寫入擋');
assert.match(relWrite.stderr, /寫入矩陣/);

// —— 四必修回歸（1.5.5 閘環）——
// 大小寫：乾淨沙盒原生 .SHIFTBLAME/（realpathSync 保留輸入大小寫——rel 比對 toLowerCase）
const root3 = mkdtempSync(join(tmpdir(), 'sb-adv-case3-'));
try {
  const git3 = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', ...a], { cwd: root3, encoding: 'utf8' });
  const hookRun3 = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root3, ...payload }), encoding: 'utf8' });
  assert.equal(git3('init').status, 0);
  mkdirSync(join(root3, '.SHIFTBLAME', 'tmp'), { recursive: true });
  writeFileSync(join(root3, '.SHIFTBLAME', 'flow-state.json'), JSON.stringify({ slug: null, ms: null, node: null, history: [] }));
  assert.equal(git3('add', '-f', '.SHIFTBLAME/flow-state.json').status, 0);
  writeFileSync(join(root3, '.SHIFTBLAME', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: 大小寫驗證', cwd: root3, issuedAt: new Date().toISOString() }));
  const hs3 = hookRun3({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root3} commit -m "feat: 大小寫驗證"` } });
  assert.equal(hs3.status, 2, 'staged 含 .SHIFTBLAME/（大小寫）→hooks commit 擋');
  assert.match(hs3.stderr, /系統檔不入庫/);
} finally { rmSync(root3, { recursive: true, force: true }); }
// env 引號重定向：env "GIT_DIR=…" 形態（\b 前綴涵蓋引號）
const hr3 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `env "GIT_DIR=${root}/.git" git commit -m "feat: 重定向繞過嘗試"` } });
assert.equal(hr3.status, 2, 'env "GIT_DIR=…"（引號前綴）→hooks 擋');
const hr4 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `bash -c 'GIT_DIR=${root}/.git git commit -m x'` } });
assert.equal(hr4.status, 2, 'bash -c 引號內 GIT_DIR= →hooks 擋');
// 偽章相對 cwd：stamp.cwd='.' → 擋（非絕對即擋）
writeFileSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: 偽章相對 cwd', cwd: '.', issuedAt: new Date().toISOString() }));
const hf = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 偽章相對 cwd"` } });
assert.equal(hf.status, 2, 'stamp.cwd 相對（"."）→hooks 擋');
assert.match(hf.stderr, /非絕對/);

// 大小寫與反斜線跳脫形態（N1 回歸：Windows env 查找不敏感＋bash 引號吞反斜線）
const hr5 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git_dir=${root}/.git git commit -m "feat: 重定向繞過嘗試"` } });
assert.equal(hr5.status, 2, '小寫 git_dir= →hooks 擋');
const hr6 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `Git_Dir=${root}/.git git commit -m "feat: 重定向繞過嘗試"` } });
assert.equal(hr6.status, 2, '混合大小寫 Git_Dir= →hooks 擋');
const hr7 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `env GIT_DIR\\=${root}/.git git commit -m "feat: 重定向繞過嘗試"` } });
assert.equal(hr7.status, 2, 'env GIT_DIR\\=（反斜線跳脫）→hooks 擋');
const hr8 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `env GIT\\_DIR=${root}/.git git commit -m "feat: 重定向繞過嘗試"` } });
assert.equal(hr8.status, 2, 'env GIT\\_DIR=（名稱內反斜線）→hooks 擋');
// 誤傷對照：MY_GIT_DIR=（前綴詞）放行
const hr9 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `MY_GIT_DIR=${root}/.git git -C ${root} status` } });
assert.equal(hr9.status, 0, 'MY_GIT_DIR=（非重定向變數）→放行');

console.log('sb-adversarial-gate: PASS');
