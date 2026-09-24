#!/usr/bin/env node
// sb — Shiftblame 工作狀態與契約檢查。
// 在專案根使用 git 事實、正式文件與 flow-state.json 核對階段前提。
// CLI 記錄需求封存、獨立審查及使用者授權；語義與真實驗收由對話及行為證據承載。
// 使用 Node 內建模組；狀態與工作記錄存於 <repo>/.shiftblame/。
// exit：0 = 通過，1 = 條件不符，2 = 用法錯誤。

import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, realpathSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, basename } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { objectRecord, hookRecords, uninitializedState, directState, endedState, validCloseout, readFlowState, migrateStreams, unchangedG1Approval } from './flow-state.mjs';

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

// 各階段的正常推進與技術回查路徑。
const FLOW = {
  intent:  { next: ['requirement'], desc: '確認目標、範圍與授權；實質新需求在同一里程碑開新輪，驗收出口可開下一里程碑' },
  requirement: { next: ['research'], desc: 'G1 需求與驗收契約；首次或改義需時點 1 獨立審查與使用者判定，有效且未變的契約沿用原核准' },
  research:{ next: ['plan', 'requirement'], desc: 'G2 技術決策與證據；必要時回 requirement 釐清契約，技術回查保留里程碑輪次' },
  plan:    { next: ['test', 'research', 'requirement'], desc: 'G3 實作順序與驗收安排；必要時回 research 或 requirement 修正前提' },
  test:    { next: ['build', 'plan'], desc: '建立與風險相稱的驗證；必要時回 plan 修正操作、計畫或驗收方法' },
  build:   { next: ['verify', 'test'], desc: '實作、整合與提交；必要時回 test 修正測試，受驗工作樹乾淨後進入 verify' },
  verify:  { next: ['intent', 'test', 'build'], desc: '執行真實驗收並回指 G1；技術問題回 test 或 build 修復，時點 2 獨立審查及使用者終審後開下一里程碑或結束' },
};

// 明確的新需求可由任意階段回 intent；已完成驗收的出口以 --new-ms 或 end 承接。
const backEdge = (from, to) => to === 'intent';

// 階段前提由正式文件、契約封存與對應審查／授權旗標共同核對。
const needsBossOk = (from, to) =>
  (from === 'intent' && to === 'requirement') || (from === 'requirement' && to === 'research');

// 兩個審查出口核對對應 lastAdv 條目及其新鮮度，並承接使用者判定。
const ADVERSARIAL_EDGES = [
  { from: 'requirement', to: 'research', point: '1' },
  { from: 'verify', to: 'intent', point: '2' },
];
const adversarialEdge = (from, to) => ADVERSARIAL_EDGES.find((e) => e.from === from && e.to === to) ?? null;

// ———— 小工具 ————

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };

const fin = (msgs) => { console.log('pass'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? "error" : "log"]("sb — Shiftblame 工作狀態與契約檢查\n\n用法：\n  sb state\n  sb init <slug> [type]                 建立已授權 slug；type 預設 feat\n  sb init --main                       完結已整合的 ended 流程，留在基底分支\n  sb next <段> [--boss-ok] [--adversarial] [--new-ms]\n  sb adversarial <報告檔> --point 1|2  記錄 tmp 內的獨立審查報告\n  sb end [--base <分支>] --adversarial --boss-ok\n  sb closeout --base <分支>             核對收尾整合事實\n  sb commitmsg \"<訊息>\"                 檢查非空單行、狀態與 staged 系統檔，發提交章\n  sb sopreview \"<範圍與結論>\"           選用的治理文件審查記錄\n  sb vault                             設定本專案 Obsidian 顯示與註冊\n  sb --help\n\nslug：intent → requirement → research → plan → test → build → verify\n技術問題可回相鄰責任段修正；明確的新需求以 next intent 開新輪。\nintent→requirement 用 --boss-ok 承接既有開工授權。\n時點 1 在 requirement→research，時點 2 在 verify 出口；皆先獨立審查再由使用者判定。\n--adversarial 與 --boss-ok 記錄已完成的真實審查及已取得的使用者授權。\n未變且有效的 G1 契約可沿用核准；定義變更需重新核准。\nend 歸檔並合併回基底，刪本機工作分支；推送依另有的發布授權。\nnext intent --new-ms 在驗收及終審完成後開下一里程碑。\n驗收使用真實行為證據，來源修正後重驗受影響範圍；未驗如實標示。");
  process.exit(code);
};

const readJson = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const mdOf = (p) => (existsSync(p) ? readFileSync(p, 'utf-8') : null);

// 前處理：以「遮罩」呈現渲染後可見文字——HTML 註解與圍籬（行首 ```／~~~，含未閉合與
// ```` 包 ``` 錯配）以空白替換但保留行列位置：行中註解後的 `##` 不會位移成行首標題、
// 未閉合結構到檔尾一律隱藏。閘門判斷以老闆看得到的文字為準。
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
// 重走 intent 開新輪只遞增計數（ms 目錄有 G 檔才計），零檔案寫入
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
    if (unique(ids).length !== ids.length) problems.push('G1 驗收契約含重複 AC-ID——每個 AC-ID MUST 唯一');
    const required = ['需求', '使用者', '前置', '操作', '可觀察結果', '失敗邊界', '證據'];
    for (const row of rows) {
      const missing = required.filter((key) => !filled(row.fields[key]));
      if (missing.length) problems.push(`G1 ${row.id} 缺實質欄位：${missing.join('、')}`);
      if (row.fields['證據'] !== 'BEHAVIOR') problems.push(`G1 ${row.id} 證據 MUST 為 BEHAVIOR——以使用者可觀察結果驗收`);
    }
    if (!problems.length) passes.push(`G1 使用者驗收契約：${unique(ids).join('、')}（BEHAVIOR）`);
    return unique(ids);
  }
  // BDD 分段格式（主推；含現狀＋消融鍵）：### AC- 分段，每段含 Given／When／Then＋現狀＋使用者＋失敗邊界＋消融＋證據——值逐鍵驗實質
  const blocks = String(g1).split(/^###\s+AC-/m).slice(1);
  if (blocks.length) {
    const ids = blocks.map((b) => 'AC-' + ((b.match(/^\s*(\d{2,})/) ?? [, '?'])[1])); // 剝中文短名——id 恆為 AC-數字（G3 對照鍵）
    if (unique(ids).length !== ids.length) problems.push('G1 驗收契約含重複 AC-ID——每個 AC-ID MUST 唯一');
    for (const [i, b] of blocks.entries()) {
      for (const [key, re] of [['Given', /Given[:：]/], ['When', /When[:：]/], ['Then', /Then[:：]/], ['現狀', /現狀[:：]/], ['使用者', /使用者[:：]/], ['失敗邊界', /失敗邊界[:：]/], ['消融', /消融[:：]/]]) { // 七鍵（現狀——差異宣言左邊：現行系統同 Given/When 的實際觀察，現狀＝Then 即偽需求；消融——拿掉此需求使用者失去什麼）
        if (!re.test(b)) { problems.push(`G1 ${ids[i]} 缺 ${key}（BDD 行為規格——字面搬運產不行為規格）`); continue; }
        const val = (b.match(new RegExp(`^[-*]?\\s*${key}[^\\S\\n]*[:：]\\s*(.+)$`, 'm')) ?? [, ''])[1].trim();
        if (!filled(val)) problems.push(`G1 ${ids[i]} ${key} 未填實質（模板照抄不構成行為規格）`);
      }
      if (!/證據[:：]\s*BEHAVIOR/.test(b)) problems.push(`G1 ${ids[i]} 證據 MUST 為 BEHAVIOR——以使用者可觀察結果驗收`);
    }
    if (!problems.length) passes.push(`G1 使用者驗收契約（BDD 行為規格）：${ids.join('、')}（BEHAVIOR）`);
    return unique(ids);
  }
  problems.push('G1 缺 AC 驗收契約——單行（- AC-01 | 鍵=值 |…）或 BDD 分段（### AC-01＋Given／When／Then／現狀／使用者／失敗邊界／消融／證據——主推 BDD）擇一定義');
  return [];
}

function validateG3Acceptance(g3, g1Ids, problems, passes) {
  const rows = acRows(g3);
  const required = ['驗收操作', '通過判準', '需要的證據', '測試'];
  for (const row of rows) {
    const missing = required.filter((key) => !filled(row.fields[key]));
    if (missing.length) problems.push(`G3 ${row.id} 缺實質欄位：${missing.join('、')}`);
  }
  const ids = unique(rows.map((row) => row.id));
  if (ids.length !== rows.length) problems.push('G3 驗收條件含重複 AC-ID——每個 G1 AC-ID MUST 恰有一列');
  const missing = g1Ids.filter((id) => !ids.includes(id));
  const unknown = ids.filter((id) => !g1Ids.includes(id));
  if (missing.length) problems.push(`G3 未逐項承接 G1：${missing.join('、')}`);
  if (unknown.length) problems.push(`G3 含不存在於 G1 的驗收 ID：${unknown.join('、')}`);
  if (!problems.length) passes.push(`G3 已逐項排程 ${g1Ids.length} 個 G1 驗收條件`);
}

function checkCleanWorktree(problems, passes, timing) {
  try {
    const dirty = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (dirty.trim()) problems.push(`${timing} working tree 必須乾淨——該提交的先精準提交，該捨棄的明確捨棄——變更先分類再回定義`);
    else passes.push(`working tree 乾淨（${timing}已完成提交／捨棄判定）`);
  } catch { passes.push('（非 git 環境，略過乾淨度檢查）'); }
}

// ———— 各節點推進閘門（target = 要進入的節點） ————
function gate(st, target, opts) {
  const problems = [];
  const passes = [];
  const reuseApproval = st.node === 'requirement' && target === 'research' && unchangedG1Approval(ROOT, st);
  if (reuseApproval) passes.push('G1 定義與當前里程碑封存完全相同——沿用已核准契約');

  // 骨架存在性閘（僅前進邊——回頭邊不擋）：SLUG.md 缺＝骨架不完整
  if (st.slug && target !== 'intent' && !existsSync(join(SB_DIR, st.slug, 'SLUG.md'))) {
    problems.push(`骨架不完整：${join(SB_DIR, st.slug, 'SLUG.md')} 不存在——由主代理手建（.shiftblame/ 永遠可寫；重跑 init 會覆蓋 flow-state，既有工作區禁止）`);
  }

  // G1 契約核對（封存於 requirement→research 邊，之後任何推進重算；回 intent 邊（老闆新輸入重走 intent）重定義前不擋）。
  // requirement→research 由時點 1 承接變更，未變且無新意圖時沿用原封存。
  // 定義 hash 改變須重新核准；滿足集合改變仍先回 intent，由既有修約流程承接。
  if (st.g1Contract?.ms === st.ms && target !== 'intent' && !(st.node === 'requirement' && target === 'research')) {
    const path = st.g1Contract.file;
    if (!path || !existsSync(path)) problems.push(`G1 契約檔不存在：${path ?? '缺失'}——回 intent（sb next intent）重定義後重新放行`);
    else {
      const raw = readFileSync(path, 'utf8');
      const heads = reflectHeads(raw);
      if (heads !== 1) problems.push(`G1 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——回指區格式破壞（RAM/ROM 分區，SKILL §0）`);
      else if (sha256Text(defSection(raw)) !== st.g1Contract.sha256) problems.push('G1 定義區已偏離封存時契約——定義級變更走回 intent（sb next intent）同 ms 開新輪（記錄實質需求修正）；回指區更新不觸契約');
      else passes.push(`G1 定義區 hash 核對：${st.g1Contract.sha256.slice(0, 12)}（封存於 flow-state；回指區在 hash 外）`);
    }
  }

  // --boss-ok：老闆決策邊留痕（旗標即章——老闆實際輸入由對話承載，機械不驗時戳；偽造由抽查承擔）
  if (opts.bossOk && !needsBossOk(st.node, target) && !opts.newMs) {
    problems.push(`「${st.node} → ${target}」不是老闆決策邊——--boss-ok 留給老闆決策邊；段內旗標切段與回頭邊不帶，工作邊沿用既有授權`);
  } else if (needsBossOk(st.node, target) && !reuseApproval && !opts.bossOk) {
    problems.push(`「${st.node} → ${target}」是老闆決策邊——MUST 帶 --boss-ok 留痕（理解老闆授權的語義由 think 揭露承擔）；時點對抗在前、老闆判定在後——pass 才推進（SKILL §3）`);
  } else if (opts.bossOk) {
    passes.push('老闆授權留痕（--boss-ok——旗標即章，對話承載老闆實際輸入）');
  }

  // --new-ms：時點 2 對抗條目＋老闆終審章同一邊——verify→intent 出口邊＝時點 2 對抗邊：
  // --adversarial＋lastAdv['2'] 條目由下方對抗邊檢查承載；--boss-ok 終審章（旗標即章——老闆輸入由對話承載）
  if (opts.newMs) {
    if (!(st.node === 'verify' && target === 'intent')) die(['--new-ms 僅限 verify→intent 邊（老闆終審 pass 後開下一 ms）——其他推進走各自旗標']);
    if (!opts.bossOk) die(['開新里程碑是老闆選擇（終審 pass 後 next）——MUST 帶 --boss-ok 留痕']);
    passes.push('老闆終審：pass 後開新 ms（--boss-ok——旗標即章）');
  }
  // --adversarial＋lastAdv point 條目對照（對抗產物屬 RAM，不入 SLUG）：
  // 時點 1 比同邊上次推進；時點 2 比本 ms 末次進 verify，修復重驗後須有本次對抗。
  // 時點 2（verify→intent）的對抗義務僅限出口（--new-ms）：fail＝老闆新輸入重走 intent 零旗標
  // （fail 本身是時點 2 對抗／終審的產物——不通過即回走證據；sb end 出口另由 cmdEnd 手動驗雙章）
  const adv = adversarialEdge(st.node, target);
  const advGate = adv && !reuseApproval && (adv.point !== '2' || opts.newMs);
  if (advGate) {
    if (!opts.adversarial) problems.push(`「${st.node} → ${target}」需時點 ${adv.point} 對抗——MUST 帶 --adversarial 宣告（對抗在前、老闆判定在後——pass 才推進）`);
    else {
      const lastEdgeAt = adv.point === '2' ? st.edgeAt?.['build→verify'] : st.edgeAt?.[`${st.node}→${target}`];
      const entry = st.lastAdv?.[adv.point];
      if (!entry) problems.push(`lastAdv 缺時點 ${adv.point} 條目——MUST sb adversarial <報告檔> --point ${adv.point}（外部唯讀子代理，報告落 tmp）後推進`);
      else if (lastEdgeAt && entry.at <= lastEdgeAt) problems.push(`時點 ${adv.point} 對抗條目過期（早於${adv.point === '2' ? '本 ms 進 verify' : '同邊上次推進'}）——本輪 MUST 重新 sb adversarial --point ${adv.point}`);
      else passes.push(`時點 ${adv.point} 對抗：lastAdv 條目對照一致（新鮮度已驗）`);
    }
  } else if (opts.adversarial && !reuseApproval) {
    if (adv) problems.push(`「${st.node} → ${target}」的時點 ${adv.point} 對抗義務僅限出口（--new-ms）——fail＝老闆新輸入重走 intent 零旗標（fail 本身是對抗／終審產物，不重驗）`);
    else problems.push(`「${st.node} → ${target}」不是對抗邊——--adversarial 留給時點對抗邊（時點 1 requirement→research／時點 2 verify 出口）`);
  }

  const g1 = mdOf(gPath(st, 1)), g2 = mdOf(gPath(st, 2)), g3 = mdOf(gPath(st, 3));

  switch (target) {
    case 'requirement': // 意圖確認邊（--boss-ok 留痕）；requirement 段才寫 G1，無 G 檔閘
      break;

    case 'research': // 假需求閘（時點 1 機械下限：requirement→research 邊審意圖→需求翻譯——格式與 GWT 掃描為機械面，語義攻防由時點 1 對抗承載）
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

    case 'plan':
      if (st.node !== 'research') break; // 測試揭露計畫問題時，允許先回到計畫修正。
      if (!g2) problems.push('G2 不存在');
      else if (!substantive(g2, 30)) problems.push('G2 內容空白——請填入支持實作計畫的技術結論與依據');
      else passes.push('G2 實質存在');
      break;

    case 'test':
      if (st.node === 'plan') { // plan → test 核對 G3 的驗收映射與實作安排。
        if (!g1) problems.push('G1 不存在——無法推進');
        const g1Ids = g1 ? validateG1Acceptance(g1, problems, passes) : [];
        if (!g3) problems.push('G3 不存在');
        else {
          const fm = section(g3, '失敗模式');
          if (fm === null) problems.push('G3 缺「失敗模式」段——premortem：假設計畫失敗了，最可能 2-3 個原因是什麼（假規劃訊號）');
          else if (!substantive(fm, 10)) problems.push('G3「失敗模式」段敷衍——列不出真實失敗點＝沒想過會怎麼失敗');
          else passes.push('G3 失敗模式（premortem）非敷衍');
          const steps = section(g3, '實作步驟');
          if (steps === null) problems.push('G3 缺「實作步驟」段——計畫沒有可執行的步驟（假規劃訊號）');
          else if (!substantive(steps, 10)) problems.push('G3「實作步驟」段敷衍');
          else passes.push('G3 實作步驟實質存在');
          if (g1) validateG3Acceptance(g3, g1Ids, problems, passes);
        }
      }
      // 進 test＝功能迭代與段內修復的切入段（plan→test 機械推進、提交閘回 test、旗標切段回 test）；假測試由文件層判準擋
      break;

    case 'build': // 存檔＝build 段結束動作；測試定稿與假測試由文件層判準（git 歷史可稽）
      break;

    case 'verify': // 進驗收＝實作已存檔：working tree 乾淨（git 判定）
      try {
        const dirty = execSync('git status --porcelain', { encoding: 'utf-8' });
        if (dirty.trim()) problems.push('working tree 未乾淨——實作存檔（commit）先於驗收（進驗收前完成提交）');
        else passes.push('working tree 乾淨（實作已存檔，git 判定）');
      } catch { /* 非 git 環境略過 */ }
      break;

    case 'intent': // 回頭邊（任何新意圖一律重走 intent）：補充／重修／追加子需求／修約——同 ms 開新輪；--new-ms 時出口邊 ms++（cmdNext）
      passes.push(st.node === 'verify' && opts?.newMs ? '--new-ms——出口邊閉環回 intent 且開新里程碑' : '回 intent——任何新意圖一律重走 intent 開新輪（同 ms）');
      break;
  }
  return { problems, passes };
}

// ———— 指令 ————

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'build', 'ci'];
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
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
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
// sb vault 以 repo 根註冊 Obsidian vault；顯示範圍為 docs/ 與 README.md。
// 查詢使用 userIgnoreFilters；檔案總管使用 data-path 與原生 CSS snippet。
// snippets 放於 configDir/snippets，以 appearance.json enabledCssSnippets 啟用。
// 退役的 docs-vault 設定由此入口清理。
// 全域 obsidian.json 於 Obsidian 關閉時更新，避免與應用程式退出寫入衝突。
const OBSIDIAN_GLOBAL_DIR = process.env.SB_OBSIDIAN_GLOBAL || join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'obsidian');
function vaultIgnoreFilters() {
  // 顯示規定集＝docs/＋README.md——頂層其餘非 dot 項目一律隱藏（dot 項核心不索引，不列）。
  const filters = [];
  let entries = [];
  try { entries = readdirSync(ROOT, { withFileTypes: true }); } catch { return []; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'docs' || e.name === 'README.md') continue;
    filters.push(e.isDirectory() ? `${e.name}/` : e.name);
  }
  return filters.sort();
}
function ensureVaultRegistration() {
  const regPath = join(OBSIDIAN_GLOBAL_DIR, 'obsidian.json');
  let reg = { vaults: {} };
  if (existsSync(regPath)) {
    try {
      const parsed = JSON.parse(readFileSync(regPath, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.vaults && typeof parsed.vaults === 'object' && !Array.isArray(parsed.vaults)) reg = parsed;
    } catch { /* 註冊表毀損——重建空表 */ }
  }
  for (const [id, entry] of Object.entries(reg.vaults)) {
    if (entry && entry.path === ROOT) return { regPath, note: `已註冊（${id}）——不動`, changed: false };
  }
  const id = randomBytes(8).toString('hex');
  reg.vaults[id] = { path: ROOT, ts: Date.now() };
  try { mkdirSync(OBSIDIAN_GLOBAL_DIR, { recursive: true }); writeFileSync(regPath, JSON.stringify(reg) + '\n'); } catch { return { regPath, note: '無法寫入全域註冊表——未註冊（Obsidian 執行中或權限不足）', changed: false, failed: true }; }
  return { regPath, note: `已補掛全域註冊表（${id}）`, changed: true };
}
function ensureObsidianIgnored() {
  // .obsidian/ 是本機 Obsidian 設定與快取（workspace 等），不入庫——冪等補忽略。
  const giPath = join(ROOT, '.gitignore');
  let gi = existsSync(giPath) ? readFileSync(giPath, 'utf8') : '';
  if (hasGitMetadata()) {
    const check = spawnSync('git', ['-C', ROOT, 'check-ignore', '--quiet', '--no-index', '--', '.obsidian/'], { encoding: 'utf8' });
    if (check.status === 0) return '.obsidian/ 已被忽略規則涵蓋（.gitignore 原樣）';
    if (check.status !== 0 && check.status !== 1) return 'Git 忽略查詢失敗——請手動確認 .obsidian/ 忽略設定';
  } else {
    const direct = [...gi.matchAll(/^(\!?)\/?\.obsidian\/?[ \t]*(?:\r?$)/gm)].at(-1);
    if (direct && direct[1] !== '!') return '.obsidian/ 已有忽略規則（非 Git 工作區，直接規則判定）';
  }
  const eol = gi.match(/\r?\n/)?.[0] ?? '\n';
  appendFileSync(giPath, (gi && !gi.endsWith('\n') ? eol : '') + '.obsidian/' + eol);
  return '.gitignore 已補一行：.obsidian/';
}
const VAULT_SNIPPET_NAME = 'sb-vault-filter';
const VAULT_SNIPPET_WHITELIST = { folders: ['docs'], files: ['README.md'] };
function vaultFilterCss() {
  // 檔案總管顯示規定集反白名單：頂層條目（data-path 不含 /）白名單之外一律 display:none；
  // 子層條目 data-path 含 /（如 docs/ 下內容）不受影響。選擇器綁 nav class（檔案總管條目專屬，
  // asar 實證 setAttr('data-path', ...) 位於 nav-folder-title／nav-file-title），不誤擊其他面板。
  const css = [
    `/* sb vault 生成：檔案總管顯示規定集——頂層僅顯示 ${VAULT_SNIPPET_WHITELIST.folders.join('、')} 與 ${VAULT_SNIPPET_WHITELIST.files.join('、')}，其餘一律隱藏。 */`,
  ];
  for (const name of VAULT_SNIPPET_WHITELIST.folders) {
    css.push(`.nav-folder-title:not([data-path*="/"]):not([data-path="${name}"]),`);
  }
  for (const name of VAULT_SNIPPET_WHITELIST.files) {
    css.push(`.nav-file-title:not([data-path*="/"]):not([data-path="${name}"]),`);
  }
  css[css.length - 1] = css[css.length - 1].replace(/,$/, ' {');
  css.push('  display: none !important;', '}', '');
  return css.join('\n');
}

function cmdVault() {
  const created = [];
  const obsidianDir = join(ROOT, '.obsidian');
  if (!existsSync(obsidianDir)) { mkdirSync(obsidianDir, { recursive: true }); created.push('.obsidian/'); }
  // 清理退役的外掛設定，統一使用原生 vault 設定。
  const staleNotes = [];
  const stalePlugin = join(obsidianDir, 'plugins', 'hidden-folders-access');
  if (existsSync(stalePlugin)) { try { rmSync(stalePlugin, { recursive: true, force: true }); staleNotes.push('已移除舊外掛殘留 hidden-folders-access'); } catch { staleNotes.push('無法移除 .obsidian/plugins/hidden-folders-access——請手動刪除'); } }
  const staleCp = join(obsidianDir, 'community-plugins.json');
  if (existsSync(staleCp)) { try { rmSync(staleCp, { force: true }); staleNotes.push('已移除舊 community-plugins.json'); } catch { staleNotes.push('無法移除 community-plugins.json——請手動刪除'); } }
  const pluginsDir = join(obsidianDir, 'plugins');
  if (existsSync(pluginsDir)) { try { if (readdirSync(pluginsDir).length === 0) rmSync(pluginsDir, { force: true }); } catch { /* 留空目錄無害 */ } }
  let filterChanged = false;
  const filterNote = (() => {
    const appJsonPath = join(obsidianDir, 'app.json');
    let cfg = {};
    if (existsSync(appJsonPath)) {
      try { cfg = JSON.parse(readFileSync(appJsonPath, 'utf8')); } catch { return '.obsidian/app.json 非 JSON——保持原樣，過濾器未設定（修復或刪除後重跑）'; }
      if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) return '.obsidian/app.json 結構非物件——保持原樣，過濾器未設定';
    }
    // 強制接管：userIgnoreFilters 每次配置都對齊規定集（顯示＝docs/＋README.md）；漂移重寫，無漂移不動檔。
    const prev = Array.isArray(cfg.userIgnoreFilters) ? cfg.userIgnoreFilters : [];
    const required = vaultIgnoreFilters();
    const drift = required.length !== prev.length || required.some((f, i) => prev[i] !== f);
    if (!drift) return `userIgnoreFilters 已對齊規定集（${required.length} 條，無漂移）`;
    cfg.userIgnoreFilters = required;
    try { writeFileSync(appJsonPath, JSON.stringify(cfg, null, 2) + '\n'); } catch { return '無法寫入 .obsidian/app.json——過濾器未設定'; }
    filterChanged = true;
    return `userIgnoreFilters 已強制設定 ${required.length} 條——顯示規定集＝docs/＋README.md，其餘一律隱藏`;
  })();
  if (filterChanged) created.push('.obsidian/app.json 過濾器');
  let explorerChanged = false;
  const explorerNote = (() => {
    // 檔案總管過濾（asar 實證：檔案總管原生不讀過濾設定）——原生 CSS snippet 機制補上顯示面：
    // snippet 檔內容漂移重寫；appearance.json enabledCssSnippets 確保包含本 snippet（不整表接管，
    // 使用者自裝 snippet 不屬規定集管轄；停用本 snippet 視為漂移，重跑即恢復）。
    const snippetsDir = join(obsidianDir, 'snippets');
    const cssPath = join(snippetsDir, VAULT_SNIPPET_NAME + '.css');
    let snippetWritten = false;
    try {
      mkdirSync(snippetsDir, { recursive: true });
      const css = vaultFilterCss();
      if (!existsSync(cssPath) || readFileSync(cssPath, 'utf8') !== css) { writeFileSync(cssPath, css); snippetWritten = true; explorerChanged = true; }
    } catch { return '無法寫入 .obsidian/snippets/——檔案總管過濾未設定'; }
    const appearancePath = join(obsidianDir, 'appearance.json');
    let appearance = {};
    if (existsSync(appearancePath)) {
      try { appearance = JSON.parse(readFileSync(appearancePath, 'utf8')); } catch { return '.obsidian/appearance.json 非 JSON——snippet 未啟用（修復或刪除後重跑）'; }
      if (typeof appearance !== 'object' || appearance === null || Array.isArray(appearance)) return '.obsidian/appearance.json 結構非物件——snippet 未啟用';
    }
    const prev = Array.isArray(appearance.enabledCssSnippets) ? appearance.enabledCssSnippets : [];
    if (prev.includes(VAULT_SNIPPET_NAME)) {
      return snippetWritten ? `檔案總管過濾：snippet ${VAULT_SNIPPET_NAME} 內容已更新（啟用中）` : `檔案總管過濾已生效（snippet ${VAULT_SNIPPET_NAME}，無漂移）`;
    }
    appearance.enabledCssSnippets = [...prev, VAULT_SNIPPET_NAME];
    try { writeFileSync(appearancePath, JSON.stringify(appearance, null, 2) + '\n'); } catch { return '無法寫入 .obsidian/appearance.json——snippet 未啟用'; }
    explorerChanged = true;
    return `檔案總管過濾：snippet ${VAULT_SNIPPET_NAME} 已生成並啟用——頂層僅顯示 docs 與 README.md，其餘一律隱藏`;
  })();
  if (explorerChanged) created.push('.obsidian 檔案總管過濾');
  let ignoreNote;
  try { ignoreNote = ensureObsidianIgnored(); } catch { ignoreNote = '無法讀寫 .gitignore——請手動確認 .obsidian/ 忽略設定'; }
  const reg = ensureVaultRegistration();
  fin([
    `vault 根＝${ROOT}——Obsidian 開啟此儲存庫即以 repo 根為 vault（無外掛）`,
    created.length ? `建立：${created.join('、')}` : '結構已存在，零新增（冪等）',
    ...staleNotes,
    filterNote,
    explorerNote,
    ignoreNote,
    `全域註冊表：${reg.note}`,
    '顯示規定集＝docs/＋README.md（查詢層：userIgnoreFilters 生效於圖譜／搜尋／快速切換／屬性；檔案總管：CSS snippet ' + VAULT_SNIPPET_NAME + ' 隱藏白名單外頂層條目；索引器掃描範圍仍為全樹——查詢結果已被過濾）',
    'Obsidian 執行中退出會把全域註冊表與設定寫回覆蓋——建議關閉 Obsidian 後執行本命令，再開啟 Obsidian 載入；漂移重跑即對齊',
  ]);
}
function cmdInit(slug, type = 'feat') {
  if (!slug) usage();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(slug)) die([`slug 僅接受英數與連字號（首字英數、≤64 字）：${slug}`], 2);
  if (!TYPES.includes(type)) die([`type 僅接受：${TYPES.join('/')}（預設 feat）——收到：${type}`], 2);
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
  let branchNote = '', workBranch;
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
  mkdirSync(join(SB_DIR, slug, '001'), { recursive: true });
  mkdirSync(join(SB_DIR, 'archive'), { recursive: true });
  const slugPath = join(SB_DIR, slug, 'SLUG.md');
  if (!existsSync(slugPath)) {
    const templatePath = fileURLToPath(new URL('../../skills/shiftblame/assets/SLUG.md', import.meta.url));
    let content = null;
    try { if (existsSync(templatePath)) content = readFileSync(templatePath, 'utf8'); } catch { /* 範本不可讀 → 最小種子 */ }
    if (!content) content = `---\nslug: ${slug}\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${slug}\n\n（最小種子——由主代理依範本補全結構：§3 待辦／§4 段表＋定案索引／三面向範本節）\n`;
    else content = content.replaceAll('<slug>', slug).replaceAll('<YYYY-MM-DD>', new Date().toISOString().slice(0, 10));
    writeFileSync(slugPath, content);
  }
  try {
    ensureWorkspaceIgnored();
  } catch { out('〔忽略檢查〕無法讀寫 .gitignore，請確認 .shiftblame/ 忽略設定。'); }
  if (!gitPlan.baseCommit) {
  try {
    const br = `${type}/${slug}`;
    let r = execSync(`git checkout -b ${br}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });
    branchNote = `開發分支：${br}（已切換）`;
    workBranch = br;
  } catch {
    try { execSync(`git checkout ${type}/${slug}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] }); branchNote = `開發分支：${type}/${slug}（已存在，切換過去）`; workBranch = `${type}/${slug}`; }
    catch { branchNote = '非 git 環境或分支不可建——分支跳過（由主代理依已授權路由處理分支缺口）'; }
  }
  }
  // git baseline 錨定（產出遙測的時序基準）：init 時記 HEAD 與起始時間——sb end 以 baseline..HEAD 做 diff 時序分析
  // （資料在 git；非 git 工作區記 null，遙測 diff 缺省）。回合計數屬 slug 生命週期——新 slug 歸零重計。
  const carried = prior ? (ended ? hookRecords(prior) : prior) : {};
  delete carried.turnUsage; delete carried.usageTotals; // 回合計數屬 slug 生命週期——新 slug 歸零重計
  writeFileSync(STATE_FILE, JSON.stringify({ ...carried, slug, ms: '001', node: 'intent', startedAt: new Date().toISOString(), baseCommit: gitHeadCommit(), ...(workBranch ? { workBranch } : {}) }, null, 2));
  fin([`slug「${slug}」骨架建立：flow-state＋<slug>/001/＋SLUG.md＋archive/ → ${SB_DIR}`, branchNote, `目前段：intent——七段圓環環首，任何新意圖經 shiftblame:think 揭露後由此展開`, `專案根錨定：${ROOT}${ROOT === resolve(process.cwd()) ? '' : `（由 ${process.cwd()} 向上錨定）`}`]);
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
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
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
    out('經 shiftblame:think 依老闆授權路由：不開 slug 可直接實行；明確開 slug 才執行 sb init <slug>。狀態可辨識不等於批准。');
    return;
  }
  if (st?.node === 'ended') {
    if (!endedState(st, ROOT)) die(['ended 狀態不完整或未知——保留原檔，查明原因後修復']);
    if (st.concludedAt) {
      out(`slug: ${st.slug}   狀態：ended＋已完結（${st.concludedAt}）——base 分支直接作業中（直接實行語意）`);
      out('  提交走 sb commitmsg（正常 type 訊息）；開新工作：經 shiftblame:think 對齊後 sb init <新slug>');
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
    out('  出口同 pass：sb next intent --new-ms --adversarial --boss-ok（下一 ms）或 sb end --adversarial --boss-ok（結束 slug）；重修＝老闆新輸入重走 intent 開新輪');
    return;
  }
  if (!objectRecord(st) || typeof st.slug !== 'string' || !st.slug || typeof st.ms !== 'string' || !(Object.hasOwn(FLOW, st.node) || st.node === 'ended')) die(['flow-state 狀態不完整或未知——保留原檔，查明原因後修復；未執行任何狀態變更']);
  out(`slug: ${st.slug}   ms: ${st.ms}${st.rev ? `   輪次: r${String(st.rev).padStart(2, '0')}` : ''}   段: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  else if (st.turnUsage) out(`回合觀測（純量測，無預算無上限）：本回合迄今 ${st.turnUsage.requests} 工具調用——工作做到完成為止`);
  const nexts = [...FLOW[st.node].next];
  if (st.node !== 'intent' && !nexts.includes('intent')) nexts.push('intent');
  for (const n of nexts) {
    if (n === 'intent' && !FLOW[st.node].next.includes('intent')) {
      out('  → intent（回頭：任何新意圖一律重走 intent 開新輪——同 ms）');
      continue;
    }
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
  if (st.node === 'verify') out('  時點 2 對抗＋老闆終審 pass 出口（真驗收完成、G1 回指閉環——GWT 逐條行為證據在回指區）：sb next intent --new-ms --adversarial --boss-ok（下一 ms）或 sb end --adversarial --boss-ok（結束 slug）；fail＝老闆新輸入重走 intent');
}

function cmdNext(target, opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = migrateStreams(readJson(STATE_FILE));
  if (st.node === 'done') st.node = 'verify'; // done 相容狀態按 verify 處理，寫入時儲存目前節點
  if (st.node === 'ended' || !(st.node in FLOW)) die([`目前狀態 ${st.node ?? '（無）'} 不可推進——slug 已結束或狀態檔不屬於任何段`]);
  if (!(target in FLOW)) die([`未知段「${target}」。流程節點：${Object.keys(FLOW).join(' → ')}`], 2);
  const legal = FLOW[st.node].next.includes(target) || backEdge(st.node, target);
  if (!legal) die([`不合法推進：${st.node} → ${target}（可走：${[...FLOW[st.node].next, 'intent'].join(' / ')}）`]);
  const { problems, passes } = gate(st, target, opts);
  if (problems.length) die(problems);
  const prev = st.node;
  st.node = target;
  delete st.stopBlockedAt; // 工作已續行——擋停自限失效（停等位置導向，SKILL §1.12）
  if (prev === 'requirement' && target === 'research' && !unchangedG1Approval(ROOT, st)) {
    // 首次核准或重新核准後才封存；同一已核准定義的技術回查保留原 hash 與 sealedAt。
    // 回指區在 hash 外隨執行更新，需求滿足集合改變仍先走 intent 修約。
    const file = gPath(st, 1);
    const raw = mdOf(file) ?? '';
    const heads = reflectHeads(raw);
    if (heads !== 1) die([`G1 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——推進前修正回指區格式（RAM/ROM 分區，SKILL §0）`]);
    const reseal = !!st.g1Contract;
    st.g1Contract = { ms: st.ms, file, sha256: sha256Text(defSection(raw)), sealedAt: new Date().toISOString() };
    passes.push(`G1 定義區契約${reseal ? '已重封存（重新核准後凍結）' : '已封存（時點 1——自進 research 起全鏈凍結）'}（flow-state）：${st.g1Contract.sha256.slice(0, 12)}`);
  }
  if (target === 'intent') {
    // 回頭邊（任何新意圖一律重走 intent）：同 ms 開新輪；--new-ms（出口邊——老闆終審開新里程碑）→ms++
    delete st.g1Contract;
    if (prev === 'verify' && opts.newMs) {
      const prevMs = st.ms; // per-ms 遙測結算對象＝前一 ms（鍵＝被結算 ms）
      st.ms = String(Number(st.ms) + 1).padStart(3, '0');
      delete st.rev; // 新 ms 乾淨輪次——舊 ms 輪號不帶入
      delete st.sopReview; // 審查戳記屬 ms——新 ms 重跑三問後重新留痕
      delete st.edgeAt; delete st.lastAdv; // 邊推進時戳與對抗條目屬 ms——新 ms 重驗（出口新鮮度由新 ms 的條目對照承載）
      passes.push(`新里程碑：${st.ms}（--new-ms）`);
      if (existsSync(join(ROOT, '.git')) && (st.msBaseline || st.baseCommit)) {
        const d = gitDiffStats(st.msBaseline || st.baseCommit, gitHeadCommit());
        st.msTelemetry = { ...(st.msTelemetry ?? {}), [prevMs]: { diff: d, settledAt: new Date().toISOString() } }; // per-ms 遙測結算（前一 ms）
      }
      st.msBaseline = gitHeadCommit(); // 新 ms 記自身基準
    } else if (prev !== 'intent') { // intent→intent＝no-op 輪
      // 開新輪：新輪重寫自洽，時序由 edgeAt＋輪次計數承擔（歷史不可變性歸 git）
      const revN = countRev(st);
      if (revN) { st.rev = revN; passes.push(`修正輪 r${String(revN).padStart(2, '0')}：新輪重寫自洽（時序由 edgeAt 承擔，歷史歸 git）——按受影響範圍整理文件並驗證`); }
    }
  }
  // 各邊保留最後推進時間，供審查新鮮度核對。
  st.edgeAt = { ...(st.edgeAt ?? {}), [`${prev}→${target}`]: new Date().toISOString() };
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
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
  writeFileSync(STATE_FILE,JSON.stringify(st,null,2));
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
    if (!st.baseCommit) die(['無法自動偵測基底（缺 slug 起始提交錨點）——MUST 帶 --base <本機基底分支> 明示']);
    const r = gitRun('for-each-ref', '--format=%(refname:short)', '--contains', st.baseCommit, 'refs/heads');
    if (r.status !== 0) die(['基底偵測查詢失敗——MUST 帶 --base <本機基底分支> 明示']);
    const hits = r.stdout.trim().split(/\r?\n/).filter(n => n && n !== workBranch);
    if (hits.length === 1) base = hits[0];
    else if (!hits.length) die([`基底偵測零命中（起始提交不在任何本機分支）——MUST 帶 --base <本機基底分支> 明示`]);
    else die([`基底偵測歧義（${hits.join('、')} 皆含 slug 起始提交）——MUST 帶 --base <本機基底分支> 明示`]);
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
  const del = gitRun('branch', '-d', workBranch);
  if (del.status !== 0) die([`收尾留痕完成但刪除工作分支失敗——人工 git branch -d ${workBranch} 後重試 sb end（重試冪等跳過重併）`]);
  return { workBranch, workCommit, baseBranch: base };
}

// --boss-ok 承接對話中已取得的使用者授權。
// 機械不驗時戳，語義授權由 think 揭露＋老闆終審承擔；偽造由抽查承擔。
function cmdEnd(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = migrateStreams(readJson(STATE_FILE));
  if (st.node === 'done') st.node = 'verify'; // done 相容狀態按 verify 處理，寫入時儲存目前節點
  if (st.node !== 'verify') die([`sb end 僅限 verify 態選 end（目前 ${st.node}）——真驗收（GWT 逐條實操、行為證據落回指區）完成、G1 回指閉環後時點 2 對抗＋老闆終審 pass 先於結束`]);
  if (!opts.bossOk) die(['結束是老闆終審決策——MUST 帶 --boss-ok 留痕（理解老闆通過授權的語義由 think 揭露承擔）']);
  if (!opts.adversarial) die(['結束出口＝時點 2 對抗條目＋老闆終審章同一邊（verify 出口邊）——MUST 帶 --adversarial（驗收完成後 sb adversarial --point 2 審驗收結果至通過）']);
  const pt2Entry = st.lastAdv?.['2'];
  const verifyEnteredAt = st.edgeAt?.['build→verify'];
  if (!pt2Entry) die(['lastAdv 缺時點 2 條目——驗收完成、G1 回指閉環後 MUST sb adversarial <報告檔> --point 2（審驗收結果：GWT 回指、假綠燈、錯誤處置完整性）才可出口']);
  if (verifyEnteredAt && pt2Entry.at <= verifyEnteredAt) die(['時點 2 對抗條目過期（早於本 ms 進 verify）——本輪 MUST 重新 sb adversarial --point 2（驗收後審驗收結果）才可出口']);
  const problems = [], passes = [];
  passes.push('時點 2 對抗條目＋老闆終審章（--adversarial＋--boss-ok——出口同一邊兩章）已驗');
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
  // 對抗判定取時點 2 條目（lastAdv——verdict＋審查模型）；計數與耗時來自 hooks 觀測紀錄；缺省一律 null（舊流程／無 git 可比）。
  // 錨定收尾合併後的 HEAD——遙測涵蓋整個 slug 生命週期直到收尾合併。
  const head = gitHeadCommit();
  const diff = ((st.msBaseline || st.baseCommit) && head && (st.msBaseline || st.baseCommit) !== head) ? gitDiffStats(st.msBaseline || st.baseCommit, head) : null; // per-ms 結算
  if (diff) st.msTelemetry = { ...(st.msTelemetry ?? {}), [st.ms]: { diff, settledAt: new Date().toISOString() } }; // per-ms 遙測：末段 ms 於 end 出口同步結算
  const pt2 = st.lastAdv?.['2'] ?? null;
  st.telemetry = {
    diff,
    baseCommit: st.baseCommit ?? null,
    headCommit: head,
    adversarial: pt2 ? { verdict: pt2.verdict, model: pt2.model ?? null } : null,
    counts: {
      toolCalls: Object.hasOwn(st, 'usageTotals') ? st.usageTotals.requests : null,
    },
    durationMinutes: st.startedAt ? Math.round(((Date.now() - Date.parse(st.startedAt)) / 60000) * 10) / 10 : null,
  };
  st.node = 'ended';
  st.endedAt = new Date().toISOString();
  // slug 邊界清理（終態留痕後）：lastAdv/edgeAt 屬 ms 生命週期欄位，隨 slug 終結清除；
  // 清除結束狀態未使用的流程欄位。
  delete st.lastAdv; delete st.edgeAt;
  delete st.inputs; delete st.understandings; delete st.adversarialLog; delete st.understandingHold; delete st.rev; delete st.rewriteSeen; delete st.g1Contract; delete st.history;
  delete st.sopReview; delete st.baseCommit; delete st.startedAt;
  delete st.turnUsage; delete st.usageTotals; delete st.stopBlockedAt;
  delete st.externalEvidence; // ended 狀態只保存目前 schema 定義的欄位。
  delete st.worktrees; // 冪等清理歷史鍵（已移除的 worktree 帳本欄位——舊 flow-state 兼容清理）
  delete st.rerunExtPending; // 冪等清理歷史鍵（已移除的返工直通 pending——舊 flow-state 兼容清理）
  delete st.adversarialAt; delete st.adversarialConsumed; // 清除退役的提交審查欄位。
  delete st.budget; delete st.budgetBreaches; // 冪等清理歷史鍵（舊版預算欄位——不相容則 ended 檔自我 invalid）
  delete st.inputsRotated; delete st.understandingsRotated; delete st.understandingSeedHash; delete st.adversarialRotated; delete st.historyRotated;
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
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



// —— 對抗宣告（時點對抗條目）：MUST 外部唯讀子代理對抗，報告原文落檔後引用 ——
// 機械驗三條：報告檔存在（.shiftblame/tmp 內）→ 含判定行（「對抗判定：通過/不通過」）→ 判定「通過」才可留條目
// （判定「通過」即零必修）。自代無合法介面——
// 子代理工具不可用＝流程阻塞等待至可用（自代無合法介面）；偽造報告檔屬手改造假（天花板：抽查承擔）。
// --point 必帶——時點 1（requirement→research：審意圖→需求翻譯）／時點 2（verify 出口：驗收完成後審驗收結果）；段內提交對抗章（無 point）已移除
// （審核資源前移需求與驗收兩接縫；提交閘僅存 commitmsg 格式驗證＋印章，審核不在提交時點）。
function cmdAdversarial(report, point) { // --point 1|2＝時點對抗條目（RAM）
  if (!report || !report.trim()) die(['缺報告檔——sb adversarial <子代理對抗報告檔> --point 1|2（.shiftblame/tmp/review-*.md；MUST 外部唯讀子代理，報告原文落檔後引用）']);
  if (!point) die(['--point 必帶——sb adversarial <報告檔> --point 1|2（1＝requirement→research 時點 1：審意圖→需求翻譯；2＝verify 出口時點 2：驗收完成後審驗收結果）；段內提交對抗章已移除（審核資源前移需求與驗收兩時點）']);
  const current = requireHealthyState();
  if (current.kind !== 'active') die(['時點對抗需要有效 slug 流程；不開 slug 的直接實行無時點對抗（時點屬七段圓環流程）']);
  mkdirSync(TMP, { recursive: true }); // 參數驗證通過才建目錄（bare repo 誤跑不長出空 .shiftblame）
  const st = current.state ?? {};
  const file = resolve(ROOT, report.trim());
  // 工作報告的可見路徑與實體位置都須在 tmp 內；連結不改變落點規範。
  const rel = relative(TMP, file);
  const realRel = existsSync(file) ? relative(realpathSync(TMP), realpathSync(file)) : '..';
  const inside = [rel, realRel].every((p) => p !== '' && !p.startsWith('..') && !isAbsolute(p));
  if (!inside || !existsSync(file) || !statSync(file).isFile()) die([`報告檔不存在、非檔案或不在 .shiftblame/tmp 內：${report}——子代理對抗報告原文移入 tmp 並讀回後引用（SKILL §3：對抗 MUST 外部唯讀子代理，無自代介面）`]);
  const text = readFileSync(file, 'utf8');
  const verdicts = [...text.matchAll(/對抗判定[：:]\s*(通過|不通過)/g)].map((m) => m[1]);
  const verdict = verdicts.at(-1); // 取最後一個判定行（多輪引用舊判定時以最終判定為準；判定行應唯一）
  if (!verdict) die(['報告缺判定行（「對抗判定：通過／不通過」）——子代理報告 MUST 含判定行；缺行屬假對抗']);
  if (verdict !== '通過') die([`對抗判定「${verdict}」＝必修未清——修復後 MUST 再對抗至「通過」才可推進（閘環零必修機械化）`]);
  // 審查模型（遙測素材）：報告內含「審查模型：」行則記錄（外部子代理自報身份），缺省為無鍵——不新增宣告介面
  const model = text.match(/^[ \t]*審查模型[：:][ \t]*([^\n\r]{1,80})/m)?.[1]?.trim() || null;
  const at = new Date().toISOString();
  const entry = { at, report: report.trim(), verdict, node: st.node ?? null, ...(model ? { model } : {}) };
  // 各時點保留最後審查條目，供決策出口核對新鮮度。
  st.lastAdv = { ...(st.lastAdv ?? {}), [point]: entry };
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([
    `時點${point}對抗條目留痕（@${st.node ?? '未入段'}）：${report.trim()}（判定：${verdict}）——lastAdv 定長欄位；推進帶 --adversarial 由 CLI 對照條目與新鮮度`,
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
      .split('\n').map((l) => l.trim()).filter(Boolean).filter((p) => /^\.shiftblame(?:\/|$)/i.test(p));
    if (staged.length) die([`系統檔不入庫——staged 含 ${staged.slice(0, 5).join('、')}${staged.length > 5 ? ` 等 ${staged.length} 檔` : ''}（.shiftblame/ MUST gitignore；先 git restore --staged 移除再發章）`]);
  } catch { /* 非 git 工作區：無事實清單可查，跳過（hooks 層照常把關） */ }
  // 驗收段對 repo 唯讀——防「驗收中偷改＋偷 commit」的洗白鏈；重修回 test／build 才可存檔
  if (['verify', 'done'].includes(current.state?.node)) die(['驗收段對 repo 唯讀（寫入矩陣）——存檔回 test／build（或任意→intent）後進行']);
  if (!msg.trim() || /[\n\r]/.test(msg)) die(['提交訊息須為非空單行，格式依 repo 慣例。']);
  // 印章：hooks PreToolUse 對 git commit 硬擋的憑證（10 分鐘內、訊息相符才放行）——commitmsg 格式閘的機械承載
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, 'commit-stamp.json'), JSON.stringify({ message: msg, cwd: ROOT, issuedAt: new Date().toISOString() }, null, 2));
  fin([`提交訊息合格：${msg}`, `印章已寫入 ${join(TMP, 'commit-stamp.json')}——10 分鐘內以相同訊息 git commit -m 可過 hooks 硬擋`]);
}

// ———— main ————

const [cmd, ...rest] = process.argv.slice(2);
// sb usage 事件：每次調用（子命令＋參數摘要）落 tmp JSONL——sb 呼叫頻譜的機械觀測層
// （老闆可隨時清理該檔；缺檔自動重建；觀測失敗靜默——遙測失效不影響本命令執行）。
try {
  mkdirSync(TMP, { recursive: true });
  appendFileSync(join(TMP, 'sb-usage.jsonl'), JSON.stringify({ at: new Date().toISOString(), cmd: cmd ?? '(none)', args: rest.join(' ').slice(0, 120) }) + '\n');
} catch { /* 觀測落檔失敗不攔主流程 */ }
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const flags = { bossOk: false, adversarial: false, newMs: false, point: null, base: null, main: false, task: null, phase: null, verdict: null, report: null };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--adversarial') flags.adversarial = true;
  else if (rest[i] === '--new-ms') flags.newMs = true;
  else if (rest[i] === '--main') { flags.main = true; if (cmd !== 'init') usage(); }
  else if (rest[i] === '--point') { flags.point = rest[++i] ?? ''; if (!['1', '2'].includes(flags.point)) usage(); }
  else if (rest[i] === '--base') { flags.base = rest[++i] ?? ''; if ((cmd !== 'closeout' && cmd !== 'end') || !flags.base || flags.base.startsWith('-')) usage(); }
  else if (rest[i].startsWith('--')) usage(); // 未知旗標（拼錯）直接提示 usage——解析器衛生
  else pos.push(rest[i]);
}
if (['next', 'end', 'closeout', 'sopreview'].includes(cmd)) requireHealthyState();
switch (cmd) {
  case 'init': if (flags.main) { if (pos.length) usage(); cmdInitMain(); } else cmdInit(pos[0], pos[1]); break;
  case 'state': cmdState(); break;
  case 'unlock': cmdUnlockAbsent(); break;
  case 'adversarial': cmdAdversarial(pos.join(' '), flags.point); break;
  case 'next': cmdNext(pos[0], flags); break;
  case 'end': cmdEnd(flags); break;
  case 'closeout': cmdCloseout(flags.base); break;
  case 'sopreview': cmdSopreview(pos.join(' ')); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  case 'vault': cmdVault(); break;
  default: usage();
}
