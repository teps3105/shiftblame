import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 1.5 八段全流程：intent→requirement→research→plan→test→build→verify→done→（重修／開新 ms／PASS）
// 授權鑰匙（1.7.0 撤印章）：--boss-ok 留痕＋--adversarial×adversarialLog point 條目對照＋理解流曝光（hooks 雙流記錄）
const root = mkdtempSync(join(tmpdir(), 'sb-eight-'));
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
assert.equal(run('init', 'demo').status, 0);
assert.equal(state().node, 'intent');

// 回頭自由：intent 自身不可回（無意義），其他段可。先走八段——
// intent→requirement：--boss-ok 邊；首走不得以 --rerun 直通繞過（返工直通僅限曾達 test 後的重走）
assert.match(run('next', 'requirement').stderr, /MUST 帶 --boss-ok/);
assert.match(run('next', 'requirement', '--rerun', 'impl').stderr, /--rerun 僅限同 ms 返工重走/, '首走防繞');
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
// requirement→research：G1 假需求閘
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n\n### AC-02（送出錯誤資料）\n- Given：已輸入不合法資料\n- When：送出資料\n- Then：看到明確錯誤\n- 使用者：送出錯誤資料的人\n- 失敗邊界：不得誤報成功\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口處理合法與不合法輸入，保留真實輸出作為測試依據。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
assert.equal(run('next', 'research').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 1.6.0 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
// plan→test：--boss-ok＋--adversarial＋adversarialLog point 條目；G3 缺承接先擋
assert.match(run('next', 'test').stderr, /MUST 帶 --boss-ok/);
assert.match(run('next', 'test', '--boss-ok').stderr, /--adversarial/);
assert.match(run('next', 'test', '--boss-ok', '--adversarial').stderr, /G3 未逐項承接 G1：AC-02/);
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出 | 測試=test-1.mjs\n- AC-02 | 驗收操作=送出不合法資料 | 通過判準=看到明確錯誤 | 需要的證據=實際錯誤輸出 | 測試=test-2.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
// 缺時點①條目即擋（RAM/ROM 對照源）→--point 宣告→過
assert.match(run('next', 'test', '--boss-ok', '--adversarial').stderr, /缺時點①條目/);
assert.equal(pt('①').status, 0);
const rel = run('next', 'test', '--boss-ok', '--adversarial');
if (rel.status !== 0) { console.error('release gate:', rel.stderr); }
assert.equal(rel.status, 0);
const st1 = state();
assert.match(st1.g1Contract.sha256, /^[a-f0-9]{64}$/); // G1 於放行邊封存
assert.equal(st1.g1Contract.snapshot, undefined);

// G1 偏離→任何前進擋；回 intent 不擋（回頭自由）
writeFileSync(join(ms, 'G1.md'), '# 驗收\n被改動。');
assert.match(run('next', 'build').stderr, /分隔標題出現 0 次|已偏離/);
assert.equal(run('next', 'intent').status, 0); // 回 intent 同 ms 重走，零旗標
writeFileSync(join(ms, 'G1.md'), '# 驗收\n### AC-01（送出資料）\n- Given：已輸入合法資料\n- When：送出資料\n- Then：畫面顯示完整結果\n- 使用者：送出資料的人\n- 失敗邊界：不得顯示部分結果\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n\n### AC-02（送出錯誤資料）\n- Given：已輸入不合法資料\n- When：送出資料\n- Then：看到明確錯誤\n- 使用者：送出錯誤資料的人\n- 失敗邊界：不得誤報成功\n- 消融：拿掉則無法送出且看不到結果\n- 證據：BEHAVIOR\n## 回指記錄\n');
// 返工直通：曾達 test 的重走，--rerun 免 --boss-ok（時點①分流判定留痕；老闆決策邊被豁免）
assert.equal(run('next', 'requirement', '--rerun', 'definition').status, 0, '返工直通：定義級免停靠');
assert.ok(state().history.at(-1).rerun === 'definition', '直通留痕於 history');
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 1.6.0 返工外部協助（rerunExtPending 邊驗；同時作數 research→plan）
assert.equal(run('next', 'research').status, 0);
assert.equal(run('next', 'plan').status, 0, '返工外部協助延續作數——一次調用滿足兩閘');
assert.match(run('next', 'test', '--boss-ok', '--adversarial').stderr, /過期|早於同邊/, '舊①條目過期即擋（新鮮度核心防護）');
assert.equal(pt('①', 'r2').status, 0, '重走後新鮮①條目（晚於上次同邊推進）');
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);

// 功能循環：test（定稿 commit）→build（存檔 commit）→verify（tree 乾淨）
writeFileSync(join(root, 'test-1.mjs'), 'import assert from "node:assert/strict";\nassert.equal("完整結果", "完整結果");\n');
commit('test-1.mjs', 'test: cover first acceptance');
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');
commit('seed.txt', 'feat: deliver first');
assert.equal(run('next', 'verify').status, 0);
// verify 唯讀：未存檔變更不得前進
writeFileSync(join(root, 'seed.txt'), '驗收中偷改\n');
assert.equal(pt('③', 't1').status, 0);
assert.match(run('next', 'done', '--boss-ok', '--adversarial').stderr, /working tree 未乾淨|乾淨/);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1\n');
// verify→done：1.7.0 撤印章——--boss-ok＋時點③對抗即鑰匙（授權語義由理解流曝光承擔）
assert.equal(pt('③').status, 0);
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
assert.equal(state().node, 'done');

// done→test 重修（零旗標，老闆不滿意）
assert.equal(run('next', 'test').status, 0);
assert.equal(state().node, 'test');
// 回 verify 再 done（循環後）
writeFileSync(join(root, 'seed.txt'), 'seed after rework fix\n');
commit('seed.txt', 'fix: touch for loop');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0);
assert.equal(pt('③', 'r2').status, 0);
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);

// done→intent：零旗標＝同 ms；--new-ms＝開新里程碑（ms++）
assert.equal(run('next', 'intent').status, 0);
assert.equal(state().ms, '001'); // 同 ms
assert.equal(state().rev, 2, '第二次開新輪遞增（時序可對照）');
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
assert.equal(run('next', 'research').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 1.6.0 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(pt('①', 'r3').status, 0);
assert.equal(run('next', 'test', '--boss-ok', '--adversarial').status, 0);
writeFileSync(join(root, 'seed.txt'), 'seed with feature 1 v2\n');
commit('seed.txt', 'feat: redo after rework');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0);
assert.equal(pt('③', 'r3').status, 0);
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
assert.equal(run('next', 'intent', '--new-ms').status, 0);
assert.equal(state().ms, '002'); // --new-ms→ms++

// PASS：sb end 需 done 態＋--boss-ok（1.7.0 撤 pass 印章）
assert.match(run('end', '--boss-ok').stderr, /done 態|sb end 僅限/);
// ms002 建檔後快走到 done（測 sb end 的 --boss-ok 鏈）
mkdirSync(join(root, '.shiftblame/demo/002'), { recursive: true });
const ms2 = join(root, '.shiftblame/demo/002');
writeFileSync(join(ms2, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=u | 前置=p | 操作=o | 可觀察結果=r | 失敗邊界=f | 證據=BEHAVIOR\n## 回指記錄\n');
writeFileSync(join(ms2, 'G2.md'), '# 技術\n沿用既有入口完成需求並保留錯誤邊界，測試以真實輸出為依據，不引入新依賴。');
writeFileSync(join(ms2, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=o | 通過判準=r | 需要的證據=實際輸出 | 測試=t.mjs\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果，這是真實的失敗點描述。\n# 實作步驟\n沿用既有入口並驗證輸出，逐步執行。');
// 跨 ms 繞過防線：ms002 的老闆邊不得以 --rerun 直通（history 的 test 記錄屬 ms001）
assert.match(run('next', 'requirement', '--rerun', 'impl').stderr, /--rerun 僅限同 ms/, '跨 ms --rerun 擋');
assert.equal(run('next', 'requirement', '--boss-ok').status, 0);
// 混合格式擋：單行 G1 加 BDD 塊 → research 邊擋（擇一定義）；移除後放行
writeFileSync(join(ms2, 'G1.md'), readFileSync(join(ms2, 'G1.md'), 'utf8') + '\n### AC-99（混合）\n- Given：（填）\n');
assert.match(run('next', 'research').stderr, /混合格式/, '1.7.3 混合格式擋（單行與 BDD 並存擇一）');
writeFileSync(join(ms2, 'G1.md'), readFileSync(join(ms2, 'G1.md'), 'utf8').replace('\n### AC-99（混合）\n- Given：（填）\n', ''));
assert.equal(run('next', 'research').status, 0);
hookRun({ hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'x' } }); // 1.6.0 外部證據標記（research→plan 邊驗）
assert.equal(run('next', 'plan').status, 0);
assert.equal(pt('①', 'ms2').status, 0);
{ const dbg = run('next', 'test', '--boss-ok', '--adversarial'); if (dbg.status !== 0) console.error('MS2 GATE:', dbg.stderr); assert.equal(dbg.status, 0); }
writeFileSync(join(root, 'seed.txt'), 'seed for second ms feature\n');
commit('seed.txt', 'feat: second ms');
assert.equal(run('next', 'build').status, 0);
assert.equal(run('next', 'verify').status, 0);
assert.match(run('end', '--boss-ok').stderr, /僅限 done/);
assert.equal(pt('③', 'ms2').status, 0);
assert.equal(run('next', 'done', '--boss-ok', '--adversarial').status, 0);
assert.equal(run('end', '--boss-ok').status, 0);
assert.equal(state().node, 'ended');
console.log('sb-user-acceptance: PASS');
