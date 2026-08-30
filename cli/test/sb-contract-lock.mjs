import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.4：G1 契約封存＝hash 記入 flow-state（無快照檔）；閘門只讀 git 與 flow-state
const root = mkdtempSync(join(tmpdir(), 'sb-contract-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
mkdirSync(join(root, '.shiftblame/tmp'), { recursive: true });
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'app.txt'), 'base\n');
assert.equal(git('add', '.gitignore', 'app.txt').status, 0);
assert.equal(git('-c', 'user.name=shiftblame-test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test: initial').status, 0);
writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'plan', history: [] }));
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=操作服務的人 | 前置=已輸入合法資料 | 操作=送出資料 | 可觀察結果=畫面顯示完整結果 | 失敗邊界=不得顯示部分結果 | 證據=BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口完成需求並保留錯誤邊界。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=畫面顯示完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');

const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
assert.match(run('next', 'release', '--boss-ok').stderr, /工作狀態邊界/);
assert.equal(run('next', 'release').status, 0);
const locked = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json')));
assert.match(locked.g1Contract.sha256, /^[a-f0-9]{64}$/);
assert.equal(locked.g1Contract.snapshot, undefined); // 1.4：無快照檔——hash 只記 flow-state
assert.equal(locked.g1Contract.file, join(ms, 'G1.md'));
writeFileSync(join(ms, 'G1.md'), '# 驗收\n局部模型改寫了契約。');
assert.match(run('next', 'test').stderr, /G1 已偏離放行時契約/);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=操作服務的人 | 前置=已輸入合法資料 | 操作=送出資料 | 可觀察結果=畫面顯示完整結果 | 失敗邊界=不得顯示部分結果 | 證據=BEHAVIOR');
// 修約後還原 G1 原文（此測試只驗契約核對與修約路徑）
// 修約：amendment 為文件層義務（閘門不讀 tmp）；clean worktree 由 git 判定
writeFileSync(join(root, 'app.txt'), '未分類變更\n');
assert.match(run('amend', '--boss-ok').stderr, /回指 G1 前 working tree 必須乾淨/);
writeFileSync(join(root, 'app.txt'), 'base\n');
assert.equal(run('amend', '--boss-ok').status, 0);
const amended = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json')));
assert.equal(amended.node, 'audit');
assert.equal(amended.g1Contract, undefined);
writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ ...amended, node: 'ms-done' }));
writeFileSync(join(root, 'app.txt'), '未分類的新里程碑變更\n');
assert.match(run('next', 'audit', '--boss-ok').stderr, /工作狀態邊界/);
assert.match(run('next', 'audit').stderr, /回指 G1 前 working tree 必須乾淨/);
writeFileSync(join(root, 'app.txt'), 'base\n');
assert.equal(run('next', 'audit').status, 0);
assert.equal(JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'))).ms, '002');
console.log('sb-contract-lock: PASS');
