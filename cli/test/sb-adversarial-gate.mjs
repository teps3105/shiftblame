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
console.log('sb-adversarial-gate: PASS');
