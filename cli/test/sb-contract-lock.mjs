import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const hookBin = resolve(dirname(fileURLToPath(import.meta.url)), '../../hooks/shiftblame-guard.mjs');
const hookRun = (payload) => spawnSync(process.execPath, [hookBin], { input: JSON.stringify({ cwd: root, ...payload }), encoding: 'utf8' });


assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'app.txt'), 'base\n');
assert.equal(git('add', '.gitignore', 'app.txt').status, 0);
assert.equal(git('-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-m', 'test: initial').status, 0);
assert.equal(run('init', 'demo').status, 0);
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 證據：BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=畫面顯示完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
writeFileSync(join(slugDir, 'SLUG.md'), '# SLUG\n- 時點①對抗：完成，反向對抗判定成立\n');
assert.equal(run('next', 'audit', '--boss-ok').status, 0);
assert.match(run('next', 'research').stderr, /零現況查證/, '1.7.3 審計閘：零 auditEvidence 擋（字面研究死路）');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: join(root, 'app.txt') } }); // 1.7.3 審計痕跡標記（audit→research 邊驗）
assert.equal(run('next', 'research').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 1.6.0 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);
const locked = state();
assert.match(locked.g1Contract.sha256, /^[a-f0-9]{64}$/);
assert.equal(locked.g1Contract.snapshot, undefined);
// G1 偏離→前進擋；回 intent 不擋（回頭自由）
writeFileSync(join(ms, 'G1.md'), '# 驗收\n局部模型改寫了契約。');
assert.match(run('next', 'build').stderr, /G1 已偏離/);
const revOut = run('next', 'intent');
assert.equal(revOut.status, 0);
assert.match(revOut.stdout, /修正輪 r01：基線凍結/, '1.7.3 回 intent 開新輪——rev 快照訊息');
assert.equal(state().g1Contract, undefined); // 回 intent 解除契約，重定義後重新封存
assert.equal(state().rev, 1, '輪次編號記入 flow-state');
assert.ok(existsSync(join(ms, 'rev/r01/G1.md')), 'rev/r01 凍結 G1 基線');
assert.ok(existsSync(join(ms, 'rev/r01/G2.md')) && existsSync(join(ms, 'rev/r01/G3.md')), 'rev/r01 凍結 G2/G3');
assert.match(readFileSync(join(ms, 'rev/r01/G1.md'), 'utf8'), /局部模型改寫了契約/, '凍結的是回頭當下的內容（時序唯一權威）');
assert.equal(state().auditEvidence, undefined, '回 intent 重置審計痕跡（每輪重新審計）');
// 再回一輪：r02 遞增（快照疊代不覆蓋）
run('next', 'audit', '--boss-ok');
run('next', 'intent');
assert.equal(state().rev, 2, '第二次開新輪遞增 r02');
assert.ok(existsSync(join(ms, 'rev/r02/G1.md')), 'rev/r02 存在（時序可對照）');
console.log('sb-contract-lock: PASS');
