#!/usr/bin/env node
// sb — shiftblame 流程狀態機 CLI：閘門只讀 git 事實與 flow-state.json（1.4）。
//
// 對抗兩類系統性問題：
//   1. 「不自知推進」——agent 自以為該推進就推進，跳過檢查/確認而不自覺。
//      對策：單向節點鏈＋每個推進點的前置閘門；推進 MUST 跑 `sb next`，閘門
//      不過即擋（exit 1）。階段邊界不是老闆決策；只有真正的語義決策才留痕。
//   2. 「五假」——假需求、假規劃由 G 檔結構閘機械查核；假測試（test 節點
//      無定稿 commit）由 git 判定；假驗收、假對抗屬文件層義務——由層間停靠
//      老闆 checkpoint、時點對抗與 sb report 外部審計承擔（閘門不讀 tmp）。
//
// 無依賴（node:fs / node:crypto / node:path / node:child_process）。在 <repo>（專案根）
// 執行；寫入僅 <repo>/.shiftblame/（狀態檔 flow-state.json 與 tmp/）。
// exit：0 = PASS，1 = 閘門擋下，2 = 用法錯誤。

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

// 專案根錨定：從執行目錄向上找 .git／既有 .shiftblame——子目錄執行不得在錯誤位置長出流浪工作區
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

// ———— 檢查規則常數（五假訊號，日後按需調整） ————

// 假需求：驗收標準不得含不可查核的模糊謂詞
const VAGUE = ['完善', '正常運作', '順利', '合理', '適當', '良好', '友好', '自如', '更好', '優化用戶體驗', 'works properly', 'user-friendly'];
// 敷衍詞（段落全為此類 = 假）
const COP_OUT = /^(無|無風險|沒有|暫無|none|n\/?a|待補|略|不適用|無法)[。.\s]*$/i;

// ———— 節點鏈（單向；next = 允許的下一步） ————

const FLOW = {
  think:    { next: ['audit'], desc: 'sb-think 意圖確認' },
  audit:    { next: ['research'], desc: '審計 G1' },
  research: { next: ['plan'], desc: '研究 G2' },
  plan:     { next: ['release'], desc: '規劃 G3' },
  release:  { next: ['test', 'commit'], desc: '放行（§10 核對後）' },  // release→commit --direct = 預設直接修正
  test:     { next: ['build'], desc: '測試碼定義＋定稿 commit' },
  build:    { next: ['commit'], desc: '實作＋實機驗證' },
  commit:   { next: ['verify', 'converge'], desc: 'commit 存檔＝建立待驗對象（先於驗收）' },
  verify:   { next: ['verdict'], desc: '對存檔跑 CI 到綠燈＋報告' },
  verdict:  { next: ['converge', 'test'], desc: '秘書判決：通過→收斂或開下一功能小循環' },
  converge: { next: ['test', 'ms-done'], desc: 'ms 收斂（三面向重審；不合格→test 返工回同 ms）' },
  'ms-done': { next: ['audit', 'pass'], desc: 'ms 已完成：承接已授權的新 ms 或最終 PASS' },
  pass:     { next: [], desc: 'slug PASS（終態，收尾保鮮＋archive 由 sb-end 執行）' },
};

// --boss-ok 只證明已取得真正的語義決策，不是階段切換許可證。
// 老闆決策點（按轉移邊）：最終 PASS、release→test 層間放行（§11 停靠 checkpoint）。
// audit／release／ms-done 等工作狀態邊界不得要求 --boss-ok；amend 另行在 cmdAmend 強制。
const needsBossOk = (from, to) => to === 'pass' || (from === 'release' && to === 'test');

// ———— 小工具 ————

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };
const fin = (msgs) => { console.log('PASS'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log'](`sb — shiftblame 流程狀態機（在 <repo> 專案根執行）

用法：
  sb init <slug>                        開 slug：建立 flow-state.json（節點 think）
  sb state                              顯示目前節點、可走下一步與其前置條件
  sb next <node> [--boss-ok] [--direct] [--self-attack]
                                        推進節點（閘門不過即擋）
                                        --boss-ok：已取得老闆語義決策的留痕；一般階段不得使用
                                        （老闆決策點：最終 pass、release→test 層間放行）
                                        --direct：release→commit 預設直接修正路徑
                                        --self-attack：本次對抗檢閱為身分切換自攻（外部子代理不可用）
                                        的 history 留痕（1.4：旗標僅記錄降級事實，揭露義務見 SKILL §3）
  sb amend --boss-ok                    顯式修約：解除 G1 鎖定並退回 audit
  sb report                              彙整自包含外部審計報告 → tmp/report-*.md
                                        （當前節點＋G1/G2/G3 全文＋執行證據＋審計判準）
  sb commitmsg "<訊息>"                  提交訊息機械驗證（type 前綴＋長度＋禁追蹤編號）
                                        任何 commit 前 MUST 通過（sb-commit 技能）；
                                        通過時寫 commit-stamp.json，hooks 對 git commit 硬擋無印章者

閘門只讀 git 事實與 flow-state.json（SKILL §3：tmp 是自由傾倒區，流程零依賴）：
  G1 契約＝放行時 hash 記入 flow-state，每次推進重算核對
  測試定稿＝test 節點期間的 commit（git 判定）；驗收期間 working tree 與待驗 commit 一致
  對抗三時點與驗收報告為文件層義務（SKILL §3）：記錄寫 tmp 自由區，
  由層間停靠簡報（老闆 checkpoint）與 sb report 外部審計消費`);
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

// 段落實質性：非空、有效字數達標、非全敷衍行
function substantive(body, minLen = 20) {
  if (!body) return false;
  const s = body.replace(/^[>#\-\s*]+/gm, '').replace(/\s+/g, '');
  if (s.length < minLen) return false;
  const lines = body.split('\n').map((l) => l.replace(/^[>#\-\s*]+/, '').trim()).filter(Boolean);
  return lines.length > 0 && !lines.every((l) => COP_OUT.test(l));
}

const msDir = (st) => join(SB_DIR, st.slug, st.ms);
const gPath = (st, n) => join(msDir(st), `G${n}.md`);
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

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
  if (!rows.length) { problems.push('G1 缺 AC-xx 原始驗收契約——每項使用者需求 MUST 有穩定驗收 ID'); return []; }
  const ids = rows.map((row) => row.id);
  if (unique(ids).length !== ids.length) problems.push('G1 驗收契約含重複 AC-ID——每個 AC-ID MUST 唯一');
  const required = ['需求', '使用者', '前置', '操作', '可觀察結果', '失敗邊界', '證據'];
  for (const row of rows) {
    const missing = required.filter((key) => !filled(row.fields[key]));
    if (missing.length) problems.push(`G1 ${row.id} 缺實質欄位：${missing.join('、')}`);
    if (row.fields['證據'] !== 'BEHAVIOR') problems.push(`G1 ${row.id} 證據 MUST 為 BEHAVIOR——結構正確不能代替使用者需求`);
  }
  if (!problems.length) passes.push(`G1 使用者驗收契約：${unique(ids).join('、')}（BEHAVIOR）`);
  return unique(ids);
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
    if (dirty.trim()) problems.push(`${timing} working tree 必須乾淨——該提交的先依 sb-commit 精準提交，該捨棄的明確捨棄，不得把未分類變更帶回 G1`);
    else passes.push(`working tree 乾淨（${timing}已完成提交／捨棄判定）`);
  } catch { passes.push('（非 git 環境，略過乾淨度檢查）'); }
}

// ———— 各節點推進閘門（target = 要進入的節點） ————
function gate(st, target, opts) {
  const problems = [];
  const passes = [];

  if (st.g1Contract?.ms === st.ms) {
    const path = st.g1Contract.file;
    if (!path || !existsSync(path)) problems.push(`G1 契約檔不存在：${path ?? '缺失'}——不得繼續；以 sb amend --boss-ok 顯式修約`);
    else if (sha256(path) !== st.g1Contract.sha256) problems.push('G1 已偏離放行時契約——局部技術模型不得改義；以 sb amend --boss-ok 顯式修約');
    else passes.push(`G1 契約 hash 核對：${st.g1Contract.sha256.slice(0, 12)}（封存於 flow-state）`);
  }

  if (opts.bossOk && !needsBossOk(st.node, target)) {
    problems.push(`「${st.node} → ${target}」是工作狀態邊界，不是新的老闆決策——不得帶 --boss-ok 或再次詢問；沿用 sb-think 已取得的授權`);
  } else if (needsBossOk(st.node, target) && !opts.bossOk) {
    problems.push(`「${st.node} → ${target}」是老闆決策點——${target === 'pass' ? '最終 PASS' : '層間停靠放行（放行簡報經老闆確認後）'}MUST 帶 --boss-ok 記錄已取得的明確授權（SKILL §11）`);
  } else if (opts.bossOk) {
    passes.push('老闆語義決策留痕（--boss-ok）');
  }

  const g1 = mdOf(gPath(st, 1)), g2 = mdOf(gPath(st, 2)), g3 = mdOf(gPath(st, 3));
  // 測試定稿判準＝git 事實：test 節點進入時記 baseline HEAD（cmdNext），期間有新 commit 即定稿存在
  const gitHead = () => { try { return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(); } catch { return null; } };
  const testCommitExists = () => {
    // 判準＝git 事實：test 節點期間存在新 commit。不驗 commit 內容與斷言——
    // 假測試（無斷言、空殼）由文件層判準擋下（SKILL §1.8、TEST.md 假測試判準）。
    if (!st.testBaseline) return { ok: true, note: '⚠ 無 test baseline（repo 尚無任何 commit）——測試定稿未經 git 判定，如實揭露' };
    const head = gitHead();
    if (!head) return { ok: true, note: '⚠ 非 git 環境——測試定稿未經 git 判定，如實揭露' };
    return head === st.testBaseline
      ? { ok: false, note: 'test 節點期間無新 commit——測試定稿 MUST commit（假測試判準見 TEST.md，文件層擋下），定稿前不得寫實作' }
      : { ok: true, note: 'test 節點期間存在新 commit（不驗內容；假測試由文件層判準擋下）' };
  };

  switch (target) {
    case 'research': // 假需求閘
      if (!g1) problems.push('G1 不存在（.shiftblame/<slug>/<ms>/G1.md）');
      else {
        const acc = section(g1, '驗收');
        if (acc === null) problems.push('G1 缺「驗收」段——需求沒有可查核的「完成」定義（假需求訊號）');
        else {
          if (!substantive(acc)) problems.push('G1 驗收段敷衍——驗收標準是不可查核的空話（假需求訊號）');
          const vague = VAGUE.filter((v) => acc.includes(v));
          if (vague.length) problems.push(`G1 驗收段含模糊謂詞「${vague.join('、')}」——不可查核（假需求訊號），改寫為可觀察的行為/狀態`);
          if (!problems.length) passes.push('G1 驗收標準可查核（存在＋實質＋無模糊謂詞）');
        }
        validateG1Acceptance(g1, problems, passes);
      }
      break;

    case 'plan':
      if (!g2) problems.push('G2 不存在');
      else if (!substantive(g2, 30)) problems.push('G2 內容空泛——研究產出無實質內容，規劃無依據（薄研究也要有真結論，不是空話）');
      else passes.push('G2 實質存在');
      break;

    case 'release': { // 假規劃閘（起始效應）；§10 一致性核對與對抗方向檢閱為文件層義務（SKILL §1.1、§3）
      if (!g1) problems.push('G1 不存在——無法封存需求契約');
      const g1Ids = g1 ? validateG1Acceptance(g1, problems, passes) : [];
      if (!g3) problems.push('G3 不存在');
      else {
        const fm = section(g3, '失敗模式');
        if (fm === null) problems.push('G3 缺「失敗模式」段——premortem：假設計畫失敗了，最可能 2-3 個原因是什麼（假規劃/起始效應訊號）');
        else if (!substantive(fm, 10)) problems.push('G3「失敗模式」段敷衍——列不出真實失敗點＝沒想過會怎麼失敗');
        else passes.push('G3 失敗模式（premortem）非敷衍');
        const steps = section(g3, '實作步驟');
        if (steps === null) problems.push('G3 缺「實作步驟」段——計畫沒有可執行的步驟（假規劃訊號）');
        else if (!substantive(steps, 10)) problems.push('G3「實作步驟」段敷衍');
        else passes.push('G3 實作步驟實質存在');
        if (g1) validateG3Acceptance(g3, g1Ids, problems, passes);
      }
      break;
    }

    case 'test':
      // release→test（重流程首個功能）或 verdict→test（判決通過開下一功能小循環）。
      // 層間停靠（release→test）的老闆 checkpoint 由 needsBossOk 的 --boss-ok 機械把關；
      // 放行簡報（含人話與對抗要點）以 commentary 揭露、由老闆消費（SKILL §11）——閘門不讀 tmp。
      break;

    case 'build': { // 假測試閘：測試定稿＝test 節點期間的 commit（git 判定）
      const tc = testCommitExists();
      if (!tc.ok) problems.push(tc.note);
      else passes.push(tc.note);
      break;
    }

    case 'verify': {
      // 待驗對象＝重流程存檔（build→commit）；直接修正（release→commit --direct）無測試可驗。
      // 實機驗證記錄與驗收報告為文件層義務（SKILL §1 驗收鏈）——記錄寫 tmp 自由區，閘門不讀。
      const commitIn = st.history.filter((h) => h.to === 'commit').at(-1);
      if (!commitIn || commitIn.from !== 'build') problems.push('commit 節點非重流程存檔（build→commit）——直接修正無測試可驗，不得進驗收');
      else passes.push('待驗對象＝重流程存檔（build→commit）');
      break;
    }

    case 'verdict': { // 判決閘：working tree 與待驗 commit 一致（git 判定）；驗收證據與判決為文件層義務（SKILL §1 驗收鏈）
      try {
        const dirty = execSync('git status --porcelain', { encoding: 'utf-8' });
        if (dirty.trim()) problems.push('驗收期間 working tree 已偏離待驗 commit——實作碼／測試碼在驗收狀態被修改（狀態寫入矩陣違規）；MUST 回實作狀態修正後建立新 commit 重新驗收');
        else passes.push('working tree 與待驗 commit 一致（驗收期間未動 repo）');
      } catch { /* 非 git 環境略過 */ }
      break;
    }

    case 'commit': {
      if (opts.direct) {
        // 直接修正聲明（USER_OBSERVABLE=NO、來源=自行發現）為文件層義務（SKILL §1.4）——閘門不讀 tmp
        if (st.node !== 'release') problems.push(`--direct 僅限 release→commit（預設直接修正路徑）；目前節點 ${st.node} 的 commit 邊必須走重流程`);
        else passes.push('直接修正路徑（聲明義務見 SKILL §1.4；收斂時仍須滿足全部 G1 驗收）');
        break;
      }
      const tc = testCommitExists();
      if (!tc.ok) problems.push(tc.note);
      else passes.push(tc.note);
      break;
    }

    case 'converge': {
      checkCleanWorktree(problems, passes, '收斂前');
      const commitIn = st.history.filter((h) => h.to === 'commit').at(-1);
      if (commitIn && commitIn.from === 'build' && st.node !== 'verdict') {
        problems.push('重流程存檔（build→commit）未經驗收（verify）＋判決（verdict）即收斂——commit 存檔先於驗收，MUST 判決通過才收斂');
      }
      // 收斂的 G1 逐項驗收彙總與時點③對抗為文件層義務（SKILL §1.4.2）——由秘書審計、SLUG §4 記錄、sb report 審計
      if (g1) validateG1Acceptance(g1, problems, passes);
      break;
    }

    case 'audit': {
      if (st.node === 'ms-done') checkCleanWorktree(problems, passes, '回指 G1 前');
      // 開新 slug／ms 前的需求審計（sb report）為文件層強制義務（SKILL §1.8）——閘門不讀 tmp 報告檔
      if (st.node === 'ms-done') { st.ms = String(Number(st.ms) + 1).padStart(3, '0'); passes.push(`開新 ms：${st.ms}（新里程碑回三面向制衡）`); }
      break;
    }
    case 'ms-done':
    case 'pass':
      break;
  }
  return { problems, passes };
}

// ———— 指令 ————

function cmdInit(slug) {
  if (!slug) usage();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(slug)) die([`slug 僅接受英數與連字號（首字英數、≤64 字）：${slug}`], 2);
  mkdirSync(SB_DIR, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  // 落實 §5：.shiftblame/ MUST 經 .gitignore 排除——缺漏即補（verdict 樹漂移檢查依賴此排除）
  try {
    const giPath = join(ROOT, '.gitignore');
    const gi = existsSync(giPath) ? readFileSync(giPath, 'utf-8') : '';
    if (!/(^|\n)\.shiftblame\/?(\n|$)/.test(gi)) appendFileSync(giPath, (gi && !gi.endsWith('\n') ? '\n' : '') + '.shiftblame/\n');
  } catch { /* 非 git 環境略過 */ }
  writeFileSync(STATE_FILE, JSON.stringify({ slug, ms: '001', node: 'think', history: [] }, null, 2));
  fin([`slug「${slug}」狀態檔建立 → ${STATE_FILE}`, `目前節點：think（sb-think 意圖確認）`, `專案根錨定：${ROOT}${ROOT === resolve(process.cwd()) ? '' : `（由 ${process.cwd()} 向上錨定）`}`]);
}

function cmdState() {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  out(`slug: ${st.slug}   ms: ${st.ms}   node: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  for (const n of FLOW[st.node].next) {
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
}

function cmdNext(target, opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (!(target in FLOW)) die([`未知節點「${target}」。可用：${Object.keys(FLOW).join(' → ')}`], 2);
  if (st.node === 'release' && target === 'commit' && !opts.direct) {
    die([`release→commit 是「預設直接修正」路徑，MUST 帶 --direct 留痕；重流程走 test→build→commit→verify→verdict（commit 存檔先於驗收）`]);
  }
  if (!FLOW[st.node].next.includes(target)) {
    die([`不合法推進：${st.node} → ${target}（單向節點鏈，当前可走：${FLOW[st.node].next.join(' / ')}）`]);
  }
  const { problems, passes } = gate(st, target, opts);
  if (problems.length) die(problems);
  const prev = st.node;
  st.node = target;
  if (target === 'release') {
    // G1 封存＝hash 記入 flow-state（唯一機械依賴檔）；不可變性由 git 與此 hash 核對承擔
    const file = gPath(st, 1);
    st.g1Contract = { ms: st.ms, file, sha256: sha256(file), lockedAt: new Date().toISOString() };
    passes.push(`G1 契約已封存（flow-state）：${st.g1Contract.sha256.slice(0, 12)}`);
  }
  if (target === 'test') {
    // 測試定稿判準的 baseline：test 節點期間的新 commit＝測試定稿 commit（git 判定）
    try { st.testBaseline = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(); }
    catch { st.testBaseline = null; }
  }
  const entry = { from: prev, to: target, at: new Date().toISOString(), bossOk: !!opts.bossOk, direct: !!opts.direct, selfAttack: !!opts.selfAttack };
  st.history.push(entry);
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → ${target}`, ...passes]);
}

function cmdAmend(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  if (!opts.bossOk) die(['G1 修約是老闆拍板點——MUST 帶 --boss-ok（顯性留痕，不可由 agent 自行推進）']);
  const st = readJson(STATE_FILE);
  if (!st.g1Contract || st.g1Contract.ms !== st.ms) die(['目前 ms 尚無已放行的 G1 契約可修約']);
  if (!new Set(['release', 'test', 'build', 'commit', 'verify', 'verdict', 'converge']).has(st.node)) die([`目前節點 ${st.node} 不允許修約`]);
  // 修約差異（原條款／新條款／影響範圍）為文件層義務——amendment 寫 tmp 自由區，閘門不讀（SKILL §1.4.1）
  const problems = [], passes = [];
  checkCleanWorktree(problems, passes, '回指 G1 前');
  if (problems.length) die(problems);
  const prev = st.node;
  st.history.push({ from: prev, to: 'audit', at: new Date().toISOString(), bossOk: true, amendment: true });
  st.node = 'audit';
  delete st.g1Contract;
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → audit（G1 顯式修約）`, ...passes, '修約差異已記錄（amendment 寫 tmp）；原 G1 契約已解除；G1 定稿後須重新對齊 G2/G3 並重新 release']);
}



function cmdCommitmsg(msg) {
  if (!msg) usage();
  // 驗收／判決狀態不得產生印章——防「驗收期間偷改＋偷 commit」的洗白鏈（印章應於實作完成時取得）
  try {
    const stPath = join(ROOT, '.shiftblame', 'flow-state.json');
    if (existsSync(stPath)) {
      const node = JSON.parse(readFileSync(stPath, 'utf-8')).node;
      if (node === 'verify' || node === 'verdict') die([`節點 ${node} 不得產生 commit 印章——驗收／判決狀態對 repo 唯讀（寫入矩陣）；回實作狀態（經判決返工）後才可存檔`]);
    }
  } catch (e) { if (e && e.code === 'ERR_STRING_TOO_LONG') throw e; /* 狀態檔異常視為無狀態 */ }
  const problems = [];
  const m = msg.match(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]+\))?:\s*(.+)$/);
  if (!m) problems.push('缺 type 前綴——格式 `<type>: <繁中描述>`（type：feat/fix/docs/style/refactor/perf/test/chore/build/ci）');
  else {
    const body = m.at(-1);
    if (body.length < 5) problems.push(`描述過短（${body.length} 字）——單行 10-30 字為準，至少講清楚變更本身`);
    if (body.length > 60) problems.push(`描述過長（${body.length} 字）——單行 10-30 字，MUST NOT 含功能詳細訊息`);
    if (/[a-zA-Z]{3,}-\d+|#\d+/.test(body)) problems.push('含追蹤編號（#123、PROJ-456 等）——commit 訊息純描述變更本身，追蹤靠分支名與 merge 訊息');
    if (/[\n\r]/.test(msg)) problems.push('多行訊息——規範要求單行');
  }
  if (problems.length) die(problems);
  // 印章：hooks PreToolUse 對 git commit 硬擋的憑證（10 分鐘內、訊息相符才放行）
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, 'commit-stamp.json'), JSON.stringify({ message: msg, cwd: ROOT, issuedAt: new Date().toISOString() }, null, 2));
  fin([`提交訊息合格：${msg}`, `印章已寫入 ${join(TMP, 'commit-stamp.json')}——10 分鐘內以相同訊息 git commit -m 可過 hooks 硬擋`]);
}

function cmdReport() {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const outPath = join(TMP, `report-${st.slug}-${st.ms}-${st.node}-${stamp}.md`);
  const g = (n) => mdOf(gPath(st, n)) ?? `（G${n} 尚未建立）`;
  const tmpMd = (re) => {
    if (!existsSync(TMP)) return null;
    const c = readdirSync(TMP).filter((f) => re.test(f)).sort();
    return c.length ? { name: c.at(-1), text: readFileSync(join(TMP, c.at(-1)), 'utf-8') } : null;
  };
  const align = tmpMd(/^alignment-check\.md$/i);
  const amendment = tmpMd(/^amendment\.md$/i);
  const build = tmpMd(/^build-.*\.md$/i);
  const verify = tmpMd(/^verify-.*\.md$/i);
  const contract = st.g1Contract?.ms === st.ms
    ? `封存時間 ${st.g1Contract.lockedAt}，G1 sha256 ${st.g1Contract.sha256}（目前${st.g1Contract.file && existsSync(st.g1Contract.file) && sha256(st.g1Contract.file) === st.g1Contract.sha256 ? '一致' : '已偏離'}；任何變更即擋，須 sb amend --boss-ok）`
    : '（尚未放行，無 G1 契約封存）';
  let gitlog = '（非 git 環境）';
  try { gitlog = execSync('git log --oneline -10', { encoding: 'utf-8' }).trim(); } catch {}
  let testCommits = '（無 test baseline——未進入執行層或非 git 環境）';
  if (st.testBaseline) {
    try { testCommits = execSync(`git log --oneline ${st.testBaseline}..HEAD`, { encoding: 'utf-8' }).trim() || '（test baseline 之後無 commit——測試未定稿）'; }
    catch { testCommits = '（無法讀取 test baseline 之後的 commit）'; }
  }
  const reviews = existsSync(TMP) ? readdirSync(TMP).filter((f) => /^review-.*\.md$/i.test(f)).sort().map((name) => ({ name, text: readFileSync(join(TMP, name), 'utf-8') })) : [];
  const hist = st.history.map((h) => `- ${h.from} → ${h.to}（${h.at}${h.bossOk ? '，老闆拍板' : ''}${h.direct ? '，直接修正' : ''}${h.selfAttack ? '，自攻降級' : ''}${h.amendment ? '，G1 修約' : ''}）`).join('\n') || '（尚無推進記錄）';

  const rpt = `# shiftblame 外部審計報告 — ${st.slug}/${st.ms} @ ${st.node}

> **本報告自包含**：供無法讀取原始碼與專案文件的外部審計 agent 使用。以下內容＝審計所需的全部材料，不需存取任何 repo 檔案。由 \`sb report\` 機械彙整客觀事實；§8 脈絡與審計問題由秘書補充。

## 0. 給外部審計者的說明

你是獨立外部審計者。請基於本報告材料與 §1 判準，審計這個開發流程的當前節點是否成立——重點不是「內容寫得好不好」，而是**流程誠實性**：有沒有假需求、假規劃、假測試、假驗收、假對抗；有沒有跳過檢查的不自知推進。請給出：成立／不成立＋具體理由＋你發現的矛盾。

## 1. 審計判準（框架規則摘要）

- **節點鏈（單向）**：think→audit→research→plan→release→test→build→commit→verify→verdict→converge→ms-done→(新 ms audit｜pass)；verdict→test 為下一功能回邊，\`sb amend --boss-ok\` 為開發期 G1 顯式修約回 audit 的唯一例外。commit＝存檔（建立待驗對象，先於驗收）。audit／release／ms-done 是工作狀態邊界，不是新決策，不得重問確認或帶 \`--boss-ok\`；只有最終 PASS 與顯式修約記錄已取得的語義授權。
- **§10 兩兩一致**：G1↔G2、G2↔G3、G1↔G3 三對六向，放行前核對一次（記錄寫 tmp 自由區）。
- **五假訊號**：假需求（G1 驗收含模糊謂詞/敷衍）；假規劃（G3 缺失敗模式 premortem/實作步驟）；假測試（無斷言 API 的測試碼）；假驗收（反證嘗試敷衍或全「不適用」、未驗清單寫「無」）；假對抗（三時點對抗檢閱缺席或攻擊點空洞無出處；外部子代理不可用時主對話切換身分自攻並向老闆揭露）。
- **測試定稿（git 承擔）**：測試於 test 節點定稿 commit，之後不得修改；不可變性由 git 承擔，驗收期間 working tree 與待驗 commit 一致（判決閘核對）。
- **G1 契約封存**：放行即 sha256 記入 flow-state，後續每次推進重算；局部技術模型不得改義，變更只能經 \`sb amend --boss-ok\` 顯式修約。
- **使用者驗收鏈**：G1 AC-ID → G3 驗收排程（AC-ID 與測試的映射由 G3 承載，MUST NOT 進程式碼）→ 驗收報告逐項 SATISFIED＋BEHAVIOR。結構正確與 CI 綠燈不能單獨代替使用者需求。
- **閘門分工（1.4）**：閘門只讀 git 事實與 flow-state.json；tmp 是自由傾倒區，流程零依賴。三時點對抗、驗收報告、direct 聲明為文件層義務，由層間停靠（老闆 checkpoint）、SLUG §4 自然語言記錄與本報告外部審計消費。
- **證據分工**：測試階段寫測試（定義「過」）；實作階段寫碼＋實機驗證；實作完成即由秘書 commit 存檔（建立待驗對象）；驗收階段對存檔跑 CI 到綠燈＋反證嘗試；判決（通過/返工）由主對話秘書獨佔——通過才開下一個功能。

## 2. 流程狀態

- **slug**: ${st.slug}　**ms**: ${st.ms}　**當前節點**: ${st.node}
- **推進歷史**：
${hist}

## 3. G1 需求／驗收標準（全文）

**契約封存**：${contract}

${g(1)}

## 4. G2 技術分析（全文）

${g(2)}

## 5. G3 實作計畫（全文）

${g(3)}

## 6. 執行層證據

### 6.0 G1 顯式修約差異

${amendment ? amendment.text : '（尚無 G1 修約記錄）'}

### 6.1 §10 一致性核對記錄

${align ? align.text : '（尚無 alignment-check.md——未到放行或未落記錄）'}

### 6.2 測試定稿 commit（test baseline 之後，git 判定）

${testCommits}

### 6.3 實作＋實機驗證記錄（最新）

${build ? build.text : '（尚無 build 記錄）'}

### 6.4 驗收報告（最新，含反證嘗試與未驗清單）

${verify ? verify.text : '（尚無驗收報告）'}

### 6.5 對抗檢閱記錄（tmp 內全部 review-*.md 全文）

${reviews.length ? reviews.map((r) => `#### ${r.name}\n\n${r.text}`).join('\n\n') : '（尚無對抗檢閱記錄）'}

## 7. Git 記錄（最近 10 筆）

\u0060\u0060\u0060
${gitlog}
\u0060\u0060\u0060

## 8. 秘書補充：本次審計問題（老闆／秘書填）

（秘書複核後填：本次想請外部審計回答的具體問題，如「G3 失敗模式是否涵蓋 G2 指出的最大技術風險」「驗收反證嘗試是否足以支撐合格判決」；若本輪是對抗後的修復，必問「修復是否真正解決了上一輪必修項、有無引入新問題」——對抗—修復—再對抗閉環）

---
產生：${new Date().toISOString()}　工具：sb report（shiftblame ${process.env.SB_VERSION ?? ''}）
`;
  writeFileSync(outPath, rpt);
  fin([`外部審計報告已產生 → ${outPath}`, '秘書複核＋填 §8 審計問題後交付老闆（外部 agent 無法讀 repo，本檔即全部材料）']);
}

// ———— main ————

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const flags = { bossOk: false, direct: false, selfAttack: false };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--direct') flags.direct = true;
  else if (rest[i] === '--self-attack') flags.selfAttack = true;
  else pos.push(rest[i]);
}
switch (cmd) {
  case 'init': cmdInit(pos[0]); break;
  case 'state': cmdState(); break;
  case 'next': cmdNext(pos[0], flags); break;
  case 'amend': cmdAmend(flags); break;
  case 'report': cmdReport(); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  default: usage();
}
