#!/usr/bin/env node
// sb — shiftblame 流程狀態機 CLI：閘門只讀 git 事實與 flow-state.json（1.4）。
//
// 對抗兩類系統性問題：
//   1. 「不自知推進」——agent 自以為該推進就推進，跳過檢查/確認而不自覺。
//      對策：八段單向鏈＋回頭自由（→intent）＋每個推進點的前置閘門；推進
//      MUST 跑 `sb next`，閘門不過即擋（exit 1）。回頭邊零旗標，前進要鑰匙。
//   2. 「五假」——假需求、假規劃由 G 檔結構閘機械查核；假對抗由 --adversarial
//      ×SLUG.md 逐字對照擋下；假驗收由老闆 checkpoint（對話鎖＋完成印章）
//      與時點對抗承擔（閘門不讀 tmp）。
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

// ———— 八段節點鏈（intent→audit→research→plan→test→build→verify→done；done 是完成態非段推進終點） ————

const FLOW = {
  intent:  { next: ['audit'], desc: '意圖段：sb-think 路由後的流程起點' },
  audit:   { next: ['research'], desc: '需求段：G1 定義與驗收契約' },
  research:{ next: ['plan'], desc: '研究段：G2 技術分析' },
  plan:    { next: ['test'], desc: '計畫段：G3 實作計畫＋放行準備' },
  test:    { next: ['build'], desc: '測試段：測試碼定義＋定稿 commit' },
  build:   { next: ['verify'], desc: '實作段：實作＋實機驗證＋存檔 commit' },
  verify:  { next: ['test', 'intent', 'done'], desc: '驗收段：跑驗收＋判決；中間態——老闆未宣稱 done 前停留於此' },
  done:    { next: ['test', 'intent'], desc: '完成態：老闆已宣稱 done；重修→test、補充/追加→intent；動作：開新 ms、PASS（sb end）' },
};

// 回頭自由，前進要鑰匙：任意節點→intent 永遠合法（同 ms 重走）；done→test 重修回邊零旗標。
const backEdge = (from, to) => to === 'intent' || (from === 'done' && to === 'test');

// 前進鑰匙三層（SKILL 授權章）：
//   ① 對話鎖（hooks 層）：每則老闆輸入上鎖、「開工」解鎖——擋一切寫入，CLI 不重複驗
//   ② 老闆詞印章（hooks 寫入 flow-state.stamps）：done／PASS／開新 ms——完成類推進的唯一鑰匙
//   ③ --boss-ok 旗標：留痕（記錄 agent 宣稱的老闆授權），非鑰匙；缺失仍擋以保留形式邊界
const needsBossOk = (from, to) =>
  (from === 'intent' && to === 'audit') || (from === 'plan' && to === 'test') || (from === 'verify' && to === 'done');

// --adversarial＝時點對抗宣告＋SLUG.md 對照（SLUG 內無對應時點對抗記錄即擋）
const ADVERSARIAL_EDGES = [
  { from: 'plan', to: 'test', point: '①' },
  { from: 'verify', to: 'test', point: '②' },
  { from: 'verify', to: 'done', point: '③' },
];
const adversarialEdge = (from, to) => ADVERSARIAL_EDGES.find((e) => e.from === from && e.to === to) ?? null;

// ———— 小工具 ————

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };
const fin = (msgs) => { console.log('PASS'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log'](`sb — shiftblame 流程機械（在 <repo> 專案根執行）

八段：intent → audit → research → plan → test → build → verify → done
      （回頭自由：任意節點→intent 同 ms 重走；done→test 重修——皆零旗標）
      （前進要鑰匙：對話鎖「開工」、老闆詞印章 done／PASS／開新 ms、--boss-ok 留痕）

用法：
  sb init <slug>                        開 slug：建立 flow-state.json（節點 intent）
  sb state                              顯示目前段、可走下一步與其前置條件
  sb next <段> [--boss-ok] [--adversarial] [--self-attack]
                                        推進（閘門不過即擋）
                                        --boss-ok：老闆授權留痕（intent→audit、plan→test、verify→done 邊）
                                        --adversarial：時點對抗宣告（plan→test①、verify→test②、verify→done③）；
                                        需 SLUG.md 含對應時點對抗記錄，不一致即擋
  sb end --boss-ok                      PASS 動作（僅 done 態；需 PASS 印章）：收尾保鮮＋archive
  sb commitmsg "<訊息>"                  提交訊息機械驗證（type 前綴＋長度＋禁追蹤編號）；
                                        通過時寫 commit-stamp.json，hooks 對 git commit 硬擋無印章者

完成類鑰匙＝老闆詞印章（hooks 偵測寫入 flow-state.stamps，一次性；授權詞 MUST 獨立成行）：
  老闆輸入「done」→ verify→done 放行；「PASS」→ sb end 放行；「開新 ms」→ done→intent 時 ms++
  每則新老闆輸入清未用印章（陳舊授權失效，老闆重新說了才算）
  防無意識繞過＋事後稽核（SLUG 對照＋history）；不防刻意直改 flow-state 的偽造（殘餘由老闆抽查承擔）`);
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
    if (dirty.trim()) problems.push(`${timing} working tree 必須乾淨——該提交的先精準提交，該捨棄的明確捨棄，不得把未分類變更帶回定義`);
    else passes.push(`working tree 乾淨（${timing}已完成提交／捨棄判定）`);
  } catch { passes.push('（非 git 環境，略過乾淨度檢查）'); }
}

// ———— 各節點推進閘門（target = 要進入的節點） ————
function gate(st, target, opts) {
  const problems = [];
  const passes = [];

  // G1 契約核對（放行後任何推進重算；回 intent 邊重定義前不擋——回頭自由）
  if (st.g1Contract?.ms === st.ms && target !== 'intent') {
    const path = st.g1Contract.file;
    if (!path || !existsSync(path)) problems.push(`G1 契約檔不存在：${path ?? '缺失'}——回 intent（sb next intent）重定義後重新放行`);
    else if (sha256(path) !== st.g1Contract.sha256) problems.push('G1 已偏離放行時契約——語義變更走回 intent（sb next intent）重走線性，不得靜默吸收');
    else passes.push(`G1 契約 hash 核對：${st.g1Contract.sha256.slice(0, 12)}（封存於 flow-state）`);
  }

  // --boss-ok：留痕層（缺仍擋，保留形式邊界；實質鑰匙在對話鎖與印章）
  if (opts.bossOk && !needsBossOk(st.node, target)) {
    problems.push(`「${st.node} → ${target}」不是老闆決策邊——不得帶 --boss-ok；回頭邊零旗標，工作邊沿用既有授權`);
  } else if (needsBossOk(st.node, target) && !opts.bossOk) {
    problems.push(`「${st.node} → ${target}」是老闆決策邊——MUST 帶 --boss-ok 留痕（實質鑰匙：對話鎖「開工」＋完成印章）`);
  } else if (opts.bossOk) {
    passes.push('老闆授權留痕（--boss-ok）');
  }

  // 完成印章：verify→done 的唯一鑰匙（hooks 偵測老闆輸入「done」寫入，一次性）
  if (st.node === 'verify' && target === 'done') {
    if (!st.stamps?.done) problems.push('缺完成印章——老闆輸入含「done」才產生（flow-state.stamps，一次性）；老闆未宣稱前停留在 verify 中間態（防無意識繞過；刻意偽造由稽核承擔）');
    else passes.push(`完成印章存在（${st.stamps.done}）`);
  }

  // --adversarial＋SLUG.md 對照：時點對抗宣告與自然語言記錄不一致即擋
  const adv = adversarialEdge(st.node, target);
  if (adv) {
    if (!opts.adversarial) problems.push(`「${st.node} → ${target}」需時點${adv.point}對抗——MUST 帶 --adversarial 宣告`);
    else {
      const slugMd = mdOf(join(SB_DIR, st.slug, 'SLUG.md')) ?? '';
      if (!slugMd.includes(`時點${adv.point}對抗`)) problems.push(`SLUG.md 缺「時點${adv.point}對抗」記錄——--adversarial 宣告與 SLUG 對照不一致即擋（SKILL §3）`);
      else passes.push(`時點${adv.point}對抗：宣告與 SLUG.md 記錄對照一致`);
    }
  } else if (opts.adversarial) {
    problems.push(`「${st.node} → ${target}」不是對抗邊——不得帶 --adversarial`);
  }

  const g1 = mdOf(gPath(st, 1)), g2 = mdOf(gPath(st, 2)), g3 = mdOf(gPath(st, 3));

  switch (target) {
    case 'audit': // 意圖確認邊（--boss-ok＋對話鎖）；audit 段才寫 G1，無 G 檔閘
      break;

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

    case 'test':
      if (st.node === 'plan') { // 放行邊：假規劃閘（§10 核對與時點①對抗為文件層＋SLUG 對照）；G1 於此封存
        if (!g1) problems.push('G1 不存在——無法放行');
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
      // verify→test（功能循環）／done→test（重修回邊）：零旗標直行；假測試由文件層判準擋
      break;

    case 'build': // 存檔＝build 段結束動作；測試定稿與假測試由文件層判準（git 歷史可稽）
      break;

    case 'verify': // 進驗收＝實作已存檔：working tree 乾淨（git 判定）
      try {
        const dirty = execSync('git status --porcelain', { encoding: 'utf-8' });
        if (dirty.trim()) problems.push('working tree 未乾淨——實作存檔（commit）先於驗收；未提交變更不得進驗收段');
        else passes.push('working tree 乾淨（實作已存檔，git 判定）');
      } catch { /* 非 git 環境略過 */ }
      break;

    case 'done': // 收斂邊：clean tree＋G1 AC 結構；逐項驗收彙總與時點③對抗為文件層＋SLUG 對照
      checkCleanWorktree(problems, passes, '宣稱完成前');
      if (g1) validateG1Acceptance(g1, problems, passes);
      break;

    case 'intent': // 回頭自由：補充／重修／追加子需求／修約——同 ms 重走；done＋開新 ms 印章時 ms++（cmdNext）
      passes.push(st.node === 'done' && st.stamps?.newMs ? '開新 ms 印章存在——回 intent 且 ms++' : '回 intent（同 ms 重走線性）');
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
  try {
    const giPath = join(ROOT, '.gitignore');
    const gi = existsSync(giPath) ? readFileSync(giPath, 'utf-8') : '';
    if (!/(^|\n)\.shiftblame\/?(\n|$)/.test(gi)) appendFileSync(giPath, (gi && !gi.endsWith('\n') ? '\n' : '') + '.shiftblame/\n');
  } catch { /* 非 git 環境略過 */ }
  writeFileSync(STATE_FILE, JSON.stringify({ slug, ms: '001', node: 'intent', history: [] }, null, 2));
  fin([`slug「${slug}」狀態檔建立 → ${STATE_FILE}`, `目前段：intent（意圖）——sb-think 路由後由此重走線性`, `專案根錨定：${ROOT}${ROOT === resolve(process.cwd()) ? '' : `（由 ${process.cwd()} 向上錨定）`}`]);
}

function cmdState() {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (st.node === 'ended') { out(`slug: ${st.slug}   狀態：ended（已 PASS，${st.endedAt ?? '?'}）`); return; }
  out(`slug: ${st.slug}   ms: ${st.ms}   段: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  for (const n of [...FLOW[st.node].next, ...(st.node === 'intent' ? [] : ['intent']), ...(st.node === 'done' ? ['test'] : [])]) {
    if (n === 'intent' && st.node !== 'done' && !FLOW[st.node].next.includes('intent')) {
      out(`  → intent（回頭重走：補充／重修／追加，零旗標，同 ms${st.node === 'done' ? '；有開新 ms 印章則 ms++' : ''}）`);
      continue;
    }
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
  if (st.node === 'done') out(`  動作：sb end --boss-ok（PASS，需 PASS 印章）`);
}

function cmdNext(target, opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (st.node === 'ended' || !(st.node in FLOW)) die([`目前狀態 ${st.node ?? '（無）'} 不可推進——slug 已結束或狀態檔不屬於任何段`]);
  if (!(target in FLOW)) die([`未知段「${target}」。八段：${Object.keys(FLOW).join(' → ')}`], 2);
  const legal = FLOW[st.node].next.includes(target) || backEdge(st.node, target);
  if (!legal) die([`不合法推進：${st.node} → ${target}（可走：${[...FLOW[st.node].next, 'intent'].join(' / ')}）`]);
  const { problems, passes } = gate(st, target, opts);
  if (problems.length) die(problems);
  const prev = st.node;
  st.node = target;
  if (prev === 'plan' && target === 'test') {
    // G1 封存＝放行（hash 記 flow-state）；回 intent 重定義後重新放行時重封存
    const file = gPath(st, 1);
    st.g1Contract = { ms: st.ms, file, sha256: sha256(file), sealedAt: new Date().toISOString() };
    passes.push(`G1 契約已封存（flow-state）：${st.g1Contract.sha256.slice(0, 12)}`);
  }
  if (target === 'intent') {
    // 回頭自由：同 ms 重走；done＋開新 ms 印章→ms++（一次性消費）
    delete st.g1Contract;
    if (prev === 'done' && st.stamps?.newMs) {
      st.ms = String(Number(st.ms) + 1).padStart(3, '0');
      delete st.stamps.newMs;
      passes.push(`開新 ms：${st.ms}（老闆「開新 ms」印章已消費）`);
    }
  }
  if (prev === 'verify' && target === 'done' && st.stamps?.done) delete st.stamps.done; // 完成印章一次性
  const entry = { from: prev, to: target, at: new Date().toISOString(), bossOk: !!opts.bossOk, adversarial: !!opts.adversarial, selfAttack: !!opts.selfAttack };
  st.history.push(entry);
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → ${target}`, ...passes]);
}

// PASS 動作（done 態上；非段推進）：老闆「PASS」印章＋--boss-ok 留痕；收尾保鮮為文件層動作清單（SKILL done 慵說明）
function cmdEnd(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (st.node !== 'done') die([`sb end 僅限 done 態（目前 ${st.node}）——完成（verify→done，需「done」印章）先於 PASS`]);
  if (!opts.bossOk) die(['PASS 是老闆決策——MUST 帶 --boss-ok 留痕']);
  if (!st.stamps?.pass) die(['缺 PASS 印章——老闆輸入含「PASS」才產生（flow-state.stamps，一次性）；刻意偽造由稽核承擔']);
  const problems = [], passes = [];
  checkCleanWorktree(problems, passes, 'PASS 前');
  if (problems.length) die(problems);
  delete st.stamps.pass;
  st.node = 'ended';
  st.endedAt = new Date().toISOString();
  st.history.push({ from: 'done', to: 'ended', at: st.endedAt, bossOk: true, pass: true });
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin(['done → ended（PASS）', '收尾保鮮（文件層動作，SKILL done 慵說明）：重寫 SOP.md／ROADMAP.md、盤點 docs/ 與 README、移 <slug> 至 archive/', ...passes]);
}



function cmdCommitmsg(msg) {
  if (!msg) usage();
  // 驗收段對 repo 唯讀——防「驗收中偷改＋偷 commit」的洗白鏈；重修回 test／build 才可存檔
  try {
    const stPath = join(ROOT, '.shiftblame', 'flow-state.json');
    if (existsSync(stPath)) {
      const node = JSON.parse(readFileSync(stPath, 'utf-8')).node;
      if (node === 'verify') die(['驗收段不得產生 commit 印章——驗收段對 repo 唯讀（寫入矩陣）；重修回 test／build（或任意→intent）後才可存檔']);
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

// ———— main ————

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const flags = { bossOk: false, adversarial: false, selfAttack: false };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--adversarial') flags.adversarial = true;
  else if (rest[i] === '--self-attack') flags.selfAttack = true;
  else pos.push(rest[i]);
}
switch (cmd) {
  case 'init': cmdInit(pos[0]); break;
  case 'state': cmdState(); break;
  case 'next': cmdNext(pos[0], flags); break;
  case 'end': cmdEnd(flags); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  default: usage();
}
