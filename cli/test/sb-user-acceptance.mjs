import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'sb-acceptance-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const ms = join(root, '.shiftblame/demo/001');
const tmp = join(root, '.shiftblame/tmp');
mkdirSync(tmp, { recursive: true });
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
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
writeFileSync(join(tmp, 'alignment-check.md'), 'G1↔G2：一致\nG2↔G3：一致\nG1↔G3：一致');
assert.match(run('next', 'release').stderr, /G1 AC-02 缺實質欄位：使用者/);
writeFileSync(join(ms, 'G1.md'), `# 驗收
- AC-01 | 需求=R1 | 使用者=送出資料的人 | 前置=資料合法 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR
- AC-02 | 需求=R2 | 使用者=送出錯誤資料的人 | 前置=資料不合法 | 操作=送出資料 | 可觀察結果=看到明確錯誤 | 失敗邊界=不得誤報成功 | 證據=BEHAVIOR`);
assert.match(run('next', 'release').stderr, /G3 未逐項承接 G1：AC-02/);
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出合法資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出\n- AC-02 | 驗收操作=送出不合法資料 | 通過判準=看到明確錯誤 | 需要的證據=實際錯誤輸出\n# 失敗模式\n輸入邊界漏驗會造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
const g3Sha = createHash('sha256').update(readFileSync(join(ms, 'G3.md'))).digest('hex');
writeFileSync(join(tmp, 'alignment-check.md'), `G1↔G2：一致\nG2↔G3：一致\nG1↔G3：一致\nG3-SHA256=${g3Sha}`);
writeFileSync(join(tmp, 'review-plan-demo-001-1.md'), `# 對抗方向檢閱
G3-SHA256=${g3Sha}

## 對抗要點

- AC-01 與 AC-02 只驗送出路徑，攻擊：錯誤邊界（AC-02）若被同一入口吞掉，計畫缺獨立的錯誤驗證步驟。
- 攻擊：兩項驗收共用同一入口，若入口本身行為分裂，合法與不合法路徑的判準會互相污染。

## 複核結論

- 駁回第一項：G3.md:1 已為 AC-02 排定不合法輸入驗收並要求實際錯誤輸出，錯誤驗證不缺。
- 駁回第二項：G2.md:1 載明入口行為單一可重現，合法與不合法路徑判準不會互相污染。

## 反向對抗

對照攻擊點與複核結論：兩項駁回分別引 G3.md 與 G2.md 內容，出處可查且語義相符，複核誠實。
反向對抗判定：成立

## 附錄：外部子代理原始輸出

（外部子代理全文）攻擊一：AC-01 與 AC-02 只驗送出路徑，錯誤邊界若被同一入口吞掉，計畫缺獨立錯誤驗證。攻擊二：兩項驗收共用同一入口，入口行為分裂時判準互相污染。`);
assert.equal(run('next', 'release').status, 0);
assert.match(run('next', 'commit', '--direct').stderr, /USER_OBSERVABLE=NO/);
const contract = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json'))).g1Contract;
writeFileSync(join(tmp, 'release-brief-demo-001-1.md'), `# 放行簡報

計畫：以既有入口完成 AC-01 與 AC-02 的驗收與實作。
對抗檢閱：review-plan-demo-001-1.md 的要點與複核已納入，無自攻降級。
§10 核對：三對六向成立，即進入開發。`);

assert.equal(run('next', 'test').status, 0);
writeFileSync(join(root, 'test-1.mjs'), '// AC-01\nimport assert from "node:assert/strict";\nassert.equal("完整結果", "完整結果");\n');
assert.equal(run('lock', 'test-1.mjs').status, 0);
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(tmp, 'build-001.md'), '# 實機驗證\n已用合法輸入執行並取得完整輸出。');
assert.equal(run('next', 'commit').status, 0);
const commit1 = commit('test-1.mjs', 'test: cover AC-01');
assert.equal(run('next', 'verify').status, 0);

const report = (id, result, evidence, sha, observation, evidenceFile, evidenceHash) => `G1-SHA256=${contract.sha256}
MS=001
- ${id} | 結果=${result} | commit=${sha} | 證據=${evidence} | 操作=執行真實使用情境 | 觀察=${observation} | 證據檔=${evidenceFile} | 證據SHA256=${evidenceHash}
# 反證嘗試
使用邊界輸入嘗試讓結果失敗，系統回傳可判讀結果。
# 未驗
不同作業系統與極端負載尚未涵蓋，不影響本項必填行為判定。
`;
const evidence1 = join(tmp, 'evidence-001.txt');
writeFileSync(evidence1, '實際操作後，使用者看到完整結果。\n');
const evidenceHash1 = createHash('sha256').update(readFileSync(evidence1)).digest('hex');
writeFileSync(join(tmp, 'verify-001.md'), report('AC-01', 'SATISFIED', 'STRUCTURE', commit1, '檔案與節點存在', evidence1, evidenceHash1));
assert.match(run('next', 'verdict').stderr, /證據 MUST 為 BEHAVIOR/);
writeFileSync(join(tmp, 'verify-001.md'), report('AC-01', 'UNVERIFIED', 'BEHAVIOR', commit1, '尚未觀察', evidence1, evidenceHash1));
assert.match(run('next', 'verdict').stderr, /AC-01=UNVERIFIED/);
writeFileSync(join(tmp, 'verify-001.md'), report('AC-01', 'SATISFIED', 'BEHAVIOR', commit1, '使用者看到完整結果', evidence1, evidenceHash1));
const reviewVerify = (name, file) => {
  const sha = createHash('sha256').update(readFileSync(join(tmp, file))).digest('hex');
  writeFileSync(join(tmp, name), `# 對抗成果檢閱

錨定驗收報告：${file}
報告SHA256=${sha}

## 對抗要點

- 攻擊 ${file} 的 SATISFIED 證據：反證嘗試是否真的操作過邊界輸入，還是紙上推演。
- 攻擊證據檔：SHA-256 只證明檔案未變，不證明內容由實際執行產生，需查產生方式。

## 複核結論

- 駁回第一項：輸出：${file} 反證嘗試段列有具體邊界輸入與回傳結果，非紙上推演。
- 駁回第二項：證據檔：SHA-256 由實際執行輸出計算，可重算核對。

## 反向對抗

對照攻擊點與複核結論：駁回理由分別指向反證段落與證據 hash，出處可查，複核誠實。
反向對抗判定：成立

## 附錄：外部子代理原始輸出

（外部子代理全文）攻擊一：SATISFIED 證據的反證嘗試是否真的操作過邊界輸入。攻擊二：SHA-256 只證明檔案未變，不證明內容由實際執行產生。`);
};
reviewVerify('review-verify-demo-001-1.md', 'verify-001.md');
assert.equal(run('next', 'verdict').status, 0);
writeFileSync(evidence1, '證據遭到替換。\n');
assert.match(run('next', 'converge').stderr, /證據SHA256 缺失或與證據檔不符/);
writeFileSync(evidence1, '實際操作後，使用者看到完整結果。\n');
assert.match(run('next', 'converge').stderr, /收斂缺使用者需求驗收證據：AC-02/);

assert.equal(run('next', 'test').status, 0);
writeFileSync(join(root, 'test-2.mjs'), '// AC-02\nimport assert from "node:assert/strict";\nassert.equal("明確錯誤", "明確錯誤");\n');
assert.equal(run('lock', 'test-2.mjs').status, 0);
assert.equal(run('next', 'build').status, 0);
writeFileSync(join(tmp, 'build-002.md'), '# 實機驗證\n已用不合法輸入執行並取得明確錯誤。');
assert.equal(run('next', 'commit').status, 0);
const commit2 = commit('test-2.mjs', 'test: cover AC-02');
assert.equal(run('next', 'verify').status, 0);
const evidence2 = join(tmp, 'evidence-002.txt');
writeFileSync(evidence2, '實際操作後，使用者看到明確錯誤。\n');
const evidenceHash2 = createHash('sha256').update(readFileSync(evidence2)).digest('hex');
writeFileSync(join(tmp, 'verify-002.md'), report('AC-02', 'SATISFIED', 'BEHAVIOR', commit2, '使用者看到明確錯誤', evidence2, evidenceHash2));
reviewVerify('review-verify-demo-001-2.md', 'verify-002.md');
assert.equal(run('next', 'verdict').status, 0);
writeFileSync(join(tmp, 'review-converge-demo-001-1.md'), `# 對抗成果檢閱（收斂複驗）
G1-SHA256=${contract.sha256}

## 對抗要點

- 攻擊 AC-01 與 AC-02 的 SATISFIED 證據是否出自同一次執行環境，若共用環境，一次偏差即整體失效。
- 攻擊兩個功能的反證嘗試敘述相近，可能是複製貼上而非各自執行。

## 複核結論

- 駁回第一項：AC-01 與 AC-02 證據分屬不同 commit 的獨立執行，各自的證據檔附 SHA-256 可重算。
- 駁回第二項：命令：diff verify-001.md verify-002.md 反證段——輸入不同（完整結果／明確錯誤），非複製貼上。

## 反向對抗

對照攻擊點與複核結論：兩項駁回分別引 commit 與報告反證段，出處可查，複核誠實。
反向對抗判定：成立

## 附錄：外部子代理原始輸出

（外部子代理全文）攻擊一：AC-01 與 AC-02 的 SATISFIED 證據若出自同一次執行環境，一次偏差即整體失效。攻擊二：兩個功能的反證嘗試敘述相近，可能是複製貼上而非各自執行。`);
assert.equal(run('next', 'converge').status, 0);
assert.match(run('next', 'ms-done', '--boss-ok').stderr, /工作狀態邊界/);
assert.equal(run('next', 'ms-done').status, 0);
assert.match(run('next', 'pass').stderr, /需要新的老闆語義決策/);
assert.equal(run('next', 'pass', '--boss-ok').status, 0);
