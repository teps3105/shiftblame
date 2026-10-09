import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 紅→綠機械核對：G2「品質」段「測試入口：」行——時點 2 封存實際執行並把紅／綠記入契約
// （紅＝新標準對未實作行為失敗，是標準存在的證據）；進 verify 邊重跑同一入口要求綠燈
// （綠是 build 本份；verify 段驗行為與整體正確性，不重跑綠燈）。
// 缺入口行擋；「無（理由）」聲明跳過核對；紅燈封存可過邊、進 verify 擋；轉綠後放行且契約保留紅→綠對照。
const root = mkdtempSync(join(tmpdir(), 'sb-testgate-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const ms = join(root, '.shiftblame/demo/001');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const pt = (n) => { const f = join(root, '.shiftblame/tmp', `pt${n}.md`); writeFileSync(f, `# 時點${n}對抗\n外部子代理原文節錄（>=30 字實質內容以通過機械驗）。\n對抗判定：通過`); return f; };
const writeG2 = (g1Hash, quality) => writeFileSync(join(ms, 'G2.md'), `回指 G1：${g1Hash}\n# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=red.mjs\n# 失敗模式\n邊界漏驗造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出。\n# 品質\n以真實輸出為通過判準。\n${quality}## 回指記錄\n`);
const g3Of = (g2Hash) => writeFileSync(join(ms, 'G3.md'), `回指 G2：${g2Hash}\n# 實作紀錄\n沿用既有入口完成送出與錯誤邊界。\n## 回指記錄\n`);
const commit = (file, content, message) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
  assert.equal(git('add', file).status, 0);
  assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-q', '-m', message).status, 0);
};

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n# 技術研究\n沿用既有入口並保留錯誤邊界。\n## 回指記錄\n');
assert.equal(run('next', 'research').status, 0);
assert.equal(run('adversarial', pt('1'), '--point', '1').status, 0);
assert.equal(run('next', 'plan', '--adversarial').status, 0);
const g1Hash = state().g1Contract.sha256;
writeG2(g1Hash, '');
assert.equal(run('next', 'quality').status, 0, 'plan→quality 機械推進（G2 計畫段中鏈即驗）');

// 1. 缺「測試入口：」行 → 時點 2 邊擋（紅→綠核對的錨點不存在）
assert.equal(run('adversarial', pt('2a'), '--point', '2').status, 0);
let r = run('next', 'build', '--adversarial');
assert.equal(r.status, 1);
assert.match(r.stderr, /測試入口/);

// 2. 「無（理由）」聲明 → 封存記錄、紅→綠核對跳過；進 verify 不跑綠燈（驗收以檢核程序承載）
writeG2(g1Hash, '測試入口：無（文件變更無行為面——檢核程序見驗收操作欄）\n');
assert.equal(run('adversarial', pt('2b'), '--point', '2').status, 0);
r = run('next', 'build', '--adversarial');
assert.equal(r.status, 0, r.stderr + r.stdout);
assert.equal(state().g2Contract.tests.red, null, '無自動化聲明——red 記 null');
assert.match(r.stdout, /聲明無自動化/);
g3Of(state().g2Contract.sha256);
r = run('next', 'verify');
assert.equal(r.status, 0, r.stderr + r.stdout);
assert.ok(!r.stdout.includes('測試入口綠燈'), '無自動化聲明——verify 不跑綠燈');

// 3. 紅燈封存（新標準存在的證據）→ 過時點 2 邊；進 verify 綠燈閘擋（綠是 build 本份）
assert.equal(run('next', 'quality').status, 0, 'verify→quality 旗標切段——品質安排更新（新標準 red.mjs）');
commit(join(root, 'red.mjs'), 'process.exit(1);\n', 'test: failing standard');
writeG2(g1Hash, '測試入口：node red.mjs\n');
assert.equal(run('adversarial', pt('2c'), '--point', '2').status, 0);
r = run('next', 'build', '--adversarial');
assert.equal(r.status, 0, r.stderr + r.stdout);
assert.equal(state().g2Contract.tests.red, true, '封存記錄紅燈');
assert.match(r.stdout, /測試入口紅燈已記錄/);
g3Of(state().g2Contract.sha256);
r = run('next', 'verify');
assert.equal(r.status, 1);
assert.match(r.stderr, /測試入口紅燈/, '綠是 build 本份——紅燈擋進 verify');

// 4. 修復轉綠（build 本份完成）→ 進 verify 放行；契約保留封存時的紅燈紀錄（紅→綠對照）
commit(join(root, 'red.mjs'), 'process.exit(0);\n', 'fix: 轉綠');
r = run('next', 'verify');
assert.equal(r.status, 0, r.stderr + r.stdout);
assert.match(r.stdout, /測試入口綠燈/);
assert.equal(state().g2Contract.tests.red, true, '契約保留封存時的紅燈紀錄');
console.log('sb-test-gate: pass');
