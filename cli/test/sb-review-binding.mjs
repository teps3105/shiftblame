// sb-review-binding：審查條目綁定審查對象——時點 1 記 G1 定義區 hash、時點 2 記 G2 定義區 hash、時點 3 記受驗提交；
// 推進與結束時比對，審查後修改定義區或再提交須重新審查，回指區更新不觸發。收尾先寫留痕再刪分支：刪分支失敗後排除原因重跑即完成。
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-bind-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const ms = join(root, '.shiftblame/demo/001');
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
const ok = (r, label) => assert.equal(r.status, 0, `${label}\n${r.stdout}\n${r.stderr}`);
const state = () => JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'), 'utf8'));
const report = (n, tag) => {
  const f = join(root, '.shiftblame/tmp', `pt${n}-${tag}.md`);
  writeFileSync(f, `# 時點${n}審查\n外部子代理原文節錄，內容足夠實質。\n對抗判定：通過\n`);
  return f;
};
const commit = (file, text, message) => {
  writeFileSync(join(root, file), text);
  ok(git('add', file), 'git add');
  ok(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-q', '-m', message), 'git commit');
  return git('rev-parse', 'HEAD').stdout.trim();
};
const G1_DEF = '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 現狀：現行畫面僅顯示部分結果且送出後無回饋\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n# 技術研究\n沿用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據。\n';
const writeG1 = (def = G1_DEF, reflect = '') => writeFileSync(join(ms, 'G1.md'), `${def}## 回指記錄\n${reflect}`);
const writeG2 = (hash, def = null) => writeFileSync(join(ms, 'G2.md'), def ?? `回指 G1：${hash}\n# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。\n# 品質\n以真實輸出為通過判準。\n## 回指記錄\n`);

ok(git('init', '-q'), 'git init');
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
ok(git('add', '.gitignore'), 'git add .gitignore');
commit('seed.txt', 'seed\n', 'test: initial');
ok(run('init', 'demo'), 'sb init（直接落 requirement——開工授權由 slug 建立承載）');
const workBranch = state().workBranch;
assert.ok(workBranch, 'init 建立工作分支');

// —— 1. 時點 1 的審查對象是 G1：還沒有 G1 就不能記錄 ——
let r = run('adversarial', report(1, 'none'), '--point', '1');
assert.equal(r.status, 1);
assert.match(r.stderr, /時點 1 審查的對象是 G1/);

// —— 2. 條目記下 G1 定義區 hash；審查後改定義區 → 推進擋；改回且只改回指區 → 通過 ——
writeG1();
ok(run('next', 'research'), 'requirement→research 機械推進');
r = run('adversarial', report(1, 'a'), '--point', '1');
ok(r, '時點 1 審查');
const g1 = state().lastAdv['1'].g1;
assert.match(g1, /^[0-9a-f]{64}$/, '條目記下 G1 定義區 hash');
assert.match(r.stdout, new RegExp(`審查對象：G1 定義區 ${g1.slice(0, 12)}`));
writeG1(G1_DEF.replace('畫面顯示完整結果', '畫面顯示部分結果'));
r = run('next', 'plan', '--adversarial');
assert.equal(r.status, 1);
assert.match(r.stderr, /時點 1 審查後 G1 定義區已變更/);
assert.match(r.stderr, new RegExp(`審查時 ${g1.slice(0, 12)}`));
assert.equal(state().node, 'research', '擋下時不推進');
writeG1(G1_DEF, '- AC-01：研究時補充的回指\n');
r = run('next', 'plan', '--adversarial');
ok(r, '只改回指區不需重審');
assert.match(r.stdout, /新鮮度與審查對象已驗/);

// —— 3. 時點 2 條目記下 G2 定義區 hash；審查後改定義區 → 推進擋；對原定義重審後通過 ——
writeG2(g1);
ok(run('next', 'quality'), 'plan→quality 機械推進');
r = run('adversarial', report(2, 'a'), '--point', '2');
ok(r, '時點 2 審查');
const g2 = state().lastAdv['2'].g2;
assert.match(g2, /^[0-9a-f]{64}$/, '條目記下 G2 定義區 hash');
assert.match(r.stdout, new RegExp(`審查對象：G2 定義區 ${g2.slice(0, 12)}`));
writeG2(g1, `回指 G1：${g1}\n# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=被改動的判準 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n邊界漏驗造成錯誤結果，真實失敗點。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。\n# 品質\n以真實輸出為通過判準。\n## 回指記錄\n`);
r = run('next', 'build', '--adversarial');
assert.equal(r.status, 1);
assert.match(r.stderr, /時點 2 審查後 G2 定義區已變更/);
assert.equal(state().node, 'quality', '擋下時不推進');
writeG2(g1);
ok(run('adversarial', report(2, 'b'), '--point', '2'), '對原定義重審');
ok(run('next', 'build', '--adversarial'), '時點 2 過邊（G2 契約封存）');

// —— 4. 時點 3 條目記下受驗提交；審查後再提交 → 結束與開新里程碑都擋；對新提交重審後通過 ——
writeFileSync(join(ms, 'G3.md'), `回指 G2：${state().g2Contract.sha256}\n# 實作紀錄\n沿用既有入口完成送出與錯誤邊界。\n## 回指記錄\n`);
commit('test-1.mjs', 'import assert from "node:assert/strict";\nassert.equal(1, 1);\n', 'test: cover acceptance');
commit('seed.txt', 'seed with feature\n', 'feat: deliver feature');
ok(run('next', 'verify'), 'build→verify 機械推進');
ok(run('adversarial', report(3, 'a'), '--point', '3'), '時點 3 審查');
assert.equal(state().lastAdv['3'].head, git('rev-parse', 'HEAD').stdout.trim(), '條目記下受驗提交');
const later = commit('seed.txt', 'seed with feature and fix\n', 'fix: late change');
for (const args of [['end', '--adversarial', '--boss-ok'], ['next', 'requirement', '--new-ms', '--adversarial', '--boss-ok']]) {
  r = run(...args);
  assert.equal(r.status, 1, args.join(' '));
  assert.match(r.stderr, /時點 3 審查後受驗提交已變更/, args.join(' '));
  assert.match(r.stderr, new RegExp(`目前 ${later.slice(0, 12)}`), args.join(' '));
}
assert.equal(state().node, 'verify');
ok(run('adversarial', report(3, 'b'), '--point', '3'), '對新提交重審');
assert.equal(state().lastAdv['3'].head, later);

// —— 5. 收尾先寫留痕再刪分支：刪除工作分支失敗 → 狀態保留 closeout、停在 verify；排除原因後重跑完成 ——
const refHook = join(root, '.git', 'hooks', 'reference-transaction');
mkdirSync(dirname(refHook), { recursive: true });
writeFileSync(refHook, `#!/bin/sh
[ "$1" = prepared ] || exit 0
while read old new ref; do
  if [ "$ref" = "refs/heads/${workBranch}" ] && [ -z "$(printf %s "$new" | tr -d 0)" ]; then echo "測試：拒絕刪除工作分支" >&2; exit 1; fi
done
exit 0
`);
chmodSync(refHook, 0o755);
r = run('end', '--adversarial', '--boss-ok');
assert.equal(r.status, 1, r.stdout + r.stderr);
assert.match(r.stderr, /刪除工作分支失敗/);
let st = state();
assert.equal(st.node, 'verify', '刪分支失敗時不寫 ended');
assert.equal(st.closeout.workBranch, workBranch, '刪分支前已寫收尾留痕');
assert.equal(st.closeout.workCommit, later);
assert.equal(git('rev-parse', '--verify', '-q', `refs/heads/${workBranch}`).status, 0, '工作分支仍在');
rmSync(refHook);
r = run('end', '--adversarial', '--boss-ok');
ok(r, '排除原因後重跑收尾');
st = state();
assert.equal(st.node, 'ended');
assert.notEqual(git('rev-parse', '--verify', '-q', `refs/heads/${workBranch}`).status, 0, '工作分支已刪');
assert.equal(git('log', '-1', '--format=%s').stdout.trim(), 'merge demo', '只合併一次');
assert.equal(git('rev-list', '--count', '--merges', 'HEAD').stdout.trim(), '1');

console.log('sb-review-binding: pass');
