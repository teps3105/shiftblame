import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 全流程：init 落 requirement→research（機械）→plan（時點 1——審 G1 需求與研究，封存 G1）→quality（時點 2——審 G2 計畫與品質，封存 G2；G2 回指 G1）→build（G3 回指 G2）→verify（build→verify 機械推進——G3 存在＋回指＋樹淨）→（fail＝老闆新輸入經訪答回 requirement 開新輪／pass 出口＝時點 3 對抗條件＋--boss-ok 旗標即章同一邊：--new-ms 回 requirement 開新 ms 或 end 結束）
// 授權鑰匙（撤印章）：--boss-ok 留痕＋--adversarial×lastAdv point 條目對照（時點條目新鮮度機械驗；老闆章語義由對話＋老闆終審承擔——流不落檔）
const root = mkdtempSync(join(tmpdir(), 'sb-six-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
const slugDir = join(root, '.shiftblame/demo');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
// 流程目錄由 init 建立；接入前只準備 tmp。
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const hookBin = resolve(dirname(fileURLToPath(import.meta.url)), '../../hooks/shiftblame-guard.mjs');
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });
const ptReport = (n, tag = '') => { const f = join(root, '.shiftblame/tmp', `pt${n}${tag}.md`); writeFileSync(f, `# 時點${n}對抗\n外部子代理原文節錄${tag}內容足夠實質以通過機械驗。\n對抗判定：通過`); return f; };
const pt = (n, tag = '') => run('adversarial', ptReport(n, tag), '--point', n);

const commit = (file, message) => {
  assert.equal(git('add', file).status, 0);
  assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', message).status, 0);
  return git('rev-parse', 'HEAD').stdout.trim();
};

const G1_BODY = '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n\n### AC-02（送出錯誤資料）\n- Given：已輸入不合法資料\n- When：送出資料\n- Then：看到明確錯誤\n- 現狀：現行畫面對不合法資料靜默無反應\n- 使用者：送出錯誤資料的人\n- 失敗邊界：不得誤報成功\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n# 技術研究\n沿用既有入口處理合法與不合法輸入，保留真實輸出作為測試依據。\n';
const g2Of = (g1Hash) => `回指 G1：${g1Hash}\n# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n- AC-02 | 驗收操作=送出不合法資料 | 通過判準=看到明確錯誤 | 需要的證據=實際錯誤輸出 | 測試=test-2.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。\n# 品質\n以真實輸出為通過判準；自動測試覆蓋合法與錯誤路徑。\n## 回指記錄\n`;
const g3Of = (g2Hash) => `回指 G2：${g2Hash}\n# 實作紀錄\n沿用既有入口完成送出與錯誤邊界。\n## 回指記錄\n`;

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
commit('.gitignore', 'test: initial');
const originalBase = git('branch', '--show-current').stdout.trim();
assert.equal(run('init', 'demo').status, 0);
assert.ok(existsSync(join(root, '.shiftblame', 'demo', 'SLUG.md')), 'init 建 SLUG.md（範本複製）');
assert.match(readFileSync(join(root, '.shiftblame', 'demo', 'SLUG.md'), 'utf8'), /^### 里程碑清單$[\s\S]*^\| 001 \| .* \| 未完成 \|$/m, 'SLUG 範本帶里程碑清單（sb end 里程碑閘的資料來源）');
assert.ok(existsSync(join(root, '.shiftblame', 'demo', '001')), 'init 建 <slug>/001/ 目錄');
assert.ok(existsSync(join(root, '.shiftblame', 'archive')), 'init 建 archive/ 目錄');
assert.equal(spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).stdout.trim(), 'feat/demo', 'init 建 <type>/<slug> 分支並切換');
assert.equal(run('init', 'demo').status, 1, '既有工作區重跑 init 擋（盲覆守衛）');

assert.equal(state().node, 'requirement', 'init 直接落 requirement（開工授權由 slug 建立與訪談紀錄承載）');

// 非決策邊誤用旗標即擋；requirement→research 機械推進（假需求閘查 G1 AC）
assert.match(run('next', 'research', '--boss-ok').stderr, /不是使用者決策邊/);
writeFileSync(join(ms, 'G1.md'), G1_BODY + '## 回指記錄\n');
assert.equal(run('next', 'research').status, 0);
{
  rmSync(join(root, '.shiftblame', 'demo', 'SLUG.md'));
  assert.equal(run('next', 'plan').status, 1, '無 SLUG.md 前進邊擋（骨架存在性閘；僅前進邊的單向性由消融 target!==requirement 路徑驗證）');
  mkdirSync(join(root, '.shiftblame', 'demo'), { recursive: true });
  writeFileSync(join(root, '.shiftblame', 'demo', 'SLUG.md'), `---\nslug: demo\n---\n\n# demo\n`);
}

// research→plan：時點 1 邊（審 G1 需求與研究——假研究閘＋對抗＋老闆 pass；過邊即 G1 契約封存）
writeFileSync(join(ms, 'G2.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
assert.match(run('next', 'plan').stderr, /須帶 --boss-ok[\s\S]*先行研究/, '時點 1 等待判定期間可先行研究');
assert.match(run('next', 'plan', '--boss-ok').stderr, /需時點 1 對抗/);
assert.equal(pt('1').status, 0);
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求與研究確認，推進計畫' }); // 時點 1 老闆 pass 輸入（research＋對抗完成＝決策邊裁決通道——零推回，對話承載）
assert.equal(run('next', 'plan', '--boss-ok', '--adversarial').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據標記
const g1Hash = state().g1Contract.sha256;
// plan→quality：機械推進（G2 計畫部分——驗收映射屬機械結構閘）
assert.match(run('next', 'quality').stderr, /G2 未逐項承接 G1：AC-02/);
assert.match(run('next', 'quality', '--adversarial').stderr, /不是對抗邊/);
writeFileSync(join(ms, 'G2.md'), g2Of(g1Hash));
const rel = run('next', 'quality');
if (rel.status !== 0) { console.error('release gate:', rel.stderr); }
assert.equal(rel.status, 0);
const st1 = state();
assert.match(st1.g1Contract.sha256, /^[a-f0-9]{64}$/); // G1 於時點 1 邊封存
assert.equal(st1.g1Contract.snapshot, undefined);

// G1 偏離→任何前進擋；回 requirement（老闆新輸入經訪談）不擋
writeFileSync(join(ms, 'G1.md'), '# 驗收\n被改動。');
assert.match(run('next', 'build').stderr, /分隔標題出現 0 次|已偏離/);
assert.equal(run('next', 'requirement').status, 0); // 回 requirement 同 ms 開新輪（定義級變更）
writeFileSync(join(ms, 'G1.md'), G1_BODY + '## 回指記錄\n');
// 重走（老闆新輸入回 requirement 開新輪）：時點 1 重過＋G1 重封存
assert.equal(run('next', 'research').status, 0, 'requirement→research 機械推進（重走輪）');
assert.match(run('next', 'plan', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊 1 條目過期即擋（新鮮度核心防護）');
assert.equal(pt('1', 'r2').status, 0, '重走後新鮮 1 條目（晚於上次同邊推進）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求與研究修正確認，推進計畫' });
assert.equal(run('next', 'plan', '--boss-ok', '--adversarial').status, 0, '時點 1 重過＋G1 重封存');
assert.match(run('next', 'quality', '--adversarial').stderr, /不是對抗邊/, 'plan→quality 機械推進——對抗宣告屬誤用');
assert.equal(run('next', 'quality').status, 0, 'plan→quality 機械推進');

// 功能迭代循環：quality（品質安排）→build（時點 2 對抗＋實作＋提交閘 commit）→verify（功能 AC 判定＝段內判決）
assert.match(run('next', 'build').stderr, /需時點 2 對抗/, 'quality→build＝時點 2 邊——缺對抗即擋');
assert.equal(pt('2').status, 0, '時點 2 宣告（quality 內——G2 定稿後審計畫與品質）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：計畫與品質確認，進入實作' });
assert.equal(run('next', 'build', '--boss-ok', '--adversarial').status, 0, '時點 2 過邊——G2 契約封存');
const g2Hash = state().g2Contract.sha256;
assert.match(g2Hash, /^[a-f0-9]{64}$/);
assert.match(run('next', 'verify').stderr, /G3 不存在/, 'G3 未建立即擋（build 段建立實作紀錄）');
writeFileSync(join(ms, 'G3.md'), g3Of(g2Hash));
writeFileSync(join(root, 'test-1.mjs'), 'import assert from "node:assert/strict";\nassert.equal("完整結果", "完整結果");\n');
commit('test-1.mjs', 'test: cover first acceptance');
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');
commit('seed.txt', 'feat: deliver first');
assert.equal(run('next', 'verify').status, 0, 'build→verify 機械推進（G3 回指 G2＋樹淨即過）');

// verify 判決段唯讀：pass 出口前未存檔變更即擋（出口鑰匙鏈已齊——時點 3 條目＋老闆終審輸入）
writeFileSync(join(root, 'seed.txt'), '驗收中偷改\n');
assert.equal(pt('3', 't0').status, 0, '時點 3 宣告（verify 內——驗收完成、G1 回指閉環後審驗收結果）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：驗收通過，準備收尾' }); // 老闆終審輸入（verify＋對抗完成＝決策邊裁決通道——零推回，旗標即章）
assert.match(run('end', '--adversarial', '--boss-ok').stderr, /working tree 未乾淨|乾淨/);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');

// fail 邊（驗收不過／卡住／老闆方向錯誤＝老闆新輸入）→經訪談回 requirement 開新輪：同 ms（fail 本身是對抗／終審產物，零旗標不重驗）
assert.equal(run('next', 'requirement').status, 0, 'fail＝老闆新輸入經訪談回 requirement');
assert.equal(state().node, 'requirement');
assert.equal(state().ms, '001', 'fail 回走同 ms 開新輪');
assert.equal(state().rev, 2, '第二次回 requirement 輪次遞增（時序可對照）');
// 重整後重走：時點 1 重過＋G1 重封存
assert.equal(run('next', 'research').status, 0, 'requirement→research 機械推進（重整輪）');
assert.match(run('next', 'plan', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊 1 條目過期即擋（新鮮度核心防護）');
assert.equal(pt('1', 'r3').status, 0, '重走後新鮮 1 條目（晚於上次同邊推進）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求與研究重整確認，推進計畫' });
assert.equal(run('next', 'plan', '--boss-ok', '--adversarial').status, 0);
assert.equal(run('next', 'quality').status, 0, 'plan→quality 機械推進（重走輪）');
assert.equal(pt('2', 'r3').status, 0, '重走輪新鮮 2 條目（晚於本 ms 進 quality）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：計畫與品質重整確認，進入實作' });
writeFileSync(join(root, 'seed.txt'), 'seed after rework fix\n');
commit('seed.txt', 'fix: touch for loop');
assert.equal(run('next', 'build', '--boss-ok', '--adversarial').status, 0, '時點 2 重過（重走輪）');
assert.equal(run('next', 'verify').status, 0, 'build→verify 機械推進（重走輪——G3 回指未變的 G2＋樹淨即過）');

// pass 出口一：next --new-ms（出口＝時點 3 對抗條件＋--boss-ok 旗標即章同一邊——時點 3 條目新鮮度機械驗）
assert.match(run('next', 'requirement', '--new-ms', '--boss-ok').stderr, /需時點 3 對抗/, '出口缺 --adversarial 即擋——出口＝時點 3 對抗＋終審同一邊');
assert.match(run('next', 'requirement', '--new-ms', '--adversarial', '--boss-ok').stderr, /過期|缺時點 3 條目/, '出口舊時點 3 條目過期即擋（fail 回走是同邊推進——新鮮度重驗）');
assert.equal(pt('3', 'v2').status, 0, '時點 3 宣告（verify 內——驗收完成後審驗收結果）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：驗收通過，考慮出口' }); // 老闆終審輸入（verify＋對抗完成＝決策邊裁決通道——零推回，對話承載）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：終審 pass，開下一里程碑' }); // 老闆終審輸入（對話承載）
assert.equal(run('next', 'requirement', '--new-ms', '--adversarial', '--boss-ok').status, 0, '時點 3 條目新鮮＋旗標即章——出口放行');
assert.equal(state().ms, '002', '--new-ms→ms++');
assert.ok(state().msTelemetry && state().msTelemetry['001'] && state().msTelemetry['001'].diff, 'per-ms 遙測：ms001 已結算（鍵＝被結算 ms）');
assert.ok(state().msBaseline, '新 ms 記自身基準');

// pass 出口二前置：sb end 僅限 verify 態
assert.match(run('end', '--boss-ok').stderr, /sb end 僅限 verify/, '非 verify 態不可 end');
// ms002 建檔後快走到 verify（測 sb end 的鑰匙鏈）
mkdirSync(join(root, '.shiftblame/demo/002'), { recursive: true });
const ms2 = join(root, '.shiftblame/demo/002');
writeFileSync(join(ms2, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=u | 前置=p | 操作=o | 可觀察結果=r | 失敗邊界=f | 證據=BEHAVIOR\n# 技術研究\n沿用既有入口，不引入新依賴。\n## 回指記錄\n');
// requirement→research 機械推進；混合格式擋（擇一定義）
writeFileSync(join(ms2, 'G1.md'), readFileSync(join(ms2, 'G1.md'), 'utf8').replace('## 回指記錄', '### AC-99（混合）\n- Given：（填）\n## 回指記錄'));
assert.match(run('next', 'research').stderr, /混合格式/, '混合格式擋（單行與 BDD 並存擇一）');
writeFileSync(join(ms2, 'G1.md'), readFileSync(join(ms2, 'G1.md'), 'utf8').replace('### AC-99（混合）\n- Given：（填）\n', ''));
assert.equal(run('next', 'research').status, 0);
// 時點 1 全套：對抗＋老闆 pass
assert.equal(pt('1', 'ms2').status, 0);
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求與研究確認，推進計畫' });
assert.equal(run('next', 'plan', '--boss-ok', '--adversarial').status, 0);
const ms2G1Hash = state().g1Contract.sha256;
writeFileSync(join(ms2, 'G2.md'), `回指 G1：${ms2G1Hash}\n# 驗收條件\n- AC-01 | 驗收操作=o | 通過判準=r | 需要的證據=實際輸出 | 測試=t.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果，這是真實的失敗點描述。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。\n# 品質\n以實際輸出為通過判準。\n## 回指記錄\n`);
assert.equal(run('next', 'quality').status, 0, 'plan→quality 機械推進（ms002）');
assert.equal(pt('2', 'ms2').status, 0, '時點 2 宣告（ms002）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：計畫與品質確認，進入實作' });
assert.equal(run('next', 'build', '--boss-ok', '--adversarial').status, 0, '時點 2 過邊（ms002——G2 契約封存）');
writeFileSync(join(ms2, 'G3.md'), g3Of(state().g2Contract.sha256));
writeFileSync(join(root, 'seed.txt'), 'seed for second ms feature\n');
commit('seed.txt', 'feat: second ms');
assert.equal(run('next', 'verify').status, 0, 'build→verify 機械推進');
assert.equal(pt('3', 'ms2').status, 0, '時點 3 宣告（verify 內——驗收完成後審驗收結果）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：整體完成，結束 slug' }); // 老闆終審輸入（verify＋對抗完成＝決策邊裁決通道——零推回，旗標即章）
assert.match(run('end').stderr, /--boss-ok|終審決策/, 'end 缺 --boss-ok 終審章即擋');
assert.match(run('end', '--adversarial').stderr, /--boss-ok|終審決策/, 'end 缺 --boss-ok 即擋');
assert.match(run('end', '--boss-ok').stderr, /--adversarial/, 'end 缺對抗宣告即擋（出口同一邊兩章）');
// 里程碑閘：end 是 slug 層級出口——目前 ms（002）之後還有未完成里程碑即擋；已走過的 ms 由 flow-state 承擔，不看手填狀態
const slugDoc = join(slugDir, 'SLUG.md');
const msList = (...rows) => writeFileSync(slugDoc, `---\nslug: demo\n---\n\n# demo\n\n## 4. 目前段與進度\n\n### 里程碑清單\n\n| ms | 交付結果 | 狀態 |\n|---|---|---|\n${rows.join('\n')}\n\n### 定案索引\n\n| 問題或決策 | 狀態 |\n|---|---|\n| 取捨 | 待查待決 |\n`);
msList('| 001 | 送出資料 | 未完成 |', '| 002 | 錯誤邊界 | 未完成 |', '| 003 | 匯出 | 未完成 |', '| 004 | 報表 | 未完成 |');
{
  const blocked = run('end', '--adversarial', '--boss-ok');
  assert.equal(blocked.status, 1, '後續里程碑未完成——end 擋');
  assert.match(blocked.stderr, /後續未完成里程碑：003、004——[\s\S]*sb next requirement --new-ms/, '擋下訊息只列目前 ms 之後的列（已走過的 ms 與清單以外的表格不計）並指向里程碑出口');
  assert.equal(state().node, 'verify', '擋下後狀態仍為 verify');
  assert.ok(existsSync(slugDoc), '擋下時未歸檔');
  assert.equal(git('branch', '--show-current').stdout.trim(), 'feat/demo', '擋下時未合併、工作分支仍在');
  assert.match(run('state').stdout, /里程碑清單：後續未完成 003、004——sb end 會擋/, 'sb state 的出口提示列出後續未完成里程碑');
}
msList('| 002 | 錯誤邊界 | 未完成 |', '| 第三 | 匯出 | 未完成 |');
assert.match(run('end', '--adversarial', '--boss-ok').stderr, /無法辨識的列/, 'ms 欄無法辨識即擋——無法核對不放行');
assert.equal(state().node, 'verify');
// 狀態取表頭名為「狀態」的欄——其後另有欄位時不誤判
writeFileSync(slugDoc, '# demo\n\n### 里程碑清單\n\n| ms | 交付結果 | 狀態 | 備註 |\n|---|---|---|---|\n| 003 | 匯出 | 取消 | 使用者決定不做 |\n| 004 | 報表 | 未完成 | 尚未開工 |\n');
assert.match(run('end', '--adversarial', '--boss-ok').stderr, /後續未完成里程碑：004——/, '狀態欄後另有欄位：003 取消不計、004 未完成仍擋');
msList('| 001 | 送出資料 | 完成 |', '| 002 | 錯誤邊界 | 未完成 |', '| 003 | 匯出 | 已完成 |', '| 004 | 報表 | 取消（使用者決定提前結束） |');
assert.match(run('state').stdout, /目前 ms 之後沒有未完成里程碑/, '剩餘列完成或取消——出口提示放行');
assert.equal(run('end', '--adversarial', '--boss-ok').status, 0, '出口＝時點 3 對抗條目＋老闆終審章同一邊；剩餘里程碑已完成或取消即放行');
{
  const stEnd = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
  assert.equal(stEnd.node, 'ended', 'pass 後 ended 態');
  assert.equal(stEnd.inputs, undefined, '輸入流不落檔（對話承載）');
  assert.equal(stEnd.understandings, undefined, '理解流不落檔');
  assert.equal(stEnd.adversarialLog, undefined, '對抗 log 已轉 lastAdv 定長欄位');
  assert.equal(stEnd.history, undefined, '推進史已轉 edgeAt 定長欄位');
  assert.ok(!existsSync(join(root, '.shiftblame', 'tmp', 'flow-archive')), '零副本——無殭屍歸檔目錄');
}
assert.equal(state().node, 'ended');
// 完整流程的真實結束產物可開下一份工作——end 一條龍已完成合併、查證留痕與本機分支刪除。
assert.equal(git('branch', '--show-current').stdout.trim(), originalBase, 'end 一條龍收尾後停在基底分支');
assert.equal(String(git('branch', '--list', 'feat/demo').stdout).trim(), '', '本機工作分支已隨 end 清除');
assert.equal(git('log', '-1', '--format=%s', originalBase).stdout.trim(), 'merge demo', '收尾合併訊息固定 merge <slug>');
const oldG1 = readFileSync(join(root, '.shiftblame/archive/demo/002/G1.md'), 'utf8'); // sb end 已機械化歸檔——自 archive 讀回
assert.match(run('closeout', '--base', originalBase).stderr, /收尾已完成留痕/, '收尾已完成的 slug 不再收 closeout（事後查證工具）');
const nextBaseTip = git('rev-parse', 'HEAD').stdout.trim();
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '開始下一份工作' });
const nextRecords = state();
const nextWork = run('init', 'next-work', 'fix');
assert.equal(nextWork.status, 0, nextWork.stderr);
assert.equal(git('branch', '--show-current').stdout.trim(), 'fix/next-work');
assert.equal(git('rev-parse', 'HEAD').stdout.trim(), nextBaseTip);
assert.equal(state().slug, 'next-work');
assert.equal(state().ms, '001');
assert.equal(state().node, 'requirement');
assert.deepEqual(state().inputs, nextRecords.inputs);
assert.equal(state().endedAt, undefined);
assert.equal(state().closeout, undefined);
assert.equal(readFileSync(join(root, '.shiftblame/archive/demo/002/G1.md'), 'utf8'), oldG1);
console.log('sb-user-acceptance: pass');
