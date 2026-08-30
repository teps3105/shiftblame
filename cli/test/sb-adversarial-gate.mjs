import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.4 閘門分工：對抗三時點與 direct 聲明為文件層義務——閘門不讀 tmp。
// 本測驗證：release 不因缺 alignment-check／review 記錄而擋；direct 邊只驗節點合法性。

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-gate-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const ms = join(root, '.shiftblame/demo/001');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=shiftblame-test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test: initial').status, 0);
writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'plan', history: [] }));
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=操作者 | 前置=系統啟動 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口並保留錯誤邊界。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n邊界漏驗造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');

// 1. tmp 內無任何 alignment-check／review 記錄 → release 照過（閘門零 tmp 依賴；§10 與時點①為文件層義務）
assert.equal(run('next', 'release').status, 0);
// 2. 層間停靠：release→test 需 --boss-ok
assert.match(run('next', 'test').stderr, /老闆決策點/);
assert.equal(run('next', 'test', '--boss-ok').status, 0);
// 3. direct 邊：非 release 節點（test.next 不含 commit）帶 --direct → 擋（單向節點鏈）
assert.match(run('next', 'commit', '--direct').stderr, /不合法推進|僅限 release→commit/);
// 4. direct 邊：release 節點 → 過（聲明為文件層義務，閘門不讀 direct-change.md）
const st = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
st.node = 'release';
writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st));
const direct = run('next', 'commit', '--direct');
assert.equal(direct.status, 0);
assert.match(direct.stdout, /聲明義務/);
// 5. lock 命令已移除（test-lock.json 體系廢除）
assert.notEqual(run('lock', 'x.test.mjs').status, 0);
console.log('sb-adversarial-gate: PASS');
