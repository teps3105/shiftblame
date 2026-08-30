import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 對抗檢閱閘門專測：鎖死實攻複核發現的逃口——散文結論、無空格列點、
// 判定行藏附錄、段落灌水（section 有終點）、膚淺自攻、旗標不一致。

const cli = resolve(dirname(fileURLToPath(import.meta.url)), '../bin/sb.mjs');
const root = mkdtempSync(join(tmpdir(), 'sb-adv-gate-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
const ms = join(root, '.shiftblame/demo/001');
const tmp = join(root, '.shiftblame/tmp');
mkdirSync(tmp, { recursive: true });
mkdirSync(ms, { recursive: true });
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf-8' });
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

assert.equal(git('init').status, 0);
writeFileSync(join(root, '.gitignore'), '.shiftblame/\n');
writeFileSync(join(root, 'seed.txt'), 'seed\n');
assert.equal(git('add', '.gitignore', 'seed.txt').status, 0);
assert.equal(git('-c', 'user.name=shiftblame-test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'test: initial').status, 0);
writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify({ slug: 'demo', ms: '001', node: 'plan', history: [] }));
writeFileSync(join(ms, 'G1.md'), '# 驗收\n- AC-01 | 需求=R1 | 使用者=操作者 | 前置=系統啟動 | 操作=送出資料 | 可觀察結果=看到完整結果 | 失敗邊界=不得出現部分結果 | 證據=BEHAVIOR');
writeFileSync(join(ms, 'G2.md'), '# 技術\n使用既有入口並保留錯誤邊界。');
writeFileSync(join(ms, 'G3.md'), '# 驗收條件\n- AC-01 | 驗收操作=送出資料 | 通過判準=看到完整結果 | 需要的證據=實際輸出\n# 失敗模式\n邊界漏驗造成錯誤結果。\n# 實作步驟\n沿用既有入口並驗證輸出。');
const g3Sha = sha(join(ms, 'G3.md'));
writeFileSync(join(tmp, 'alignment-check.md'), `G1↔G2：一致\nG2↔G3：一致\nG1↔G3：一致\nG3-SHA256=${g3Sha}`);

const anchors = `G3-SHA256=${g3Sha}`;
const attack = `## 對抗要點

- AC-01 只看實際輸出，攻擊：入口吞掉錯誤時失敗邊界不可觀察。
- 攻擊：實作步驟未指明驗證方式，執行時可能跳過驗證。`;
const rebuttal = `## 複核結論

- 駁回第一項：G3.md:1 失敗模式已列邊界漏驗為首因，AC-01 邊界可觀察。
- 駁回第二項：G3.md:5 實作步驟明文「沿用既有入口並驗證輸出」。`;
const counter = `## 反向對抗

對照攻擊點與複核結論逐項查證：兩項駁回均引到 G3.md 對應行，出處存在且語義相符，複核誠實。
反向對抗判定：成立`;
const appendix = `## 附錄：外部子代理原始輸出

（外部子代理全文）攻擊一：驗收只看實際輸出，入口吞掉錯誤則失敗邊界不可觀察，計畫漏驗錯誤路徑。攻擊二：實作步驟未指明驗證方式，執行時可能跳過驗證。建議補錯誤輸入驗證以強化邊界。`;

// 1. 對照組：四段齊＋出處＋段末判定 → 放行
writeFileSync(join(tmp, 'review-plan-demo-001-ok.md'), `# 對抗方向檢閱\n${anchors}\n\n${attack}\n\n${rebuttal}\n\n${counter}\n\n${appendix}`);
assert.equal(run('next', 'release').status, 0);

// 之後每個變體重置到 plan 節點（release 前置不改 G 檔即可重試）
const reset = () => {
  const st = JSON.parse(readFileSync(join(root, '.shiftblame/flow-state.json')));
  st.node = 'plan';
  writeFileSync(join(root, '.shiftblame/flow-state.json'), JSON.stringify(st));
};
const gate = (name, content, expect) => {
  reset();
  writeFileSync(join(tmp, name), content);
  const r = run('next', 'release');
  assert.match(r.stderr, expect, `${name} 應被擋：${r.stderr}`);
};

// 2. 散文式複核結論（無列點）→ 擋：規避出處檢查
gate('review-plan-demo-001-prose.md', `# 對抗方向檢閱\n${anchors}\n\n${attack}\n\n## 複核結論\n\n兩項攻擊經評估均不成立，計畫已涵蓋相關邊界與驗證，照放行。\n\n${counter}\n\n${appendix}`, /無列點裁定/);

// 3. 無空格列點（CJK 慣例）且無出處 → 擋（BULLET_RE 不因排版逃逸）
gate('review-plan-demo-001-tight.md', `# 對抗方向檢閱\n${anchors}\n\n${attack}\n\n## 複核結論\n\n-駁回：攻擊不成立，計畫已涵蓋。\n-駁回：驗證不會跳過。\n\n${counter}\n\n${appendix}`, /無可查證出處/);

// 4. 判定行只放附錄、反向對抗段自身沒有 → 擋（section 有終點後判定行必須在本段段末）
gate('review-plan-demo-001-verdict-elsewhere.md', `# 對抗方向檢閱\n${anchors}\n\n${attack}\n\n${rebuttal}\n\n## 反向對抗\n\n判定結論詳見附錄末行。\n\n${appendix}\n\n反向對抗判定：成立`, /段末缺/);

// 5. 反向對抗段寫（略）、附錄灌水 → 擋（段落實質以本段內容計）
gate('review-plan-demo-001-skip.md', `# 對抗方向檢閱\n${anchors}\n\n${attack}\n\n${rebuttal}\n\n## 反向對抗\n\n（略）\n\n${appendix}`, /「反向對抗」段敷衍/);

// 6. 膚淺自攻（對抗要點過短）＋--self-attack → 擋（≥60 字以本段內容計，附錄灌水無效）
reset();
writeFileSync(join(tmp, 'review-plan-demo-001-shallow-self.md'), `# 對抗方向檢閱\n身分切換自攻（外部子代理不可用：平台派發失敗）\n${anchors}\n\n## 對抗要點\n\n攻擊一。攻擊二。\n\n${rebuttal}\n\n${counter}\n\n${appendix}`);
assert.match(run('next', 'release', '--self-attack').stderr, /要求 ≥60 字實質/);

// 7. 宣告自攻但未帶旗標 → 擋（無聲降級）
reset();
writeFileSync(join(tmp, 'review-plan-demo-001-silent-self.md'), `# 對抗方向檢閱\n身分切換自攻（外部子代理不可用：平台派發失敗）\n${anchors}\n\n## 對抗要點\n\n- 以最嚴厲立場攻擊 AC-01：入口吞掉錯誤時失敗邊界不可觀察，G3 漏列錯誤路徑驗證，此為方向級缺陷。\n- 以最嚴厲立場攻擊驗證設計：實作步驟未指明驗證方式，執行時可跳過驗證，等同假驗收。\n\n${rebuttal}\n\n## 反向對抗\n\n以對抗者立場重讀複核：兩項駁回引到 G3.md 對應行，出處可查，複核誠實。\n反向對抗判定：成立\n\n## 附錄：自攻完整過程\n\n外部子代理派發兩次失敗（錯誤訊息留存），切換身分以對抗者立場逐項攻擊計畫方向、驗證設計與邊界涵盖，過程如對抗要點所述。`);
assert.match(run('next', 'release').stderr, /MUST 帶 --self-attack/);

// 8. 充實自攻＋旗標 → 放行且輸出揭露要求
reset();
writeFileSync(join(tmp, 'review-plan-demo-001-full-self.md'), `# 對抗方向檢閱\n身分切換自攻（外部子代理不可用：平台派發失敗）\n${anchors}\n\n## 對抗要點\n\n- 以最嚴厲立場攻擊 AC-01：入口吞掉錯誤時失敗邊界不可觀察，G3 漏列錯誤路徑驗證，屬方向級缺陷。\n- 以最嚴厲立場攻擊驗證設計：實作步驟未指明驗證方式，執行時可跳過驗證，等同假驗收。\n- 以最嚴厲立場攻擊失敗模式：只列邊界漏驗一項，未考慮輸出被截斷的部分結果誤報。\n\n${rebuttal}\n\n## 反向對抗\n\n以對抗者立場重讀複核：兩項駁回引到 G3.md 對應行，出處可查，複核誠實。\n反向對抗判定：成立\n\n## 附錄：自攻完整過程\n\n外部子代理派發兩次失敗（錯誤訊息留存），切換身分以對抗者立場逐項攻擊計畫方向、驗證設計與失敗模式涵蓋，過程如對抗要點所述，並附不可用具體事實。`);
const ok = run('next', 'release', '--self-attack');
assert.equal(ok.status, 0);
assert.match(ok.stdout, /身分切換自攻/);
assert.match(ok.stdout, /醒目揭露/);

// 9. direct 來源閘：老闆指示不得走 direct 豁免；自行發現才可（目前節點=release，--direct 邊合法）
writeFileSync(join(tmp, 'direct-change.md'), 'USER_OBSERVABLE = NO\n理由 = 不改變使用者可觀察行為的微修\n來源 = 老闆指示\n');
assert.match(run('next', 'commit', '--direct').stderr, /老闆發現的意圖不豁免/);
writeFileSync(join(tmp, 'direct-change.md'), 'USER_OBSERVABLE = NO\n理由 = 不改變使用者可觀察行為的微修\n來源 = 自行發現\n');
const direct = run('next', 'commit', '--direct');
assert.equal(direct.status, 0);
assert.match(direct.stdout, /來源為自行發現/);
// 10. direct 矛盾雙宣告即擊：自行發現與老闆指示並存不過
writeFileSync(join(tmp, 'direct-change.md'), 'USER_OBSERVABLE = NO\n理由 = 微修\n來源 = 自行發現\n來源 = 老闆指示\n');
const st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json')));
st.node = 'release';
writeFileSync(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify(st));
assert.match(run('next', 'commit', '--direct').stderr, /唯一|矛盾/);
