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
import { appendFileSync, existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
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
  done:    { next: ['test', 'intent'], desc: '完成態：老闆已授權完成；重修→test、補充/追加→intent；動作：開新里程碑（--stamp newMs）、PASS（sb end）' },
};

// 回頭自由，前進要鑰匙：任意節點→intent 永遠合法（同 ms 重走）；done→test 重修回邊零旗標。
const backEdge = (from, to) => to === 'intent' || (from === 'done' && to === 'test');

// 前進鑰匙三層（SKILL 授權章）：
//   ① 對話鎖（hooks 層）：每則老闆輸入上鎖、sb unlock --quoted 引原句解鎖——擋一切寫入，CLI 不重複驗
//   ② 授權印章（sb unlock --stamp 寫入 flow-state.stamps）：done／pass／newMs——完成類推進的唯一鑰匙
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
      （前進要鑰匙：對話鎖 sb unlock 引老闆原句、授權印章 done／pass／newMs、--boss-ok 留痕）

用法：
  sb init <slug>                        開 slug：建立 flow-state.json（節點 intent）
  sb state                              顯示目前段、可走下一步與其前置條件
  sb unlock --quoted "<老闆原句>" [--stamp done|pass|newMs]
                                        解鎖對話鎖：逐字引用老闆「當前輸入」（最後一則）中承載
                                        授權語義的原句——引句必須覆蓋該則的非否定候選詞（hooks 於
                                        輸入時刻掃描標記；時序元規則：每則覆蓋前一則，消費即失效）；
                                        捏造／跳時序／無候選／否定候選皆機械擋；--stamp 寫對應授權
                                        印章（done→verify→done；pass→sb end；newMs→done→intent 時 ms++）；
                                        引句於老闆下則輸入自動展示（必然曝光）
  sb adversarial <報告檔>                對抗宣告（提交時點的鑰匙）：MUST 外部唯讀子代理對抗，報告原文
                                        落檔 tmp 後引用檔案；機械驗：檔案存在＋含判定行＋判定為「通過」
                                        （不通過＝必修未清，不得發章）；commit 時由 hooks 消費（一對一）
  sb next <段> [--boss-ok] [--adversarial] [--rerun impl|definition]
                                        推進（閘門不過即擋）
                                        --boss-ok：老闆授權留痕（intent→audit、plan→test、verify→done 邊）
                                        --rerun：返工直通（僅限同 ms 曾達 test 後的重走；時點①分流判定——
                                        實作級 impl／定義級 definition 直通免停靠，根本性不帶旗標走完整確認；
                                        verify→done 完成時點永不直通）
                                        --adversarial：時點對抗宣告（plan→test①、verify→test②、verify→done③）；
                                        需 SLUG.md 含對應時點對抗記錄，不一致即擋
  sb end --boss-ok                      PASS 動作（僅 done 態；需 pass 印章）：收尾保鮮＋archive
  sb commitmsg "<訊息>"                  提交訊息機械驗證（type 前綴＋長度＋禁追蹤編號）；
                                        通過時寫 commit-stamp.json，hooks 對 git commit 硬擋無印章者

完成類鑰匙＝授權印章（sb unlock --stamp 引老闆原句寫入 flow-state.stamps，一次性）：
  理解老闆「完成／done」→ sb unlock --stamp done；「PASS／通過」→ --stamp pass；「下一個／開新的」→ --stamp newMs
  語義由 agent 依上下文閱讀理解（語例非判準）；引句逐字錨定＋解鎖必然曝光
  捏造／翻舊帳機械擋；斷章（引真話但非授權）屬越權，老闆每則輸入可見解鎖引句
  防無意識繞過＋必然曝光；不防刻意直改 flow-state 的偽造（殘餘由老闆抽查承擔）`);
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

  // --rerun 返工直通：時點①意圖分流（實作級/定義級）→ 免停靠直通；根本性不帶旗標走完整確認
  // 僅限「同 ms」返工重走（history 中本 ms 曾達 test 及之後）——首次推進或跨 ms 帶 --rerun 即繞過老闆邊，必擋
  // （history entry 帶 ms；無 ms 欄位的舊條目 fail-closed 視為他 ms）
  const rerunReached = (st.history ?? []).some((h) => h.ms === st.ms && ['test', 'build', 'verify', 'done'].includes(h.to));
  if (opts.rerun && !rerunReached) {
    problems.push('--rerun 僅限同 ms 返工重走（本 ms 尚未到達 test）——首次推進或跨 ms 之老闆決策邊不得以返工直通繞過');
  }
  const rerunExempt = opts.rerun && rerunReached && st.node !== 'verify'; // verify→done（完成時點）永不直通——老闆終審不可省

  // --boss-ok：留痕層（缺仍擋，保留形式邊界；實質鑰匙在對話鎖與印章）；--rerun 直通豁免非完成邊
  if (opts.bossOk && !needsBossOk(st.node, target)) {
    problems.push(`「${st.node} → ${target}」不是老闆決策邊——不得帶 --boss-ok；回頭邊零旗標，工作邊沿用既有授權`);
  } else if (needsBossOk(st.node, target) && !opts.bossOk && !rerunExempt) {
    problems.push(`「${st.node} → ${target}」是老闆決策邊——MUST 帶 --boss-ok 留痕（實質鑰匙：對話鎖 sb unlock 引原句＋授權印章）；返工直通改帶 --rerun（時點①分流判定，SKILL §3）`);
  } else if (opts.bossOk) {
    passes.push('老闆授權留痕（--boss-ok）');
  } else if (rerunExempt && needsBossOk(st.node, target)) {
    passes.push(`返工直通（--rerun ${opts.rerun}）：時點①分流判定留痕，完成時點曝光彙總`);
  }

  // 完成印章：verify→done 的唯一鑰匙（sb unlock --stamp done 引老闆原句寫入，一次性）
  if (st.node === 'verify' && target === 'done') {
    if (!st.stamps?.done) problems.push('缺完成印章——理解老闆完成授權後 sb unlock --stamp done --quoted "原句" 才產生（flow-state.stamps，一次性）；老闆未授權前停留在 verify 中間態（防無意識繞過；斷章由必然曝光承擔）');
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

    case 'intent': // 回頭自由：補充／重修／追加子需求／修約——同 ms 重走；done＋newMs 印章時 ms++（cmdNext）
      passes.push(st.node === 'done' && st.stamps?.newMs ? 'newMs 印章存在——回 intent 且 ms++' : '回 intent（同 ms 重走線性）');
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
      out(`  → intent（回頭重走：補充／重修／追加，零旗標，同 ms${st.node === 'done' ? '；有 newMs 印章則 ms++' : ''}）`);
      continue;
    }
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
  if (st.node === 'done') out(`  動作：sb end --boss-ok（PASS，需 pass 印章）`);
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
    // 回頭自由：同 ms 重走；done＋newMs 印章→ms++（一次性消費）
    delete st.g1Contract;
    if (prev === 'done' && st.stamps?.newMs) {
      st.ms = String(Number(st.ms) + 1).padStart(3, '0');
      delete st.stamps.newMs;
      passes.push(`新里程碑：${st.ms}（newMs 印章已消費）`);
    }
  }
  if (prev === 'verify' && target === 'done' && st.stamps?.done) delete st.stamps.done; // 完成印章一次性
  const entry = { from: prev, to: target, at: new Date().toISOString(), ms: st.ms, bossOk: !!opts.bossOk, adversarial: !!opts.adversarial };
  if (opts.rerun) entry.rerun = opts.rerun; // 返工直通判定留痕（impl|definition；時點①分流）
  if (prev === 'verify' && target === 'done') {
    const reruns = (st.history ?? []).filter((h) => h.rerun && h.ms === st.ms);
    if (reruns.length) passes.push(`返工直通曝光彙總：本 ms ${reruns.length} 次（${reruns.map((h) => `${h.from}→${h.to}(${h.rerun})`).join('、')}）——判定正確性由老闆終審`);
  }
  st.history.push(entry);
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → ${target}`, ...passes]);
}

// PASS 動作（done 態上；非段推進）：老闆「PASS」印章＋--boss-ok 留痕；收尾保鮮為文件層動作清單（SKILL done 慵說明）
// —— 解鎖驗證鏈（全機械；時序元規則：只認當前輸入＝最後一則老闆輸入）——
// ①逐字錨定：--quoted 必須是當前輸入原文的子串——捏造即擋；無當前輸入＝翻舊帳即擋（覆蓋式：舊則不存在）。
// ②候選覆蓋：引句必須覆蓋至少一個非否定候選詞（hooks 輸入時刻掃描標記；英文詞比照掃描層 \b 邊界，
//   引 book/look 不得借道 ok）——引無候選／否定候選即擋。
// ③消費即失效：同一則輸入只可解鎖一次——授權生命週期＝一則輸入。
// ④unlockLog 唯增雜湊鏈：每條 hash=sha256(前條hash+引句+時間)——「中間條目刪改」與「整體刪除重建」
//   中，刪改中間條目即斷鏈擋死；整體刪除（空鏈 trivially 通過）與完整重算重寫不防——發動於解鎖窗口，
//   屬通道層天花板（SKILL 如實揭露），老闆抽查 unlockLog 與對話實蹟對照終審。
// 必然曝光：unlockLog 引句於老闆下則輸入由 hooks 自動展示；曝光行是老闆終審。
const wordHits = (word, s) => (word.charCodeAt(0) > 127 ? s.includes(word) : new RegExp(`\\b${word}\\b`, 'i').test(s));

function verifyUnlockChain(log) {
  let prev = '';
  for (const e of log) {
    const expect = createHash('sha256').update(prev + String(e.quoted) + String(e.at)).digest('hex').slice(0, 16);
    if (e.hash !== expect) return false;
    prev = e.hash;
  }
  return true;
}

function cmdUnlock(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  const quoted = opts.quoted;
  const inp = st.input;
  if (!quoted) die(['缺 --quoted "<老闆原句>"——解鎖 MUST 逐字引用老闆當前輸入（最後一則）中承載授權語義的原句']);
  if (opts.stamp && !['done', 'pass', 'newMs'].includes(opts.stamp)) die([`--stamp 值無效（${opts.stamp}）——done｜pass｜newMs`]);
  if (!verifyUnlockChain(st.unlockLog ?? [])) die(['unlockLog 雜湊鏈斷裂——記錄被刪改（曝光洗除）即擋；完整性由老闆抽查對話實蹟終審']);
  if (!inp || typeof inp.text !== 'string' || !inp.text.length) {
    die(['無當前輸入可引（input 空）——翻舊帳即擋；等老闆實際輸入後再解鎖']);
  }
  if (inp.consumed) die(['當前輸入已消費——同一則不得再引（授權生命週期＝一則輸入）；等老闆下一則']);
  if (!inp.text.includes(quoted)) {
    die([`引句非當前輸入（最後一則）的逐字內容——捏造／跳時序即擋。當前輸入：「${inp.text.slice(0, 80)}」`]);
  }
  const covered = (inp.candidates ?? []).filter((c) => wordHits(c.word, quoted));
  const ok = covered.filter((c) => !c.negated);
  if (!covered.length) {
    die([`引句未覆蓋任何候選詞——無候選即不可解鎖（fail-closed）。本則候選：${(inp.candidates ?? []).map((c) => c.word + (c.negated ? '（否定）' : '')).join('、') || '無'}`]);
  }
  if (!ok.length) {
    die([`引句覆蓋的候選全為否定標記（否定詞共現）——引否定候選即擋；若老闆語義確為授權，等老闆改述或下一則`]);
  }
  if (opts.stamp) {
    const stampType = { done: 'done', pass: 'pass', newMs: 'newMs' }[opts.stamp];
    const typeOk = ok.some((c) => c.type === stampType) || ok.some((c) => c.type === 'go' || c.type === 'nod');
    if (!typeOk) {
      die([`--stamp ${opts.stamp} 與引句覆蓋的候選類型不符（覆蓋：${ok.map((c) => c.type).join('、')}）——印章類型由引句的候選語義支撐`]);
    }
    st.stamps = { [stampType]: new Date().toISOString() }; // 單一授權單一印章
  }
  st.dialogueLock = false;
  st.input.consumed = true; // 消費即失效——同一則不得再引
  const at = new Date().toISOString();
  const prevHash = (st.unlockLog ?? []).at(-1)?.hash ?? '';
  const hash = createHash('sha256').update(prevHash + String(quoted) + at).digest('hex').slice(0, 16);
  (st.unlockLog ??= []).push({ at, quoted, stamp: opts.stamp ?? null, node: st.node ?? null, reviewed: false, hash });
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([
    `解鎖（引句錨定當前輸入 @${inp.at.slice(0, 19)}）：「${quoted}」`,
    `覆蓋候選：${ok.map((c) => `${c.word}(${c.type})`).join('、')}`,
    ...(opts.stamp ? [`授權印章 ${opts.stamp} 已寫入（一次性；消費即焚）`] : []),
    '解鎖引句於老闆下則輸入自動展示（必然曝光——斷章即越權，當場可見）',
  ]);
}

function cmdEnd(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (st.node !== 'done') die([`sb end 僅限 done 態（目前 ${st.node}）——完成（verify→done，需 done 印章）先於 PASS`]);
  if (!opts.bossOk) die(['PASS 是老闆決策——MUST 帶 --boss-ok 留痕']);
  if (!st.stamps?.pass) die(['缺 pass 印章——理解老闆通過授權後 sb unlock --stamp pass --quoted "原句" 才產生（flow-state.stamps，一次性）；斷章由必然曝光承擔']);
  const problems = [], passes = [];
  checkCleanWorktree(problems, passes, 'PASS 前');
  if (problems.length) die(problems);
  delete st.stamps.pass;
  st.node = 'ended';
  st.endedAt = new Date().toISOString();
  st.history.push({ from: 'done', to: 'ended', at: st.endedAt, ms: st.ms, bossOk: true, pass: true });
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin(['done → ended（PASS）', '收尾保鮮（文件層動作，SKILL done 慵說明）：重寫 SOP.md／ROADMAP.md、盤點 docs/ 與 README、移 <slug> 至 archive/', ...passes]);
}



// —— 對抗宣告（提交時點的鑰匙）：MUST 外部唯讀子代理對抗，報告原文落檔後引用 ——
// 機械驗三條：報告檔存在（.shiftblame/tmp 內）→ 含判定行（「對抗判定：通過/不通過」）→ 判定「通過」才可發章
// （不通過＝必修未清，閘環未達零必修，不得發章）。自代無合法介面（旗標已移除）——
// 子代理工具不可用＝流程阻塞等待，MUST NOT 以任何形式自代；偽造報告檔屬手改造假（天花板：抽查承擔）。
function cmdAdversarial(report) {
  if (!report || !report.trim()) die(['缺報告檔——sb adversarial <子代理對抗報告檔>（.shiftblame/tmp/review-*.md；MUST 外部唯讀子代理，報告原文落檔後引用）']);
  mkdirSync(TMP, { recursive: true }); // 參數驗證通過才建目錄（bare repo 誤跑不長出空 .shiftblame）
  const st = existsSync(STATE_FILE) ? readJson(STATE_FILE) : { slug: null, ms: null, node: null, history: [] };
  const file = resolve(ROOT, report.trim());
  // 邊界正規判定（startsWith 無分隔符會放過 .shiftblame-evil 前綴）：必須在 SB_DIR 之內或就是 SB_DIR
  const rel = relative(SB_DIR, file);
  const inside = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  if (!inside || !existsSync(file) || !statSync(file).isFile()) die([`報告檔不存在、非檔案或不在 .shiftblame 內：${report}——子代理對抗報告原文落檔後引用（SKILL §3：對抗 MUST 外部唯讀子代理，無自代介面）`]);
  const text = readFileSync(file, 'utf8');
  const verdicts = [...text.matchAll(/對抗判定[：:]\s*(通過|不通過)/g)].map((m) => m[1]);
  const verdict = verdicts.at(-1); // 取最後一個判定行（多輪引用舊判定時以最終判定為準；判定行應唯一）
  if (!verdict) die(['報告缺判定行（「對抗判定：通過／不通過」）——子代理報告 MUST 含判定行；缺行屬假對抗']);
  if (verdict !== '通過') die([`對抗判定「${verdict}」＝必修未清——修復後 MUST 再對抗至「通過」才可提交（閘環零必修機械化）`]);
  st.adversarialAt = new Date().toISOString();
  st.adversarialConsumed = false;
  (st.adversarialLog ??= []).push({ at: st.adversarialAt, report: report.trim(), verdict, node: st.node ?? null });
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([
    `對抗宣告留痕（@${st.node ?? '未入段'}）：${report.trim()}（判定：${verdict}）`,
    'commitmsg 將驗本宣告（不消費）；hooks 於實際 commit 時消費（一對一）——每個 commit 前都需要新的子代理對抗',
  ]);
}

function cmdCommitmsg(msg) {
  if (!msg) usage();
  // 提交對抗閘：提交＝對抗時點（機制時點，非階段；所有 repo 統一）——
  // 每個 commit 需未消費的對抗宣告；返工修復必然終於 commit，閘在此必然觸發（CARD⑧ 機械化）
  // 發章只驗不消費——消費由 hooks 於實際 git commit 時執行（一對一；訊息不合格重試不燒宣告）
  if (!existsSync(STATE_FILE)) die(['提交前需對抗記錄——外部唯讀子代理對抗、報告落檔後 sb adversarial <報告檔> 宣告（判定須「通過」）']);
  {
    const st = readJson(STATE_FILE);
    if (!st.adversarialAt || st.adversarialConsumed) die(['提交前需對抗記錄——本次返工/變更後重新以子代理對抗並 sb adversarial <報告檔> 宣告（判定「通過」才可發章；每 commit 一對一消費）']);
  }
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
  // 對抗宣告消費點唯一化：發章只驗不消費——由 hooks 於實際 git commit 時消費並焚章
  // （對抗授予的是 commit 本身；訊息不合格重試與發章至 commit 的間隔不燒宣告）
  fin([`提交訊息合格：${msg}`, `印章已寫入 ${join(TMP, 'commit-stamp.json')}——10 分鐘內以相同訊息 git commit -m 可過 hooks 硬擋（對抗宣告於 commit 時由 hooks 消費）`]);
}

// ———— main ————

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const flags = { bossOk: false, adversarial: false, rerun: null, quoted: null, stamp: null };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--adversarial') flags.adversarial = true;
  else if (rest[i] === '--rerun') { flags.rerun = rest[++i] ?? ''; if (flags.rerun !== 'impl' && flags.rerun !== 'definition') usage(); }
  else if (rest[i] === '--quoted') flags.quoted = rest[++i] ?? '';
  else if (rest[i] === '--stamp') flags.stamp = rest[++i] ?? '';
  else if (rest[i].startsWith('--')) usage(); // 未知旗標（拼錯或已移除者）不得靜默落入 positional——解析器衛生
  else pos.push(rest[i]);
}
switch (cmd) {
  case 'init': cmdInit(pos[0]); break;
  case 'state': cmdState(); break;
  case 'unlock': cmdUnlock(flags); break;
  case 'adversarial': cmdAdversarial(pos.join(' ')); break;
  case 'next': cmdNext(pos[0], flags); break;
  case 'end': cmdEnd(flags); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  default: usage();
}
