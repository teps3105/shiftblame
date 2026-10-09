// sb-rewrite：文件唯一編輯入口的檢查核心——docs/ 結構（非 md 檔、編號兩層、H1 對應、
// 編號連續、索引對帳）＋參照型文件可讀性三判準（重點前置、長度預算、治理暗語）＋
// tmp 快照；提交閘（commitmsg 於 staged 動文件時）與收尾閘（end 於 slug 期間動過文件時）
// 執行同一判準；sb docs 已退役（無殘餘入口）。撰寫規範見 skills/shiftblame/assets/DOCS.md。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-rewrite-chk-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
let serial = 0;
const LEAD = '本節說明現況、適用條件與讀者入口，供離開對話的讀者快速掌握。';
const fixture = ({ withDocs = true } = {}) => {
  const cwd = join(root, String(serial++));
  mkdirSync(cwd, { recursive: true });
  if (withDocs) mkdirSync(join(cwd, 'docs'), { recursive: true });
  return { cwd, docs: join(cwd, 'docs'), run: (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' }) };
};
const write = (p, content) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, content); };
const IDX = (...links) => '# 索引\n\n' + links.map((l) => `- [文件](${l})：說明。\n`).join('');
const doc = (title) => `# ${title}\n\n${LEAD}\n\n內容。\n`;
// 建好一組檔案後斷言失敗且訊息指出對象。
const fail = (files, patterns) => {
  const f = fixture();
  for (const [rel, content] of Object.entries(files)) write(join(f.docs, rel), content);
  const r = f.run('rewrite');
  assert.equal(r.status, 1, '應失敗：' + JSON.stringify(Object.keys(files)) + '\n' + r.stdout + r.stderr);
  for (const p of patterns) assert.match(r.stderr, p);
  return f;
};

// —— 1. 無文件集：檢查不適用，通過；空 docs/ 視為文件集存在，缺索引應失敗 ——
{
  const r = fixture({ withDocs: false }).run('rewrite');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /無 README／docs／\.shiftblame\/SOP／ROADMAP——文件檢查不適用/);
  const empty = fixture().run('rewrite');
  assert.equal(empty.status, 1, 'docs/ 存在即適用檢查');
  assert.match(empty.stderr, /缺少 docs\/索引\.md/);
}

// —— 2. sb docs 已退役：無殘餘入口，落入 usage（exit 2） ——
{
  const r = fixture({ withDocs: false }).run('docs');
  assert.equal(r.status, 2, 'sb docs 退役＝用法錯誤');
}

// —— 3. 良好結構通過：N-大節／N.M-名稱.md＋索引一行一檔＋每份重點前置；tmp 快照落地 ——
{
  const f = fixture();
  write(join(f.docs, '索引.md'), IDX('1-核心/1.1-動機.md', '1-核心/1.2-支柱.md', '2-開發/2.1-架構.md'));
  write(join(f.docs, '1-核心/1.1-動機.md'), doc('1.1 動機'));
  write(join(f.docs, '1-核心/1.2-支柱.md'), doc('1.2 支柱'));
  write(join(f.docs, '2-開發/2.1-架構.md'), doc('架構原則'));
  const r = f.run('rewrite');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /文件檢查通過/);
  const backupRoot = join(f.cwd, '.shiftblame', 'tmp', 'rewrite-backup');
  assert.ok(existsSync(backupRoot), '每次 sb rewrite 快照文件集至 tmp');
  const stamp = readdirSync(backupRoot)[0];
  assert.equal(readFileSync(join(backupRoot, stamp, 'docs', '1-核心', '1.1-動機.md'), 'utf8'), readFileSync(join(f.docs, '1-核心', '1.1-動機.md'), 'utf8'), '快照內容與原檔一致');
}

// —— 4. 重點前置：缺摘要段擋、H1 前置（無 H1）擋、lead-allow 豁免、索引.md 豁免 ——
{
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': '# 1.1 a\n\n## 背景\n\n內容。\n' }, [/1\.1-a\.md——H1 後第一個標題前沒有一段當下摘要/]);
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': '## 沒有 H1\n\n內容。\n' }, [/1\.1-a\.md——缺 H1 標題/]);
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': '# 1.1 a\n\n短。\n' }, [/沒有一段當下摘要/]);
  {
    const f = fixture();
    write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
    write(join(f.docs, '1-核心/1.1-a.md'), '---\nlead-allow: true\n---\n# 1.1 a\n\n## 背景\n\n內容。\n');
    assert.equal(f.run('rewrite').status, 0, 'lead-allow 豁免重點前置');
  }
  // 索引.md 是導航清單，豁免重點前置與暗語
  {
    const f = fixture();
    write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
    write(join(f.docs, '1-核心/1.1-a.md'), doc('1.1 a'));
    assert.equal(f.run('rewrite').status, 0, '索引清單格式不擋');
  }
}

// —— 5. 長度預算：超過 300 可見行擋；length-allow 聲明權威長參照後過 ——
{
  const long = doc('1.1 長文') + Array.from({ length: 400 }, (_, i) => `第 ${i + 1} 條內容。\n`).join(''); // 每行含數值——非零內容散文
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': long }, [/1\.1-a\.md——可見 \d+ 行超過長度預算 300/]);
  {
    const f = fixture();
    write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
    write(join(f.docs, '1-核心/1.1-a.md'), '---\nlength-allow: true\n---\n' + long);
    assert.equal(f.run('rewrite').status, 0, 'length-allow 豁免長度預算');
  }
}

// —— 6. 治理暗語與純散文段：docs/ 內命中擋（逐行指出）、jargon-allow 豁免、圍籬與索引不誤判 ——
{
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': doc('1.1 a') + '\n時點 1 之後才能進計畫。\n' }, [/治理暗語（時點 1／2／3）/]);
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': doc('1.1 a') + '\nG1 契約封存於時點審查。\n' }, [/治理暗語（G 檔治理搭配詞）/]);
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': doc('1.1 a') + '\n提交前跑 sb end 留痕，狀態寫 .shiftblame/flow-state.json。\n' }, [/治理暗語（sb 命令）/]);
  fail({
    '索引.md': IDX('1-核心/1.1-a.md'),
    '1-核心/1.1-a.md': doc('1.1 a') + '\n' + '這一句沒有任何具體內容。' .repeat(5) + '\n',
  }, [/連續 5 句純散文且無任何具體內容/]);
  {
    const f = fixture();
    write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
    write(join(f.docs, '1-核心/1.1-a.md'), '---\njargon-allow: true\n---\n' + doc('1.1 a') + '\n時點 1 之後才能進計畫。\n');
    assert.equal(f.run('rewrite').status, 0, 'jargon-allow 豁免暗語');
  }
  {
    const f = fixture();
    write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
    write(join(f.docs, '1-核心/1.1-a.md'), doc('1.1 a') + '\n```sh\n# 圍籬內的 sb end 與時點 1 是範例文字，不是敘事\n```\n');
    assert.equal(f.run('rewrite').status, 0, '圍籬內容不掃暗語');
  }
}

// —— 6b. 佔位符殘留：模板提示與 TODO 視為未完成（不受文風豁免） ——
{
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': doc('1.1 a') + '\n（填實際環境與服務。）\n' }, [/佔位符殘留/]);
  fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': doc('1.1 a') + '\nTODO：補上驗證指令。\n' }, [/佔位符殘留/]);
}

// —— 7. 根檔 README：形象文件全套三判準（重點前置＋長度＋治理暗語——形象文件不得承載治理與規範職能）＋結構零變化 ——
{
  const f = fixture({ withDocs: false });
  const r1 = (() => { write(join(f.cwd, 'README.md'), '# 專案\n\n安裝：`npm i`。\n'); return f.run('rewrite'); })();
  assert.equal(r1.status, 1);
  assert.match(r1.stderr, /README\.md——H1 後第一個標題前沒有一段當下摘要/);
  // 整檔重寫：補重點前置並重新推導架構（新增節）→ 過
  write(join(f.cwd, 'README.md'), `# 專案\n\n${LEAD}\n\n安裝：\`npm i\`。\n\n## 操作入口\n\n命令與說明。\n`);
  assert.equal(f.run('rewrite').status, 0, '重寫（結構有變）後過');
  // 原樣再跑：標題序列與上一份快照完全相同＝沿舊目錄抄錄 → 擋
  const r3 = f.run('rewrite');
  assert.equal(r3.status, 1);
  assert.match(r3.stderr, /重寫後標題序列與上一份快照完全相同/);
  assert.match(r3.stderr, /小幅修正直接編輯檔案即可/);
  // README 治理暗語擋：形象文件寫成治理／規範文件的機械信號；jargon-allow 豁免可用
  const g = fixture({ withDocs: false });
  write(join(g.cwd, 'README.md'), `# 專案\n\n${LEAD}\n\n## 流程\n\n提交前先跑 sb commitmsg 發章。\n`);
  const r4 = g.run('rewrite');
  assert.equal(r4.status, 1, 'README 暗語擋');
  assert.match(r4.stderr, /README\.md.*治理暗語（sb 命令）/);
  write(join(g.cwd, 'README.md'), `---\njargon-allow: true\n---\n# 專案\n\n${LEAD}\n\n## 發章流程\n\n提交前先跑 sb commitmsg 發章。\n`);
  assert.equal(g.run('rewrite').status, 0, 'jargon-allow 豁免 README 暗語');
}

// —— 7c. README 唯一性：根目錄大小寫變體並存擋（形象文件全專案唯一）——
// 前提是兩個大小寫變體可並存：Windows NTFS 與 macOS APFS 預設不分大小寫，第二個變體會塌進第一個檔。
// 以實際檔案系統探測取代平台判斷：寫入大寫檔名後以小寫查詢存在，查得到＝不敏感＝案例不可建，跳過。
const caseSensitive = (() => {
  const probe = join(root, '.fs-probe-CASECHK');
  writeFileSync(probe, 'x');
  try { return !existsSync(join(root, '.fs-probe-casechk')); }
  finally { rmSync(probe, { force: true }); }
})();
if (caseSensitive) {
  const f = fixture({ withDocs: false });
  write(join(f.cwd, 'README.md'), `# 專案\n\n${LEAD}\n`);
  write(join(f.cwd, 'readme.md'), `# 專案\n\n${LEAD}\n`);
  const r = f.run('rewrite');
  assert.equal(r.status, 1, 'README 變體並存擋');
  assert.match(r.stderr, /README 位置違例：根目錄大小寫變體並存/);
}

// —— 7b. 結構零變化：docs/ 檔案同判準；首次執行無快照不檢查結構變化 ——
{
  const f = fixture();
  write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
  write(join(f.docs, '1-核心/1.1-a.md'), '# 1.1 a\n\n## 背景\n\n內容。\n');
  assert.equal(f.run('rewrite').status, 1, '首次跑因缺 lead 擋（快照建立）');
  write(join(f.docs, '1-核心/1.1-a.md'), `# 1.1 a\n\n${LEAD}\n\n## 背景\n\n內容。\n`); // 補 lead 但結構不變
  const r2 = f.run('rewrite');
  assert.equal(r2.status, 1, '結構零變化即擋');
  assert.match(r2.stderr, /重寫後標題序列與上一份快照完全相同/);
  write(join(f.docs, '1-核心/1.1-a.md'), `# 1.1 a\n\n${LEAD}\n\n## 現況與邊界\n\n內容。\n\n## 背景\n\n內容。\n`); // 重新推導章節
  write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
  assert.equal(f.run('rewrite').status, 0, '結構有變且過三判準 → 過');
}

// —— 8. 結構違例矩陣：每類違例各自失敗並指出條目（可讀性判準同批在跑，不影響定向） ——
fail({ '索引.md': IDX(), '1-核心/note.txt': 'x' }, [/docs\/1-核心\/note\.txt——非 md 檔不得置於 docs\//]);
fail({ '索引.md': IDX(), '雜項/x.md': '# x\n' }, [/docs\/雜項\/——頂層資料夾未編號（應為 N-名稱）/]);
fail({ '備忘.md': '# 備忘\n', '索引.md': IDX() }, [/docs\/備忘\.md——頂層文件未編號/]);
fail({ '索引.md': IDX('1-核心/想法.md'), '1-核心/想法.md': '# 想法\n' }, [/docs\/1-核心\/想法\.md——節內文件未編號/]);
fail({ '索引.md': IDX('1-核心/1.1.1-深.md'), '1-核心/1.1.1-深.md': '# 1.1.1 深\n' }, [/檔名出現三層編號（最多 N\.M）/]);
fail({ '索引.md': IDX('1-核心/1.1-動機.md'), '1-核心/1.1-動機.md': '# 1.1 動機\n\n## 1.1.1 子節\n' }, [/標題出現三層編號（最多 N\.M）/]);
fail({ '索引.md': IDX('1-核心/1.1-動機.md'), '1-核心/1.1-動機.md': '# 6.1 動機\n' }, [/H1 編號 6\.1 與檔名 1\.1 不符/]);
fail({ '索引.md': IDX('1-核心/1.1-a.md', '3-開發/3.1-架構.md'), '1-核心/1.1-a.md': doc('a'), '3-開發/3.1-架構.md': doc('架構') }, [/大節編號不連續：出現 3，缺 2/]);
fail({ '索引.md': IDX('1-核心/1.1-a.md', '1-核心/1.3-b.md'), '1-核心/1.1-a.md': doc('a'), '1-核心/1.3-b.md': doc('b') }, [/文件編號不連續：出現 3，缺 2/]);
fail({ '索引.md': IDX('1-核心/1.1-a.md', '1-核心/1.1-b.md'), '1-核心/1.1-a.md': doc('a'), '1-核心/1.1-b.md': doc('b') }, [/文件編號重複：1/]);
fail({ '索引.md': IDX('1-a/1.1-x.md', '1-b/1.1-y.md'), '1-a/1.1-x.md': doc('x'), '1-b/1.1-y.md': doc('y') }, [/大節編號重複：1-b（1）/]);
fail({ '1-核心/1.1-a.md': doc('a') }, [/缺少 docs\/索引\.md/]);
fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': doc('a'), '1-核心/1.2-b.md': doc('b') }, [/索引未收錄：docs\/1-核心\/1\.2-b\.md/]);
fail({ '索引.md': IDX('1-核心/9.9-x.md'), '1-核心/1.1-a.md': doc('a') }, [/索引連結不存在：1-核心\/9\.9-x\.md/]);
fail({ '索引.md': IDX(), '1-核心/子/x.md': 'x' }, [/大節內不設子資料夾/]);
fail({ '索引.md': IDX('2-開發/1.1-x.md'), '2-開發/1.1-x.md': '# x\n' }, [/檔名編號 1\.1 與大節 2 不符/]);

// —— 9. 圍籬內的井號標題不誤判 ——
{
  const f = fixture();
  write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
  write(join(f.docs, '1-核心/1.1-a.md'), '# 1.1 a\n\n' + LEAD + '\n\n```sh\n# 1.1.1 這是註解示範，不是標題\n```\n');
  assert.equal(f.run('rewrite').status, 0);
}

// —— 10. 提交閘：staged 動到參照型文件時 commitmsg 先過同一判準 ——
{
  const f = fixture();
  write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
  write(join(f.docs, '1-核心/1.1-a.md'), '# 1.1 a\n\n## 背景\n\n內容。\n'); // 缺 lead
  const git = (...args) => spawnSync('git', ['-C', f.cwd, ...args], { encoding: 'utf8' });
  spawnSync('git', ['-C', f.cwd, 'init'], { encoding: 'utf8' });
  git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid');
  git('add', '.');
  // docs 壞 → 文件閘擋發章
  const blocked = f.run('commitmsg', 'docs: 更新文件');
  assert.equal(blocked.status, 1, '文件閘未過不發章：' + blocked.stdout);
  assert.match(blocked.stderr, /文件閘未過/);
  // staged 只動程式碼（文件壞但在工作樹、不在 staged）→ 不觸發文件閘，正常發章
  write(join(f.cwd, 'app.js'), 'console.log(1)\n');
  git('reset'); git('add', 'app.js');
  assert.equal(f.run('commitmsg', 'feat: 程式碼變更').status, 0, 'staged 不含文件不觸發文件閘');
  // 整檔重寫補上 lead → 發章通過
  write(join(f.docs, '1-核心/1.1-a.md'), doc('1.1 a'));
  git('add', 'docs');
  assert.equal(f.run('commitmsg', 'docs: 整檔重寫補重點前置').status, 0);
  // 位置違例：staged 的 SOP.md 任一位置皆擋（權威位置 .shiftblame/ 不入庫）
  write(join(f.cwd, 'SOP.md'), `# 操作規範\n\n${LEAD}\n`);
  git('add', 'SOP.md');
  const misplaced = f.run('commitmsg', 'docs: 加入操作規範');
  assert.equal(misplaced.status, 1, 'staged 根目錄 SOP.md 擋：' + misplaced.stdout);
  assert.match(misplaced.stderr, /位置違例——staged 含 SOP／ROADMAP/);
  write(join(f.docs, 'SOP.md'), `# 操作規範\n\n${LEAD}\n`);
  git('add', 'docs/SOP.md');
  const misplacedDocs = f.run('commitmsg', 'docs: 加入 docs 操作規範');
  assert.equal(misplacedDocs.status, 1, 'staged docs/SOP.md 擋');
  assert.match(misplacedDocs.stderr, /docs\/SOP\.md/);
}

// —— 11. 收尾閘：slug 期間動過文件時，end 前須過同一判準 ——
{
  const f = fixture({ withDocs: false });
  const git = (...args) => spawnSync('git', ['-C', f.cwd, ...args], { encoding: 'utf8' });
  spawnSync('git', ['-C', f.cwd, 'init'], { encoding: 'utf8' });
  git('config', 'user.name', 'test'); git('config', 'user.email', 'test@example.invalid');
  write(join(f.cwd, '.gitignore'), '.shiftblame/\n');
  git('add', '.gitignore'); git('commit', '-m', 'chore: 初始化');
  assert.equal(f.run('init', 'docfix', 'docs').status, 0);
  // slug 期間提交一份壞 docs（缺 lead）——測試內直接 git commit（不經發章）
  write(join(f.cwd, 'README.md'), '# 專案\n\n安裝：`npm i`。\n');
  git('add', '.'); git('commit', '-m', 'docs: 加入 README');
  const stateFile = join(f.cwd, '.shiftblame/flow-state.json');
  const st = JSON.parse(readFileSync(stateFile, 'utf8'));
  st.node = 'verify';
  st.adversarialLog = [{ at: new Date().toISOString(), report: '.shiftblame/tmp/p3.md', verdict: '通過', node: 'verify', point: '2' }];
  writeFileSync(stateFile, JSON.stringify(st));
  const blocked = f.run('end', '--adversarial', '--boss-ok');
  assert.equal(blocked.status, 1, '收尾文件閘未過不歸檔：' + blocked.stdout);
  assert.match(blocked.stderr, /收尾文件閘未過/);
  // 整檔重寫補 lead、提交後收尾通過
  write(join(f.cwd, 'README.md'), `# 專案\n\n${LEAD}\n\n安裝：\`npm i\`。\n`);
  git('add', '.'); git('commit', '-m', 'docs: 整檔重寫');
  assert.equal(f.run('end', '--adversarial', '--boss-ok').status, 0);
}

// —— 12. SOP／ROADMAP 位置違例與 .shiftblame/ 三判準：根目錄／docs/ 皆擋；權威位置 .shiftblame/ 全套判準＋快照 ——
{
  // 根目錄 SOP.md／ROADMAP.md：位置違例
  {
    const f = fixture({ withDocs: false });
    write(join(f.cwd, 'SOP.md'), `# 專案操作規範\n\n${LEAD}\n`);
    write(join(f.cwd, 'ROADMAP.md'), `# 產品方向\n\n${LEAD}\n`);
    const r = f.run('rewrite');
    assert.equal(r.status, 1, '根目錄 SOP／ROADMAP 位置違例擋');
    assert.match(r.stderr, /SOP\.md——位置違例：SOP／ROADMAP 的權威位置是 \.shiftblame\/SOP\.md/);
    assert.match(r.stderr, /ROADMAP\.md——位置違例：SOP／ROADMAP 的權威位置是 \.shiftblame\/ROADMAP\.md/);
  }
  // docs/ 下的 SOP.md：位置違例（不落編號規則的訊息，直接指出權威位置）
  {
    const f = fixture();
    write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
    write(join(f.docs, '1-核心/1.1-a.md'), doc('1.1 a'));
    write(join(f.docs, '1-核心/SOP.md'), `# 操作規範\n\n${LEAD}\n`);
    const r = f.run('rewrite');
    assert.equal(r.status, 1, 'docs/ 內 SOP.md 位置違例擋');
    assert.match(r.stderr, /docs\/1-核心\/SOP\.md——位置違例：SOP／ROADMAP 的權威位置是 \.shiftblame\//);
  }
  // 權威位置 .shiftblame/SOP.md：三判準全套（缺 lead 擋、治理暗語擋）＋過關時納入快照
  {
    const f = fixture({ withDocs: false });
    write(join(f.cwd, '.shiftblame', 'SOP.md'), '# 專案操作規範\n\n## 環境\n\n（填環境。）\n');
    const r1 = f.run('rewrite');
    assert.equal(r1.status, 1, '.shiftblame/SOP.md 缺 lead 擋');
    assert.match(r1.stderr, /\.shiftblame\/SOP\.md——H1 後第一個標題前沒有一段當下摘要/);
    assert.match(r1.stderr, /佔位符殘留/);
    write(join(f.cwd, '.shiftblame', 'SOP.md'), `# 專案操作規範\n\n${LEAD}\n\n## 發章\n\n提交前跑 sb commitmsg 發章。\n`);
    const r2 = f.run('rewrite');
    assert.equal(r2.status, 1, '.shiftblame/SOP.md 治理暗語擋');
    assert.match(r2.stderr, /\.shiftblame\/SOP\.md.*治理暗語（sb 命令）/);
    write(join(f.cwd, '.shiftblame', 'SOP.md'), `# 專案操作規範\n\n${LEAD}\n\n## 發章與撤章\n\n提交前以提交印章發章。\n`);
    assert.equal(f.run('rewrite').status, 0, '.shiftblame/SOP.md 過三判準（無 docs 無 README 亦適用）');
    const backupRoot = join(f.cwd, '.shiftblame', 'tmp', 'rewrite-backup');
    const stamp = readdirSync(backupRoot)[0];
    assert.ok(existsSync(join(backupRoot, stamp, '.shiftblame', 'SOP.md')), '.shiftblame/SOP.md 納入快照');
  }
}

console.log('sb-rewrite: 全部場景通過');
