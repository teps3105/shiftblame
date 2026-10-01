// sb-docs：docs/ 結構檢查——非 md 檔不得入 docs/、除索引.md 外全編號（頂層 N-大節／文件、
// 節內 N.M-文件）、層級最多 N.M（檔名與標題）、H1 帶號須與檔名一致、編號連續、索引對帳；
// 無 docs/ 時檢查不適用。撰寫規範見 skills/shiftblame/assets/DOCS.md。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/sb.mjs', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'sb-docs-chk-'));
process.on('exit', () => rmSync(root, { recursive: true, force: true }));
let serial = 0;
const fixture = ({ withDocs = true } = {}) => {
  const cwd = join(root, String(serial++));
  mkdirSync(cwd, { recursive: true });
  if (withDocs) mkdirSync(join(cwd, 'docs'), { recursive: true });
  return { cwd, docs: join(cwd, 'docs'), run: () => spawnSync(process.execPath, [cli, 'docs'], { cwd, encoding: 'utf8' }) };
};
const write = (p, content) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, content); };
const IDX = (...links) => '# 索引\n\n' + links.map((l) => `- [文件](${l})：說明。\n`).join('');
// 建好一組檔案後斷言失敗且訊息指出對象。
const fail = (files, patterns) => {
  const f = fixture();
  for (const [rel, content] of Object.entries(files)) write(join(f.docs, rel), content);
  const r = f.run();
  assert.equal(r.status, 1, '應失敗：' + JSON.stringify(Object.keys(files)) + '\n' + r.stdout);
  for (const p of patterns) assert.match(r.stderr, p);
  return f;
};

// —— 1. 無 docs/：檢查不適用，通過；空 docs/ 視為文件集存在，缺索引應失敗 ——
{
  const r = fixture({ withDocs: false }).run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /無 docs\/——文件結構檢查不適用/);
  const empty = fixture().run();
  assert.equal(empty.status, 1, 'docs/ 存在即適用檢查');
  assert.match(empty.stderr, /缺少 docs\/索引\.md/);
}

// —— 2. 良好結構通過：N-大節／N.M-名稱.md＋索引一行一檔；H1 可不帶號 ——
{
  const f = fixture();
  write(join(f.docs, '索引.md'), '# 專案索引\n\n## 1-核心\n\n- [1.1 動機](1-核心/1.1-動機.md)：為什麼做。\n- [1.2 支柱](1-核心/1.2-支柱.md)：四根支柱。\n\n## 2-開發\n\n- [2.1 架構](2-開發/2.1-架構.md)：每幀路徑。\n');
  write(join(f.docs, '1-核心/1.1-動機.md'), '# 1.1 動機\n\n內容。\n');
  write(join(f.docs, '1-核心/1.2-支柱.md'), '# 1.2 支柱\n\n內容。\n');
  write(join(f.docs, '2-開發/2.1-架構.md'), '# 架構原則\n\n內容。\n');
  const r = f.run();
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /結構檢查通過：2 個大節、3 份文件/);
}

// —— 3. 違例矩陣：每類違例各自失敗並指出條目 ——
fail({ '索引.md': IDX(), '1-核心/note.txt': 'x' }, [/docs\/1-核心\/note\.txt——非 md 檔不得置於 docs\//]);
fail({ '索引.md': IDX(), '雜項/x.md': '# x\n' }, [/docs\/雜項\/——頂層資料夾未編號（應為 N-名稱）/]);
fail({ '備忘.md': '# 備忘\n', '索引.md': IDX() }, [/docs\/備忘\.md——頂層文件未編號/]);
fail({ '索引.md': IDX(), '1-核心/想法.md': '# 想法\n' }, [/docs\/1-核心\/想法\.md——節內文件未編號/]);
fail({ '索引.md': IDX(), '1-核心/1.1.1-深.md': '# 1.1.1 深\n' }, [/檔名出現三層編號（最多 N\.M）/]);
fail({ '索引.md': IDX('1-核心/1.1-動機.md'), '1-核心/1.1-動機.md': '# 1.1 動機\n\n## 1.1.1 子節\n' }, [/標題出現三層編號（最多 N\.M）/]);
fail({ '索引.md': IDX('1-核心/1.1-動機.md'), '1-核心/1.1-動機.md': '# 6.1 動機\n' }, [/H1 編號 6\.1 與檔名 1\.1 不符/]);
fail({ '索引.md': IDX('1-核心/1.1-動機.md', '3-開發/3.1-架構.md'), '1-核心/1.1-動機.md': '# 動機\n', '3-開發/3.1-架構.md': '# 架構\n' }, [/大節編號不連續：出現 3，缺 2/]);
fail({ '索引.md': IDX('1-核心/1.1-a.md', '1-核心/1.3-b.md'), '1-核心/1.1-a.md': '# a\n', '1-核心/1.3-b.md': '# b\n' }, [/文件編號不連續：出現 3，缺 2/]);
fail({ '索引.md': IDX('1-核心/1.1-a.md', '1-核心/1.1-b.md'), '1-核心/1.1-a.md': '# a\n', '1-核心/1.1-b.md': '# b\n' }, [/文件編號重複：1/]);
fail({ '索引.md': IDX('1-a/1.1-x.md', '1-b/1.1-y.md'), '1-a/1.1-x.md': '# x\n', '1-b/1.1-y.md': '# y\n' }, [/大節編號重複：1-b（1）/]);
fail({ '1-核心/1.1-a.md': '# a\n' }, [/缺少 docs\/索引\.md/]);
fail({ '索引.md': IDX('1-核心/1.1-a.md'), '1-核心/1.1-a.md': '# a\n', '1-核心/1.2-b.md': '# b\n' }, [/索引未收錄：docs\/1-核心\/1\.2-b\.md/]);
fail({ '索引.md': IDX('1-核心/9.9-x.md'), '1-核心/1.1-a.md': '# a\n' }, [/索引連結不存在：1-核心\/9\.9-x\.md/]);
fail({ '索引.md': IDX(), '1-核心/子/x.md': 'x' }, [/大節內不設子資料夾/]);
fail({ '索引.md': IDX('2-開發/1.1-x.md'), '2-開發/1.1-x.md': '# x\n' }, [/檔名編號 1\.1 與大節 2 不符/]);

// —— 4. 圍籬內的井號標題不誤判：程式碼區塊示範三層編號不觸發 ——
{
  const f = fixture();
  write(join(f.docs, '索引.md'), IDX('1-核心/1.1-a.md'));
  write(join(f.docs, '1-核心/1.1-a.md'), '# 1.1 a\n\n```sh\n# 1.1.1 這是註解示範，不是標題\n```\n');
  const r = f.run();
  assert.equal(r.status, 0, r.stderr + r.stdout);
}

console.log('sb-docs: 全部場景通過');
