import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 全流程：intent→requirement→research（時點 1——審意圖→需求翻譯）→plan→test→build→verify（build→verify 機械推進，中鏈零審核）→（fail＝老闆新輸入重走 intent 開新輪／pass 出口＝時點 2 對抗條件＋--boss-ok 旗標即章同一邊：--new-ms 開新 ms 或 end 結束）
// 授權鑰匙（撤印章）：--boss-ok 留痕＋--adversarial×lastAdv point 條目對照（時點條目新鮮度機械驗；老闆章語義由對話＋老闆終審承擔——流不落檔）
const root = mkdtempSync(join(tmpdir(), 'sb-eight-'));
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

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
commit('.gitignore', 'test: initial');
const originalBase = git('branch', '--show-current').stdout.trim();
assert.equal(run('init', 'demo').status, 0);
assert.ok(existsSync(join(root, '.shiftblame', 'demo', 'SLUG.md')), 'init 建 SLUG.md（範本複製）');
assert.ok(existsSync(join(root, '.shiftblame', 'demo', '001')), 'init 建 <slug>/001/ 目錄');
assert.ok(existsSync(join(root, '.shiftblame', 'archive')), 'init 建 archive/ 目錄');
assert.equal(spawnSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).stdout.trim(), 'feat/demo', 'init 建 <type>/<slug> 分支並切換');
assert.equal(run('init', 'demo').status, 1, '既有工作區重跑 init 擋（盲覆守衛）');

assert.equal(state().node, 'intent');

// 老闆新輸入重走 intent：intent 自身不可回（無意義），其他段可。先走圓環主鏈——
// intent→requirement：--boss-ok 邊（老闆決策邊 MUST 留痕）
assert.match(run('next', 'requirement').stderr, /MUST 帶 --boss-ok/);
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：確認意圖，推進 requirement' }); // 老闆決策邊輸入（對話承載——旗標即章）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
{
  rmSync(join(root, '.shiftblame', 'demo', 'SLUG.md'));
  assert.equal(run('next', 'research').status, 1, '無 SLUG.md 前進邊擋（骨架存在性閘；僅前進邊的單向性由消融 target!==intent 路徑驗證）');
  mkdirSync(join(root, '.shiftblame', 'demo'), { recursive: true });
  writeFileSync(join(root, '.shiftblame', 'demo', 'SLUG.md'), `---\nslug: demo\n---\n\n# demo\n`);
}

// requirement→research：時點 1 邊（2.4.0 審意圖→需求翻譯——G1 假需求閘＋對抗＋老闆 pass；過邊即 G1 契約封存）
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n\n### AC-02（送出錯誤資料）\n- Given：已輸入不合法資料\n- When：送出資料\n- Then：看到明確錯誤\n- 現狀：現行畫面對不合法資料靜默無反應\n- 使用者：送出錯誤資料的人\n- 失敗邊界：不得誤報成功\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口處理合法與不合法輸入，保留真實輸出作為測試依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
assert.match(run('next', 'research').stderr, /MUST 帶 --boss-ok/);
assert.match(run('next', 'research', '--boss-ok').stderr, /需時點 1 對抗/);
assert.equal(pt('1').status, 0);
assert.equal(run('stop-report', '--question', '時點 1 終審：意圖→需求翻譯（G1）待老闆判定').status, 0); // 停決策邊申報（2.5.5：裁決通道——老闆回覆零推回）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯正確，推進研究' }); // 時點 1 老闆 pass 輸入（對話承載——機械不驗時戳）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
// plan→test：機械推進（2.4.0 中鏈零審核——老闆放行與時點對抗取消；G3 承接屬機械結構閘）
assert.match(run('next', 'test').stderr, /G3 未逐項承接 G1：AC-02/);
assert.match(run('next', 'test', '--adversarial').stderr, /不是對抗邊/);
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n- AC-02 | 驗收操作=送出不合法資料 | 通過判準=看到明確錯誤 | 需要的證據=實際錯誤輸出 | 測試=test-2.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
const rel = run('next', 'test');
if (rel.status !== 0) { console.error('release gate:', rel.stderr); }
assert.equal(rel.status, 0);
const st1 = state();
assert.match(st1.g1Contract.sha256, /^[a-f0-9]{64}$/); // G1 於放行邊封存
assert.equal(st1.g1Contract.snapshot, undefined);

// G1 偏離→任何前進擋；重走 intent（老闆新輸入）不擋
writeFileSync(join(ms, 'G1.md'), '# 驗收\n被改動。');
assert.match(run('next', 'build').stderr, /分隔標題出現 0 次|已偏離/);
assert.equal(run('next', 'intent').status, 0); // 回 intent 同 ms 開新輪（定義級變更）
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n\n### AC-02（送出錯誤資料）\n- Given：已輸入不合法資料\n- When：送出資料\n- Then：看到明確錯誤\n- 現狀：現行畫面對不合法資料靜默無反應\n- 使用者：送出錯誤資料的人\n- 失敗邊界：不得誤報成功\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
// 重走（老闆新輸入重走 intent 開新輪）：老闆決策邊 --boss-ok＋新鮮老闆輸入；research 進段重置外部證據（時點 1 重過＋G1 重封存）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：定義級修正，重新確認需求' }); // 老闆決策邊輸入（對話承載——旗標即章）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0, '重走：老闆決策邊帶 --boss-ok');
assert.match(run('next', 'research', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊 1 條目過期即擋（新鮮度核心防護）');
assert.equal(pt('1', 'r2').status, 0, '重走後新鮮 1 條目（晚於上次同邊推進）');
assert.equal(run('stop-report', '--question', '時點 1 終審：重走後意圖→需求翻譯（G1）待老闆判定').status, 0); // 停決策邊申報（2.5.5：裁決通道——老闆回覆零推回）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯修正確認，推進研究' }); // 時點 1 老闆 pass 輸入（對話承載——機械不驗時戳）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, 'research 進段重置外部證據');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.match(run('next', 'test', '--adversarial').stderr, /不是對抗邊/, 'plan→test 機械推進——對抗宣告屬誤用');
assert.equal(run('next', 'test').status, 0, 'plan→test 機械推進（中鏈零審核——2.4.0 取消老闆放行）');

// 功能迭代循環：test（撰寫功能測試）→build（實作＋提交閘 commit）→verify（功能 AC 判定＝段內判決）
writeFileSync(join(root, 'test-1.mjs'), 'import assert from "node:assert/strict";\nassert.equal("完整結果", "完整結果");\n');
commit('test-1.mjs', 'test: cover first acceptance');
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');
commit('seed.txt', 'feat: deliver first');
assert.equal(run('next', 'verify').status, 0, 'build→verify 機械推進（中鏈零審核——樹淨即過，無老闆停靠）');

// verify 判決段唯讀：pass 出口前未存檔變更即擋（出口鑰匙鏈已齊——時點 2 條目＋老闆終審輸入）
writeFileSync(join(root, 'seed.txt'), '驗收中偷改\n');
assert.equal(pt('2', 't0').status, 0, '時點 2 宣告（verify 內——驗收完成、G1 回指閉環後審驗收結果）');
assert.equal(run('stop-report', '--question', '時點 2 終審：驗收結果待老闆判定（出口裁決）').status, 0); // 停裁決邊申報（2.5.5：裁決通道——老闆回覆零推回）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：驗收通過，準備收尾' }); // 老闆終審輸入（對話承載——旗標即章）
assert.match(run('end', '--adversarial', '--boss-ok').stderr, /working tree 未乾淨|乾淨/);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');

// fail 邊（驗收不過／卡住／老闆方向錯誤＝老闆新輸入）→重走 intent 開新輪：同 ms（fail 本身是對抗／終審產物，零旗標不重驗）
assert.equal(run('next', 'intent').status, 0, 'fail＝老闆新輸入重走 intent');
assert.equal(state().node, 'intent');
assert.equal(state().ms, '001', 'fail 回走同 ms 開新輪');
assert.equal(state().rev, 2, '第二次重走 intent 輪次遞增（時序可對照）');
// 重整後重走：老闆決策邊 --boss-ok（旗標即章——對話承載）；時點 1 重過＋G1 重封存
assert.equal(run('next', 'requirement', '--boss-ok').status, 0, '重整重走：老闆決策邊帶 --boss-ok');
assert.match(run('next', 'research', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊 1 條目過期即擋（新鮮度核心防護）');
assert.equal(pt('1', 'r3').status, 0, '重走後新鮮 1 條目（晚於上次同邊推進）');
assert.equal(run('stop-report', '--question', '時點 1 終審：重整後意圖→需求翻譯（G1）待老闆判定').status, 0); // 停決策邊申報（2.5.5：裁決通道——老闆回覆零推回）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯重整確認，推進研究' }); // 時點 1 老闆 pass 輸入（對話承載——機械不驗時戳）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0, 'research 進段重置外部證據');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(run('next', 'test').status, 0, 'plan→test 機械推進（中鏈零審核——2.4.0 取消老闆放行）');
writeFileSync(join(root, 'seed.txt'), 'seed after rework fix\n');
commit('seed.txt', 'fix: touch for loop');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0, 'build→verify 機械推進（重走輪——樹淨即過）');

// pass 出口一：next --new-ms（出口＝時點 2 對抗條件＋--boss-ok 旗標即章同一邊——2.5.2：時點 2 條目新鮮度機械驗，老闆章語義由對話＋老闆終審承擔）
assert.equal(run('stop-report', '--question', '時點 2 終審：重走輪驗收結果待老闆判定（出口裁決）').status, 0); // 停裁決邊申報（2.5.5：裁決通道——老闆回覆零推回；出口邊 die 不清申報，覆蓋至放行）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：驗收通過，考慮出口' }); // 老闆終審輸入（對話承載——機械不驗時戳）
assert.match(run('next', 'intent', '--new-ms', '--boss-ok').stderr, /需時點 2 對抗/, '出口缺 --adversarial 即擋——出口＝時點 2 對抗＋終審同一邊');
assert.match(run('next', 'intent', '--new-ms', '--adversarial', '--boss-ok').stderr, /過期|缺時點 2 條目/, '出口舊時點 2 條目過期即擋（fail 回走是同邊推進——新鮮度重驗）');
assert.equal(pt('2', 'v2').status, 0, '時點 2 宣告（verify 內——驗收完成後審驗收結果）');
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：終審 pass，開下一里程碑' }); // 老闆終審輸入（對話承載）
assert.equal(run('next', 'intent', '--new-ms', '--adversarial', '--boss-ok').status, 0, '時點 2 條目新鮮＋旗標即章——出口放行（老闆章不驗輸入時戳——對話承載）');
assert.equal(state().ms, '002', '--new-ms→ms++');
assert.ok(state().msTelemetry && state().msTelemetry['001'] && state().msTelemetry['001'].diff, 'per-ms 遙測：ms001 已結算（鍵＝被結算 ms）');
assert.ok(state().msBaseline, '新 ms 記自身基準');

// pass 出口二前置：sb end 僅限 verify 態
assert.match(run('end', '--boss-ok').stderr, /sb end 僅限 verify/, '非 verify 態不可 end');
// ms002 建檔後快走到 verify（測 sb end 的鑰匙鏈）
mkdirSync(join(root, '.shiftblame/demo/002'), { recursive: true });
const ms2 = join(root, '.shiftblame/demo/002');
writeFileSync(join(ms2, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=u | 前置=p | 操作=o | 可觀察結果=r | 失敗邊界=f | 證據=BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms2, 'G2.md'), '# 技術\n沿用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴。');
writeFileSync(join(ms2, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=o | 通過判準=r | 需要的證據=實際輸出 | 測試=t.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果，這是真實的失敗點描述。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。');
// ms002 的老闆邊：--boss-ok＋新鮮老闆輸入（重走 intent 開新 ms 後的定義重走）
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
// 混合格式擋：單行 G1 加 BDD 塊 → research 邊擋（擇一定義）；移除後放行（時點 1 全套：對抗＋老闆 pass）
writeFileSync(join(ms2, 'G1.md'), readFileSync(join(ms2, 'G1.md'), 'utf8') + '\n### AC-99（混合）\n- Given：（填）\n');
assert.match(run('next', 'research', '--boss-ok', '--adversarial').stderr, /混合格式/, '混合格式擋（單行與 BDD 並存擇一）');
writeFileSync(join(ms2, 'G1.md'), readFileSync(join(ms2, 'G1.md'), 'utf8').replace('\n### AC-99（混合）\n- Given：（填）\n', ''));
assert.equal(pt('1', 'ms2').status, 0);
assert.equal(run('stop-report', '--question', '時點 1 終審：ms002 意圖→需求翻譯（G1）待老闆判定').status, 0); // 停決策邊申報（2.5.5：裁決通道——老闆回覆零推回）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求翻譯確認，推進研究' }); // 時點 1 老闆 pass 輸入（對話承載——機械不驗時戳）
assert.equal(run('next', 'research', '--boss-ok', '--adversarial').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(run('next', 'test').status, 0, 'plan→test 機械推進（中鏈零審核——2.4.0 取消老闆放行）');
writeFileSync(join(root, 'seed.txt'), 'seed for second ms feature\n');
commit('seed.txt', 'feat: second ms');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0, 'build→verify 機械推進');
assert.equal(pt('2', 'ms2').status, 0, '時點 2 宣告（verify 內——驗收完成後審驗收結果）');
assert.equal(run('stop-report', '--question', '時點 2 終審：ms002 驗收結果待老闆判定（slug 終結裁決）').status, 0); // 停裁決邊申報（2.5.5：裁決通道——老闆回覆零推回；end 邊 die 不清申報，覆蓋至出口）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：整體完成，結束 slug' }); // 老闆終審輸入（對話承載——旗標即章）
assert.match(run('end').stderr, /--boss-ok|終審決策/, 'end 缺 --boss-ok 終審章即擋');
assert.match(run('end', '--adversarial').stderr, /--boss-ok|終審決策/, 'end 缺 --boss-ok 即擋');
assert.match(run('end', '--boss-ok').stderr, /--adversarial/, 'end 缺對抗宣告即擋（出口同一邊兩章）');
assert.equal(run('end', '--adversarial', '--boss-ok').status, 0, '出口＝時點 2 對抗條目＋老闆終審章同一邊');
{
  const stEnd = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
  assert.equal(stEnd.node, 'ended', 'pass 後 ended 態');
  assert.equal(stEnd.inputs, undefined, '輸入流不落檔（2.5.2——對話承載）');
  assert.equal(stEnd.understandings, undefined, '理解流不落檔');
  assert.equal(stEnd.adversarialLog, undefined, '對抗 log 已轉 lastAdv 定長欄位');
  assert.equal(stEnd.history, undefined, '推進史已轉 edgeAt 定長欄位');
  assert.ok(!existsSync(join(root, '.shiftblame', 'tmp', 'flow-archive')), '零副本——無殭屍歸檔目錄');
}
assert.equal(state().node, 'ended');
// 完整流程的真實結束產物可開下一份工作；拒絕不切分支，成功建立新分支。
const endedBranch = git('branch', '--show-current').stdout.trim();
assert.equal(run('init', 'next-work', 'fix').status, 1, 'closeout 前拒絕（歸檔已由 sb end 機械完成）');
assert.equal(git('branch', '--show-current').stdout.trim(), endedBranch);
const oldG1 = readFileSync(join(root, '.shiftblame/archive/demo/002/G1.md'), 'utf8'); // sb end 已機械化歸檔——自 archive 讀回
assert.equal(run('init', 'next-work', 'fix').status, 1, '歸檔不等於合併與清理完成');
assert.equal(git('checkout', originalBase).status, 0);
assert.equal(git('merge', '--no-ff', endedBranch, '-m', 'merge demo').status, 0, '分支合併一律 --no-ff＋固定訊息 merge <slug>');
{ const co = run('closeout', '--base', originalBase); if (co.status !== 0) console.error('CLOSEOUT:', co.stderr); assert.equal(co.status, 0); }
assert.equal(run('init', 'next-work', 'fix').status, 1, '舊本機分支存在仍拒絕');
assert.equal(git('branch', '-d', endedBranch).status, 0);
const nextBaseTip = git('rev-parse', 'HEAD').stdout.trim();
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '開始下一份工作' });
const nextRecords = state();
const nextWork = run('init', 'next-work', 'fix');
assert.equal(nextWork.status, 0, nextWork.stderr);
assert.equal(git('branch', '--show-current').stdout.trim(), 'fix/next-work');
assert.equal(git('rev-parse', 'HEAD').stdout.trim(), nextBaseTip);
assert.equal(state().slug, 'next-work');
assert.equal(state().ms, '001');
assert.equal(state().node, 'intent');
assert.deepEqual(state().inputs, nextRecords.inputs);
assert.equal(state().endedAt, undefined);
assert.equal(state().closeout, undefined);
assert.equal(readFileSync(join(root, '.shiftblame/archive/demo/002/G1.md'), 'utf8'), oldG1);
console.log('sb-user-acceptance: pass');
