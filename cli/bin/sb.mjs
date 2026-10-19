#!/usr/bin/env node
// sb — Shiftblame 的提交訊息、文件與交接檢查。
// 在專案根以 git 事實與正式文件核對提交前提；語義與真實驗收由對話及行為證據承載。
// 使用 Node 內建模組；工作記錄存於 <repo>/.shiftblame/tmp/。
// exit：0 = 通過，1 = 條件不符，2 = 用法錯誤。

import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { commitMessageIssue } from './commit-format.mjs';
import { runHandoff } from './handoff.mjs';
import { findRoot } from './project-root.mjs';

// 專案根錨定：從執行目錄向上找 .git／既有 .shiftblame（子目錄執行時錨定到正確工作區；磁碟根與系統頂層目錄不作錨點）
// （相對路徑展開到錯誤資料夾是破壞與污染的共同來源；所有狀態路徑一律錨定絕對根）
const ROOT = findRoot(process.cwd());
const SB_DIR = join(ROOT, '.shiftblame');
const TMP = join(SB_DIR, 'tmp');

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };
const fin = (msgs) => { console.log('pass'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log']([
    'sb — Shiftblame 提交、文件與交接檢查',
    '',
    '用法：',
    '  sb state                              顯示專案根、工作區與交接入口',
    '  sb commitmsg "<訊息>"                 檢查「type: 一句話」格式與內容、staged 系統檔，發提交章',
    '                                        （內容須自含白話：內部文件、任務代號、壓縮術語、流程詞彙擋下，版本號不在此限；',
    '                                        staged 動到參照型文件 README／docs/ 時須先過文件閘；staged 的 SOP／ROADMAP 任一位置皆違例——權威位置 .shiftblame/）',
    '  sb rewrite                            文件編輯唯一入口：快照文件集至 tmp 後檢查',
    '                                        （位置違例＋docs/ 結構＋README／docs／.shiftblame/SOP／ROADMAP 可讀性判準）',
    '  sb handoff save <task> <notes.md>     保存具名工作的機械快照',
    '  sb handoff list                       列出具名工作及損壞診斷',
    '  sb handoff show <task>                讀取指定交接並核對目前差異',
    '  sb --help',
  ].join('\n'));
  process.exit(code);
};

// 前處理：以「遮罩」呈現渲染後可見文字——HTML 註解與圍籬（行首 ```／~~~，含未閉合與
// ```` 包 ``` 錯配）以空白替換但保留行列位置：行中註解後的 `##` 不會位移成行首標題、
// 未閉合結構到檔尾一律隱藏。閘門判斷以使用者看得到的文字為準。
const visibleText = (text) => {
  const src = text.replace(/\r\n?/g, '\n').split('\n'); // CRLF 正規化——Windows 產檔日常
  const out = [];
  let fence = null; // { ch: '`' | '~', len } 開籬後狀態
  let inComment = false;
  for (const line of src) {
    if (fence) {
      // 閉合籬：標記後僅允許半形空白/tab 到行尾（CommonMark §4.5）；其餘一律是籬內容
      const closeM = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/);
      if (closeM && closeM[1][0] === fence.ch && closeM[1].length >= fence.len) {
        fence = null;
        out.push(' '.repeat(line.length));
      } else {
        out.push(' '.repeat(line.length));
      }
      continue;
    }
    if (inComment) {
      const close = line.indexOf('-->');
      if (close < 0) { out.push(' '.repeat(line.length)); continue; }
      out.push(' '.repeat(close + 3) + line.slice(close + 3));
      inComment = false;
      continue;
    }
    // 開籬：行首（僅半形空白/tab）三個以上反引號或波浪號；info string 允許
    const open = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (open) { fence = { ch: open[1][0], len: open[1].length }; out.push(' '.repeat(line.length)); continue; }
    let res = '';
    let rest = line;
    for (;;) {
      const c = rest.indexOf('<!--');
      if (c < 0) { res += rest; break; }
      res += rest.slice(0, c) + ' '.repeat(4);
      rest = rest.slice(c + 4);
      const close = rest.indexOf('-->');
      if (close < 0) { res += ' '.repeat(rest.length); inComment = true; break; }
      res += ' '.repeat(close + 3);
      rest = rest.slice(close + 3);
    }
    out.push(res);
  }
  return out.join('\n');
};


function hasGitMetadata() {
  // .git 可為 worktree 的檔案；既有 .shiftblame 根也可能位於 Git 子目錄。
  let dir = ROOT, inGit = false;
  for (;;) {
    if (existsSync(join(dir, '.git'))) { inGit = true; break; }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return inGit;
}

// —— 參照型文件可讀性信號（形象 README／專案 docs/／規範 SOP／路線 ROADMAP）——
// 治理文件的累積式寫法（定義區、封存、回指）外溢到參照型文件會長成流水帳：
// 開頭無當下摘要、以補丁追加變更、治理暗語混入。三個機械判準由 sb rewrite 與
// 提交閘執行同一套判準，逼出整檔重寫而非追加；豁免以 frontmatter 明示
// （lead-allow／length-allow／jargon-allow）。
// 文件分型與權威位置：形象文件 README＝根目錄全專案唯一（子專案的 README 不在根目錄）；專案文件＝docs/；
// 規範文件 SOP 與路線文件 ROADMAP＝.shiftblame/ 下——根目錄或 docs/ 出現
// SOP.md／ROADMAP.md 即位置違例（正確位置的檔案才有資格被檢查）。
const DOC_ROOT_FILES = ['README.md'];
const SB_REF_DOCS = ['SOP.md', 'ROADMAP.md']; // 規範／路線文件：權威位置 .shiftblame/
const DOC_LEAD_MIN_HAN = 20; // 重點前置：H1 後摘要段的最少中文字數
const DOC_LEAD_MIN_WORDS = 15; // 或最少英文詞數（中英混排任一達標即過）
const DOC_LENGTH_BUDGET = 300; // 長度預算：可見行數上限，超過須 length-allow 聲明權威長參照
const DOC_PROSE_SENTENCE_MIN = 5; // 純散文段：連續達此句數且零具體內容即為黑話宿主
const JARGON = [
  ['時點 1／2／3', /時點\s*[1-3]/],
  ['G 檔治理搭配詞', /\bG[1-3]\s*(?:契約|檔|定義區|封存|回指|審查)|\bG\s*檔\b/],
  ['sb 命令', /\bsb\s+(?:init|next|end|rewrite|commitmsg|sopreview|closeout|adversarial|handoff)\b/],
  ['.shiftblame 路徑', /\.shiftblame\//i],
  ['流程術語', /回指記錄|定義區|六段圓環|三時點|時點審查/],
];
const isDocPath = (p) => { const pl = String(p).trim().toLowerCase(); return DOC_ROOT_FILES.some((f) => f.toLowerCase() === pl) || pl.startsWith('docs/'); };
function docFlags(text) {
  const flags = {};
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return flags;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][A-Za-z-]*)\s*:\s*(.*?)\s*$/);
    if (kv) flags[kv[1].toLowerCase()] = kv[2];
  }
  return flags;
}
function leadProblem(lines) {
  const h1 = lines.findIndex((l) => /^#\s/.test(l));
  if (h1 < 0) return '缺 H1 標題——文件以可讀標題為入口';
  const prose = [];
  for (let i = h1 + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^#{1,6}\s/.test(t)) break; // 第一個後續標題＝摘要區結束
    if (/^\[!\[/.test(t) || /^</.test(t) || /^>/.test(t) || /^\|/.test(t)) continue; // 徽章／HTML／引用／表格
    if (/^[-*+]\s/.test(t) || /^\d+[.)]\s/.test(t)) continue; // 清單
    if (/^\[[^\]]*\]\([^)]*\)$/.test(t)) continue; // 單行純連結
    prose.push(t);
  }
  const joined = prose.join('');
  const han = (joined.match(/\p{Script=Han}/gu) ?? []).length;
  const words = (joined.toLowerCase().match(/[a-z][a-z0-9'-]*/g) ?? []).length;
  if (han < DOC_LEAD_MIN_HAN && words < DOC_LEAD_MIN_WORDS) return `H1 後第一個標題前沒有一段當下摘要（至少 ${DOC_LEAD_MIN_HAN} 個中文字或 ${DOC_LEAD_MIN_WORDS} 個英文詞）——以 sb rewrite 整檔重寫，開頭即現況、用途與入口`;
  return null;
}

// sb rewrite——文件編輯的唯一入口：備份文件集至 tmp 後跑位置違例＋結構＋可讀性判準，代理依報告
// 整檔重寫至 pass。檢查核心 docsFindings 為唯讀，由本命令與提交閘（cmdCommitmsg）
// 共用同一判準。結構檢查（docs/ 文件集）：非 md 檔不得入 docs/；
// 除索引.md 外全編號（頂層 N-大節／文件、節內 N.M-文件）；編號最多兩層（N.M，檔名與
// 標題皆不出現 N.M.K）；H1 帶與檔名一致的編號；大節與節內編號連續；索引.md 對帳。
function docsFindings() {
  const bad = [];
  const docsDir = join(ROOT, 'docs');
  const mdFiles = [];
  const folderNames = [];
  const rootNums = [];
  const seqByFolder = new Map();
  if (existsSync(docsDir)) {
    const walk = (dir, rel) => {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { bad.push(`docs/${rel}——無法讀取`); return; }
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (rel !== '') { bad.push(`docs/${r}/——大節內不設子資料夾（結構最多兩層：N-大節／N.M-文件）`); continue; }
          const m = e.name.match(/^(\d+)-(.+)/);
          if (!m) { bad.push(`docs/${r}/——頂層資料夾未編號（應為 N-名稱）`); continue; }
          folderNames.push({ num: Number(m[1]), name: e.name });
          walk(join(dir, e.name), r);
        } else if (!/\.md$/i.test(e.name)) {
          bad.push(`docs/${r}——非 md 檔不得置於 docs/`);
        } else if (SB_REF_DOCS.some((n) => n.toLowerCase() === e.name.toLowerCase())) {
          bad.push(`docs/${r}——位置違例：SOP／ROADMAP 的權威位置是 .shiftblame/（規範／路線文件不進 docs/；搬移內容後刪除本檔）`);
        } else if (rel === '' && e.name === '索引.md') {
          mdFiles.push(r);
        } else if (rel === '') {
          const m = e.name.match(/^(\d+)-.+/);
          if (!m) { bad.push(`docs/${r}——頂層文件未編號（應為 N-名稱.md，或移入 N-大節/）`); continue; }
          rootNums.push(Number(m[1]));
          mdFiles.push(r);
        } else {
          const folderNum = rel.match(/^(\d+)-/)[1];
          if (/^\d+\.\d+\.\d+-/.test(e.name)) { bad.push(`docs/${r}——檔名出現三層編號（最多 N.M）`); continue; }
          const m = e.name.match(/^(\d+)\.(\d+)-(.+)\.md$/i);
          if (!m) { bad.push(`docs/${r}——節內文件未編號（應為 ${folderNum}.M-名稱.md）`); continue; }
          if (m[1] !== folderNum) bad.push(`docs/${r}——檔名編號 ${m[1]}.${m[2]} 與大節 ${folderNum} 不符`);
          if (!seqByFolder.has(rel)) seqByFolder.set(rel, []);
          seqByFolder.get(rel).push(Number(m[2]));
          mdFiles.push(r);
        }
      }
    };
    walk(docsDir, '');
    const topNums = [...new Set([...folderNames.map((f) => f.num), ...rootNums])].sort((a, b) => a - b);
    topNums.forEach((n, i) => { if (n !== i + 1) bad.push(`大節編號不連續：出現 ${n}，缺 ${i + 1}——插入或移除大節後應全域重排`); });
    const dupFolders = folderNames.filter((f, i) => folderNames.findIndex((o) => o.num === f.num) !== i);
    for (const f of new Map(dupFolders.map((f) => [f.num, f])).values()) bad.push(`大節編號重複：${f.name}（${f.num}）——一個號一個大節`);
    for (const [dir, seqs] of seqByFolder) {
      const sorted = [...new Set(seqs)].sort((a, b) => a - b);
      sorted.forEach((n, i) => { if (n !== i + 1) bad.push(`docs/${dir}——文件編號不連續：出現 ${n}，缺 ${i + 1}——插入或移除文件後應重排`); });
      const dup = seqs.find((n, i) => seqs.indexOf(n) !== i);
      if (dup !== undefined) bad.push(`docs/${dir}——文件編號重複：${dup}——一個號一份文件`);
    }
    for (const f of mdFiles) {
      const seg = f.split('/').pop();
      const fm = seg.match(/^(\d+)\.(\d+)-/);
      if (!fm) continue; // 頂層 N- 檔不做 H1 編號對應
      let content;
      try { content = readFileSync(join(docsDir, f), 'utf8'); } catch { continue; }
      const lines = visibleText(content).split(/\r?\n/);
      lines.forEach((l, i) => { if (/^\s*#{1,6}\s+\d+\.\d+\.\d+/.test(l)) bad.push(`docs/${f} 第 ${i + 1} 行——標題出現三層編號（最多 N.M）`); });
      const want = `${fm[1]}.${fm[2]}`;
      const h1 = lines.find((l) => /^#\s/.test(l));
      if (!h1) continue;
      // H1 不強制帶號；一旦以編號開頭，就必須與檔名一致（抓複製貼上的漂移，如檔名 5.1 標題 6.1）。
      const hm = h1.match(/^#\s+(\d+(?:\.\d+)?)/);
      if (hm && hm[1] !== want) bad.push(`docs/${f}——H1 編號 ${hm[1]} 與檔名 ${want} 不符`);
    }
    if (!existsSync(join(docsDir, '索引.md'))) bad.push('缺少 docs/索引.md——文件集以索引為入口');
    else {
      const idx = readFileSync(join(docsDir, '索引.md'), 'utf8');
      const targets = new Set();
      for (const m of idx.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        let t = m[1].trim();
        if (/^(https?:)?\/\//.test(t) || t.startsWith('#') || t.startsWith('mailto:')) continue;
        t = t.split('#')[0];
        if (!t) continue;
        let decoded = t;
        try { decoded = decodeURIComponent(t); } catch { /* 非法編碼保留原樣 */ }
        targets.add(decoded.replace(/^\.\//, ''));
        if (!existsSync(join(docsDir, decoded))) bad.push(`索引連結不存在：${t}`);
      }
      for (const f of mdFiles) if (f !== '索引.md' && !targets.has(f)) bad.push(`索引未收錄：docs/${f}`);
    }
  }
  // —— 可讀性三判準：docs/ 每份 md（索引.md 豁免重點前置與暗語）＋根檔 README＋.shiftblame/SOP／ROADMAP ——
  // 全套 lead／length／jargon（豁免走 frontmatter）；README 查暗語＝形象文件不得承載治理與規範職能的機械面。
  const auditFile = (label, abs, { lead = true, jargon = false } = {}) => {
    let text;
    try { text = readFileSync(abs, 'utf8'); } catch { return; }
    const flags = docFlags(text);
    const lines = visibleText(text).split('\n');
    if (lead && flags['lead-allow'] !== 'true') {
      const p = leadProblem(lines);
      if (p) bad.push(`${label}——${p}`);
    }
    if (flags['length-allow'] !== 'true' && lines.length > DOC_LENGTH_BUDGET) {
      bad.push(`${label}——可見 ${lines.length} 行超過長度預算 ${DOC_LENGTH_BUDGET}：同構合併或拆分；權威長參照以 frontmatter length-allow: true 聲明`);
    }
    if (jargon && flags['jargon-allow'] !== 'true') {
      lines.forEach((l, i) => {
        for (const [name, re] of JARGON) {
          if (re.test(l)) { bad.push(`${label} 第 ${i + 1} 行——治理暗語（${name}）：${l.trim().slice(0, 60)}`); break; }
        }
      });
      // 純散文段：連續 ≥5 句且零具體內容（命令、路徑、數值）＝黑話的宿主結構。
      // 腔調不靠詞表——在結構上要求敘事掛得住具體內容，寫不出具體值的段落依「當下自洽」改欄位或刪除。
      for (const [start, joined] of proseParagraphs(lines)) {
        const sents = joined.split(/[。！？!?]+/).filter((s) => s.trim());
        if (sents.length >= DOC_PROSE_SENTENCE_MIN && !/[`\d]|[/\\]|\.(?:md|json|ts|js|mjs|py|sh|toml|ya?ml)/.test(joined)) {
          bad.push(`${label} 第 ${start + 1} 行起——連續 ${sents.length} 句純散文且無任何具體內容（命令、路徑、數值）：追問這段的命令、觸發條件與預期結果，填不出的內容刪除或移 tmp`);
          break; // 每檔報第一處，重寫後自然暴露下一處
        }
      }
    }
    // 佔位符殘留＝文件未完成（模板提示、TODO、待補）——完成度獨立於文風，不受文風豁免
    lines.forEach((l, i) => {
      if (/（填|（待填|（待實|TODO[:：）]|待補[:：）]/.test(l)) bad.push(`${label} 第 ${i + 1} 行——佔位符殘留（文件未完成）：${l.trim().slice(0, 40)}`);
    });
  };
  for (const f of mdFiles) {
    const isIndex = f === '索引.md';
    auditFile(`docs/${f}`, join(docsDir, f), { lead: !isIndex, jargon: !isIndex });
  }
  for (const name of SB_REF_DOCS) {
    const sbPath = join(SB_DIR, name);
    if (existsSync(sbPath)) auditFile(`.shiftblame/${name}`, sbPath, { lead: true, jargon: true });
  }
  const rootEntries = (() => { try { return readdirSync(ROOT); } catch { return []; } })();
  const readmes = rootEntries.filter((e) => /^readme\.md$/i.test(e));
  if (readmes.length > 1) bad.push(`README 位置違例：根目錄大小寫變體並存（${readmes.join('、')}）——形象文件全專案唯一（子專案的 README 不在根目錄）`);
  for (const name of SB_REF_DOCS) {
    const misplaced = rootEntries.find((e) => e.toLowerCase() === name.toLowerCase());
    if (misplaced) bad.push(`${misplaced}——位置違例：SOP／ROADMAP 的權威位置是 .shiftblame/${name}（規範／路線文件不住根目錄；搬移內容後刪除本檔，.shiftblame/ 不入庫）`);
  }
  for (const name of DOC_ROOT_FILES) {
    const actual = rootEntries.find((e) => e.toLowerCase() === name.toLowerCase());
    if (actual) auditFile(actual, join(ROOT, actual), { lead: true, jargon: true });
  }
  return bad;
}
function cmdRewrite() {
  // 機械起點：文件集原稿快照至 tmp（rewrite-backup/<時間戳>/），重寫自快照後整檔從零撰寫，
  // 不在原檔上補丁；歷史由 git 承載，tmp 快照供重寫時對照需要保留的契約與證據。
  // 結構零變化檢查：與上一份快照比對標題序列——完全相同＝沿舊目錄逐節翻寫（抄錄）。
  // sb rewrite 的語義是架構必變的整檔重寫；小幅修正直接編輯檔案（提交閘驗三判準）。
  const docsDir = join(ROOT, 'docs');
  const rootEntries = (() => { try { return readdirSync(ROOT); } catch { return []; } })();
  const roots = DOC_ROOT_FILES.map((name) => rootEntries.find((e) => e.toLowerCase() === name.toLowerCase())).filter(Boolean);
  const sbDocs = SB_REF_DOCS.filter((name) => existsSync(join(SB_DIR, name)));
  const misplacedRoots = SB_REF_DOCS.filter((name) => rootEntries.some((e) => e.toLowerCase() === name.toLowerCase()));
  const hasDocs = existsSync(docsDir);
  // 位置違例（根目錄的 SOP／ROADMAP）不構成「無文件集」——即使其餘全空也要進檢查報違例。
  if (!hasDocs && !roots.length && !sbDocs.length && !misplacedRoots.length) fin(['無 README／docs／.shiftblame/SOP／ROADMAP——文件檢查不適用（文件集建立後 sb rewrite 為唯一編輯入口）']);
  const backupRoot = join(TMP, 'rewrite-backup');
  const rels = listDocRels(docsDir, hasDocs).concat(sbDocs.map((name) => `.shiftblame/${name}`));
  // 上一份快照＝結構比對基準；本命令新建立的快照不參與（重寫確認輪的基準是重寫前的版本）。
  let prev = null;
  try {
    const stamps = readdirSync(backupRoot).filter((d) => /^\d{4}-/.test(d)).sort();
    if (stamps.length) prev = join(backupRoot, stamps[stamps.length - 1]);
  } catch { /* 無既有快照——首次執行不檢查結構變化 */ }
  const stale = [];
  if (prev) {
    for (const rel of rels) {
      const curAbs = join(ROOT, rel);
      const oldAbs = join(prev, rel);
      if (!existsSync(oldAbs) || !existsSync(curAbs)) continue;
      let curText, oldText;
      try { curText = readFileSync(curAbs, 'utf8'); oldText = readFileSync(oldAbs, 'utf8'); } catch { continue; }
      const seq = headingSeq(curText);
      if (seq.length && seq === headingSeq(oldText)) stale.push(rel);
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(backupRoot, stamp);
  mkdirSync(backupDir, { recursive: true });
  if (hasDocs) cpSync(docsDir, join(backupDir, 'docs'), { recursive: true });
  for (const name of roots) cpSync(join(ROOT, name), join(backupDir, name));
  for (const name of sbDocs) {
    mkdirSync(join(backupDir, '.shiftblame'), { recursive: true });
    cpSync(join(SB_DIR, name), join(backupDir, '.shiftblame', name));
  }
  const bad = docsFindings();
  for (const rel of stale) bad.push(`${rel}——重寫後標題序列與上一份快照完全相同：沿舊目錄逐節翻寫是抄錄——先從讀者任務重新推導章節再落筆；小幅修正直接編輯檔案即可（不走 sb rewrite）`);
  if (bad.length) die([
    `文件檢查未通過（${bad.length} 項）——依 rewrite 整檔重寫至 pass（原稿快照：${backupDir}）`,
    ...bad,
  ]);
  fin([
    `文件檢查通過${prev ? '（結構相對上一份快照有變化）' : '（首次執行——下一輪起比對結構變化）'}${hasDocs ? `：docs/ ${folderCount(docsDir)} 節、${mdCount(docsDir)} 份` : ''}${roots.length ? `；根檔：${roots.join('、')}` : ''}${sbDocs.length ? `；.shiftblame/：${sbDocs.join('、')}` : ''}`,
    `原稿快照：${backupDir}`,
    '參照型文件以整檔重寫維護——不在原檔上補丁；提交閘執行同一判準',
  ]);
}
function listDocRels(docsDir, hasDocs) {
  // 回傳 ROOT 相對路徑（docs/ 前綴＋根檔名）——快照佈局與 ROOT 佈局同構，直接 join 比對
  const rels = [];
  if (hasDocs) {
    const walk = (dir, rel) => {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(join(dir, e.name), r);
        else if (/\.md$/i.test(e.name) && r !== '索引.md') rels.push(`docs/${r}`);
      }
    };
    walk(docsDir, '');
  }
  const rootEntries = (() => { try { return readdirSync(ROOT); } catch { return []; } })();
  for (const name of DOC_ROOT_FILES) {
    const actual = rootEntries.find((e) => e.toLowerCase() === name.toLowerCase());
    if (actual) rels.push(actual);
  }
  return rels;
}
function proseParagraphs(lines) {
  // 敘事段落（排除標題、清單、表格、引用）；回傳 [起始行號, 拼接文字]
  const out = [];
  let cur = [], start = 0;
  const flush = () => { if (cur.length) { out.push([start, cur.join('')]); cur = []; } };
  lines.forEach((l, i) => {
    const t = l.trim();
    const isProse = t && !/^#{1,6}\s/.test(t) && !/^[-*+]\s/.test(t) && !/^\d+[.)]\s/.test(t) && !/^>/.test(t) && !/^\|/.test(t);
    if (isProse) { if (!cur.length) start = i; cur.push(t); } else flush();
  });
  flush();
  return out;
}
function headingSeq(text) {
  const src = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ''); // 去 frontmatter——豁免旗標不屬於結構
  return visibleText(src).split('\n').map((l) => l.trim()).filter((l) => /^#{1,6}\s/.test(l)).join('\n');
}
function folderCount(dir) {
  try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length; } catch { return 0; }
}
function mdCount(dir) {
  try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && /\.md$/i.test(e.name)).length; } catch { return 0; }
}

function cmdState() {
  out(`專案根：${ROOT}`);
  out(`工作區：${existsSync(SB_DIR) ? `${SB_DIR}（不入庫）` : '尚未建立（有對話代號的工作階段會自動建立）'}`);
  out('直接作業交接：sb handoff list；選定具名工作後以 sb handoff show <task> 讀取，不自動載入。');
}

function cmdCommitmsg(msg) {
  if (!msg) usage();
  // 提交核對訊息與 staged 系統檔；hooks 消費綁定 repo、訊息與時效的印章。
  // 發章：hooks PreToolUse 對 git commit 硬擋的憑證——10 分鐘內、訊息相符才放行。
  // 發章前 staged 同檢（與 hooks 同判據——雙層一致）：讀 git 展開的事實清單（cwd=ROOT 錨定），
  // 判系統檔 .shiftblame/（傾倒區唯一）。
  // quotePath=false 防引號逃逸＋--diff-filter 排除純刪除——清理通道放行；非 git 工作區跳過
  try {
    const staged = execSync('git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMRTUB', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean);
    const sys = staged.filter((p) => /^\.shiftblame(?:\/|$)/i.test(p));
    if (sys.length) die([`系統檔不入庫——staged 含 ${sys.slice(0, 5).join('、')}${sys.length > 5 ? ` 等 ${sys.length} 檔` : ''}（.shiftblame/ 須列入 .gitignore；先 git restore --staged 移除再發章）`]);
    // 位置違例：SOP／ROADMAP 的權威位置是 .shiftblame/（不入庫）——任何位置的 staged 同名檔
    // 都是把違例位置合法化，直接擋下；規範／路線內容搬 .shiftblame/ 後 restore --staged 移除。
    const misplacedDocs = staged.filter((p) => SB_REF_DOCS.some((n) => n.toLowerCase() === p.split('/').pop().toLowerCase()));
    if (misplacedDocs.length) die([`位置違例——staged 含 SOP／ROADMAP（權威位置 .shiftblame/，不入庫）：${misplacedDocs.slice(0, 5).join('、')}${misplacedDocs.length > 5 ? ` 等 ${misplacedDocs.length} 檔` : ''}——規範／路線內容搬 .shiftblame/ 後 git restore --staged 移除再發章；撞名的專案文件請改名`]);
    // 文件閘：staged 動到參照型文件（根 README／docs/）時，文件集須先過 sb rewrite 判準——
    // 整檔重寫而非補丁的機械承載。hooks 對無章提交硬擋，本閘因此覆蓋所有動文件的提交。
    const docHits = staged.filter(isDocPath);
    if (docHits.length) {
      const bad = docsFindings();
      if (bad.length) die([
        `文件閘未過（staged 動到參照型文件：${docHits.slice(0, 5).join('、')}${docHits.length > 5 ? ` 等 ${docHits.length} 檔` : ''}）——先以 sb rewrite 整檔重寫至 pass 再發章：`,
        ...bad,
      ]);
    }
  } catch { /* 非 git 工作區：無事實清單可查，跳過（hooks 層照常把關） */ }
  // 格式「type: 一句話」：與 hooks 提交閘同一判準（commit-format.mjs）——無 type、冒號後無空格、段落式長文都在此擋下
  const issue = commitMessageIssue(msg);
  if (issue) die([issue]);
  // 印章：hooks PreToolUse 對 git commit 硬擋的憑證（10 分鐘內、訊息相符才放行）——commitmsg 格式閘的機械承載
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, 'commit-stamp.json'), JSON.stringify({ message: msg, cwd: ROOT, issuedAt: new Date().toISOString() }, null, 2));
  fin([`提交訊息合格：${msg}`, `印章已寫入 ${join(TMP, 'commit-stamp.json')}——10 分鐘內以相同訊息 git commit -m 可過 hooks 硬擋`]);
}

// ———— main ————

const [cmd, ...rest] = process.argv.slice(2);
// sb usage 事件：每次調用（子命令＋參數摘要）落 tmp JSONL——sb 呼叫頻譜的機械觀測層
// （使用者可隨時清理該檔；缺檔自動重建；觀測失敗靜默——遙測失效不影響本命令執行）。
let usageLogged = false;
function logUsage() {
  if (usageLogged) return;
  usageLogged = true;
  try {
    mkdirSync(TMP, { recursive: true });
    appendFileSync(join(TMP, 'sb-usage.jsonl'), JSON.stringify({ at: new Date().toISOString(), cmd: cmd ?? '(none)', args: rest.join(' ').slice(0, 120) }) + '\n');
  } catch { /* 觀測落檔失敗不攔主流程 */ }
}
// handoff 自行由 Git 錨定 canonical repo；安全檢查前不得由既有遙測寫入任何目錄。
if (cmd === 'handoff') {
  if (rest.includes('--help')) usage(0);
  try { process.exitCode = runHandoff(rest); }
  catch (error) { console.error(`FAIL\n  ✗ ${error.message}`); process.exitCode = 1; }
} else {
// 只寫入既有工作區或目前所在的 Git 專案根：非 Git 資料夾（如家目錄）不因查詢多出工作區，
// 否則其下子資料夾都會向上錨定到這裡。
if (existsSync(SB_DIR) || (ROOT === resolve(process.cwd()) && hasGitMetadata())) logUsage();
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const pos = [];
for (const arg of rest) {
  if (arg.startsWith('--')) usage(); // 未知旗標（拼錯）直接提示 usage
  pos.push(arg);
}
switch (cmd) {
  case 'state': if (pos.length) usage(); cmdState(); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  case 'rewrite': cmdRewrite(); break;
  default: usage();
}
}