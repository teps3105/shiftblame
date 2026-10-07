#!/usr/bin/env node
// sb — Shiftblame 工作狀態與契約檢查。
// 在專案根使用 git 事實、正式文件與 flow-state.json 核對階段前提。
// CLI 記錄需求封存、獨立審查及使用者授權；語義與真實驗收由對話及行為證據承載。
// 使用 Node 內建模組；狀態與工作記錄存於 <repo>/.shiftblame/。
// exit：0 = 通過，1 = 條件不符，2 = 用法錯誤。

import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, cpSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, realpathSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, basename } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { objectRecord, hookRecords, uninitializedState, directState, endedState, validCloseout, readFlowState, migrateStreams, unchangedG1Approval } from './flow-state.mjs';
import { COMMIT_TYPES as TYPES, commitMessageIssue } from './commit-format.mjs';
import { runHandoff } from './handoff.mjs';
import { acquireLock, hookRecordsPath, readHookRecords, writeAtomic } from './state-io.mjs';

// 專案根錨定：從執行目錄向上找 .git／既有 .shiftblame（子目錄執行時錨定到正確工作區）
// （相對路徑展開到錯誤資料夾是破壞與污染的共同來源；所有狀態路徑一律錨定絕對根）
function findRoot(start) {
  let dir = resolve(start ?? process.cwd());
  for (;;) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, '.shiftblame'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start ?? process.cwd());
    dir = parent;
  }
}
const ROOT = findRoot();
const SB_DIR = join(ROOT, '.shiftblame');
const TMP = join(SB_DIR, 'tmp');
const STATE_FILE = join(SB_DIR, 'flow-state.json');
// 以暫存檔改名寫入；修改狀態的命令在讀取前已取得排他鎖（見 main）。
const writeState = (st) => writeAtomic(STATE_FILE, JSON.stringify(st, null, 2));

// 各階段的正常推進與技術回查路徑。六段成環：G1＝需求＋研究（requirement／research 段撰寫）、
// G2＝計畫＋品質（plan／quality 段撰寫）、G3＝實作＋驗收（build／verify 段撰寫）。
const FLOW = {
  requirement: { next: ['research'], desc: 'G1 需求定義與驗收契約（AC）；實質新需求先訪談對齊，在同一里程碑開新輪' },
  research:{ next: ['plan', 'requirement'], desc: 'G1 技術研究與證據；必要時回 requirement 釐清契約；完成後時點 1 獨立審查與使用者判定' },
  plan:    { next: ['quality', 'research'], desc: 'G2 實作計畫與驗收映射；必要時回 research 修正依據' },
  quality: { next: ['build', 'plan'], desc: 'G2 品質標準與驗證方式；必要時回 plan 修正計畫；時點 2 獨立審查與使用者判定後進 build' },
  build:   { next: ['verify', 'quality'], desc: 'G3 實作、整合與提交；必要時回 quality 修正品質安排，受驗工作樹乾淨後進入 verify' },
  verify:  { next: ['requirement', 'quality', 'build'], desc: 'G3 執行真實驗收並回指 G1；時點 3 獨立審查及使用者終審後，slug 還有里程碑則回 requirement 開下一里程碑，整個 slug 完成才結束；技術問題回 quality 或 build 修復' },
};

// 任何新意圖先經產品訪談對齊，再回 requirement 重入（同 ms 開新輪）；已完成驗收的出口以 --new-ms 或 end 承接。
const backEdge = (from, to) => to === 'requirement';

// 階段前提由正式文件、契約封存與對應審查／授權旗標共同核對。
// 三時點皆為完整時點：獨立審查（--adversarial）＋使用者判定（--boss-ok）。
// 開工授權由 slug 建立（sb init）與訪談紀錄承載，不再另設決策邊。
const ADVERSARIAL_EDGES = [
  { from: 'research', to: 'plan', point: '1' },
  { from: 'quality', to: 'build', point: '2' },
  { from: 'verify', to: 'requirement', point: '3' },
];
const adversarialEdge = (from, to) => ADVERSARIAL_EDGES.find((e) => e.from === from && e.to === to) ?? null;
const needsBossOk = (from, to) => !!adversarialEdge(from, to);

// ———— 小工具 ————

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };

const fin = (msgs) => { console.log('pass'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log']('直接作業交接：\n  sb handoff save <task> <notes.md>     保存具名工作的機械快照\n  sb handoff list                       列出具名工作及損壞診斷\n  sb handoff show <task>                讀取指定交接並核對目前差異\n');
  console[code ? "error" : "log"]("sb — Shiftblame 工作狀態與契約檢查\n\n用法：\n  sb state\n  sb init <slug> [type] [--no-git]      建立已授權 slug；type 預設 feat\n                                        空資料夾自動建 Git 庫並補起始提交；--no-git 不用 Git\n  sb init --main                       完結已整合的 ended 流程，留在基底分支\n  sb next <段> [--boss-ok] [--adversarial] [--new-ms]\n  sb adversarial <報告檔> --point 1|2|3  記錄 tmp 內的獨立審查報告\n  sb end [--base <分支>] --adversarial --boss-ok\n  sb closeout --base <分支>             核對收尾整合事實\n  sb commitmsg \"<訊息>\"                 檢查「type: 一句話」格式、狀態與 staged 系統檔，發提交章\n                                        （staged 動到 README／docs／SOP／ROADMAP 時須先過文件閘）\n  sb sopreview \"<範圍與結論>\"           選用的治理文件審查記錄\n  sb rewrite                           文件編輯唯一入口：快照文件集至 tmp 後檢查\n                                        （docs/ 結構＋重點前置、長度預算、治理暗語）\n  sb --help\n\nslug：requirement → research → plan → quality → build → verify（六段圓環）\nG1 寫需求與研究、G2 寫計畫與品質、G3 寫實作與驗收；回指為三角循環（G2 回指 G1、G3 回指 G2、G1 回指 G3——時點 3 後閉環）。\n技術問題可回相鄰責任段修正；任何新意圖先經產品訪談對齊，再回 requirement 同 ms 開新輪。\nsb init 直接落 requirement——開工授權由 slug 建立與訪談紀錄承載。\n時點 1 在 research→plan（審 G1），時點 2 在 quality→build（審 G2），時點 3 在 verify 出口（審驗收結果）；皆先獨立審查再由使用者判定。\n--adversarial 與 --boss-ok 記錄已完成的真實審查及已取得的使用者授權。\n未變且有效的 G1／G2 契約可沿用核准；定義變更需重新核准。\nend 結束整個 slug：歸檔並合併回基底，刪本機工作分支；SLUG 里程碑清單還有後續未完成里程碑時擋下。推送依另有的發布授權。\nnext requirement --new-ms 在驗收及終審完成後開下一里程碑，slug 與工作分支保留。\n驗收使用真實行為證據，來源修正後重驗受影響範圍；未驗如實標示。");
  process.exit(code);
};

const readJson = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const mdOf = (p) => (existsSync(p) ? readFileSync(p, 'utf-8') : null);

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

// 取含關鍵詞的標題段內容（任何後續 ATX 標題（含 ≤3 縮排）即段終——防遮蔽空段吞越相鄰段）
function section(text, keyword) {
  const lines = visibleText(text).split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^ {0,3}(#{1,6})\s+(.*)$/);
    if (!h) continue;
    if (start >= 0) return lines.slice(start + 1, i).join('\n').trim();
    if (h[2].includes(keyword)) start = i;
  }
  return start < 0 ? null : lines.slice(start + 1).join('\n').trim();
}

// Mechanical checks establish presence, not semantic quality.
function substantive(body) { return typeof body === "string" && body.trim().length > 0; }

const msDir = (st) => join(SB_DIR, st.slug, st.ms);
const gPath = (st, n) => join(msDir(st), `G${n}.md`);

// 輪次計數——僅計數零檔案寫入，歷史不可變性由 git 承擔：
// 回 requirement 開新輪只遞增計數（ms 目錄有 G 檔才計），零檔案寫入
function countRev(st) {
  const dir = msDir(st);
  const has = [1, 2, 3].some((n) => existsSync(join(dir, `G${n}.md`)));
  if (!has) return null;
  return (st.rev ?? 0) + 1;
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const sha256Text = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
// RAM/ROM：G 檔二分區——`## 回指記錄` 恰一次；定義區（標題前）hash 封存，回指區（標題後）隨執行更新不觸契約
const REFLECT_HEAD = /^## 回指記錄$/gm;
const reflectHeads = (t) => [...t.matchAll(REFLECT_HEAD)].length;
const defSection = (t) => t.slice(0, t.search(REFLECT_HEAD));
// 審查條目綁定審查對象：時點 1 記 G1 定義區 hash，時點 2 記 G2 定義區 hash，時點 3 記受驗提交；
// 推進時比對，審查後的變更須重新審查。舊版條目沒有綁定鍵，只核對新鮮度。
function g1DefHash(st) {
  const raw = mdOf(gPath(st, 1));
  return raw !== null && reflectHeads(raw) === 1 ? sha256Text(defSection(raw)) : null;
}
function g2DefHash(st) {
  const raw = mdOf(gPath(st, 2));
  return raw !== null && reflectHeads(raw) === 1 ? sha256Text(defSection(raw)) : null;
}
function bindingProblem(point, entry, st) {
  if (point === '1' && Object.hasOwn(entry, 'g1')) {
    const cur = g1DefHash(st);
    if (cur !== entry.g1) return `時點 1 審查後 G1 定義區已變更（審查時 ${entry.g1.slice(0, 12)}，目前 ${cur ? cur.slice(0, 12) : '無法計算'}）——修改後的 G1 須重新 sb adversarial --point 1 審查`;
  }
  if (point === '2' && Object.hasOwn(entry, 'g2')) {
    const cur = g2DefHash(st);
    if (cur !== entry.g2) return `時點 2 審查後 G2 定義區已變更（審查時 ${entry.g2.slice(0, 12)}，目前 ${cur ? cur.slice(0, 12) : '無法計算'}）——修改後的 G2 須重新 sb adversarial --point 2 審查`;
  }
  if (point === '3' && Object.hasOwn(entry, 'head')) {
    const cur = verifiedCommit(st);
    if (cur !== entry.head) return `時點 3 審查後受驗提交已變更（審查時 ${entry.head.slice(0, 12)}，目前 ${cur ? cur.slice(0, 12) : '無法解析'}）——對目前提交重新 sb adversarial --point 3 審查`;
  }
  return null;
}
// 時點 2 的受驗提交：收尾已留痕取其工作提交；有工作分支取分支末端（收尾中斷後已切到基底也不變）；否則取 HEAD。
function verifiedCommit(st) {
  if (st.closeout?.slug === st.slug && st.closeout.workCommit) return st.closeout.workCommit;
  const branches = st.workBranch ? [st.workBranch] : TYPES.map((type) => `${type}/${st.slug}`).filter((name) => branchTip(name));
  return (branches.length === 1 && branchTip(branches[0])) || gitHeadCommit();
}

// 里程碑清單：SLUG.md「里程碑清單」標題下的表格，首欄 ms，狀態取表頭名為「狀態」的欄（沒有則取末欄）。
// 已走過的 ms 由 flow-state 的 ms 計數承擔，不靠手填狀態；只有目前 ms 之後的列看狀態欄——
// 不是「完成／取消」即為後續未完成里程碑。回傳 null＝沒有清單（既有 slug 相容，不核對）。
function milestonePlan(st) {
  if (typeof st.slug !== 'string' || !st.slug) return null;
  const raw = mdOf(join(SB_DIR, st.slug, 'SLUG.md'));
  const body = raw === null ? null : section(raw, '里程碑清單');
  if (body === null) return null;
  const pending = [], unreadable = [];
  let head = null, inRows = false; // 分隔列之前是表頭，之後才是資料列
  for (const line of body.split('\n')) {
    if (!/^\s*\|/.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) { inRows = true; continue; }
    if (!inRows) { head = cells; continue; }
    const n = cells[0].match(/^(?:ms)?\s*(\d{1,3})$/i);
    if (!n || cells.length < 2) { unreadable.push(line.trim()); continue; }
    const ms = n[1].padStart(3, '0');
    const status = cells[head?.indexOf('狀態') ?? -1] ?? cells.at(-1);
    if (Number(ms) > Number(st.ms) && !/^已?(?:完成|取消)/.test(status)) pending.push(ms);
  }
  return { pending, unreadable };
}
// verify 的兩個出口層級不同：--new-ms 只結束目前里程碑，end 結束整個 slug。sb state 與 done 相容狀態共用。
function exitLines(st) {
  const plan = milestonePlan(st);
  const listed = plan === null ? 'SLUG 沒有里程碑清單——sb end 不核對後續里程碑，選出口前自行核對待辦'
    : plan.unreadable.length ? `里程碑清單有無法辨識的列（${plan.unreadable.length} 列）——sb end 會擋，先修正 ms 欄`
    : plan.pending.length ? `里程碑清單：後續未完成 ${plan.pending.join('、')}——sb end 會擋`
    : '里程碑清單：目前 ms 之後沒有未完成里程碑';
  return [
    '    目前里程碑通過、slug 還有里程碑 → sb next requirement --new-ms --adversarial --boss-ok（回 requirement 開下一 ms；slug 與工作分支保留）',
    '    整個 slug 完成 → sb end --adversarial --boss-ok（歸檔、合併回基底、刪除本機工作分支）',
    `    ${listed}`,
  ];
}

function acRows(text) {
  if (typeof text !== 'string') return [];
  return text.replace(/\r\n?/g, '\n').split('\n').flatMap((line) => {
    const match = line.match(/^\s*-\s*(AC-\d{2,})\s*\|\s*(.+)$/);
    if (!match) return [];
    const fields = Object.fromEntries(match[2].split('|').map((part) => part.trim().split(/\s*=\s*/, 2)).filter(([key, value]) => key && value));
    return [{ id: match[1], fields, line }];
  });
}

const filled = (value) => typeof value === 'string' && value.trim().length > 0 && !/^([（(]填[）)]|填|待填|todo|tbd|<[^>]+>)$/i.test(value.trim());
const unique = (values) => [...new Set(values)];

function validateG1Acceptance(g1, problems, passes) {
  const rows = acRows(g1);
  if (rows.length && /^###\s+AC-/m.test(String(g1))) problems.push('G1 混合格式（單行與 BDD 分段並存）——擇一定義（主推 BDD 分段）');
  if (rows.length) { // 單行格式——相容驗證
    const ids = rows.map((row) => row.id);
    if (unique(ids).length !== ids.length) problems.push('G1 驗收契約含重複 AC-ID——每個 AC-ID 須唯一');
    const required = ['需求', '使用者', '前置', '操作', '可觀察結果', '失敗邊界', '證據'];
    for (const row of rows) {
      const missing = required.filter((key) => !filled(row.fields[key]));
      if (missing.length) problems.push(`G1 ${row.id} 缺實質欄位：${missing.join('、')}`);
      if (row.fields['證據'] !== 'BEHAVIOR') problems.push(`G1 ${row.id} 證據須為 BEHAVIOR——以使用者可觀察結果驗收`);
    }
    if (!problems.length) passes.push(`G1 使用者驗收契約：${unique(ids).join('、')}（BEHAVIOR）`);
    return unique(ids);
  }
  // BDD 分段格式（主推；含現狀＋消融鍵）：### AC- 分段，每段含 Given／When／Then＋現狀＋使用者＋失敗邊界＋消融＋證據——值逐鍵驗實質
  const blocks = String(g1).split(/^###\s+AC-/m).slice(1);
  if (blocks.length) {
    const ids = blocks.map((b) => 'AC-' + ((b.match(/^\s*(\d{2,})/) ?? [, '?'])[1])); // 剝中文短名——id 恆為 AC-數字（G2 對照鍵）
    if (unique(ids).length !== ids.length) problems.push('G1 驗收契約含重複 AC-ID——每個 AC-ID 須唯一');
    for (const [i, b] of blocks.entries()) {
      for (const [key, re] of [['Given', /Given[:：]/], ['When', /When[:：]/], ['Then', /Then[:：]/], ['現狀', /現狀[:：]/], ['使用者', /使用者[:：]/], ['失敗邊界', /失敗邊界[:：]/], ['消融', /消融[:：]/]]) { // 七鍵（現狀——差異宣言左邊：現行系統同 Given/When 的實際觀察，現狀＝Then 即偽需求；消融——拿掉此需求使用者失去什麼）
        if (!re.test(b)) { problems.push(`G1 ${ids[i]} 缺 ${key}（BDD 行為規格——字面搬運產不行為規格）`); continue; }
        const val = (b.match(new RegExp(`^[-*]?\\s*${key}[^\\S\\n]*[:：]\\s*(.+)$`, 'm')) ?? [, ''])[1].trim();
        if (!filled(val)) problems.push(`G1 ${ids[i]} ${key} 未填實質（模板照抄不構成行為規格）`);
      }
      if (!/證據[:：]\s*BEHAVIOR/.test(b)) problems.push(`G1 ${ids[i]} 證據須為 BEHAVIOR——以使用者可觀察結果驗收`);
    }
    if (!problems.length) passes.push(`G1 使用者驗收契約（BDD 行為規格）：${ids.join('、')}（BEHAVIOR）`);
    return unique(ids);
  }
  problems.push('G1 缺 AC 驗收契約——單行（- AC-01 | 鍵=值 |…）或 BDD 分段（### AC-01＋Given／When／Then／現狀／使用者／失敗邊界／消融／證據——主推 BDD）擇一定義');
  return [];
}

function validateG2Acceptance(g2, g1Ids, problems, passes) {
  const rows = acRows(g2);
  const required = ['驗收操作', '通過判準', '需要的證據', '測試'];
  for (const row of rows) {
    const missing = required.filter((key) => !filled(row.fields[key]));
    if (missing.length) problems.push(`G2 ${row.id} 缺實質欄位：${missing.join('、')}`);
  }
  const ids = unique(rows.map((row) => row.id));
  if (ids.length !== rows.length) problems.push('G2 驗收條件含重複 AC-ID——每個 G1 AC-ID 須恰有一列');
  const missing = g1Ids.filter((id) => !ids.includes(id));
  const unknown = ids.filter((id) => !g1Ids.includes(id));
  if (missing.length) problems.push(`G2 未逐項承接 G1：${missing.join('、')}`);
  if (unknown.length) problems.push(`G2 含不存在於 G1 的驗收 ID：${unknown.join('、')}`);
  if (!problems.length) passes.push(`G2 已逐項排程 ${g1Ids.length} 個 G1 驗收條件`);
}

function checkCleanWorktree(problems, passes, timing) {
  try {
    const dirty = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (dirty.trim()) problems.push(`${timing} working tree 必須乾淨——該提交的先精準提交，該捨棄的明確捨棄——變更先分類再回定義`);
    else passes.push(`working tree 乾淨（${timing}已完成提交／捨棄判定）`);
  } catch { passes.push('（非 git 環境，略過乾淨度檢查）'); }
}

// ———— 各節點推進閘門（target = 要進入的節點） ————
// G2 契約沿用核對：與 G1 同準——封存 hash 與目前 G2 定義區一致時沿用原核准。
function unchangedG2Approval(st) {
  const c = st?.g2Contract;
  if (!c || c.ms !== st?.ms || !/^[a-f0-9]{64}$/.test(c.sha256 ?? '')) return false;
  const cur = g2DefHash(st);
  return cur !== null && cur === c.sha256;
}
function gate(st, target, opts) {
  const problems = [];
  const passes = [];
  const reuseG1 = st.node === 'research' && target === 'plan' && unchangedG1Approval(ROOT, st);
  const reuseG2 = st.node === 'quality' && target === 'build' && unchangedG2Approval(st);
  const reuseApproval = reuseG1 || reuseG2;
  if (reuseG1) passes.push('G1 定義與當前里程碑封存完全相同——沿用已核准契約');
  if (reuseG2) passes.push('G2 定義與當前里程碑封存完全相同——沿用已核准契約');

  // 骨架存在性閘（僅前進邊——回頭邊不擋）：SLUG.md 缺＝骨架不完整
  if (st.slug && target !== 'requirement' && !existsSync(join(SB_DIR, st.slug, 'SLUG.md'))) {
    problems.push(`骨架不完整：${join(SB_DIR, st.slug, 'SLUG.md')} 不存在——由主代理手建（.shiftblame/ 永遠可寫；重跑 init 會覆蓋 flow-state，既有工作區禁止）`);
  }

  // G1／G2 契約核對（分別封存於 research→plan、quality→build 邊，之後任何推進重算；回 requirement 邊（新意圖經訪談重入）重定義前不擋）。
  // 封存邊由時點 1／2 承接變更，未變且無新意圖時沿用原封存。
  // 定義 hash 改變須重新核准；滿足集合改變仍先回 requirement，由既有修約流程承接。
  if (st.g1Contract?.ms === st.ms && target !== 'requirement' && !(st.node === 'research' && target === 'plan')) {
    const path = st.g1Contract.file;
    if (!path || !existsSync(path)) problems.push(`G1 契約檔不存在：${path ?? '缺失'}——回 requirement（sb next requirement）重定義後重新放行`);
    else {
      const raw = readFileSync(path, 'utf8');
      const heads = reflectHeads(raw);
      if (heads !== 1) problems.push(`G1 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——回指區格式破壞（定義區與回指區須以此標題分隔）`);
      else if (sha256Text(defSection(raw)) !== st.g1Contract.sha256) problems.push('G1 定義區已偏離封存時契約——定義級變更走回 requirement（sb next requirement）同 ms 開新輪（記錄實質需求修正）；回指區更新不觸契約');
      else passes.push(`G1 定義區 hash 核對：${st.g1Contract.sha256.slice(0, 12)}（封存於 flow-state；回指區在 hash 外）`);
    }
  }
  if (st.g2Contract?.ms === st.ms && target !== 'requirement' && !(st.node === 'quality' && target === 'build')) {
    const path = st.g2Contract.file;
    if (!path || !existsSync(path)) problems.push(`G2 契約檔不存在：${path ?? '缺失'}——回 requirement（sb next requirement）重定義後重新放行`);
    else {
      const raw = readFileSync(path, 'utf8');
      const heads = reflectHeads(raw);
      if (heads !== 1) problems.push(`G2 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——回指區格式破壞（定義區與回指區須以此標題分隔）`);
      else if (sha256Text(defSection(raw)) !== st.g2Contract.sha256) problems.push('G2 定義區已偏離封存時契約——定義級變更走回 requirement（sb next requirement）同 ms 開新輪（記錄實質計畫／品質修正）；回指區更新不觸契約');
      else passes.push(`G2 定義區 hash 核對：${st.g2Contract.sha256.slice(0, 12)}（封存於 flow-state；回指區在 hash 外）`);
    }
  }

  // --boss-ok：使用者決策邊留痕（旗標承接對話中已取得的使用者判定；機械不驗時戳，語義由對話承載）
  // verify→requirement 兼作 fail 回走（零旗標——新輸入經訪談回 requirement）——僅出口（--new-ms）要求使用者判定章。
  const adv = adversarialEdge(st.node, target);
  const bossEdge = !!adv && (adv.point !== '3' || opts.newMs);
  if (opts.bossOk && !bossEdge && !opts.newMs) {
    problems.push(`「${st.node} → ${target}」不是使用者決策邊——--boss-ok 留給使用者決策邊；段內旗標切段與回頭邊不帶，工作邊沿用既有授權`);
  } else if (bossEdge && !reuseApproval && !opts.bossOk) {
    problems.push(`「${st.node} → ${target}」是使用者決策邊——須帶 --boss-ok 留痕（使用者授權的語義由 think 揭露承擔）；時點審查在前、使用者判定在後——通過才推進；等待判定期間可先行研究（唯讀查證、tmp 筆記、隔離原型），不推進、不改受審來源、不提交`);
  } else if (opts.bossOk) {
    passes.push('使用者授權留痕（--boss-ok——旗標承接對話中的使用者判定）');
  }

  // --new-ms：時點 3 審查條目與使用者終審同一邊——verify→requirement 出口邊＝時點 3 對抗邊：
  // --adversarial＋lastAdv['3'] 條目由下方對抗邊檢查承載；--boss-ok 承接使用者終審（使用者輸入由對話承載）
  if (opts.newMs) {
    if (!(st.node === 'verify' && target === 'requirement')) die(['--new-ms 僅限 verify→requirement 邊（使用者終審通過後開下一 ms）——其他推進走各自旗標']);
    if (!opts.bossOk) die(['開新里程碑是使用者選擇（終審通過後 next）——須帶 --boss-ok 留痕']);
    passes.push('使用者終審：通過後開新 ms（--boss-ok）');
  }
  // --adversarial＋lastAdv point 條目對照（對抗產物屬 RAM，不入 SLUG）：
  // 時點 1 比同邊上次推進；時點 2 比本 ms 末次進 quality、時點 3 比本 ms 末次進 verify，修復重驗後須有本次對抗。
  // 時點 3（verify→requirement）的對抗義務僅限出口（--new-ms）：fail＝使用者新輸入經訪談回 requirement 零旗標
  // （fail 本身是時點 3 對抗／終審的產物——不通過即回走證據；sb end 出口另由 cmdEnd 手動驗雙章）
  const advGate = adv && !reuseApproval && (adv.point !== '3' || opts.newMs);
  if (advGate) {
    if (!opts.adversarial) problems.push(`「${st.node} → ${target}」需時點 ${adv.point} 對抗——須帶 --adversarial 宣告（審查在前、使用者判定在後——通過才推進）`);
    else {
      const lastEdgeAt = adv.point === '2' ? st.edgeAt?.['plan→quality'] : adv.point === '3' ? st.edgeAt?.['build→verify'] : st.edgeAt?.[`${st.node}→${target}`];
      const entry = st.lastAdv?.[adv.point];
      if (!entry) problems.push(`lastAdv 缺時點 ${adv.point} 條目——須先 sb adversarial <報告檔> --point ${adv.point}（外部唯讀子代理，報告落 tmp）後推進`);
      else if (lastEdgeAt && entry.at <= lastEdgeAt) problems.push(`時點 ${adv.point} 對抗條目過期（早於${adv.point === '2' ? '本 ms 進 quality' : adv.point === '3' ? '本 ms 進 verify' : '同邊上次推進'}）——本輪須重新 sb adversarial --point ${adv.point}`);
      else {
        const bound = bindingProblem(adv.point, entry, st);
        if (bound) problems.push(bound);
        else passes.push(`時點 ${adv.point} 對抗：lastAdv 條目對照一致（新鮮度${Object.hasOwn(entry, adv.point === '1' ? 'g1' : adv.point === '2' ? 'g2' : 'head') ? '與審查對象' : ''}已驗）`);
      }
    }
  } else if (opts.adversarial && !reuseApproval) {
    if (adv) problems.push(`「${st.node} → ${target}」的時點 ${adv.point} 對抗義務僅限出口（--new-ms）——fail＝使用者新輸入經訪談回 requirement 零旗標（fail 本身是對抗／終審產物，不重驗）`);
    else problems.push(`「${st.node} → ${target}」不是對抗邊——--adversarial 留給時點對抗邊（時點 1 research→plan／時點 2 quality→build／時點 3 verify 出口）`);
  }

  const g1 = mdOf(gPath(st, 1)), g2 = mdOf(gPath(st, 2)), g3 = mdOf(gPath(st, 3));

  switch (target) {
    case 'requirement': // 回頭邊（任何新意圖先經產品訪談回 requirement）：補充／重修／追加子需求／修約——同 ms 開新輪；--new-ms 時出口邊 ms++（cmdNext）
      passes.push(st.node === 'verify' && opts?.newMs ? '--new-ms——出口邊閉環回 requirement 且開新里程碑' : '回 requirement——任何新意圖先經產品訪談對齊，同 ms 開新輪');
      break;

    case 'research': // 假需求閘（機械下限：requirement→research 邊審需求翻譯——格式與 GWT 掃描為機械面，語義攻防由時點 1 對抗承載）
      if (st.node !== 'requirement') break; // 回研究是修正工作，內容格式在重新前進時查驗。
      if (!g1) problems.push('G1 不存在（.shiftblame/<slug>/<ms>/G1.md）');
      else {
        const bdd = String(g1).split(/^###\s+AC-/m).slice(1); // BDD 分段格式（主推）
        if (bdd.length) {
          const accAll = bdd.join('\n');
          if (!substantive(accAll)) problems.push('G1 驗收段敷衍——驗收標準是不可查核的空話（假需求訊號）');
          if (!problems.length) passes.push('G1 驗收欄位齊備（語義需審查）（BDD 行為規格：存在＋必填欄位）');
        } else {
          const acc = section(g1, '驗收');
          if (acc === null) problems.push('G1 缺「驗收」段——需求沒有可查核的「完成」定義（假需求訊號）');
          else {
            if (!substantive(acc)) problems.push('G1 驗收段敷衍——驗收標準是不可查核的空話（假需求訊號）');
            if (!problems.length) passes.push('G1 驗收欄位齊備（語義需審查）（存在＋必填欄位）');
          }
        }
        validateG1Acceptance(g1, problems, passes);
      }
      break;

    case 'plan': // research → plan（時點 1 邊）：G1 定稿核對——驗收契約＋技術研究實質＋回指格式，契約於推進時封存（cmdNext）
      if (st.node !== 'research') break; // 品質段回計畫是修正工作，內容格式在重新前進時查驗。
      if (!g1) problems.push('G1 不存在');
      else {
        validateG1Acceptance(g1, problems, passes);
        const res = section(g1, '技術研究');
        if (res === null) problems.push('G1 缺「技術研究」段——研究與技術決策沒有可查核的依據（假研究訊號）');
        else if (!substantive(res)) problems.push('G1「技術研究」段敷衍——填入支持計畫的結論、依據與來源');
        else passes.push('G1 技術研究實質存在');
        const heads = reflectHeads(g1);
        if (heads !== 1) problems.push(`G1 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——時點 1 封存前修正回指區格式（定義區與回指區須以此標題分隔）`);
      }
      break;

    case 'quality':
      if (st.node === 'plan') { // plan → quality 核對 G2 的驗收映射與實作安排。
        if (!g1) problems.push('G1 不存在——無法推進');
        const g1Ids = g1 ? validateG1Acceptance(g1, problems, passes) : [];
        if (!g2) problems.push('G2 不存在');
        else {
          const fm = section(g2, '失敗模式');
          if (fm === null) problems.push('G2 缺「失敗模式」段——premortem：假設計畫失敗了，最可能 2-3 個原因是什麼（假規劃訊號）');
          else if (!substantive(fm)) problems.push('G2「失敗模式」段敷衍——列不出真實失敗點＝沒想過會怎麼失敗');
          else passes.push('G2 失敗模式（premortem）非敷衍');
          const steps = section(g2, '實作步驟');
          if (steps === null) problems.push('G2 缺「實作步驟」段——計畫沒有可執行的步驟（假規劃訊號）');
          else if (!substantive(steps)) problems.push('G2「實作步驟」段敷衍');
          else passes.push('G2 實作步驟實質存在');
          if (g1) validateG2Acceptance(g2, g1Ids, problems, passes);
        }
      }
      // 進 quality＝功能迭代與段內修復的切入段（plan→quality 機械推進、提交閘回 quality、旗標切段回 quality）；假品質安排由文件層判準擋
      break;

    case 'build': // quality → build（時點 2 邊）：品質安排實質＋G2 回指 G1（三角回指邊），契約於推進時封存（cmdNext）
      if (st.node === 'quality') {
        if (!g2) problems.push('G2 不存在');
        else {
          const q = section(g2, '品質');
          if (q === null) problems.push('G2 缺「品質」段——品質標準與驗證方式沒有可查核的安排（時點 2 審查對象不完整）');
          else if (!substantive(q)) problems.push('G2「品質」段敷衍——填入品質標準、驗證方式與通過判準');
          else passes.push('G2 品質安排實質存在');
          const heads = reflectHeads(g2);
          if (heads !== 1) problems.push(`G2 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——時點 2 封存前修正回指區格式（定義區與回指區須以此標題分隔）`);
          const g1seal = st.g1Contract?.ms === st.ms ? st.g1Contract.sha256 : null;
          if (g1seal && !String(g2).includes(g1seal)) problems.push('G2 未回指 G1——計畫與品質安排須回指已封存的 G1 定義區 hash（三角回指邊：G2 → G1）');
          else if (g1seal) passes.push('G2 回指 G1 定義區（三角回指邊：G2 → G1）');
        }
      }
      break;

    case 'verify': // 進驗收＝實作已存檔＋G3 回指 G2（三角回指邊：G3 → G2）：working tree 乾淨（git 判定）
      if (!g3) problems.push('G3 不存在——實作紀錄（G3）於 build 段建立（.shiftblame/<slug>/<ms>/G3.md）');
      else {
        const g2seal = st.g2Contract?.ms === st.ms ? st.g2Contract.sha256 : null;
        if (g2seal && !String(g3).includes(g2seal)) problems.push('G3 未回指 G2——實作與驗收須回指已封存的 G2 定義區 hash（三角回指邊：G3 → G2）');
        else if (g2seal) passes.push('G3 回指 G2 定義區（三角回指邊：G3 → G2）');
      }
      try {
        const dirty = execSync('git status --porcelain', { encoding: 'utf-8' });
        if (dirty.trim()) problems.push('working tree 未乾淨——實作存檔（commit）先於驗收（進驗收前完成提交）');
        else passes.push('working tree 乾淨（實作已存檔，git 判定）');
      } catch { /* 非 git 環境略過 */ }
      break;
  }
  return { problems, passes };
}

// ———— 指令 ————
// TYPES（提交 type 詞彙）由 commit-format.mjs 提供——與 hooks 提交閘同一來源。
function readStartupState() {
  try { return migrateStreams(readJson(STATE_FILE)); }
  catch { die([`flow-state 無法解析：${STATE_FILE}——保留原檔，查明損壞原因後修復`]); }
}
function requireHealthyState() {
  const result = readFlowState(ROOT);
  if (result.kind === 'invalid') die(['流程接入異常：flow-state 狀態不完整或未知——先保留原檔並修復，再以 sb state 查證；正式寫入、對抗宣告與提交不得繼續']);
  return result;
}
// ended 是新 slug 的入口；只接納正常 end 產物及其後的 hooks 紀錄。
function endedInitProblems(st) {
  const problems = [];
  if (existsSync(join(SB_DIR, st.slug))) problems.push(`舊 slug 尚未移出：${join(SB_DIR, st.slug)}——先完成收尾歸檔`);
  const archived = join(SB_DIR, 'archive', st.slug, 'SLUG.md');
  if (!existsSync(archived) || !statSync(archived).isFile()) problems.push(`舊 slug 歸檔缺失：${archived}——先完成收尾歸檔`);
  return problems;
}
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
const gitRun = (...args) => spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', timeout: 15000 });
const branchName = (name) => typeof name === 'string' && name.length > 0 && gitRun('check-ref-format', `refs/heads/${name}`).status === 0;
const commitId = (id) => typeof id === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(id);
function branchTip(name) {
  const r = gitRun('rev-parse', '--verify', `refs/heads/${name}^{commit}`);
  return r.status === 0 && commitId(r.stdout.trim()) ? r.stdout.trim() : null;
}
function remoteConfig(name) {
  const r = gitRun('remote', 'get-url', '--push', '--all', name);
  if (r.status !== 0) throw new Error(`遠端 ${name} 無法解析，無法確認清除狀態`);
  const urls = [...new Set(r.stdout.trim().split(/\r?\n/).filter(Boolean))];
  if (!urls.length) throw new Error(`遠端 ${name} 缺少推送位置`);
  return { urls, configHash: createHash('sha256').update(JSON.stringify(urls)).digest('hex') };
}
function remoteTips(name, ref, expectedHash) {
  const config = remoteConfig(name);
  if (expectedHash && config.configHash !== expectedHash) throw new Error(`遠端 ${name} 設定已變更，請重新查證收尾`);
  const tips = [];
  for (const url of config.urls) {
    const r = gitRun('ls-remote', '--exit-code', '--heads', '--', url, ref);
    if (r.status === 2) continue; // 伺服器確認無此 ref，非本機 tracking 快取。
    if (r.status !== 0) throw new Error(`遠端 ${name} 查詢失敗，無法確認 ${ref} 已清除`);
    const lines = r.stdout.trim().split(/\r?\n/);
    for (const line of lines) {
      const [oid, found] = line.split('\t');
      if (found !== ref || !commitId(oid)) throw new Error(`遠端 ${name} 回傳無效的分支資料`);
      tips.push(oid);
    }
  }
  return { tips, configHash: config.configHash };
}
function knownRemoteTargets(workBranch) {
  const result = gitRun('remote');
  if (result.status !== 0) throw new Error('無法列出遠端，先修復 Git');
  const targets = result.stdout.trim().split(/\r?\n/).filter(Boolean).map(name => ({ name, ref: `refs/heads/${workBranch}` }));
  const name = gitRun('config', '--get', `branch.${workBranch}.remote`).stdout.trim();
  const ref = gitRun('config', '--get', `branch.${workBranch}.merge`).stdout.trim();
  if (name && name !== '.' && ref.startsWith('refs/heads/') && !targets.some(r => r.name === name && r.ref === ref)) targets.push({ name, ref });
  // push refspec 可以另命名且沒有 upstream；查證所有可對應的目的分支。
  for (const remote of result.stdout.trim().split(/\r?\n/).filter(Boolean)) {
    const push = gitRun('config', '--get-all', `remote.${remote}.push`);
    if (push.status !== 0 && push.status !== 1) throw new Error(`無法讀取遠端 ${remote} 的 push refspec`);
    for (let spec of push.stdout.trim().split(/\r?\n/).filter(Boolean)) {
      spec = spec.replace(/^\+/, '');
      if (spec === ':') continue; // matching branches，同名目標已列。
      let [src, dst, extra] = spec.split(':');
      if (extra !== undefined) throw new Error(`遠端 ${remote} push refspec 無法可靠對應，先明確設定目的分支`);
      if (!src || (src.startsWith('refs/') && !src.startsWith('refs/heads/'))) continue; // 刪除與標籤等來源不屬於舊工作分支。
      dst ??= src;
      if (dst.startsWith('refs/') && !dst.startsWith('refs/heads/')) continue; // 本入口只檢查分支清除。
      if (!dst.startsWith('refs/heads/')) dst = `refs/heads/${dst}`;
      if (src && src !== 'HEAD' && !src.startsWith('refs/')) src = `refs/heads/${src}`;
      const source = `refs/heads/${workBranch}`;
      if (src.includes('*')) {
        if (src.split('*').length !== 2 || dst.split('*').length !== 2) throw new Error(`遠端 ${remote} push refspec 無法可靠對應`);
        const [prefix, suffix] = src.split('*');
        if (!source.startsWith(prefix) || !source.endsWith(suffix)) continue;
        dst = dst.replace('*', source.slice(prefix.length, suffix ? -suffix.length : undefined));
      } else {
        if (src && src !== 'HEAD' && !branchName(src.replace(/^refs\/heads\//, ''))) throw new Error(`遠端 ${remote} push refspec 無法可靠對應`);
        if (src && src !== 'HEAD' && src !== source) continue;
      }
      if (!branchName(dst.slice(11))) throw new Error(`遠端 ${remote} 目的分支無法可靠對應`);
      if (!targets.some(r => r.name === remote && r.ref === dst)) targets.push({ name: remote, ref: dst });
    }
  }
  return targets;
}
// --no-ff 合併提交證據：工作提交經「合併提交」進入基底 lineage——存在 ancestor-of-base 的
// 合併提交且其父提交含 workCommit。直接快轉（基底 tip＝工作 tip，無合併提交）與 squash 皆不含；
// 合併後基底續有新提交仍可辨識（合併提交在 ancestry-path 上）。
function noFfMergeEvidence(workCommit, baseCommit, slug) {
  // 合併提交證據＋固定訊息一體核對（政策②）：找到父含工作提交的合併提交，且 subject＝merge <slug>——訊息錯＝無有效證據
  const r = gitRun('rev-list', '--merges', '--ancestry-path', `${workCommit}..${baseCommit}`);
  if (r.status !== 0) return null;
  for (const m of r.stdout.trim().split(/\s+/).filter(Boolean)) {
    const p = gitRun('rev-list', '--parents', '-n', '1', m);
    if (p.status === 0 && p.stdout.trim().split(/\s+/).slice(1).includes(workCommit)) {
      const subject = gitRun('log', '-1', '--format=%s', m).stdout.trim();
      if (slug && subject !== `merge ${slug}`) {
        return { invalidMessage: true, subject, merge: m };
      }
      return m;
    }
  }
  return null;
}
function cleanGitProblem() {
  const r = gitRun('status', '--porcelain');
  return r.status !== 0 ? 'Git 狀態查詢失敗' : r.stdout.trim() ? '工作樹未乾淨，先完成收尾提交' : null;
}
function closedGitPlan(st) {
  if (!hasGitMetadata()) return { problems: st.workBranch || st.closeout ? ['無法查證原 Git 工作區：Git metadata 缺失，保持 ended 狀態'] : [], baseCommit: null };
  const problems = [];
  const dirty = cleanGitProblem();
  if (dirty) problems.push(dirty);
  if (!st.closeout) return { problems: [...problems, '尚未完成合併查證：歸檔與合併後、刪分支前執行 sb closeout --base <本機分支>'], baseCommit: null };
  const c = st.closeout;
  const baseCommit = branchTip(c.baseBranch);
  if (!baseCommit || !noFfMergeEvidence(c.workCommit, baseCommit, c.slug)) problems.push('基底缺失或無 --no-ff 合併提交證據（快轉／多層轉併／squash 皆不含）——快轉者回到合併前基底後 git merge --no-ff 重併（分支已刪先以工作提交重建），未進基底者直接 --no-ff 合併；完成後重跑 closeout');
  const branches = gitRun('for-each-ref', '--format=%(refname)', `refs/heads/${c.workBranch}`);
  if (branches.status !== 0) problems.push('無法查證舊本機分支');
  else if (branches.stdout.trim()) problems.push(`舊本機分支尚未清除：${c.workBranch}`);
  try {
    const targets = [...c.remotes];
    for (const r of knownRemoteTargets(c.workBranch)) if (!targets.some(x => x.name === r.name && x.ref === r.ref)) targets.push(r);
    for (const r of targets) if (remoteTips(r.name, r.ref, r.configHash).tips.length) problems.push(`舊遠端分支尚未清除：${r.name} ${r.ref}`);
  } catch (e) { problems.push(e.message); }
  return { problems, baseCommit };
}
function cmdCloseout(base) {
  if (!existsSync(STATE_FILE)) die(['尚無流程，無法查證收尾']);
  const st = readStartupState();
  if (!endedState(st, ROOT)) die(['收尾查證僅接受合法 ended 狀態']);
  if (hasGitMetadata() && st.closeout?.slug === st.slug && st.closeout.workBranch && !branchTip(st.closeout.workBranch)) {
    die([`收尾已完成留痕且工作分支已清除（${st.closeout.workBranch} → ${st.closeout.baseBranch}）——無需再查證；如需重建或修復請人工處理後再查證`]);
  }
  const problems = endedInitProblems(st);
  if (!hasGitMetadata()) problems.push('非 Git 工作區不需合併查證');
  if (!branchName(base)) problems.push('請以 --base 明確指定本機基底分支');
  const dirty = cleanGitProblem();
  if (dirty) problems.push(dirty);
  if (problems.length) die(problems);
  const baseCommit = branchTip(base);
  if (!baseCommit) die(['基底分支不存在或尚無提交']);
  const candidates = st.workBranch ? [st.workBranch] : TYPES.map(type => `${type}/${st.slug}`).filter(name => branchTip(name));
  if (candidates.length !== 1) die(['缺少唯一舊工作分支來源；先恢復可核實的原功能分支，再查證收尾來源']);
  const workBranch = candidates[0], workCommit = branchTip(workBranch);
  if (workBranch === base || !workCommit) die(['舊工作分支須存在且不同於基底；先查證再刪除']);
  const mergeCommit = noFfMergeEvidence(workCommit, baseCommit, st.slug);
  if (mergeCommit?.invalidMessage) {
    die([`合併提交訊息不符固定格式——實得「${mergeCommit.subject}」，期望「merge ${st.slug}」；回復：回到合併前基底（git reflog 可查）後 git merge --no-ff ${workBranch} -m "merge ${st.slug}" 重併，再重新 sb closeout`]);
  }
  if (!mergeCommit || mergeCommit?.invalidMessage) {
    const isAncestor = gitRun('merge-base', '--is-ancestor', workCommit, baseCommit).status === 0;
    const branchGone = branchTip(workBranch) ? '' : `（分支已刪時先 git branch ${workBranch} ${workCommit} 重建）`;
    die([isAncestor
      ? `主分支缺 --no-ff 合併提交證據（工作提交已快轉進基底——直接 FF 或舊收尾皆常見）；回復：git reset --hard <合併前基底>（git reflog 或工作提交的第一父可查）後 git merge --no-ff ${workBranch} 重併${branchGone}——基底已推送時重寫需 force-push，先確認影響；完成後重新 sb closeout`
      : `主分支缺 --no-ff 合併提交證據（工作提交未進基底——多層轉併或 squash）；直接合併 git merge --no-ff ${workBranch} 後重新 sb closeout`]);
  }
  const remotes = [];
  try {
    for (const r of knownRemoteTargets(workBranch)) {
      const remote = remoteTips(r.name, r.ref);
      if (remote.tips.some(tip => gitRun('merge-base', '--is-ancestor', tip, baseCommit).status !== 0)) throw new Error(`遠端 ${r.name} 的舊功能提交尚無基底祖先證據；先取得並查證提交`);
      remotes.push({ ...r, configHash: remote.configHash });
    }
  } catch (e) { die([e.message]); }
  st.closeout = { slug: st.slug, workBranch, workCommit, baseBranch: base, at: new Date().toISOString(), remotes };
  writeState(st);
  fin([`合併查證已留痕：${workBranch} @ ${workCommit} → ${base}（合併訊息固定 merge <slug>）`, '依已查證 tip 清除舊本機與遠端分支，再以 sb init 開新工作；清除前如新增提交，重新執行 closeout']);
}
function ensureWorkspaceIgnored() {
  const giPath = join(ROOT, '.gitignore');
  const gi = existsSync(giPath) ? readFileSync(giPath, 'utf8') : '';
  if (hasGitMetadata()) {
    // --no-index 只判規則，已追蹤檔仍交由 staged 閘門；全程不動索引。
    const check = spawnSync('git', ['-C', ROOT, 'check-ignore', '--quiet', '--no-index', '--', '.shiftblame/'], { encoding: 'utf8' });
    if (check.status !== 0 && check.status !== 1) {
      out('〔忽略檢查〕Git 查詢失敗，保留 .gitignore 原樣；請修復 Git 後確認 .shiftblame/ 忽略設定。');
      return;
    }
    if (check.status === 0) return;
  } else {
    // 非 Git 目錄只辨識直接規則，含最後一條直接否定；不模擬 Git 通配語義。
    const direct = [...gi.matchAll(/^(\!?)\/?\.shiftblame\/?[ \t]*(?:\r?$)/gm)].at(-1);
    if (direct && direct[1] !== '!') return;
  }
  const eol = gi.match(/\r?\n/)?.[0] ?? '\n';
  appendFileSync(giPath, (gi && !gi.endsWith('\n') ? eol : '') + '.shiftblame/' + eol);
}

// —— 參照型文件可讀性信號（README／docs／SOP／ROADMAP）——
// 治理文件的累積式寫法（定義區、封存、回指）外溢到參照型文件會長成流水帳：
// 開頭無當下摘要、以補丁追加變更、治理暗語混入。三個機械判準由 sb rewrite 與
// 提交閘／收尾閘執行同一套判準，逼出整檔重寫而非追加；豁免以 frontmatter 明示
// （lead-allow／length-allow／jargon-allow）。
const DOC_ROOT_FILES = ['README.md', 'SOP.md', 'ROADMAP.md'];
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

// sb rewrite——文件編輯的唯一入口：備份文件集至 tmp 後跑結構＋可讀性判準，代理依報告
// 整檔重寫至 pass。檢查核心 docsFindings 為唯讀，由本命令與提交閘（cmdCommitmsg）、
// 收尾閘（cmdEnd）共用同一判準。結構檢查（docs/ 文件集）：非 md 檔不得入 docs/；
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
  // —— 可讀性三判準：docs/ 每份 md（索引.md 豁免重點前置與暗語）＋根檔 README／SOP／ROADMAP ——
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
  const rootEntries = (() => { try { return readdirSync(ROOT); } catch { return []; } })();
  for (const name of DOC_ROOT_FILES) {
    const actual = rootEntries.find((e) => e.toLowerCase() === name.toLowerCase());
    if (actual) auditFile(actual, join(ROOT, actual));
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
  const hasDocs = existsSync(docsDir);
  if (!hasDocs && !roots.length) fin(['無 README／docs／SOP／ROADMAP——文件檢查不適用（文件集建立後 sb rewrite 為唯一編輯入口）']);
  const backupRoot = join(TMP, 'rewrite-backup');
  const rels = listDocRels(docsDir, hasDocs);
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
  const bad = docsFindings();
  for (const rel of stale) bad.push(`${rel}——重寫後標題序列與上一份快照完全相同：沿舊目錄逐節翻寫是抄錄——先從讀者任務重新推導章節再落筆；小幅修正直接編輯檔案即可（不走 sb rewrite）`);
  if (bad.length) die([
    `文件檢查未通過（${bad.length} 項）——依 rewrite 整檔重寫至 pass（原稿快照：${backupDir}）`,
    ...bad,
  ]);
  fin([
    `文件檢查通過${prev ? '（結構相對上一份快照有變化）' : '（首次執行——下一輪起比對結構變化）'}${hasDocs ? `：docs/ ${folderCount(docsDir)} 節、${mdCount(docsDir)} 份` : ''}${roots.length ? `；根檔：${roots.join('、')}` : ''}`,
    `原稿快照：${backupDir}`,
    '參照型文件以整檔重寫維護——不在原檔上補丁；提交與收尾閘執行同一判準',
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
// —— 初始化的 Git 基線 ——
// 工作分支要能合併回有提交的基底：空資料夾建庫、unborn repo 補空樹起始提交；
// 已有內容的非 Git 資料夾不代為提交，由使用者選擇先建庫或 --no-git。
const OS_JUNK = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
const INITIAL_MESSAGE = 'chore: 初始化專案';
function entriesBesides(dir, keep = []) {
  try { return readdirSync(dir).filter((n) => !OS_JUNK.has(n.toLowerCase()) && !keep.includes(n)); }
  catch { return null; }
}
function gitError(r) {
  const lines = String(r?.stderr ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => /^(?:fatal|error):/.test(l)) ?? lines[0] ?? `exit ${r?.status ?? '?'}`;
}
function gitIdentityProblem() {
  for (const v of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    const r = gitRun('var', v);
    if (r.status !== 0) return `Git 提交身分未設定（${gitError(r)}）——先執行 git config --global user.name "<名字>" 與 git config --global user.email "<email>"，或改用 sb init <slug> --no-git`;
  }
  return null;
}
// 在空資料夾執行卻向上錨定時，使用者多半想開新專案，不能改在上層專案建立流程。
function refuseEmptySubfolder() {
  const cwd = resolve(process.cwd());
  if (ROOT !== cwd && entriesBesides(cwd)?.length === 0) {
    die([`目前資料夾是空的（${cwd}），專案根卻向上錨定到 ${ROOT}——要在上層專案開 slug 請到 ${ROOT} 執行；要讓此資料夾成為獨立專案，先在此執行 git init 再 sb init <slug>`]);
  }
}
// 回傳 mode：none（--no-git）／fresh（空資料夾，待建庫）／unborn（有 repo 無提交）／born／broken（Git 查詢失敗）。
function planRepository(noGit) {
  if (noGit) {
    if (hasGitMetadata()) die([`--no-git 只用於非 Git 工作區；${ROOT} 位於 Git 儲存庫內——移除 --no-git 以建立工作分支`], 2);
    return { mode: 'none' };
  }
  if (!hasGitMetadata()) {
    const content = entriesBesides(ROOT, ['.shiftblame']);
    if (content === null) die([`無法讀取專案根 ${ROOT}——確認資料夾權限後重試`]);
    if (content.length) {
      die([
        `${ROOT} 不是 Git 儲存庫且已有內容（${content.slice(0, 3).join('、')}${content.length > 3 ? ` 等 ${content.length} 項` : ''}）——sb init 不代為提交既有內容`,
        '要用 Git 管理：先 git init 並提交既有內容（以 .gitignore 排除不入庫的檔案），再 sb init <slug>',
        '不用 Git：sb init <slug> --no-git（不建分支與基底錨點，收尾只歸檔）',
      ]);
    }
    if (spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 15000 }).status !== 0) die(['找不到可用的 Git——安裝 Git 後重試，或改用 sb init <slug> --no-git']);
    return { mode: 'fresh' }; // 提交身分於建庫後檢查（bootstrapFresh）
  }
  const head = gitRun('rev-parse', '--verify', '-q', 'HEAD');
  if (head.status === 0) return { mode: 'born' };
  const symbolic = gitRun('symbolic-ref', '-q', 'HEAD');
  const ref = symbolic.stdout?.trim() ?? '';
  if (head.status === 1 && symbolic.status === 0 && ref.startsWith('refs/heads/')) {
    const identity = gitIdentityProblem();
    if (identity) die([identity]);
    return { mode: 'unborn', ref };
  }
  return { mode: 'broken' };
}
// 起始提交只建立不存在的 ref（update-ref 舊值留空），不經 git commit，也不讀使用者的暫存。
function initialCommit(tree, ref, fail) {
  const commit = gitRun('commit-tree', tree, '-m', INITIAL_MESSAGE);
  if (commit.status !== 0) fail('commit-tree', commit);
  const sha = commit.stdout.trim();
  const update = gitRun('update-ref', '-m', 'sb init: 起始提交', ref, sha, '');
  if (update.status !== 0) fail('update-ref', update);
  return { sha, branch: ref.replace(/^refs\/heads\//, '') };
}
function bootstrapFresh() {
  const created = [join(ROOT, '.git'), join(ROOT, '.gitignore')].filter((p) => !existsSync(p));
  // 回復本次建立的 .git 與 .gitignore；刪不掉的列出由使用者處理，不以例外中斷。
  const rollback = () => {
    const left = created.filter((p) => { try { rmSync(p, { recursive: true, force: true }); return false; } catch { return true; } });
    return left.length ? `無法移除 ${left.join('、')}，請手動刪除` : '已移除本次建立的 .git 與 .gitignore';
  };
  const fail = (step, r) => die([`建立 Git 儲存庫失敗（${step}：${gitError(r)}）——${rollback()}，未建立流程骨架`]);
  const init = spawnSync('git', ['init', '-q', '--', ROOT], { encoding: 'utf8', timeout: 15000 });
  if (init.status !== 0) fail('git init', init);
  // 身分在建庫後才檢查：includeIf "gitdir:" 條件設定只在儲存庫內生效。
  const identity = gitIdentityProblem();
  if (identity) die([identity, `${rollback()}，未建立流程骨架`]);
  try {
    ensureWorkspaceIgnored();
    // 視為空資料夾時略過的系統雜檔，同步列入忽略，建庫後工作樹才會乾淨。
    const junk = readdirSync(ROOT).filter((n) => OS_JUNK.has(n.toLowerCase()) && gitRun('check-ignore', '-q', '--no-index', '--', n).status === 1);
    if (junk.length) {
      const giPath = join(ROOT, '.gitignore');
      const gi = existsSync(giPath) ? readFileSync(giPath, 'utf8') : '';
      appendFileSync(giPath, (gi && !gi.endsWith('\n') ? '\n' : '') + junk.map((n) => `${n}\n`).join(''));
    }
  } catch (error) { fail('.gitignore', { stderr: error.message }); }
  const hasIgnore = existsSync(join(ROOT, '.gitignore'));
  if (hasIgnore) { const add = gitRun('add', '--', '.gitignore'); if (add.status !== 0) fail('git add .gitignore', add); }
  const tree = gitRun('write-tree');
  if (tree.status !== 0) fail('write-tree', tree);
  const head = gitRun('symbolic-ref', '-q', 'HEAD');
  if (head.status !== 0) fail('symbolic-ref', head);
  const { sha, branch } = initialCommit(tree.stdout.trim(), head.stdout.trim(), fail);
  return `建立 Git 儲存庫（${join(ROOT, '.git')}）：起始提交 ${sha.slice(0, 12)}（${hasIgnore ? '只含 .gitignore' : '空樹'}）位於 ${branch}`;
}
function bootstrapUnborn(ref) {
  const fail = (step, r) => die([`補上起始提交失敗（${step}：${gitError(r)}）——索引與工作樹未變動，未建立流程骨架`]);
  const tree = spawnSync('git', ['-C', ROOT, 'mktree'], { encoding: 'utf8', input: '', timeout: 15000 });
  if (tree.status !== 0) fail('mktree', tree);
  const { sha, branch } = initialCommit(tree.stdout.trim(), ref, fail);
  return `補上起始提交 ${sha.slice(0, 12)}（空樹）於 ${branch}——索引與工作樹未變動，既有暫存保留`;
}
function switchWorkBranch(br) {
  const exists = gitRun('rev-parse', '--verify', '-q', `refs/heads/${br}`).status === 0;
  const r = exists ? gitRun('checkout', br) : gitRun('checkout', '-b', br);
  if (r.status === 0) return { workBranch: br, note: `開發分支：${br}（${exists ? '已存在，切換過去' : '已建立並切換'}）` };
  return { note: `開發分支 ${br} 無法${exists ? '切換' : '建立'}（${gitError(r)}）——分支跳過，由主代理依已授權路由處理分支缺口` };
}
function cmdInit(slug, type = 'feat', noGit = false) {
  if (!slug) usage();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(slug)) die([`slug 僅接受英數與連字號（首字英數、≤64 字）：${slug}`], 2);
  if (!TYPES.includes(type)) die([`type 僅接受：${TYPES.join('/')}（預設 feat）——收到：${type}`], 2);
  refuseEmptySubfolder();
  requireHealthyState();
  const prior = existsSync(STATE_FILE) ? readStartupState() : null;
  const ended = endedState(prior, ROOT);
  if (existsSync(STATE_FILE) && !uninitializedState(prior, ROOT) && !directState(prior, ROOT) && !ended) die([`flow-state 已存在（${STATE_FILE}）且非合法未初始化／直接實行紀錄或 ended——進行中流程、部分初始化或異常資料保持原樣`]);
  if (ended) { const problems = endedInitProblems(prior); if (problems.length) die(problems); }
  for (const target of ended ? [join(SB_DIR, slug), join(SB_DIR, 'archive', slug)] : []) {
    if (existsSync(target)) die([`新 slug 路徑已占用：${target}——選擇未使用的 slug，既有文件保持原樣`]);
  }
  const gitPlan = ended ? closedGitPlan(prior) : { problems: [], baseCommit: null };
  if (gitPlan.problems.length) die(gitPlan.problems);
  const repo = planRepository(noGit);
  let branchNote = '', workBranch;
  // 建庫與起始提交先於骨架：失敗時不留下半套流程。
  const repoNote = repo.mode === 'fresh' ? bootstrapFresh() : repo.mode === 'unborn' ? bootstrapUnborn(repo.ref) : '';
  if (gitPlan.baseCommit) {
    const br = `${type}/${slug}`;
    const existing = gitRun('for-each-ref', '--format=%(refname)', `refs/heads/${br}`);
    if (existing.status !== 0 || existing.stdout.trim()) die([`新分支已存在或無法查證：${br}——保持原狀`]);
    const checkout = gitRun('checkout', '-b', br, gitPlan.baseCommit);
    if (checkout.status !== 0) die(['無法從已查證基底建立新分支，未初始化新流程']);
    workBranch = br;
    branchNote = `開發分支：${br}（起點 ${prior.closeout.baseBranch} @ ${gitPlan.baseCommit}）`;
  }
  mkdirSync(SB_DIR, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  logUsage(); // 工作區尚不存在時，init 的使用紀錄延到骨架建立後
  mkdirSync(join(SB_DIR, slug, '001'), { recursive: true });
  mkdirSync(join(SB_DIR, 'archive'), { recursive: true });
  const slugPath = join(SB_DIR, slug, 'SLUG.md');
  if (!existsSync(slugPath)) {
    const templatePath = fileURLToPath(new URL('../../skills/shiftblame/assets/SLUG.md', import.meta.url));
    let content = null;
    try { if (existsSync(templatePath)) content = readFileSync(templatePath, 'utf8'); } catch { /* 範本不可讀 → 最小種子 */ }
    if (!content) content = `---\nslug: ${slug}\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${slug}\n\n（最小種子——由主代理依範本補全結構：§3 待辦／§4 段表＋里程碑清單＋定案索引／三面向範本節）\n`;
    else content = content.replaceAll('<slug>', slug).replaceAll('<YYYY-MM-DD>', new Date().toISOString().slice(0, 10));
    writeFileSync(slugPath, content);
  }
  try {
    ensureWorkspaceIgnored();
  } catch { out('〔忽略檢查〕無法讀寫 .gitignore，請確認 .shiftblame/ 忽略設定。'); }
  if (!gitPlan.baseCommit) {
    if (repo.mode === 'none') branchNote = '非 Git 模式（--no-git）：不建分支與基底錨點，收尾只歸檔';
    else if (repo.mode === 'broken') branchNote = 'Git 查詢失敗（HEAD 無法解析）——分支未建立；修復 Git 後以 sb state 查證，分支由主代理依已授權路由補建';
    else ({ workBranch, note: branchNote } = switchWorkBranch(`${type}/${slug}`));
  }
  // git baseline 錨定（產出遙測的時序基準）：init 時記 HEAD 與起始時間——sb end 以 baseline..HEAD 做 diff 時序分析
  // （資料在 git；非 git 工作區記 null，遙測 diff 缺省）。工具呼叫計數由 hooks 另存 tmp，
  // 這裡記下開 slug 時的累計值（usageBase），sb end 以差值算本 slug 的呼叫數。
  const carried = prior ? (ended ? hookRecords(prior) : prior) : {};
  delete carried.turnUsage; delete carried.usageTotals;
  const usageBase = readHookRecords(ROOT).usageTotals?.requests ?? 0;
  writeState({ ...carried, slug, ms: '001', node: 'requirement', startedAt: new Date().toISOString(), baseCommit: gitHeadCommit(), usageBase, ...(workBranch ? { workBranch } : {}) });
  fin([`slug「${slug}」骨架建立：flow-state＋<slug>/001/＋SLUG.md＋archive/ → ${SB_DIR}`, ...(repoNote ? [repoNote] : []), branchNote, `目前段：requirement——六段圓環之首，任何新意圖經產品訪談對齊後由此展開（開工授權由 slug 建立與訪談紀錄承載）`, `專案根錨定：${ROOT}${ROOT === resolve(process.cwd()) ? '' : `（由 ${process.cwd()} 向上錨定）`}`]);
}

// sb init --main：完結 ended 生命週期——不開新 slug、不建工作分支，留在 closeout 基底分支直接作業
// （直接實行語意）。與開新 slug 同一道衛生驗證（歸檔完成＋closeout 證據＋分支清除＋樹淨），另驗目前
// 分支＝closeout 基底；完結戳（concludedAt）維持 ended 分類（歸檔與證據保留），之後 commitmsg 走正常
// type 訊息（merge <slug> 固定訊息僅限完結前收尾——合併證據已由 closeout 查證）。
function cmdInitMain(slugArg) {
  if (slugArg) usage();
  const current = requireHealthyState();
  if (!endedState(current.state, ROOT)) die([`完結僅接受合法 ended 狀態（目前 ${current.kind}）——sb init --main 是 ended 的收束出口；開新流程走 sb init <新slug>`]);
  const st = current.state;
  if (st.concludedAt) die([`本 slug 已完結（${st.concludedAt}）——base 分支直接作業中；開新流程走 sb init <新slug>`]);
  const problems = [...endedInitProblems(st), ...closedGitPlan(st).problems];
  if (st.closeout && hasGitMetadata()) {
    const head = gitRun('symbolic-ref', '--quiet', '--short', 'HEAD');
    if (head.status !== 0) problems.push('無法查證目前分支（detached HEAD？）——切回 closeout 基底分支後再完結');
    else if (head.stdout.trim() !== st.closeout.baseBranch) problems.push(`完結須停於 closeout 基底分支 ${st.closeout.baseBranch}（目前 ${head.stdout.trim()}）——先切回基底再完結`);
  }
  if (problems.length) die(problems);
  st.concludedAt = new Date().toISOString();
  writeState(st);
  fin([
    `ended 生命週期已完結（${st.concludedAt}）：留在 ${st.closeout ? `基底分支 ${st.closeout.baseBranch}` : '目前工作區'} 直接作業（直接實行語意——正常提交走 sb commitmsg）`,
    '狀態維持 ended 分類（歸檔與 closeout 證據保留）；日後開新 slug：sb init <新slug>（同 ended 驗證重跑）',
  ]);
}


// （hooks Stop：決策邊＝合法停等零申報；中鏈與對抗未完成＝擋停一次強制續行，真外部阻塞第二次放行，
// 待決於回覆說明——對話承載 A2）。flow-state 舊 stopReport 鍵由 migrateStreams 讀取即剝。

function cmdState() {
  const { kind, state: st } = requireHealthyState();
  if (['missing', 'uninitialized', 'direct'].includes(kind)) {
    out(kind === 'direct' ? '直接實行：合法無段位紀錄；沒有 slug。' : '尚未初始化：沒有已接入的 slug；既有 hooks 紀錄保持原值。');
    out('經 shiftblame:think 依使用者授權路由：不開 slug 可直接實行；明確開 slug 才執行 sb init <slug>。狀態可辨識不等於批准。');
    out('直接作業交接：sb handoff list；選定具名工作後以 sb handoff show <task> 讀取，不自動載入。');
    return;
  }
  if (st?.node === 'ended') {
    if (!endedState(st, ROOT)) die(['ended 狀態不完整或未知——保留原檔，查明原因後修復']);
    if (st.concludedAt) {
      out(`slug: ${st.slug}   狀態：ended＋已完結（${st.concludedAt}）——base 分支直接作業中（直接實行語意）`);
      out('  提交走 sb commitmsg（正常 type 訊息）；開新工作：經 shiftblame:think 對齊後 sb init <新slug>');
      out('  直接作業交接：sb handoff list；選定具名工作後以 sb handoff show <task> 讀取，不自動載入。');
      return;
    }
    out(`slug: ${st.slug}   狀態：ended（已 pass 結束，${st.endedAt}）`);
    const problems = [...endedInitProblems(st), ...closedGitPlan(st).problems];
    if (problems.length) for (const p of problems) out(`  初始化前：${p}`);
    else out('  下一步：經 shiftblame:think 對齊新工作後 sb init <新slug>（開新流程）或 sb init --main（完結 ended 生命週期、留在 base 分支直接作業——不開 slug 不建分支；工作與歸檔路徑須未占用）');
    return;
  }
  if (st.node === 'done') { // done 相容狀態：依驗收出口處理，查詢保持來源原樣
    out(`slug: ${st.slug}   ms: ${st.ms}   段: done（相容狀態，對應 verify 驗收出口）`);
    out('  pass 後的出口分兩層，由使用者決定：');
    for (const line of exitLines(st)) out(line);
    out('  重修＝使用者新輸入先經訪談對齊再回 requirement 開新輪');
    return;
  }
  if (!objectRecord(st) || typeof st.slug !== 'string' || !st.slug || typeof st.ms !== 'string' || !(Object.hasOwn(FLOW, st.node) || st.node === 'ended')) die(['flow-state 狀態不完整或未知——保留原檔，查明原因後修復；未執行任何狀態變更']);
  out(`slug: ${st.slug}   ms: ${st.ms}${st.rev ? `   輪次: r${String(st.rev).padStart(2, '0')}` : ''}   段: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  if (st.g2Contract?.ms === st.ms) out(`G2 contract: ${st.g2Contract.sha256}（${st.g2Contract.file}）`);
  if (!(st.g1Contract?.ms === st.ms || st.g2Contract?.ms === st.ms)) {
    const turn = readHookRecords(ROOT).turnUsage ?? st.turnUsage;
    if (turn) out(`回合觀測（純量測，無預算無上限）：本回合迄今 ${turn.requests} 工具調用——工作做到完成為止`);
  }
  // 先行研究的比對基準：審查與判定期間的 tmp 筆記記下此值，判定後只重查受影響部分。
  if (st.node === 'research') {
    const g1 = g1DefHash(st);
    if (g1) out(`G1 定義區 hash（目前）：${g1}——時點 1 審查期間的先行研究筆記記錄此值，判定後核對`);
  } else if (st.node === 'quality') {
    const g2 = g2DefHash(st);
    if (g2) out(`G2 定義區 hash（目前）：${g2}——時點 2 審查期間的先行研究筆記記錄此值，判定後核對`);
  } else if (st.node === 'verify') {
    const head = verifiedCommit(st); // 與時點 3 條目綁定的比對同一來源
    if (head) out(`受驗提交：${head}——時點 3 審查期間的先行研究筆記記錄此值，判定後核對`);
  }
  const nexts = [...FLOW[st.node].next];
  if (st.node !== 'requirement' && !nexts.includes('requirement')) nexts.push('requirement');
  for (const n of nexts) {
    if (n === 'requirement' && !FLOW[st.node].next.includes('requirement')) {
      out('  → requirement（回頭：任何新意圖先經產品訪談對齊，同 ms 開新輪）');
      continue;
    }
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
  if (st.node === 'verify') {
    out('  時點 3 審查＋使用者終審通過後的出口（真驗收完成、G1 回指閉環——GWT 逐條行為證據在回指區）分兩層，由使用者決定：');
    for (const line of exitLines(st)) out(line);
    out('  fail＝使用者新輸入先經訪談對齊再回 requirement');
  }
}

// 帳本收帳（不阻擋）：切段時列出 tmp/<slug>/ledger.md 的 [未決] 行，已落 G 檔或交接的由代理原行改標 [已解] 並回指落點。
function ledgerOpenLines(slug) {
  let raw;
  try { raw = readFileSync(join(SB_DIR, 'tmp', slug, 'ledger.md'), 'utf8'); } catch { return []; }
  return raw.replace(/\r\n?/g, '\n').split('\n').filter((l) => /^\s*-\s+(?:\S+\s+)?\[未決\]/.test(l));
}

function cmdNext(target, opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = migrateStreams(readJson(STATE_FILE));
  if (st.node === 'done') st.node = 'verify'; // done 相容狀態按 verify 處理，寫入時儲存目前節點
  if (st.node === 'ended' || !(st.node in FLOW)) die([`目前狀態 ${st.node ?? '（無）'} 不可推進——slug 已結束或狀態檔不屬於任何段`]);
  if (!(target in FLOW)) die([`未知段「${target}」。流程節點：${Object.keys(FLOW).join(' → ')}`], 2);
  const legal = FLOW[st.node].next.includes(target) || backEdge(st.node, target);
  if (!legal) die([`不合法推進：${st.node} → ${target}（可走：${[...FLOW[st.node].next, 'requirement'].join(' / ')}）`]);
  const { problems, passes } = gate(st, target, opts);
  if (problems.length) die(problems);
  const prev = st.node;
  st.node = target;
  delete st.stopBlockedAt; // 工作已續行——清除舊版擋停欄位
  if (prev === 'research' && target === 'plan' && !unchangedG1Approval(ROOT, st)) {
    // 首次核准或重新核准後才封存；同一已核准定義的技術回查保留原 hash 與 sealedAt。
    // 回指區在 hash 外隨執行更新，需求滿足集合改變仍先回 requirement 修約。
    const file = gPath(st, 1);
    const raw = mdOf(file) ?? '';
    const heads = reflectHeads(raw);
    if (heads !== 1) die([`G1 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——推進前修正回指區格式（定義區與回指區須以此標題分隔）`]);
    const reseal = !!st.g1Contract;
    st.g1Contract = { ms: st.ms, file, sha256: sha256Text(defSection(raw)), sealedAt: new Date().toISOString() };
    passes.push(`G1 定義區契約${reseal ? '已重封存（重新核准後凍結）' : '已封存（時點 1——自進 plan 起全鏈凍結）'}（flow-state）：${st.g1Contract.sha256.slice(0, 12)}`);
  }
  if (prev === 'quality' && target === 'build' && !unchangedG2Approval(st)) {
    // G2（計畫＋品質）於時點 2 封存；回指區在 hash 外隨執行更新。
    const file = gPath(st, 2);
    const raw = mdOf(file) ?? '';
    const heads = reflectHeads(raw);
    if (heads !== 1) die([`G2 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——推進前修正回指區格式（定義區與回指區須以此標題分隔）`]);
    const reseal = !!st.g2Contract;
    st.g2Contract = { ms: st.ms, file, sha256: sha256Text(defSection(raw)), sealedAt: new Date().toISOString() };
    passes.push(`G2 定義區契約${reseal ? '已重封存（重新核准後凍結）' : '已封存（時點 2——自進 build 起全鏈凍結）'}（flow-state）：${st.g2Contract.sha256.slice(0, 12)}`);
  }
  if (target === 'requirement') {
    // 回頭邊／出口邊（任何新意圖先經訪談回 requirement）：同 ms 開新輪；--new-ms（出口邊——使用者終審後開新里程碑）→ms++
    delete st.g1Contract; delete st.g2Contract;
    if (prev === 'verify' && opts.newMs) {
      const prevMs = st.ms; // per-ms 遙測結算對象＝前一 ms（鍵＝被結算 ms）
      st.ms = String(Number(st.ms) + 1).padStart(3, '0');
      delete st.rev; // 新 ms 乾淨輪次——舊 ms 輪號不帶入
      delete st.sopReview; // 審查戳記屬 ms——新 ms 重跑三問後重新留痕
      delete st.edgeAt; delete st.lastAdv; // 邊推進時戳與對抗條目屬 ms——新 ms 重驗（出口新鮮度由新 ms 的條目對照承載）
      // 待重審標記屬 ms——新 ms 乾淨開場，不帶入上一 ms 的暫時性通過疑慮。
      const release = acquireLock(hookRecordsPath(ROOT), { waitMs: 2000, staleMs: 10000 });
      if (release) {
        try {
          const rec = readHookRecords(ROOT);
          if (rec.suspect) { delete rec.suspect; writeAtomic(hookRecordsPath(ROOT), JSON.stringify(rec, null, 2)); }
        } finally { release(); }
      }
      passes.push(`新里程碑：${st.ms}（--new-ms）`);
      if (existsSync(join(ROOT, '.git')) && (st.msBaseline || st.baseCommit)) {
        const d = gitDiffStats(st.msBaseline || st.baseCommit, gitHeadCommit());
        st.msTelemetry = { ...(st.msTelemetry ?? {}), [prevMs]: { diff: d, settledAt: new Date().toISOString() } }; // per-ms 遙測結算（前一 ms）
      }
      st.msBaseline = gitHeadCommit(); // 新 ms 記自身基準
    } else if (prev !== 'requirement') { // requirement→requirement＝no-op 輪
      // 開新輪：新輪重寫自洽，時序由 edgeAt＋輪次計數承擔（歷史不可變性歸 git）
      const revN = countRev(st);
      if (revN) { st.rev = revN; passes.push(`修正輪 r${String(revN).padStart(2, '0')}：新輪重寫自洽（時序由 edgeAt 承擔，歷史歸 git）——按受影響範圍整理文件並驗證`); }
    }
  }
  // 各邊保留最後推進時間，供審查新鮮度核對。
  const prevEdgeAt = st.edgeAt?.[`${prev}→${target}`];
  st.edgeAt = { ...(st.edgeAt ?? {}), [`${prev}→${target}`]: new Date().toISOString() };
  // 時點通過是暫時性的：下游連續失敗曾把封存邊標記待重審（hooks 寫 tmp/hook-records.json），該邊再次推進即重審通過。
  const susp = readHookRecords(ROOT).suspect;
  const point = susp ? Object.keys(susp).find((p) => ({ '1': 'research→plan', '2': 'quality→build' })[p] === `${prev}→${target}`) : null;
  if (point && susp[point] && (!prevEdgeAt || prevEdgeAt < susp[point])) {
    passes.push(`時點 ${point} 重審通過——待重審標記解除（該次通過曾被下游連續失敗動搖，本次重新推進即重審）`);
    delete susp[point];
    const release = acquireLock(hookRecordsPath(ROOT), { waitMs: 2000, staleMs: 10000 });
    if (release) {
      try {
        const rec = readHookRecords(ROOT);
        if (rec.suspect) { delete rec.suspect[point]; if (!Object.keys(rec.suspect).length) delete rec.suspect; writeAtomic(hookRecordsPath(ROOT), JSON.stringify(rec, null, 2)); }
      } finally { release(); }
    }
  }
  writeState(st);
  const openLedger = ledgerOpenLines(st.slug);
  if (openLedger.length) passes.push(`帳本未決 ${openLedger.length} 筆——已寫進對應 G 檔或交接的，把該行 [未決] 原地改標 [已解] 並回指落點：\n  ${openLedger.join('\n  ')}`);
  fin([`${prev} → ${target}`, ...passes]);
}

// 對退役命令提供目前工作入口。
function cmdUnlockAbsent() {
  die(['sb unlock 不存在；依 shiftblame:think 理解需求後承接已授權工作。決策出口使用 --boss-ok 與對應獨立審查。']);
}

// Optional review record for affected governance documents.
function govDocFiles() {
  return ['SOP.md','ROADMAP.md'].filter(n=>existsSync(join(SB_DIR,n)));
}

function gitDiffStats(base, head) {
  const r = gitRun('diff', '--numstat', base, head);
  if (r.status !== 0) return null;
  let additions = 0, deletions = 0, files = 0;
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue;
    files += 1;
    const [a, d] = line.split('\t');
    if (/^\d+$/.test(a)) additions += Number(a);
    if (/^\d+$/.test(d)) deletions += Number(d);
  }
  return { additions, deletions, files };
}
function gitHeadCommit() {
  if (!hasGitMetadata()) return null;
  const r = gitRun('rev-parse', 'HEAD');
  return r.status === 0 && commitId(r.stdout.trim()) ? r.stdout.trim() : null;
}


// Retain a bounded review summary and current file hashes.
function cmdSopreview(answers) {
  const q=String(answers??'').trim();
  if (!q) die(['請說明已審查的範圍與結論。']);
  const current=requireHealthyState();
  const st=current.state ?? {};
  const files=Object.fromEntries(govDocFiles().map(n=>[n,sha256Text(readFileSync(join(SB_DIR,n),'utf8'))]));
  st.sopReview={...(current.kind==='active'?{ms:st.ms}:{}),at:new Date().toISOString(),answers:q.slice(0,200),files,...(current.kind!=='active'&&gitHeadCommit()?{head:gitHeadCommit()}: {})};
  mkdirSync(SB_DIR,{recursive:true});
  writeState(st);
  fin(['治理文件審查已記錄：'+q]);
}

// 收尾依序完成歸檔、基底確認、合併、核對及分支清理。
// 偵測基底 → merge --no-ff（訊息固定 merge <slug>）→ 內建查證 → 留痕 closeout → 刪本機工作分支。
// 任一步 die（ended 未寫入，狀態保持 verify 可修後重試）；重試冪等——已合併且有證據即跳過重併。
// 回傳 null＝無工作分支可收（非 Git 或分支已隨前次收尾清除），僅歸檔；否則回傳留痕摘要供輸出。
function finalizeMerge(st, baseFlag) {
  const candidates = st.workBranch ? [st.workBranch] : TYPES.map(type => `${type}/${st.slug}`).filter(name => branchTip(name));
  if (!candidates.length) return null;
  if (candidates.length > 1) die(['多個候選工作分支無法唯一辨識——人工查明分支狀態後重試 sb end，或以 sb closeout 查證']);
  const workBranch = candidates[0];
  const workCommit = branchTip(workBranch);
  if (!workCommit) {
    if (st.closeout?.slug === st.slug && st.closeout?.workBranch === workBranch) return null; // 前次收尾已完成（留痕在、分支已刪）——冪等跳過
    die([`工作分支 ${workBranch} 不存在且無收尾留痕——人工查明或恢復分支後重試 sb end`]);
  }
  if (baseFlag && workBranch === baseFlag) die([`--base 不可等於工作分支本身（${workBranch}）——指定收尾合併的基底分支`]);
  let base = baseFlag;
  if (!base) {
    // 基底自動偵測：slug 起始提交（st.baseCommit——init 時錨定）所在的唯一本機分支；不猜主幹名稱
    if (!st.baseCommit) die(['無法自動偵測基底（缺 slug 起始提交錨點）——須帶 --base <本機基底分支> 明示']);
    const r = gitRun('for-each-ref', '--format=%(refname:short)', '--contains', st.baseCommit, 'refs/heads');
    if (r.status !== 0) die(['基底偵測查詢失敗——須帶 --base <本機基底分支> 明示']);
    const hits = r.stdout.trim().split(/\r?\n/).filter(n => n && n !== workBranch);
    if (hits.length === 1) base = hits[0];
    else if (!hits.length) die([`基底偵測零命中（起始提交不在任何本機分支）——須帶 --base <本機基底分支> 明示`]);
    else die([`基底偵測歧義（${hits.join('、')} 皆含 slug 起始提交）——須帶 --base <本機基底分支> 明示`]);
  }
  if (!branchName(base)) die([`--base 須為合法本機分支名：${base}`]);
  const baseCommit = branchTip(base);
  if (!baseCommit) die([`基底分支不存在或尚無提交：${base}`]);
  const isAncestor = gitRun('merge-base', '--is-ancestor', workCommit, baseCommit).status === 0;
  if (isAncestor) {
    const ev = noFfMergeEvidence(workCommit, baseCommit, st.slug);
    if (!ev || ev.invalidMessage) {
      die([ev?.invalidMessage
        ? `工作提交已進基底但合併訊息不符固定格式（實得「${ev.subject}」）——回到合併前基底（git reflog 可查）後 git merge --no-ff ${workBranch} -m "merge ${st.slug}" 重併，再重試 sb end`
        : '工作提交已快轉進基底（無 --no-ff 合併提交證據）——git reset --hard <合併前基底>（git reflog 可查）後重試 sb end，或以 sb closeout 查證修復']);
    }
  } else {
    const cur = gitRun('branch', '--show-current');
    if (cur.status === 0 && cur.stdout.trim() !== base) {
      const co = gitRun('checkout', base);
      if (co.status !== 0) die([`無法切換至基底分支 ${base}——排除阻礙後重試 sb end（狀態仍為 verify）`]);
    }
    const merge = gitRun('merge', '--no-ff', workBranch, '-m', `merge ${st.slug}`);
    if (merge.status !== 0) die([`收尾合併失敗（衝突或阻礙）——git merge --abort 復原後排除衝突原因，重試 sb end（狀態仍為 verify，未寫 ended）`]);
    if (!noFfMergeEvidence(branchTip(workBranch), branchTip(base), st.slug)) die(['合併後查證失敗（無 --no-ff 證據）——人工查明 git 狀態後以 sb closeout 查證']);
  }
  // 遠端來源留痕（與 closeout 同準：遠端有未進基底的舊功能提交即擋）
  const remotes = [];
  try {
    for (const r of knownRemoteTargets(workBranch)) {
      const remote = remoteTips(r.name, r.ref);
      if (remote.tips.some(tip => gitRun('merge-base', '--is-ancestor', tip, branchTip(base)).status !== 0)) throw new Error(`遠端 ${r.name} 的舊功能提交尚無基底祖先證據——先 fetch／處理遠端後重試 sb end`);
      remotes.push({ ...r, configHash: remote.configHash });
    }
  } catch (e) { die([e.message]); }
  st.closeout = { slug: st.slug, workBranch, workCommit, baseBranch: base, at: new Date().toISOString(), remotes };
  // 先寫下收尾留痕再刪分支：刪除後中斷時，重跑可由留痕辨識已完成的合併。
  writeState(st);
  const del = gitRun('branch', '-d', workBranch);
  if (del.status !== 0) die([`收尾留痕完成但刪除工作分支失敗——人工 git branch -d ${workBranch} 後重試 sb end（重試冪等跳過重併）`]);
  return { workBranch, workCommit, baseBranch: base };
}

// 本 slug 的工具呼叫數：hooks 在 tmp 的累計值減去開 slug 時的基準；累計起點晚於開 slug
// （紀錄曾被清除）時整段累計都屬本 slug。舊版開的 slug 沒有基準，沿用 flow-state 內的累計。
function toolCallCount(st) {
  const totals = readHookRecords(ROOT).usageTotals;
  if (Object.hasOwn(st, 'usageBase') && totals) {
    return st.startedAt && totals.firstAt > st.startedAt ? totals.requests : Math.max(0, totals.requests - st.usageBase);
  }
  return !Object.hasOwn(st, 'usageBase') && Object.hasOwn(st, 'usageTotals') ? st.usageTotals.requests : null;
}

// --boss-ok 承接對話中已取得的使用者授權。
// 機械不驗時戳，語義授權由 think 揭露與使用者終審承擔。
function cmdEnd(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = migrateStreams(readJson(STATE_FILE));
  if (st.node === 'done') st.node = 'verify'; // done 相容狀態按 verify 處理，寫入時儲存目前節點
  if (st.node !== 'verify') die([`sb end 僅限 verify 態選 end（目前 ${st.node}）——真驗收（GWT 逐條實操、行為證據落回指區）完成、G1 回指閉環，並完成時點 3 審查與使用者終審後才可結束`]);
  if (!opts.bossOk) die(['結束是使用者終審決策——須帶 --boss-ok 留痕（使用者通過授權的語義由 think 揭露承擔）']);
  if (!opts.adversarial) die(['結束出口＝時點 3 審查條目與使用者終審同一邊（verify 出口邊）——須帶 --adversarial（驗收完成後 sb adversarial --point 3 審驗收結果至通過）']);
  const pt3Entry = st.lastAdv?.['3'];
  const verifyEnteredAt = st.edgeAt?.['build→verify'];
  if (!pt3Entry) die(['lastAdv 缺時點 3 條目——驗收完成、G1 回指閉環後須先 sb adversarial <報告檔> --point 3（審驗收結果：GWT 回指、假綠燈、錯誤處置完整性）才可出口']);
  if (verifyEnteredAt && pt3Entry.at <= verifyEnteredAt) die(['時點 3 對抗條目過期（早於本 ms 進 verify）——本輪須重新 sb adversarial --point 3（驗收後審驗收結果）才可出口']);
  const bound = bindingProblem('3', pt3Entry, st);
  if (bound) die([bound]);
  const problems = [], passes = [];
  // 里程碑閘：end 是 slug 層級的出口（歸檔＋合併＋刪分支），目前 ms 之後還有未完成里程碑即擋——
  // 時點 3 pass 只代表目前里程碑通過。清單已隨前次收尾歸檔（重試）或 slug 沒有清單時不核對。
  const plan = milestonePlan(st);
  if (plan?.unreadable.length) die([
    `SLUG 里程碑清單有無法辨識的列（ms 欄須為編號，如 002）：${plan.unreadable.slice(0, 3).join('；')}——修正 ${join(SB_DIR, st.slug, 'SLUG.md')} 後重試 sb end（狀態仍為 verify）`,
  ]);
  if (plan?.pending.length) die([
    `SLUG 里程碑清單還有後續未完成里程碑：${plan.pending.join('、')}——sb end 結束整個 slug（歸檔、合併回基底、刪除本機工作分支），不是結束目前里程碑 ${st.ms}`,
    '繼續下一個里程碑：sb next requirement --new-ms --adversarial --boss-ok',
    `使用者決定提前結束 slug：把這些列的狀態改為「取消」後重試 sb end（${join(SB_DIR, st.slug, 'SLUG.md')}；狀態仍為 verify）`,
  ]);
  if (plan) passes.push('里程碑清單已核對：目前 ms 之後沒有未完成里程碑');
  // 收尾文件閘：本 slug 期間動過參照型文件時，文件集須先過 sb rewrite 判準——
  // 收尾出口強制整檔重寫落實；無 git 或無基準提交（--no-git／非 Git 工作區）無 diff 事實，跳過。
  if (st.baseCommit) {
    const touched = gitRun('diff', '--name-only', `${st.baseCommit}..HEAD`);
    const files = touched.status === 0 ? touched.stdout.split('\n').filter(isDocPath) : [];
    if (files.length) {
      const bad = docsFindings();
      if (bad.length) die([
        `收尾文件閘未過（本 slug 動過：${files.slice(0, 5).join('、')}${files.length > 5 ? ` 等 ${files.length} 檔` : ''}）——先以 sb rewrite 整檔重寫至 pass 再收尾：`,
        ...bad,
      ]);
    }
  }
  passes.push(`時點 3 審查條目與使用者終審（--adversarial＋--boss-ok）已核對${Object.hasOwn(pt3Entry, 'head') ? '；受驗提交與審查時一致' : ''}`);
  checkCleanWorktree(problems, passes, 'pass 前');
  if (problems.length) die(problems);
  mkdirSync(join(SB_DIR, 'archive'), { recursive: true });
  // 收尾歸檔機械化（聲稱與實做一致）：實際執行 slug 目錄的歸檔移動——此前僅輸出聲稱、移動靠手動。
  // 移動失敗即 die（ended 狀態未寫入，保持 verify 可重試）；歸檔目標已占用保持原狀由人工查明。
  const slugDir = join(SB_DIR, st.slug);
  if (existsSync(slugDir)) {
    const archivedSlug = join(SB_DIR, 'archive', st.slug);
    if (existsSync(archivedSlug)) die([`歸檔目標已占用：${archivedSlug}——保持原狀（狀態仍為 verify），查明後重試 sb end`]);
    try {
      renameSync(slugDir, archivedSlug);
    } catch (error) {
      die([`歸檔移動失敗（${error.message}）——狀態仍為 verify，排除阻礙後重試 sb end`]);
    }
  }
  // 收尾依序完成歸檔、基底確認、合併、核對及分支清理。
  // 失敗即 die（ended 未寫入，狀態保持 verify 可修後重試）。
  const finalize = finalizeMerge(st, opts.base);
  // 產出遙測（基質優先）：diff 事實由 git 承擔——sb init 錨定 baseline commit，end 做時序分析；
  // 對抗判定取時點 3 條目（lastAdv——verdict＋審查模型）；計數與耗時來自 hooks 觀測紀錄；缺省一律 null（舊流程／無 git 可比）。
  // 錨定收尾合併後的 HEAD——遙測涵蓋整個 slug 生命週期直到收尾合併。
  const head = gitHeadCommit();
  const diff = ((st.msBaseline || st.baseCommit) && head && (st.msBaseline || st.baseCommit) !== head) ? gitDiffStats(st.msBaseline || st.baseCommit, head) : null; // per-ms 結算
  if (diff) st.msTelemetry = { ...(st.msTelemetry ?? {}), [st.ms]: { diff, settledAt: new Date().toISOString() } }; // per-ms 遙測：末段 ms 於 end 出口同步結算
  const pt3 = st.lastAdv?.['3'] ?? null;
  st.telemetry = {
    diff,
    baseCommit: st.baseCommit ?? null,
    headCommit: head,
    adversarial: pt3 ? { verdict: pt3.verdict, model: pt3.model ?? null } : null,
    counts: {
      toolCalls: toolCallCount(st),
    },
    durationMinutes: st.startedAt ? Math.round(((Date.now() - Date.parse(st.startedAt)) / 60000) * 10) / 10 : null,
  };
  st.node = 'ended';
  st.endedAt = new Date().toISOString();
  // slug 邊界清理（終態留痕後）：lastAdv/edgeAt 屬 ms 生命週期欄位，隨 slug 終結清除；
  // 清除結束狀態未使用的流程欄位。
  delete st.lastAdv; delete st.edgeAt;
  delete st.inputs; delete st.understandings; delete st.adversarialLog; delete st.understandingHold; delete st.rev; delete st.rewriteSeen; delete st.g1Contract; delete st.g2Contract; delete st.history;
  delete st.sopReview; delete st.baseCommit; delete st.startedAt;
  delete st.turnUsage; delete st.usageTotals; delete st.usageBase; delete st.stopBlockedAt;
  delete st.externalEvidence; // ended 狀態只保存目前 schema 定義的欄位。
  delete st.worktrees; // 冪等清理歷史鍵（已移除的 worktree 帳本欄位——舊 flow-state 兼容清理）
  delete st.rerunExtPending; // 冪等清理歷史鍵（已移除的返工直通 pending——舊 flow-state 兼容清理）
  delete st.adversarialAt; delete st.adversarialConsumed; // 清除退役的提交審查欄位。
  delete st.budget; delete st.budgetBreaches; // 冪等清理歷史鍵（舊版預算欄位——不相容則 ended 檔自我 invalid）
  delete st.inputsRotated; delete st.understandingsRotated; delete st.understandingSeedHash; delete st.adversarialRotated; delete st.historyRotated;
  writeState(st);
  const t = st.telemetry;
  fin([
    'verify → ended（pass）',
    `產出遙測（flow-state 留痕，事實由 git 承擔）：diff ${t.diff ? `${t.diff.additions}+／${t.diff.deletions}-／${t.diff.files} 檔` : '（無可比 baseline——缺省）'}｜對抗 ${t.adversarial ? `${t.adversarial.verdict}${t.adversarial.model ? `（${t.adversarial.model}）` : ''}` : '（無條目）'}｜toolCalls ${t.counts.toolCalls ?? '—'}｜耗時 ${t.durationMinutes ?? '—'} 分`,
    'slug 邊界清理完成：保留收尾狀態，清除 lastAdv、edgeAt 及活動流程欄位',
    '收尾歸檔已完成（機械化——聲稱與實做一致）：<slug>/ 已移至 archive/<slug>/（永續層文件已隨各 commit 即時保真——same-commit）',
    finalize
      ? `收尾合併已完成（一條龍——代理零收尾記憶負擔）：${finalize.workBranch} @ ${finalize.workCommit.slice(0, 12)} --no-ff → ${finalize.baseBranch}（訊息 merge ${st.slug}）；本機工作分支已刪，曾推送的遠端分支依留痕清除（init 再驗）`
      : '收尾僅歸檔（無工作分支可收——非 Git 工作區或前次收尾已完成）',
    ...passes,
  ]);
}



// —— 對抗宣告（時點對抗條目）：由外部唯讀子代理審查，報告原文落檔後引用 ——
// 機械驗三條：報告檔存在（.shiftblame/tmp 內）→ 含判定行（「對抗判定：通過/不通過」）→ 判定「通過」才可留條目
// （判定「通過」即零必修）。自代無合法介面——
// 子代理工具不可用＝流程阻塞等待至可用（自代無合法介面）；報告真實性由對話與抽查承擔。
// --point 必帶——時點 1（research→plan：審 G1 需求與研究）／時點 2（quality→build：審 G2 計畫與品質）／時點 3（verify 出口：驗收完成後審驗收結果）；段內提交對抗章（無 point）已移除
// （審核資源前移需求與驗收兩接縫；提交閘僅存 commitmsg 格式驗證＋印章，審核不在提交時點）。
// 同一 repo 根可有不同寫法（macOS 的 /var 即 /private/var、Windows 短檔名）：由上而下第一個實際指向 ROOT 的祖先
// 換回 ROOT 的寫法，其下各段照字面保留——只容許根的別名，repo 內的連結仍依字面判定落點。
function rootSpelled(file) {
  const root = realpathSync.native(ROOT);
  const chain = [];
  for (let p = file; ; p = dirname(p)) { chain.unshift(p); if (dirname(p) === p) break; }
  for (const p of chain) {
    try { if (realpathSync.native(p) === root) return join(ROOT, relative(p, file)); } catch { /* 不存在的段照字面 */ }
  }
  return file;
}
function cmdAdversarial(report, point) { // --point 1|2|3＝時點對抗條目（RAM）
  if (!report || !report.trim()) die(['缺報告檔——sb adversarial <子代理對抗報告檔> --point 1|2（.shiftblame/tmp/review-*.md；須由外部唯讀子代理審查，報告原文落檔後引用）']);
  if (!point) die(['--point 必帶——sb adversarial <報告檔> --point 1|2|3（1＝research→plan 時點 1：審 G1 需求與研究；2＝quality→build 時點 2：審 G2 計畫與品質；3＝verify 出口時點 3：驗收完成後審驗收結果）；段內提交對抗章已移除（審核資源前移三時點）']);
  const current = requireHealthyState();
  if (current.kind !== 'active') die(['時點對抗需要有效 slug 流程；不開 slug 的直接實行無時點對抗（時點屬六段圓環流程）']);
  mkdirSync(TMP, { recursive: true }); // 參數驗證通過才建目錄（bare repo 誤跑不長出空 .shiftblame）
  const st = current.state ?? {};
  const file = resolve(ROOT, report.trim());
  // 工作報告的可見路徑與實體位置都須在 tmp 內；連結不改變落點規範。
  let inside = false;
  try {
    const rel = relative(TMP, rootSpelled(file));
    const realRel = existsSync(file) ? relative(realpathSync.native(TMP), realpathSync.native(file)) : '..';
    inside = [rel, realRel].every((p) => p !== '' && !p.startsWith('..') && !isAbsolute(p));
  } catch { /* 無法解析即不在 tmp 內 */ }
  if (!inside || !existsSync(file) || !statSync(file).isFile()) die([`報告檔不存在、非檔案或不在 .shiftblame/tmp 內：${report}——子代理審查報告原文移入 tmp 並讀回後引用（審查須由外部唯讀子代理執行）`]);
  const text = readFileSync(file, 'utf8');
  const verdicts = [...text.matchAll(/對抗判定[：:]\s*(通過|不通過)/g)].map((m) => m[1]);
  const verdict = verdicts.at(-1); // 取最後一個判定行（多輪引用舊判定時以最終判定為準；判定行應唯一）
  if (!verdict) die(['報告缺判定行（「對抗判定：通過／不通過」）——子代理報告須含判定行；缺行屬假審查']);
  if (verdict !== '通過') die([`對抗判定「${verdict}」＝必修未清——修復後須再審查至「通過」才可推進（閘環零必修機械化）`]);
  // 審查模型（遙測素材）：報告內含「審查模型：」行則記錄（外部子代理自報身份），缺省為無鍵——不新增宣告介面
  const model = text.match(/^[ \t]*審查模型[：:][ \t]*([^\n\r]{1,80})/m)?.[1]?.trim() || null;
  // 綁定審查對象：時點 1 記 G1 定義區 hash，時點 2 記 G2 定義區 hash，時點 3 記受驗提交（非 Git 工作區沒有提交可記）。
  let target = {};
  if (point === '1') {
    const g1 = g1DefHash(st);
    if (!g1) die([`時點 1 審查的對象是 G1：${gPath(st, 1)} 不存在或「## 回指記錄」標題不是恰好一次——完成 G1 後再記錄審查`]);
    target = { g1 };
  } else if (point === '2') {
    const g2 = g2DefHash(st);
    if (!g2) die([`時點 2 審查的對象是 G2：${gPath(st, 2)} 不存在或「## 回指記錄」標題不是恰好一次——完成 G2 後再記錄審查`]);
    target = { g2 };
  } else {
    const head = verifiedCommit(st);
    if (head) target = { head };
  }
  const at = new Date().toISOString();
  const entry = { at, report: report.trim(), verdict, node: st.node ?? null, ...(model ? { model } : {}), ...target };
  // 各時點保留最後審查條目，供決策出口核對新鮮度與審查對象。
  st.lastAdv = { ...(st.lastAdv ?? {}), [point]: entry };
  writeState(st);
  fin([
    `時點${point}對抗條目留痕（@${st.node ?? '未入段'}）：${report.trim()}（判定：${verdict}）——推進帶 --adversarial 時核對條目、新鮮度與審查對象`,
    target.g1 ? `審查對象：G1 定義區 ${target.g1.slice(0, 12)}；之後修改定義區須重新審查` : target.g2 ? `審查對象：G2 定義區 ${target.g2.slice(0, 12)}；之後修改定義區須重新審查` : target.head ? `審查對象：受驗提交 ${target.head.slice(0, 12)}；之後再提交須重新審查` : '非 Git 工作區：只核對新鮮度',
  ]);
}

function cmdCommitmsg(msg) {
  if (!msg) usage();
  const current = requireHealthyState();
  // 提交核對訊息、狀態與 staged 系統檔；hooks 消費綁定 repo、訊息與時效的印章。
  // 發章：hooks PreToolUse 對 git commit 硬擋的憑證——10 分鐘內、訊息相符才放行。
  // 發章前 staged 同檢（與 hooks 同判據——雙層一致）：讀 git 展開的事實清單（cwd=ROOT 錨定），
  // 判系統檔 .shiftblame/（傾倒區唯一）。
  // quotePath=false 防引號逃逸＋--diff-filter 排除純刪除——清理通道放行；非 git 工作區跳過
  try {
    const staged = execSync('git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMRTUB', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean);
    const sys = staged.filter((p) => /^\.shiftblame(?:\/|$)/i.test(p));
    if (sys.length) die([`系統檔不入庫——staged 含 ${sys.slice(0, 5).join('、')}${sys.length > 5 ? ` 等 ${sys.length} 檔` : ''}（.shiftblame/ 須列入 .gitignore；先 git restore --staged 移除再發章）`]);
    // 文件閘：staged 動到參照型文件（README／docs／SOP／ROADMAP）時，文件集須先過 sb rewrite 判準——
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
  // 驗收段對 repo 唯讀——防「驗收中偷改＋偷 commit」的洗白鏈；重修回 test／build 才可存檔
  if (['verify', 'done'].includes(current.state?.node)) die(['驗收段對 repo 唯讀（寫入矩陣）——存檔回 quality／build（或任意→requirement）後進行']);
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
// 只寫入既有工作區或目前所在的 Git 專案根：init 被拒時不代為建立 .shiftblame，
// 非 Git 資料夾（如家目錄）也不因查詢多出工作區，否則其下子資料夾都會向上錨定到這裡。
if (existsSync(SB_DIR) || (ROOT === resolve(process.cwd()) && cmd !== 'init' && hasGitMetadata())) logUsage();
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const flags = { bossOk: false, adversarial: false, newMs: false, noGit: false, point: null, base: null, main: false, task: null, phase: null, verdict: null, report: null };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--adversarial') flags.adversarial = true;
  else if (rest[i] === '--new-ms') flags.newMs = true;
  else if (rest[i] === '--main') { flags.main = true; if (cmd !== 'init') usage(); }
  else if (rest[i] === '--no-git') { flags.noGit = true; if (cmd !== 'init') usage(); }
  else if (rest[i] === '--point') { flags.point = rest[++i] ?? ''; if (!['1', '2', '3'].includes(flags.point)) usage(); }
  else if (rest[i] === '--base') { flags.base = rest[++i] ?? ''; if ((cmd !== 'closeout' && cmd !== 'end') || !flags.base || flags.base.startsWith('-')) usage(); }
  else if (rest[i].startsWith('--')) usage(); // 未知旗標（拼錯）直接提示 usage——解析器衛生
  else pos.push(rest[i]);
}
// 修改 flow-state 的命令在讀取前取得排他鎖，讀改寫期間其他 sb 命令等待，不會互相覆蓋。
// 工作區尚未建立時沒有可競爭的狀態檔，不加鎖。
const STATE_WRITERS = new Set(['init', 'next', 'end', 'closeout', 'sopreview', 'adversarial']);
if (STATE_WRITERS.has(cmd) && existsSync(SB_DIR)) {
  const release = acquireLock(STATE_FILE, { waitMs: Number(process.env.SB_LOCK_WAIT_MS) || 30000, staleMs: 120000 });
  if (!release) die([`flow-state 正由另一個 sb 命令修改（${STATE_FILE}.lock）——等它完成後重試；持有的程序已結束仍殘留時，確認後刪除該鎖檔`]);
  process.on('exit', release);
}
if (['next', 'end', 'closeout', 'sopreview'].includes(cmd)) requireHealthyState();
switch (cmd) {
  case 'init': if (flags.main) { if (pos.length || flags.noGit) usage(); cmdInitMain(); } else cmdInit(pos[0], pos[1], flags.noGit); break;
  case 'state': cmdState(); break;
  case 'unlock': cmdUnlockAbsent(); break;
  case 'adversarial': cmdAdversarial(pos.join(' '), flags.point); break;
  case 'next': cmdNext(pos[0], flags); break;
  case 'end': cmdEnd(flags); break;
  case 'closeout': cmdCloseout(flags.base); break;
  case 'sopreview': cmdSopreview(pos.join(' ')); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  case 'rewrite': cmdRewrite(); break;
  default: usage();
}
}
