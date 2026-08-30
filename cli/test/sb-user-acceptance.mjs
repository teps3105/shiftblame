import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.4：閘門只讀 git 與 flow-state——測試定稿＝test 節點期間的 commit；
// AC-ID 映射由 G3 承載（MUST NOT 進程式碼）；對抗/報告/簡報為文件層義務，閘門不讀 tmp。
const root = mkdtempSync(join(tmpdir(), 'sb-acceptance-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const commit = (file, message) => {
  assert.equal(git('add', file).status, 0);
  assert.equal(git('-c', 'user.name=shiftblame-test', '-c', 'user.email=test@example.invalid', 'commit', '-m', message).status, 0);
  return git('rev-parse', 'HEAD').stdout.trim();
};

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=shiftblame-test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test: initial').status, 0);
writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'plan', history: [] }));
writeFileSync(join(ms, 'G1.md'), `# 驗收
- AC-01 | 需求=R1 | 使用者=送出資料的人 | 前置=資料合法 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR
- AC-02 | 需求=R2 | 使用者=（填） | 前置=資料不合法 | 操作=送出資料 | 可觀察結果=看到明確錯誤 | 失敗邊界=不得誤報成功 | 證據=BEHAVIOR`);
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口處理合法與不合法輸入，保留真實輸出作為測試依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
assert.match(run('next', 'release').stderr, /G1 AC-02 缺實質欄位：使用者/);
writeFileSync(join(ms, 'G1.md'), `# 驗收
- AC-01 | 需求=R1 | 使用者=送出資料的人 | 前置=資料合法 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR
- AC-02 | 需求=R2 | 使用者=送出錯誤資料的人 | 前置=資料不合法 | 操作=送出資料 | 可觀察結果=看到明確錯誤 | 失敗邊界=不得誤報成功 | 證據=BEHAVIOR`);
assert.match(run('next', 'release').stderr, /G3 未逐項承接 G1：AC-02/);
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n- AC-02 | 驗收操作=送出不合法資料 | 通過判準=看到明確錯誤 | 需要的證據=實際錯誤輸出 | 測試=test-2.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
// 1.4：§10 核對與對抗方向檢閱為文件層義務——release 閘不再讀 tmp，直接過
assert.equal(run('next', 'release').status, 0);
const contract = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'))).g1Contract;
assert.match(contract.sha256, /^[a-f0-9]{64}$/);
// 層間停靠：release→test 需 --boss-ok（老闆 checkpoint 由旗標機械把關）
assert.match(run('next', 'test').stderr, /老闆決策點/);
assert.equal(run('next', 'test', '--boss-ok').status, 0);
assert.match(JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'))).testBaseline, /^[a-f0-9]{40}$/);

// 測試碼不含任何流程代號（AC-ID 映射在 G3）；build 閘要求 test 節點期間有定稿 commit
writeFileSync(join(root, 'test-1.mjs'), 'import assert from "node:assert/strict";\nassert.equal("完整結果", "完整結果");\n');
assert.match(run('next', 'build').stderr, /test 節點期間無新 commit/);
commit('test-1.mjs', 'test: cover first acceptance');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'commit').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with first feature\n');
commit('seed.txt', 'feat: deliver first acceptance');
assert.equal(run('next', 'verify').status, 0);
// 驗收期間偷改 repo → verdict 擋（git 一致性）
writeFileSync(join(root, 'seed.txt'), '驗收期間被偷改\n');
assert.match(run('next', 'verdict').stderr, /偏離待驗 commit/);
writeFileSync(join(root, 'seed.txt'), 'seed with first feature\n');
assert.equal(run('next', 'verdict').status, 0);
assert.equal(run('next', 'test').status, 0); // verdict→test：開第二功能小循環（不需 boss-ok）
writeFileSync(join(root, 'test-2.mjs'), 'import assert from "node:assert/strict";\nassert.equal("明確錯誤", "明確錯誤");\n');
commit('test-2.mjs', 'test: cover second acceptance');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'commit').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with second feature\n');
commit('seed.txt', 'feat: deliver second acceptance');
assert.equal(run('next', 'verify').status, 0);
assert.equal(run('next', 'verdict').status, 0);
// 收斂：clean worktree＋判決鏈（G1 逐項驗收彙總為文件層，由 sb report 審計）
assert.equal(run('next', 'converge').status, 0);
assert.match(run('next', 'ms-done', '--boss-ok').stderr, /工作狀態邊界/);
assert.equal(run('next', 'ms-done').status, 0);
assert.match(run('next', 'pass').stderr, /老闆決策點/);
assert.equal(run('next', 'pass', '--boss-ok').status, 0);
console.log('sb-user-acceptance: PASS');
