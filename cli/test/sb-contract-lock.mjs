import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 契約測試：G1 於 research→plan 時點 1 邊封存（hash 記 flow-state）；偏離即擋；回 requirement（老闆新輸入經訪談）重定義
const root = mkdtempSync(join(tmpdir(), 'sb-contract-'));
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


assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'app.txt'), 'base\n');
assert.equal(git('add', '.gitignore', 'app.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
const g1Body = '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n# 技術研究\n沿用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據。\n';
writeFileSync(join(ms, 'G1.md'), g1Body + '## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=畫面顯示完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
writeFileSync(join(root, '.shiftblame/tmp/pt1.md'), '# 時點 1 對抗\n外部子代理原文節錄內容足夠實質。\n對抗判定：通過');
assert.equal(run('next', 'research').status, 0); // requirement→research 機械推進（假需求閘查 G1 AC）
assert.equal(run('adversarial', join(root, '.shiftblame/tmp/pt1.md'), '--point', '1').status, 0); // 時點 1 對抗（research→plan 邊——審 G1 需求與研究）
hookRun({ hook_event_name: 'UserPromptSubmit', prompt: '老闆：需求與研究確認，推進計畫' }); // 老闆輸入新鮮度（research＋對抗完成＝決策邊裁決通道——零推回，對話承載）
assert.equal(run('next', 'plan', '--boss-ok', '--adversarial').status, 0); // 時點 1 邊——G1 契約封存（自進 plan 起全鏈凍結）
const sealed = state();
assert.match(sealed.g1Contract.sha256, /^[a-f0-9]{64}$/);
assert.equal(sealed.g1Contract.snapshot, undefined);
assert.equal(run('next', 'quality').status, 0); // plan→quality 機械推進（G2 計畫部分查驗）
const locked = state();
assert.match(locked.g1Contract.sha256, /^[a-f0-9]{64}$/);
assert.equal(locked.g1Contract.snapshot, undefined);
// 回指區更新→定義區 hash 不觸（RAM/ROM 分區封存正向）
{ const g1 = readFileSync(join(ms, 'G1.md'), 'utf8'); writeFileSync(join(ms, 'G1.md'), g1 + '- AC-01｜判定=SATISFIED｜證據節錄=節錄｜commit=abc\n'); }
// 定義區偏離／分隔標題破壞→前進擋（quality→build 邊先查 G1 契約）；回 requirement（老闆新輸入）不擋
writeFileSync(join(ms, 'G1.md'), '# 驗收\n局部模型改寫了契約。');
assert.match(run('next', 'build').stderr, /分隔標題出現 0 次|已偏離/);
const revOut = run('next', 'requirement');
assert.equal(revOut.status, 0);
assert.match(revOut.stdout, /修正輪 r01：新輪重寫自洽/, '回 requirement 開新輪——純計數訊息');
assert.equal(state().g1Contract, undefined); // 回 requirement 解除契約，重定義後重新封存
assert.equal(state().rev, 1, '輪次編號記入 flow-state');
assert.ok(!existsSync(join(ms, 'rev')), '零 rev 目錄寫入（歷史歸 git）');
// 修復 G1 後重走再回，連續開新輪遞增計數，保持不建立快照目錄。
writeFileSync(join(ms, 'G1.md'), g1Body + '## 回指記錄\n');
run('next', 'research');
run('next', 'requirement');
assert.equal(state().rev, 2, '第二次開新輪遞增計數（時序由 edgeAt 承擔）');
console.log('sb-contract-lock: pass');
