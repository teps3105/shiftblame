#!/usr/bin/env node
// sb — shiftblame 流程狀態機 CLI：閘門只讀 git 事實與 flow-state.json（1.4）。
//
// 對抗兩類系統性問題：
//   1. 「不自知推進」——agent 自以為該推進就推進，跳過檢查/確認而不自覺。
//      對策：八段單向鏈＋回頭自由（→intent）＋每個推進點的前置閘門；推進
//      MUST 跑 `sb next`，閘門不過即擋（exit 1）。回頭邊零旗標，前進要鑰匙。
//   2. 「五假」——假需求、假規劃由 G 檔結構閘機械查核；假對抗由 --adversarial
//      ×SLUG.md 逐字對照擋下；假驗收由老闆 checkpoint（--boss-ok 留痕＋理解流曝光）
//      與時點對抗承擔（閘門不讀 tmp）。
//
// 無依賴（node:fs / node:crypto / node:path / node:child_process）。在 <repo>（專案根）
// 執行；寫入僅 <repo>/.shiftblame/（狀態檔 flow-state.json 與 tmp/）。
// exit：0 = PASS，1 = 閘門擋下，2 = 用法錯誤。

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { execSync } from 'node:child_process';

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

// ———— 檢查規則常數（五假訊號，日後按需調整） ————

// 假需求：驗收標準一律可查核（模糊謂詞即假）
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
  done:    { next: ['test', 'intent'], desc: '完成態：老闆已授權完成；重修→test、補充/追加→intent；動作：開新里程碑（--new-ms）、PASS（sb end）' },
};

// 回頭自由，前進要鑰匙：任意節點→intent 永遠合法（同 ms 重走）；done→test 重修回邊零旗標。
const backEdge = (from, to) => to === 'intent' || (from === 'done' && to === 'test');

// 前進鑰匙三層（SKILL 授權章）：
//   ① 雙流（hooks 層）：輸入流＋理解流唯增記錄＋必然曝光——無前置攔截，CLI 不重複
//   ② 老闆決策邊鑰匙＝--boss-ok 留痕＋時點對抗；--new-ms 開新里程碑（done→intent 邊）
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

// hooks 健康診斷（1.6.1 起）：本閘的鑰匙（externalEvidence 標記）由 hooks 事實記錄承擔——
// hooks 故障時記錄缺失≠授權缺失，閘的條件永遠無法滿足＝遞迴死鎖（1.6.0 實事故）。此函式對照 hooks 心跳
// 揭露故障疑慮；只診斷不降級（fail-closed 不變——逃生門屬合法漏洞，老闆已否決），修復方向是修 hooks 而非繞閘。
function hooksHealthNote() {
  try {
    const p = join(SB_DIR, 'tmp', 'hooks-heartbeat.json');
    if (!existsSync(p)) return '〔hooks 健康警示〕無心跳記錄（hooks 從未成功執行——檢查插件安裝；Codex 端須以 /hooks 審閱信任）——本擋可能是記錄缺失而非授權缺失；修復 hooks 後重試（閘保持封閉）';
    const hb = readJson(p);
    const ageMs = Date.now() - new Date(hb.at).getTime();
    const ageMin = Math.round(ageMs / 60000);
    if (!Number.isFinite(ageMs)) return '〔hooks 健康警示〕心跳時間戳無法解析——本擋可能是記錄缺失而非授權缺失；檢查插件 hooks 安裝後重試（閘保持封閉）';
    if (ageMin > 10) return `〔hooks 健康警示〕心跳停在 ${ageMin} 分鐘前（@${hb.event}）——近期工具調用未觸發 hooks（故障或 Codex 端未重新信任），本擋可能是記錄缺失而非授權缺失；修復 hooks 後重試（閘保持封閉）`;
  } catch { return '〔hooks 健康警示〕心跳無法讀取——本擋可能是記錄缺失而非授權缺失；檢查插件 hooks 安裝後重試（閘保持封閉）'; }
  return '';
}
const fin = (msgs) => { console.log('PASS'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log'](`sb — shiftblame 流程機械（在 <repo> 專案根執行）

八段：intent → audit → research → plan → test → build → verify → done
      （回頭自由：任意節點→intent 同 ms 重走；done→test 重修——皆零旗標；done→intent 開新 ms 帶 --new-ms）
      （前進要鑰匙：老闆決策邊 --boss-ok 留痕＋時點對抗 --adversarial）

雙流模型（1.7.0 撤鎖範式）：輸入＝獨立理解對象，不是鎖的鑰匙——
      輸入流唯增（hooks 記錄，永不覆蓋消費）；理解流由 sb-think 調用（args＝理解宣告）
      自動落檔＋必然曝光（老闆每則輸入審視未審理解與未覆蓋輸入）。無鎖、無解鎖命令、無引句。

用法：
  sb init <slug>                        開 slug：建立 flow-state.json（節點 intent）
  sb state                              顯示目前段、可走下一步與其前置條件
  sb adversarial <報告檔>                對抗宣告（提交時點的鑰匙）：MUST 外部唯讀子代理對抗，報告原文
                                        落檔 .shiftblame/tmp/ 後引用檔案；機械驗：檔案存在＋含判定行＋判定為「通過」
                                        （發章僅於判定「通過」——必修全清）；commit 時由 hooks 消費（一對一）
  sb next <段> [--boss-ok] [--adversarial] [--rerun impl|definition] [--new-ms]
                                        推進（閘門不過即擋）
                                        外部證據閘（1.6.0）：research→plan 邊與返工後首個推進邊驗
                                        「至少一次外部工具調用」（hooks 標記 externalEvidence——
                                        WebSearch／WebFetch／webReader／Agent）；零外部推不過
                                        --boss-ok：老闆授權留痕（intent→audit、plan→test、verify→done 邊）
                                        --rerun：返工直通（僅限同 ms 曾達 test 後的重走；時點①分流判定——
                                        實作級 impl／定義級 definition 直通免停靠，根本性不帶旗標走完整確認；
                                        verify→done 完成時點永不直通）
                                        --new-ms：開新里程碑（僅 done→intent 邊；老闆授權語義由理解流曝光承擔）
                                        --adversarial：時點對抗宣告（plan→test①、verify→test②、verify→done③）；
                                        需 SLUG.md 含對應時點對抗記錄，不一致即擋
  sb end --boss-ok                      PASS 動作（僅 done 態；老闆決策留痕）：收尾歸檔＋archive
  sb commitmsg "<訊息>"                  提交訊息機械驗證＋陳述對照閘（永續層文件的 sb 命令／旗標
                                        引用 ↔ CLI 實況——單一真相取自 sb.mjs 源碼；引用不存在的
                                        機制即擋）＋staged 系統檔檢查；
                                        通過時寫 commit-stamp.json，hooks 對 git commit 硬擋無印章者

完成類鑰匙（1.7.0）：--boss-ok（老闆決策邊留痕）＋時點對抗＋理解流必然曝光——
  老闆「完成／done」→ sb next done --boss-ok --adversarial；「PASS」→ sb end --boss-ok；
  「下一個／開新 ms」→ sb next intent --new-ms。授權語義由 agent 理解（sb-think args 落理解流），
  理解有誤即越權——老闆每則輸入審視曝光；不防刻意直改 flow-state 的偽造（殘餘由老闆抽查承擔）`);
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
    if (dirty.trim()) problems.push(`${timing} working tree 必須乾淨——該提交的先精準提交，該捨棄的明確捨棄——變更先分類再回定義`);
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
    else if (sha256(path) !== st.g1Contract.sha256) problems.push('G1 已偏離放行時契約——語義變更走回 intent（sb next intent）重走線性（顯式分類是唯一路徑）');
    else passes.push(`G1 契約 hash 核對：${st.g1Contract.sha256.slice(0, 12)}（封存於 flow-state）`);
  }

  // --rerun 返工直通：時點①意圖分流（實作級/定義級）→ 免停靠直通；根本性不帶旗標走完整確認
  // 僅限「同 ms」返工重走（history 中本 ms 曾達 test 及之後）——首次推進或跨 ms 帶 --rerun 即繞過老闆邊，必擋
  // （history entry 帶 ms；無 ms 欄位的舊條目 fail-closed 視為他 ms）
  const rerunReached = (st.history ?? []).some((h) => h.ms === st.ms && ['test', 'build', 'verify', 'done'].includes(h.to));
  if (opts.rerun && target === 'intent') {
    problems.push('--rerun 僅用於前進重走邊——回 intent 邊零旗標走完整線性（返工旗標留在執行層）');
  }
  if (opts.rerun && !rerunReached) {
    problems.push('--rerun 僅限同 ms 返工重走（本 ms 尚未到達 test）——首次推進或跨 ms 之老闆決策邊走完整確認');
  }
  const rerunExempt = opts.rerun && rerunReached && st.node !== 'verify'; // verify→done（完成時點）永不直通——老闆終審不可省

  // 外部證據閘（1.6.0）：research→plan 邊驗「進段後至少一次外部工具調用」（hooks 標記 externalEvidence）；
  // 返工期間（rerunExtPending）任何推進（含再次 --rerun；回 intent 除外——返工中止）同驗——返工外部協助是機械底線。
  if (st.node === 'research' && target === 'plan' && !st.externalEvidence?.done) {
    problems.push('research 段零外部調用——G2 以外部證據打底：MUST 至少一次外部工具調用（WebSearch／WebFetch／webReader 查證，或外部唯讀子代理；hooks 於調用時標記 externalEvidence）才可推進 plan。規模自由（一次精準查證到完整調研皆可），外部性是機械底線（CARD⑨）');
    const note = hooksHealthNote(); if (note) problems.push(note);
  }
  if (st.rerunExtPending && target !== 'intent' && !st.externalEvidence?.done) {
    problems.push('返工期間零外部協助——返工修復 MUST 至少一次外部工具調用（外部查證或外部唯讀子代理；hooks 標記 externalEvidence）——閉門自我檢驗即外部性閘擋下（CARD⑨）');
    const note = hooksHealthNote(); if (note) problems.push(note);
  }

  // --boss-ok：老闆決策邊留痕（授權語義由理解流曝光承擔）；--rerun 直通豁免非完成邊
  if (opts.bossOk && !needsBossOk(st.node, target)) {
    problems.push(`「${st.node} → ${target}」不是老闆決策邊——--boss-ok 留給老闆決策邊；回頭邊零旗標，工作邊沿用既有授權`);
  } else if (needsBossOk(st.node, target) && !opts.bossOk && !rerunExempt) {
    problems.push(`「${st.node} → ${target}」是老闆決策邊——MUST 帶 --boss-ok 留痕（授權語義由理解流曝光承擔）；返工直通改帶 --rerun（時點①分流判定，SKILL §3）`);
  } else if (opts.bossOk) {
    passes.push('老闆授權留痕（--boss-ok）');
  } else if (rerunExempt && needsBossOk(st.node, target)) {
    passes.push(`返工直通（--rerun ${opts.rerun}）：時點①分流判定留痕，完成時點曝光彙總`);
  }

  // --new-ms 誤用擋：僅 done→intent 邊可帶（開新里程碑——老闆決策，理解流曝光承擔）
  if (opts.newMs && !(st.node === 'done' && target === 'intent')) {
    problems.push('--new-ms 僅限 done→intent 邊（老闆授權開新里程碑時攜帶）；其他推進走各自旗標');
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
    problems.push(`「${st.node} → ${target}」不是對抗邊——--adversarial 留給對抗邊`);
  }

  const g1 = mdOf(gPath(st, 1)), g2 = mdOf(gPath(st, 2)), g3 = mdOf(gPath(st, 3));

  switch (target) {
    case 'audit': // 意圖確認邊（--boss-ok 留痕）；audit 段才寫 G1，無 G 檔閘
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
      else if (!substantive(g2, 30)) problems.push('G2 內容空泛——研究產出無實質內容，規劃無依據（精簡研究也要有真結論，不是空話）');
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
        if (dirty.trim()) problems.push('working tree 未乾淨——實作存檔（commit）先於驗收（進驗收前完成提交）');
        else passes.push('working tree 乾淨（實作已存檔，git 判定）');
      } catch { /* 非 git 環境略過 */ }
      break;

    case 'done': // 收斂邊：clean tree＋G1 AC 結構；逐項驗收彙總與時點③對抗為文件層＋SLUG 對照
      checkCleanWorktree(problems, passes, '宣稱完成前');
      if (g1) validateG1Acceptance(g1, problems, passes);
      break;

    case 'intent': // 回頭自由：補充／重修／追加子需求／修約——同 ms 重走；--new-ms 時 ms++（cmdNext）
      passes.push(st.node === 'done' && opts?.newMs ? '--new-ms——回 intent 且開新里程碑' : '回 intent（同 ms 重走線性）');
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
  if (st.understandingHold) out(`停等理解：輸入 #${st.understandingHold.inputIdx} 主動觸發中——寫入與推進凍結，待老闆終審回覆（兩種觸發樣態，SKILL §0）`);
  if (st.node === 'ended') { out(`slug: ${st.slug}   狀態：ended（已 PASS，${st.endedAt ?? '?'}）`); return; }
  out(`slug: ${st.slug}   ms: ${st.ms}   段: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  for (const n of [...FLOW[st.node].next, ...(st.node === 'intent' ? [] : ['intent']), ...(st.node === 'done' ? ['test'] : [])]) {
    if (n === 'intent' && st.node !== 'done' && !FLOW[st.node].next.includes('intent')) {
      out(`  → intent（回頭重走：補充／重修／追加，零旗標，同 ms${st.node === 'done' ? '；--new-ms 則開新里程碑' : ''}）`);
      continue;
    }
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
  if (st.node === 'done') out(`  動作：sb end --boss-ok（PASS——老闆決策留痕，理解流曝光承擔）`);
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
  // 進研究段重置——舊查證不沿用（fail-closed）；例外：返工 pending 未清時不重置
  // （返工期間的外部協助同時作數研究外部證據——一次調用滿足兩閘，不重複索求）
  if (prev === 'audit' && target === 'research' && !st.rerunExtPending) st.externalEvidence = null;
  if (opts.rerun) {
    st.externalEvidence = null; // 返工重走：外部協助重新計次
    st.rerunExtPending = true;  // 返工後首個推進邊驗外部協助（gate 擋零外部；回 intent 邊中止並清）
  } else if (st.rerunExtPending && target === 'intent') {
    delete st.rerunExtPending; // 返工中止（老闆補充重走）——pending 不帶入新線性
  } else if (st.rerunExtPending) {
    delete st.rerunExtPending; // 返工後首個推進邊已過 gate 驗證——消費即清
    passes.push('返工外部協助已驗（externalEvidence）');
  }
  if (prev === 'plan' && target === 'test') {
    // G1 封存＝放行（hash 記 flow-state）；回 intent 重定義後重新放行時重封存
    const file = gPath(st, 1);
    st.g1Contract = { ms: st.ms, file, sha256: sha256(file), sealedAt: new Date().toISOString() };
    passes.push(`G1 契約已封存（flow-state）：${st.g1Contract.sha256.slice(0, 12)}`);
  }
  if (target === 'intent') {
    // 回頭自由：同 ms 重走；--new-ms（老闆授權開新里程碑）→ms++
    delete st.g1Contract;
    if (prev === 'done' && opts.newMs) {
      st.ms = String(Number(st.ms) + 1).padStart(3, '0');
      passes.push(`新里程碑：${st.ms}（--new-ms）`);
    }
  }
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

// sb unlock 已於 1.7.0 退役：雙流模型撤鎖範式——輸入＝獨立理解對象，不是鎖的鑰匙材料。
// 理解經 sb-think 調用（args＝理解宣告）由 hooks 自動落理解流（understandings，雜湊鏈唯增）＋必然曝光；
// 無引句、無解鎖命令、無消費——1.5.6–1.6.2 的解鎖病灶（引句挑選／連續串／時序覆蓋／解鎖失敗／hooks 故障死鎖）根除。
function cmdUnlockRetired() {
  die(['sb unlock 已於 1.7.0 退役——輸入是理解對象不是鑰匙：理解經 sb-think 調用（args＝理解宣告）自動落理解流並曝光，無解鎖命令；完成類鑰匙＝--boss-ok（老闆決策邊）＋時點對抗']);
}

function cmdEnd(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (st.node !== 'done') die([`sb end 僅限 done 態（目前 ${st.node}）——完成（verify→done 老闆決策邊 --boss-ok＋時點③對抗）先於 PASS`]);
  if (!opts.bossOk) die(['PASS 是老闆決策——MUST 帶 --boss-ok 留痕（理解老闆通過授權的語義由理解流曝光承擔）']);
  const problems = [], passes = [];
  checkCleanWorktree(problems, passes, 'PASS 前');
  if (problems.length) die(problems);
  st.node = 'ended';
  st.endedAt = new Date().toISOString();
  st.history.push({ from: 'done', to: 'ended', at: st.endedAt, ms: st.ms, bossOk: true, pass: true });
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin(['done → ended（PASS）', '收尾歸檔（機械化，SKILL §1.7.2）：移 <slug> 至 archive/＋更新歸檔清單（永續層文件已隨各 commit 即時保真——same-commit）', ...passes]);
}



// —— 對抗宣告（提交時點的鑰匙）：MUST 外部唯讀子代理對抗，報告原文落檔後引用 ——
// 機械驗三條：報告檔存在（.shiftblame/tmp 內）→ 含判定行（「對抗判定：通過/不通過」）→ 判定「通過」才可發章
// （判定「通過」即零必修；章僅發於零必修）。自代無合法介面（旗標已移除）——
// 子代理工具不可用＝流程阻塞等待至可用（自代無合法介面）；偽造報告檔屬手改造假（天花板：抽查承擔）。
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
  // 發章前 staged 同檢（與 hooks 同判據——雙層一致）：讀 git 展開的事實清單（cwd=ROOT 錨定），
  // 判系統檔 .shiftblame/（傾倒區唯一）。
  // quotePath=false 防引號逃逸＋--diff-filter 排除純刪除——清理通道放行；非 git 工作區跳過
  try {
    const staged = execSync('git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMRTUB', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean).filter((p) => /^\.shiftblame(?:\/|$)/i.test(p));
    if (staged.length) die([`系統檔不入庫——staged 含 ${staged.slice(0, 5).join('、')}${staged.length > 5 ? ` 等 ${staged.length} 檔` : ''}（.shiftblame/ MUST gitignore；先 git restore --staged 移除再發章）`]);
    // 陳述對照閘（1.7.1）：文件與實況對照是一等公民——永續層文件（docs/、README、skills/）中
    // 可機械對照的陳述（sb 命令引用／sb 命令行內的 --旗標）↔ sb.mjs 實際命令集/旗標集（源碼單一真相）。
    // 引用不存在的機制即擋——過時假設與虛空捏造的機械防線（1.7.0 三輪語彙殘留必修的直接根除）。
    // 當下層工作文件（G*/SLUG/archive）不掃——用後即弃、過時無罪（兩層文件模型，SKILL §1.7）。
    const eternal = execSync('git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMRTUB', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean)
      .filter((p) => /^(?:docs\/|README\.md|skills\/)/.test(p) && /\.md$/i.test(p));
    if (eternal.length) {
      // 真相源（顯式陣列——對抗第一輪必修 1/3：源碼 regex 抓 case 會混入 gate() 的段名 switch、
      // rest.includes 形旗標（--help）會漏——顯式列舉是唯一單一真相）：
      const cmds = new Set(['init', 'state', 'unlock', 'adversarial', 'next', 'end', 'commitmsg']);
      const flags = new Set(['--boss-ok', '--adversarial', '--rerun', '--new-ms', '--help']);
      const bad = [];
      const add = (x) => { if (!bad.includes(x)) bad.push(x); };
      for (const f of eternal) {
        const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
        lines.forEach((line, ln) => {
          // 旗標驗證錨定 sb 命令段（行內其他命令（git 等）的旗標免疫）：從每個 sb 命令 token
          // 起掃，遇邊界即截斷——反引號閉合、中文句讀、其他命令 token（git/node/npm 等）
          for (const m of line.matchAll(/\bsb ([a-z][a-z-]{1,20})\b/g)) {
            if (!cmds.has(m[1])) add(`${f}:${ln + 1} 命令「sb ${m[1]}」不存在於 CLI（實際：${[...cmds].join('、')}）——過時假設或虛空捏造`);
            const seg = line.slice(m.index, m.index + 160).split(/[`。；：、）」』]|\b(?:git|node|npm|npx|python|pip)\b/)[0]; // sb 命令段（截斷後）
            for (const fm of seg.matchAll(/(--[a-z][a-z-]{1,20})\b/g)) {
              if (!flags.has(fm[1])) add(`${f}:${ln + 1} 旗標「${fm[1]}」不存在於 CLI（實際：${[...flags].join('、')}）`);
            }
          }
        });
      }
      if (bad.length) die(['永續層文件與實況不符（陳述對照閘——文件↔實況對照是一等公民，兩層文件模型 SKILL §1.7）', ...bad.slice(0, 8)]);
    }
  } catch { /* 非 git 工作區：無事實清單可查，跳過（hooks 層照常把關） */ }
  // 驗收段對 repo 唯讀——防「驗收中偷改＋偷 commit」的洗白鏈；重修回 test／build 才可存檔
  try {
    const stPath = join(ROOT, '.shiftblame', 'flow-state.json');
    if (existsSync(stPath)) {
      const node = JSON.parse(readFileSync(stPath, 'utf-8')).node;
      if (node === 'verify') die(['驗收段對 repo 唯讀（寫入矩陣）——存檔回 test／build（或任意→intent）後進行']);
    }
  } catch (e) { if (e && e.code === 'ERR_STRING_TOO_LONG') throw e; /* 狀態檔異常視為無狀態 */ }
  const problems = [];
  const m = msg.match(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]+\))?:\s*(.+)$/);
  if (!m) problems.push('缺 type 前綴——格式 `<type>: <繁中描述>`（type：feat/fix/docs/style/refactor/perf/test/chore/build/ci）');
  else {
    const body = m.at(-1);
    if (body.length < 5) problems.push(`描述過短（${body.length} 字）——單行 10-30 字為準，至少講清楚變更本身`);
    if (body.length > 60) problems.push(`描述過長（${body.length} 字）——單行 10-30 字，內容聚焦變更本身（詳細訊息歸文件）`);
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
const flags = { bossOk: false, adversarial: false, rerun: null, newMs: false };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--adversarial') flags.adversarial = true;
  else if (rest[i] === '--rerun') { flags.rerun = rest[++i] ?? ''; if (flags.rerun !== 'impl' && flags.rerun !== 'definition') usage(); }
  else if (rest[i] === '--new-ms') flags.newMs = true;
  else if (rest[i].startsWith('--')) usage(); // 未知旗標（拼錯或已移除者）直接提示 usage——解析器衛生
  else pos.push(rest[i]);
}
switch (cmd) {
  case 'init': cmdInit(pos[0]); break;
  case 'state': cmdState(); break;
  case 'unlock': cmdUnlockRetired(); break;
  case 'adversarial': cmdAdversarial(pos.join(' ')); break;
  case 'next': cmdNext(pos[0], flags); break;
  case 'end': cmdEnd(flags); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  default: usage();
}
