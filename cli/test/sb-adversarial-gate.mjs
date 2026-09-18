import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 時點對抗（2.4.1 前移）：時點 1＝requirement→research 邊（審意圖→需求翻譯，--point 1）；時點 2＝build→verify 邊（審驗收資格：GWT 回指、假綠燈，--point 2）；中鏈（research→plan→test→build）機械推進零審核；出口（next --new-ms／end）＝老闆終審章（--boss-ok）——對抗已在進段前，出口不重驗對抗；段內提交對抗已移除——commitmsg 僅格式閘＋印章（hooks 驗章焚章）；非對抗邊帶旗標即擋。
const root = mkdtempSync(join(tmpdir(), 'sb-adv-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
const slugDir = join(root, '.shiftblame/demo');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
// 流程目錄由 init 建立；接入前只準備 tmp。
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const run2 = (cwd2, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd: cwd2, encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const hookBin = resolve(dirname(fileURLToPath(import.meta.url)), '../../hooks/shiftblame-guard.mjs');
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const ptReport = (n) => { const f = join(root, '.shiftblame/tmp', `pt${n}.md`); writeFileSync(f, `# 時點${n}對抗\n外部子代理原文節錄（>=30 字實質內容以通過機械驗）。\n對抗判定：通過`); return f; };

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴與新抽象層。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=t.mjs\n# 失敗模式\n邊界漏驗造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出。');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：確認意圖，推進 requirement' }); // 老闆輸入新鮮度（intent→requirement 邊）
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'shiftblame:think', args: '理解宣告：老闆確認意圖與推進授權——定義層規劃循環起走' } }); // 理解宣告落流（未覆蓋即凍結解凍——中段提交閘 hooks 測試承載）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
// 1. 時點 1 邊（requirement→research）：缺 --adversarial／缺時點 1 條目即擋（RAM/ROM：對照源＝point 條目）
assert.match(run('next', 'research', '--boss-ok').stderr, /需時點 1 對抗/);
assert.match(run('next', 'research', '--boss-ok', '--adversarial').stderr, /缺時點 1 條目/);
assert.equal(run('adversarial', ptReport('1'), '--point', '1').status, 0);
assert.equal(state().adversarialConsumed, undefined, '--point 條目僅屬 RAM 對照（2.4.0 無 commit 章分流）');
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, '時點 1 過邊（審意圖→需求翻譯——G1 契約封存）');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
// 2. 非對抗邊帶 --adversarial 即擋（plan→test 機械推進）
assert.match(run('next', 'test', '--adversarial').stderr, /不是對抗邊/);
// 3. plan→test 裸推進（中鏈零審核——2.4.0 取消老闆放行）
assert.equal(run('next', 'test').status, 0);

// 推進到 build（test→build 中鏈零審核——實作層一功能迭代＋提交閘）
writeFileSync(join(root, 't.mjs'), 'import assert from "node:assert/strict";\nassert.equal(1, 1);\n');
assert.equal(git('add', 't.mjs').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: cover').status, 0);
assert.equal(run('next', 'build').status, 0);
// 提交閘段於 build 態執行（驗收段對 repo 唯讀——commitmsg 於 verify 擋）；
// 2.4.0：段內提交對抗已移除——以下驗 commitmsg 與對抗宣告脫鉤＋格式／staged／座標／陳述面。
const stateSnapshot = readFileSync(join(root, ".shiftblame/flow-state.json"), "utf8");
// —— adversarial 介面衛生與報告落點（--point 必帶；報告僅 tmp）——
const tmpDir = join(root, '.shiftblame', 'tmp');
const reportPath = join(tmpDir, 'review-test.md');
let r;
// --self-attack 無合法介面：解析層拒絕（未知旗標 usage——合法命令邊驗證，非僥倖擋）
r = run('adversarial', '--self-attack', reportPath);
assert.equal(r.status, 2, '--self-attack 未知旗標（解析器 usage 擋）');
r = run('adversarial', '--unknown-flag');
assert.equal(r.status, 2, '拼錯旗標同樣 usage 擋（解析器衛生）');
// 前綴繞過回歸：.shiftblame-evil 目錄不得通過（startsWith 無分隔符邊界缺陷已修——relative 判定）
mkdirSync(join(root, '.shiftblame-evil'), { recursive: true });
writeFileSync(join(root, '.shiftblame-evil', 'review.md'), '# 對抗報告\n對抗判定：通過（零必修）');
r = run('adversarial', join('.shiftblame-evil', 'review.md'), '--point', '1');
assert.equal(r.status, 1, '.shiftblame-evil 前綴繞過擋');
// 工作報告只由 tmp 承載；錯誤落點不改寫任何宣告。
for (const path of ['.shiftblame/review.md', '.shiftblame/demo/001/review.md', '.shiftblame/tmp-sibling/review.md']) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, '對抗判定：通過\n');
  const before = readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8');
  const result = run('adversarial', file, '--point', '1');
  assert.equal(result.status, 1, `${path} 不在 tmp，時點宣告拒絕`);
  assert.match(result.stderr, /不在 .shiftblame\/tmp 內/);
  const noPoint = run('adversarial', file);
  assert.equal(noPoint.status, 1, '無 --point 即擋（2.4.0 --point 必帶）');
  assert.match(noPoint.stderr, /--point 必帶/);
  assert.equal(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'), before, '拒絕後狀態原樣保留');
}
const linkedReports = join(tmpDir, 'linked-reports');
symlinkSync(join(root, '.shiftblame/tmp-sibling'), linkedReports, process.platform === 'win32' ? 'junction' : 'dir');
assert.equal(run('adversarial', join(linkedReports, 'review.md'), '--point', '1').status, 1, '實體位置越出 tmp 的連結拒絕');
const nestedReport = join(tmpDir, 'reviews', 'report.md');
mkdirSync(dirname(nestedReport), { recursive: true });
writeFileSync(nestedReport, '對抗判定：通過\n');
assert.equal(run('adversarial', nestedReport, '--point', '1').status, 0, 'tmp 內巢狀報告仍可宣告');
// 報告指向目錄擋（非檔案）
r = run('adversarial', '.shiftblame/tmp');
assert.equal(r.status, 1, '目錄非報告檔擋');
// 多判定行取最後（多輪引用舊判定以最終為準）
writeFileSync(reportPath, '# 對抗報告\n前次對抗判定：不通過（2 必修）\n修復後本次對抗判定：通過（零必修）');
r = run('adversarial', reportPath, '--point', '1');
assert.equal(r.status, 0, '多判定行取最後（最終判定：通過）');
// 2.4.0：commitmsg 與對抗宣告脫鉤——提交審核移除，格式合格即發章（審核資源前移兩時點）
r = run('commitmsg', 'feat: 對抗閘測試提交');
assert.equal(r.status, 0, '無對抗宣告 commitmsg 仍發章（提交僅格式閘）');
// 缺報告參數擋
r = run('adversarial');
assert.equal(r.status, 1);
assert.match(r.stderr, /缺報告檔/);
// 報告不存在擋
r = run('adversarial', 'review-missing.md', '--point', '1');
assert.equal(r.status, 1);
assert.match(r.stderr, /報告檔不存在/);
// 報告缺判定行擋
writeFileSync(reportPath, '# 對抗報告\n有些攻擊內容但沒有判定行。');
r = run('adversarial', reportPath, '--point', '1');
assert.equal(r.status, 1, '缺判定行擋');
assert.match(r.stderr, /缺判定行/);
// 判定「不通過」擋（必修未清不得留條目）
writeFileSync(reportPath, '# 對抗報告\n攻擊點……\n對抗判定：不通過（2 必修）');
r = run('adversarial', reportPath, '--point', '1');
assert.equal(r.status, 1, '不通過擋——閘環零必修機械化');
assert.match(r.stderr, /必修未清/);
// 判定「通過」→時點條目留痕；commitmsg 脫鉤照樣發章
writeFileSync(reportPath, '# 對抗報告\n攻擊點……\n對抗判定：通過（零必修）');
r = run('adversarial', reportPath, '--point', '1');
assert.equal(r.status, 0, '通過→條目留痕');
assert.ok(state().adversarialLog.at(-1).report === reportPath && state().adversarialLog.at(-1).verdict === '通過');
r = run('commitmsg', 'feat: 對抗閘測試提交');
assert.equal(r.status, 0, 'commitmsg 與對抗宣告脫鉤——格式合格即發章');

// —— 全鏈串接：commitmsg 發章→hooks commit 驗章焚章（印章一次性）——
r = run('commitmsg', 'feat: 全鏈提交驗證訊息');
assert.equal(r.status, 0, '發章');
const hc = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 全鏈提交驗證訊息"` } });
assert.equal(hc.status, 0, '全鏈：hooks commit 放行——印章一對一');
assert.equal(existsSync(join(root, '.shiftblame', 'tmp', 'commit-stamp.json')), false, 'hooks 於 commit 時焚章');
const hc2 = hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `git -C ${root} commit -m "feat: 全鏈提交驗證訊息"` } });
assert.equal(hc2.status, 2, '印章已焚→再 commit 擋');

// —— staged 系統檔不入庫（禁入僅系統檔 .shiftblame/——其他位置一律放行）——
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
r = run('commitmsg', 'feat: 中文檔名繞過驗證');
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
// 引號訊息內含旗標字樣 → 不誤傷（訊息是單一引號 token 整體跳過）；手寫章前置
const armHook = (msg) => {
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
// —— 路徑展開元規則：GIT_DIR／--git-dir 重定向即擋 ——
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

// —— 四必修回歸（閘環）——
// 大小寫：乾淨沙盒原生 .SHIFTBLAME/（realpathSync 保留輸入大小寫——rel 比對 toLowerCase）
const root3 = mkdtempSync(join(tmpdir(), 'sb-adv-case3-'));
try {
  const git3 = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', ...a], { cwd: root3, encoding: 'utf8' });
  const hookRun3 = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root3, ...payload }), encoding: 'utf8' });
  assert.equal(git3('init').status, 0);
  mkdirSync(join(root3, '.SHIFTBLAME', 'tmp'), { recursive: true });
  writeFileSync(join(root3, '.SHIFTBLAME', 'flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'build', history: [] }));
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

// —— 跨 repo 提交錨定：外部 session 以 git -C <絕對路徑> 提交內部 repo——全套 commit 閘改對目標 repo 生效 ——
{
  const ext = mkdtempSync(join(tmpdir(), 'sb-adv-ext-'));
  const inner = mkdtempSync(join(tmpdir(), 'sb-adv-inner-'));
  try {
    const gi = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@x', ...a], { cwd: inner, encoding: 'utf8' });
    assert.equal(gi('init').status, 0);
    writeFileSync(join(inner, '.gitignore'), '.shiftblame/\n');
    writeFileSync(join(inner, 'work.txt'), 'w\n');
    assert.equal(gi('add', 'work.txt').status, 0);
    assert.equal(gi('commit', '-m', 'test: seed').status, 0);
    writeFileSync(join(inner, 'more.txt'), 'm\n');
    assert.equal(gi('add', 'more.txt').status, 0); // staged 內容待 commit（staged 閘對 inner 生效）
    const at = new Date().toISOString();
    mkdirSync(join(inner, '.shiftblame', 'tmp'), { recursive: true });
    writeFileSync(join(inner, '.shiftblame', 'flow-state.json'), JSON.stringify({ slug: null, ms: null, node: null, history: [], adversarialLog: [{ at, report: '.shiftblame/tmp/r.md', verdict: '通過', node: null }], adversarialAt: at, adversarialConsumed: false }));
    const hookExt = (command) => spawnSync(process.execPath, [hookBin], { encoding: 'utf8', input: JSON.stringify({ cwd: ext, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }) });
    // 內部 repo 無章即擋（章不落在 session cwd 的外部專案）
    const hx = hookExt(`git -C ${inner} commit -m "feat: 跨repo提交"`);
    assert.equal(hx.status, 2, '內部 repo 缺章→擋');
    assert.match(hx.stderr, /缺少 commit 印章/);
    // 內部 repo 有效章→跨 repo commit 放行，並焚內部 repo 的印章（2.4.0 無對抗消費）
    writeFileSync(join(inner, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: 跨repo提交', cwd: inner, issuedAt: new Date().toISOString() }));
    const hp = hookExt(`git -C ${inner} commit -m "feat: 跨repo提交"`);
    assert.equal(hp.status, 0, '內部 repo 有效章→跨 repo commit 放行');
    assert.equal(existsSync(join(inner, '.shiftblame', 'tmp', 'commit-stamp.json')), false, '焚目標 repo 印章');
    // 章綁定其他專案：ext 簽發的章被搬進 inner（偽造面）→擋（章綁定錨點 repo）
    writeFileSync(join(inner, '.shiftblame', 'tmp', 'commit-stamp.json'), JSON.stringify({ message: 'feat: 跨repo提交', cwd: ext, issuedAt: new Date().toISOString() }));
    const hm = hookExt(`git -C ${inner} commit -m "feat: 跨repo提交"`);
    assert.equal(hm.status, 2, '其他專案的章不可提交內部 repo');
    assert.match(hm.stderr, /屬於其他專案/);
    // 相對 -C 一律擋（路徑展開元規則）
    const hrC = hookExt(`git -C whatever commit -m "feat: 跨repo提交"`);
    assert.equal(hrC.status, 2, '相對 -C 擋');
    assert.match(hrC.stderr, /絕對路徑/);
    // staged 系統檔對錨點 repo 生效：inner staged .shiftblame/ 檔→擋（系統檔不入庫在跨 repo 提交下不降級）
    writeFileSync(join(inner, '.shiftblame', 'leak.txt'), 'x\n');
    assert.equal(gi('add', '-f', '.shiftblame/leak.txt').status, 0);
    const hl = hookExt(`git -C ${inner} commit -m "feat: 跨repo提交"`);
    assert.equal(hl.status, 2, '跨 repo 提交 staged 系統檔→擋');
    assert.match(hl.stderr, /系統檔不入庫/);
  } finally { rmSync(ext, { recursive: true, force: true }); rmSync(inner, { recursive: true, force: true }); }
}

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

// —— commitmsg 詞彙閘（追蹤編號／流程時序語／非繁中開頭）——
{
  const adv = mkdtempSync(join(tmpdir(), 'sb-cv-'));
  for (const bad of ['merge old', 'fix: 修正r24殘留問題描述', 'feat: F4 規格同步修正', 'fix: MS001 檔案整理', 'feat: 斷言先行的重寫驗證', 'fix: 第三組資料修正調整', 'feat: spec-rewrite 規格重寫']) {
    const rb = run2(adv, 'commitmsg', bad);
    assert.equal(rb.status, 1, `詞彙閘擋「${bad}」`);
  }
  for (const ok of ['fix: 修正中文檔名繞過驗證', 'feat: 跨里程碑定案索引繼承機制', 'fix: 修正 HTTP 404 錯誤頁處理', 'feat: 資料分三組顯示']) {
    const ro = run2(adv, 'commitmsg', ok);
    assert.equal(ro.status, 0, `合法訊息過「${ok}」`);
  }
  rmSync(adv, { recursive: true, force: true });
}
writeFileSync(join(root, ".shiftblame/flow-state.json"), stateSnapshot); // 還原主流程狀態
assert.equal(git('checkout', '--', 'seed.txt').status, 0, '段內 -a 測試髒汙還原');
rmSync(join(root, 'tmp'), { recursive: true, force: true }); // 段內 untracked 清除
rmSync(join(root, '.shiftblame-evil'), { recursive: true, force: true }); // 段內前綴繞過沙盒清除
assert.equal(git('status', '--porcelain').stdout.trim(), '', '段後工作樹全淨');
writeFileSync(join(root, 'seed.txt'), 'v2\n');
assert.equal(git('add', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'feat: deliver').status, 0);
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：時點 2 pass，開始驗收' }); // build→verify 邊老闆判定（對抗在前老闆判定在後）
assert.equal(run('adversarial', ptReport('2'), '--point', '2').status, 0, '時點 2 宣告（build→verify 邊前置）');
assert.equal(run('next', 'verify', '--boss-ok', '--adversarial').status, 0, '時點 2 過邊（build→verify——審驗收資格：GWT 回指、假綠燈，2.4.1 前移）');

// 4. 出口（next --new-ms／end 兩門）＝老闆終審章（--boss-ok）——對抗已在 build→verify 進段前，出口不重驗對抗
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：驗收通過，決定出口' }); // 老闆輸入新鮮度（出口終審——晚於本 ms 進 verify）
assert.match(run('next', 'intent', '--new-ms', '--boss-ok', '--adversarial').stderr, /不是對抗邊/, '出口非對抗邊——--adversarial 留給時點對抗邊（requirement→research／build→verify）');
assert.match(run('end').stderr, /--boss-ok|終審決策/, 'end 缺老闆終審章即擋');
// 5. fail 邊→老闆新輸入回意圖揭露經 intent 路由器路由：零旗標、定義級同 ms 開新輪（計返工輪）；重走時點 1（requirement→research）
assert.equal(run('next', 'intent').status, 0, 'fail 回意圖揭露＝零旗標');
assert.equal(state().ms, '001');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：定義級修正，重新確認需求' }); // 老闆輸入新鮮度（intent→requirement 決策邊＋時點 1 邊——晚於上次同邊推進）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0, '重走：老闆決策邊 --boss-ok');
assert.match(run('next', 'research', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊時點 1 條目過期即擋（新鮮度）');
assert.equal(run('adversarial', ptReport('1'), '--point', '1').status, 0);
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, '重走進 research——外部證據閘進段重置＋時點 1 重過（G1 重封存）');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(run('next', 'test').status, 0, 'plan→test 機械推進（中鏈零審核）');
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'v3\n');
assert.equal(git('add', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'feat: second').status, 0);
// 6. 時點 2 新鮮度（build→verify 邊——條目早於同邊上次推進即擋）：舊條目過期擋→重審過邊→修復回 build 再過邊又過期→再重審；出口僅老闆終審章
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：時點 2 pass，開始驗收' }); // build→verify 邊老闆輸入（晚於上次同邊推進）
assert.match(run('next', 'verify', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '時點 2 條目早於同邊上次推進即擋（第一輪舊條目已過期）');
assert.equal(run('adversarial', ptReport('2'), '--point', '2').status, 0, '時點 2 宣告');
assert.equal(run('next', 'verify', '--boss-ok', '--adversarial').status, 0, '時點 2 過邊（對抗在前老闆判定在後——老闆准的是開始驗收）');
assert.equal(run('next', 'build').status, 0, 'verify→build 旗標切段（驗收發現問題回 build 修復，不計返工輪）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：修復畢，時點 2 重過' }); // 第二次過邊——老闆輸入晚於上次同邊推進
assert.match(run('next', 'verify', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊時點 2 條目早於同邊上次推進即擋（新鮮度）');
assert.equal(run('adversarial', ptReport('2'), '--point', '2').status, 0, '重審補時點 2 條目');
assert.equal(run('next', 'verify', '--boss-ok', '--adversarial').status, 0, '時點 2 重過（真驗收資格重審）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：驗收通過，決定出口' }); // 老闆輸入新鮮度（出口終審——晚於本 ms 進 verify）
assert.equal(run('end', '--boss-ok').status, 0, '出口僅老闆終審章（--boss-ok）——對抗已在進段前，不重驗');
console.log('sb-adversarial-gate: pass');
