import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.5 契約測試：G1 於 plan→test 放行邊封存（hash 記 flow-state）；偏離即擋；回 intent 重定義（零旗標）
const root = mkdtempSync(join(tmpdir(), 'sb-contract-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
const slugDir = join(root, '.shiftblame/demo');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'app.txt'), 'base\n');
assert.equal(git('add', '.gitignore', 'app.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=操作服務的人 | 前置=已輸入合法資料 | 操作=送出資料 | 可觀察結果=畫面顯示完整結果 | 失敗邊界=不得顯示部分結果 | 證據=BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=畫面顯示完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點①對抗：完成，反向對抗判定成立\n');
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0);
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);
const locked = state();
assert.match(locked.g1Contract.sha256, /^[a-f0-9]{64}$/);
assert.equal(locked.g1Contract.snapshot, undefined);
// G1 偏離→前進擋；回 intent 不擋（回頭自由）
writeFileSync(join(ms, 'G1.md'), '# 驗收\n局部模型改寫了契約。');
assert.match(run('next', 'build').stderr, /G1 已偏離/);
assert.equal(run('next', 'intent').status, 0);
assert.equal(state().g1Contract, undefined); // 回 intent 解除契約，重定義後重新封存
console.log('sb-contract-lock: PASS');
