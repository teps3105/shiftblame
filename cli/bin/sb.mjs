#!/usr/bin/env node
// sb — shiftblame 流程狀態機 CLI：閘門只讀 git 事實與 flow-state.json。
//
// 對抗兩類系統性問題：
//   1. 「不自知推進」——agent 自以為該推進就推進，跳過檢查/確認而不自覺。
//      對策：兩層兩段式段鏈＋回頭邊（→intent 經 intent 路由器路由）＋每個推進點的前置閘門；推進
//      MUST 跑 `sb next`，閘門不過即擋（exit 1）。回頭＝老闆新輸入回意圖揭露，前進要鑰匙。
//   2. 「五假」——假需求、假規劃由 G 檔結構閘機械查核；假對抗由 --adversarial＋adversarialLog point 條目對照
//      驗證宣告條目與新鮮度；假驗收由老闆 checkpoint（--boss-ok 留痕＋理解流曝光）
//      與時點對抗承擔（閘門不讀 tmp）。
//
// 無依賴（node:fs / node:crypto / node:path / node:child_process）。在 <repo>（專案根）
// 執行；寫入僅 <repo>/.shiftblame/（狀態檔 flow-state.json 與 tmp/）。
// exit：0 = pass（放行），1 = 閘門擋下，2 = 用法錯誤。

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, realpathSync, renameSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, basename } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { objectRecord, hookRecords, uninitializedState, directState, endedState, validCloseout, readFlowState } from './flow-state.mjs';

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

// ———— 段節點鏈（兩層兩段式）：定義層 requirement→research→plan（逐功能規劃循環→規劃收斂）；時點 1 放行（plan→test）；
// 實作層 test→build→verify（逐功能：提交閘 commit 回 test；紅燈段內修復旗標切段——build→test、verify→build→test）；
// 收斂期 E2E 後時點 2 老闆 pass 出口（verify→intent 帶 --new-ms 開新 ms，或 sb end 結束 slug）。 ————

const FLOW = {
  intent:  { next: ['requirement'], desc: '意圖揭露載體（非流程段）：意圖揭露路由起點——老闆新輸入經 intent 路由器路由（定義級開新輪／pass 出口落點）' },
  requirement: { next: ['research'], desc: 'G1 定義邊：經查證的現況事實＋BDD 行為規格' },
  research:{ next: ['plan', 'requirement'], desc: 'G2 定義邊：技術分析（外部證據打底）；回 requirement＝旗標切段（逐功能循環／CONFORMS 補正——不計返工輪，進段重置外部證據）' },
  plan:    { next: ['test', 'research', 'requirement'], desc: 'G3 定義邊：驗收排程＋實作計畫＋時點 1 放行準備；回 research／requirement＝旗標切段（逐功能循環「下一功能」／CONFORMS 補正——不計返工輪）' },
  test:    { next: ['build'], desc: 'G3 落地邊：撰寫功能測試（回指驗收排程 AC-ID 映射）' },
  build:   { next: ['verify', 'test'], desc: 'G2 落地邊：實作＋提交閘 commit（單功能單提交）；段內修復旗標切段回 test' },
  verify:  { next: ['intent', 'test', 'build'], desc: 'G1 裁判邊：功能 AC 判定（紅燈修復→build／test 旗標切段）；通過經提交閘回 test 接下一功能；時點 2 老闆 pass 出口→intent（--new-ms／end）' },
};

// 回頭邊（老闆新輸入回意圖揭露經 intent 路由器路由）：任意節點→intent 合法——定義級變更同 ms 開新輪
// （計返工輪＋rewrite 載入閘）；時點 2 老闆 pass 後帶 --new-ms 開新 ms 或 sb end 結束 slug。
const backEdge = (from, to) => to === 'intent';

// 前進鑰匙三層（SKILL 授權章）：
//   ① 雙流（hooks 層）：輸入流＋理解流唯增記錄＋必然曝光——無前置攔截，CLI 不重複
//   ② 老闆決策邊鑰匙＝--boss-ok 留痕＋時點對抗；--new-ms 開新里程碑（verify→intent 邊，pass 後）
//   ③ --boss-ok 旗標：老闆輸入承載（輸入流時戳新鮮度 bossFresh 驗）＋留痕；缺失仍擋以保留形式邊界
const needsBossOk = (from, to) =>
  (from === 'intent' && to === 'requirement') || (from === 'plan' && to === 'test');

// --adversarial＝時點對抗宣告＋adversarialLog point 條目對照（缺條目或過期即擋）。
// 時點 1＝定義層放行（plan→test）前——對抗方向；時點 2 不是邊表條目：由 checkPoint2Fresh 把關兩個
// pass 出口（sb end／next --new-ms）——ms 出口前對抗收斂成果、對抗在前老闆判定在後；
// 段內提交閘（實作層一每功能 commit 前）走提交對抗章（無 point），非時點編號。
const ADVERSARIAL_EDGES = [
  { from: 'plan', to: 'test', point: '1' },
];
const adversarialEdge = (from, to) => ADVERSARIAL_EDGES.find((e) => e.from === from && e.to === to) ?? null;

// ———— 小工具 ————

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };

// hooks 健康診斷：本閘的鑰匙（externalEvidence 標記）由 hooks 事實記錄承擔——
// hooks 故障時記錄缺失≠授權缺失，閘的條件永遠無法滿足＝遞迴死鎖。此函式對照 hooks 心跳
// 揭露故障疑慮；只診斷不降級（fail-closed 不變——逃生門屬合法漏洞），修復方向是修 hooks 而非繞閘。
function hooksHealthNote() {
  try {
    if (!existsSync(STATE_FILE)) return '〔hooks 健康警示〕無 flow-state（工作區未初始化）——本擋可能是記錄缺失而非授權缺失；修復工作區後重試（閘保持封閉）';
    const hb = readJson(STATE_FILE).hooksHeartbeat;
    if (!hb) return '〔hooks 健康警示〕無心跳記錄（hooks 從未成功執行——檢查插件安裝；Codex 端須以 /hooks 審閱信任）——本擋可能是記錄缺失而非授權缺失；修復 hooks 後重試（閘保持封閉）';
    const ageMs = Date.now() - new Date(hb.at).getTime();
    const ageMin = Math.round(ageMs / 60000);
    if (!Number.isFinite(ageMs)) return '〔hooks 健康警示〕心跳時間戳無法解析——本擋可能是記錄缺失而非授權缺失；檢查插件 hooks 安裝後重試（閘保持封閉）';
    if (ageMin > 10) return `〔hooks 健康警示〕心跳停在 ${ageMin} 分鐘前（@${hb.event}）——近期工具調用未觸發 hooks（故障或 Codex 端未重新信任），本擋可能是記錄缺失而非授權缺失；修復 hooks 後重試（閘保持封閉）`;
  } catch { return '〔hooks 健康警示〕心跳無法讀取——本擋可能是記錄缺失而非授權缺失；檢查插件 hooks 安裝後重試（閘保持封閉）'; }
  return '';
}
const fin = (msgs) => { console.log('pass'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log'](`sb — shiftblame 流程機械（在 <repo> 專案根執行）

意圖揭露＋六段（兩層兩段式）：老闆輸入經意圖揭露（intent＝揭露的機械載體，非流程段）
      → 定義層 requirement → research → plan（逐功能規劃循環→規劃收斂）
      →時點 1 對抗＋老闆 pass→ 實作層 test → build → verify（逐功能：提交閘 commit 回 test 接下一功能；
      紅燈段內修復旗標切段 build→test、verify→build）→ 收斂期 E2E →時點 2 對抗＋老闆 pass→ 出口
      （pass 出口：sb next intent --new-ms 開下一 ms，或 sb end 結束 slug）
      （老闆任何新輸入回意圖揭露經 intent 路由器路由：任意節點→intent——定義級同 ms 開新輪＋rewrite 載入閘；
      段內修復類由 agents 自動旗標切段不停等不計輪；前進要鑰匙：老闆決策邊 --boss-ok＋時點對抗 --adversarial）

雙流模型：輸入＝獨立理解對象，不是鎖的鑰匙——
      輸入流唯增（hooks 記錄，永不覆蓋消費）；理解流由 shiftblame:think 調用（args＝理解宣告）
      自動落檔＋必然曝光（老闆每則輸入審視未審理解與未覆蓋輸入）；未覆蓋即凍結由 hooks 機械強制。
      無鎖、無解鎖命令、無引句。

用法：
  sb init <slug> [type]                 開 slug：建全骨架（flow-state＋<slug>/001/＋SLUG.md＋archive/＋<type>/<slug> 分支；type 預設 feat）
  sb state                              顯示目前段、可走下一步與其前置條件
  sb adversarial <報告檔> [--point 1|2]  對抗宣告（提交時點的鑰匙；--point＝時點對抗條目不發 commit 章）：
                                        落檔 .shiftblame/tmp/ 後引用檔案；機械驗：檔案存在＋含判定行＋判定為「通過」
                                        （發章僅於判定「通過」——必修全清）；commit 時由 hooks 消費（一對一）
  sb next <段> [--boss-ok] [--adversarial] [--new-ms]
                                        推進（閘門不過即擋）
                                        外部證據閘：research→plan 邊驗
                                        「至少一次外部工具調用」（hooks 標記 externalEvidence——
                                        WebSearch／WebFetch／webReader／web.run（web__run）／Agent；
                                        回 intent 開新輪重走時進 research 段重置、該邊重新驗）；零外部推不過
                                        --boss-ok：老闆授權留痕（intent→requirement、plan→test 邊＋pass 出口：--new-ms／sb end）
                                        --new-ms：開新里程碑（僅 verify→intent 邊，pass 後；MUST --boss-ok＋--adversarial＋時點 2）
                                        --adversarial：時點對抗宣告（plan→test＝時點 1；時點 2 由 sb end／--new-ms 出口驗——
                                        對抗在前、老闆判定在後）；需 sb adversarial --point 對應條目
                                        （adversarialLog，新鮮度＝晚於同邊上次推進）
  sb end --boss-ok --adversarial        pass 後結束 slug（僅 verify 態；--boss-ok＋時點 2）：收尾歸檔＋產出遙測
                                        （git baseline..HEAD diff 統計＋對抗判定＋計數＋耗時——寫 flow-state，事實由 git 承擔）
  sb sopreview                          SOP／ROADMAP 每 ms 審查留痕（三問：基質可答／元行為證據／仍被觸發）；
                                        開新 ms（--new-ms）與 sb end 前機械驗本 ms 已審（無 SOP／ROADMAP 的專案不擋）
  sb closeout --base <本機分支>           歸檔與合併後、刪分支前查證留痕；init 再驗本機與遠端舊分支已清除
  sb commitmsg "<訊息>"                  提交訊息機械驗證＋陳述對照閘（永續層文件的 sb 命令／旗標
                                        引用 ↔ CLI 實況——單一真相取自 sb.mjs 源碼；引用不存在的
                                        機制即擋）＋staged 系統檔檢查；
                                        通過時寫 commit-stamp.json，hooks 對 git commit 硬擋無印章者

完成類鑰匙：--boss-ok（老闆決策邊留痕）＋時點對抗＋理解流必然曝光——
  老闆「結束」→ sb end --boss-ok --adversarial（pass 邊選 end）；「下一個／開新 ms」→ sb next intent --new-ms --boss-ok --adversarial（pass 邊選 next）；
  老闆任何新輸入（含兩時點 fail）→ 回意圖揭露（shiftblame:think）經 intent 路由器路由——定義級 sb next intent 同 ms 開新輪，
  段內修復類由 agents 自動旗標切段（不停等不計輪）。授權語義由 agent 理解（shiftblame:think args 落理解流），
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

// 輪次計數——僅計數零檔案寫入，歷史不可變性由 git 承擔：
// 回 intent 開新輪只遞增計數（ms 目錄有 G 檔才計），零檔案寫入
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
      if (row.fields['證據'] !== 'BEHAVIOR') problems.push(`G1 ${row.id} 證據 MUST 為 BEHAVIOR——結構正確不能代替使用者需求`);
    }
    if (!problems.length) passes.push(`G1 使用者驗收契約：${unique(ids).join('、')}（BEHAVIOR）`);
    return unique(ids);
  }
  // BDD 分段格式（主推；含消融鍵）：### AC- 分段，每段含 Given／When／Then＋使用者＋失敗邊界＋消融＋證據——值逐鍵驗實質
  const blocks = String(g1).split(/^###\s+AC-/m).slice(1);
  if (blocks.length) {
    const ids = blocks.map((b) => 'AC-' + ((b.match(/^\s*(\d{2,})/) ?? [, '?'])[1])); // 剝中文短名——id 恆為 AC-數字（G3 對照鍵）
    if (unique(ids).length !== ids.length) problems.push('G1 驗收契約含重複 AC-ID——每個 AC-ID MUST 唯一');
    for (const [i, b] of blocks.entries()) {
      for (const [key, re] of [['Given', /Given[:：]/], ['When', /When[:：]/], ['Then', /Then[:：]/], ['使用者', /使用者[:：]/], ['失敗邊界', /失敗邊界[:：]/], ['消融', /消融[:：]/]]) { // 六鍵（消融——拿掉此需求使用者失去什麼）
        if (!re.test(b)) { problems.push(`G1 ${ids[i]} 缺 ${key}（BDD 行為規格——字面搬運產不行為規格）`); continue; }
        const val = (b.match(new RegExp(`^[-*]?\\s*${key}[^\\S\\n]*[:：]\\s*(.+)$`, 'm')) ?? [, ''])[1].trim();
        if (!filled(val)) problems.push(`G1 ${ids[i]} ${key} 未填實質（模板照抄不構成行為規格）`);
      }
      if (!/證據[:：]\s*BEHAVIOR/.test(b)) problems.push(`G1 ${ids[i]} 證據 MUST 為 BEHAVIOR——結構正確不能代替使用者需求`);
    }
    if (!problems.length) passes.push(`G1 使用者驗收契約（BDD 行為規格）：${ids.join('、')}（BEHAVIOR）`);
    return unique(ids);
  }
  problems.push('G1 缺 AC 驗收契約——單行（- AC-01 | 鍵=值 |…）或 BDD 分段（### AC-01＋Given／When／Then／使用者／失敗邊界／證據——主推 BDD）擇一定義');
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

  // 骨架存在性閘（僅前進邊——回頭邊不擋）：SLUG.md 缺＝骨架不完整
  if (st.slug && target !== 'intent' && !existsSync(join(SB_DIR, st.slug, 'SLUG.md'))) {
    problems.push(`骨架不完整：${join(SB_DIR, st.slug, 'SLUG.md')} 不存在——由秘書手建（.shiftblame/ 永遠可寫；重跑 init 會覆蓋 flow-state，既有工作區禁止）`);
  }

  // G1 契約核對（放行後任何推進重算；回 intent 邊（老闆新輸入回意圖揭露）重定義前不擋）
  if (st.g1Contract?.ms === st.ms && target !== 'intent') {
    const path = st.g1Contract.file;
    if (!path || !existsSync(path)) problems.push(`G1 契約檔不存在：${path ?? '缺失'}——回 intent（sb next intent）重定義後重新放行`);
    else {
      const raw = readFileSync(path, 'utf8');
      const heads = reflectHeads(raw);
      if (heads !== 1) problems.push(`G1 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——回指區格式破壞（RAM/ROM 分區，SKILL §0）`);
      else if (sha256Text(defSection(raw)) !== st.g1Contract.sha256) problems.push('G1 定義區已偏離放行時契約——定義級變更走回 intent（sb next intent）同 ms 開新輪（計返工輪＋rewrite 載入閘）；回指區更新不觸契約');
      else passes.push(`G1 定義區 hash 核對：${st.g1Contract.sha256.slice(0, 12)}（封存於 flow-state；回指區在 hash 外）`);
    }
  }

  // 外部證據閘：research→plan 邊驗「進段後至少一次外部工具調用」（hooks 標記 externalEvidence；
  // requirement→research 進段重置——回 intent 開新輪重走時重新驗）。
  if (st.node === 'research' && target === 'plan' && !st.externalEvidence?.done) {
    problems.push('research 段零外部調用——G2 以外部證據打底：MUST 至少一次外部工具調用（WebSearch／WebFetch／webReader／web.run（web__run） 查證，或外部唯讀子代理；hooks 於調用時標記 externalEvidence）才可推進 plan。規模自由（一次精準查證到完整調研皆可），外部性是機械底線（CARD⑨）');
    const note = hooksHealthNote(); if (note) problems.push(note);
  }

  // --boss-ok：老闆決策邊留痕＋老闆輸入新鮮度（對抗章不替代老闆章——缺老闆輸入停等不自蓋）
  if (opts.bossOk && !needsBossOk(st.node, target) && !opts.newMs) {
    problems.push(`「${st.node} → ${target}」不是老闆決策邊——--boss-ok 留給老闆決策邊；段內旗標切段與回頭邊不帶，工作邊沿用既有授權`);
  } else if (needsBossOk(st.node, target) && !opts.bossOk) {
    problems.push(`「${st.node} → ${target}」是老闆決策邊——MUST 帶 --boss-ok 留痕（授權語義由理解流曝光承擔）；時點對抗在前、老闆判定在後——pass 才推進（SKILL §3）`);
  } else if (opts.bossOk) {
    if (!bossFresh(st, target)) {
      problems.push('老闆決策邊缺新鮮老闆輸入——--boss-ok 由老闆輸入承載（輸入流須有晚於同邊上次推進／本次 slug 起始的條目），對抗章與理解宣告不替代老闆章；缺老闆決策即 sb stop-report --question 申報待決後停等老闆');
      const note = hooksHealthNote(); if (note) problems.push(note);
    } else passes.push('老闆授權留痕（--boss-ok＋老闆輸入新鮮度已驗）');
  }

  // --new-ms：pass 邊後開下一里程碑——僅 verify→intent 邊；MUST --boss-ok＋--adversarial＋時點 2 新鮮
  // （ms 出口前：對抗收斂成果、對抗在前老闆判定在後——pass 才走出口）
  if (opts.newMs) {
    if (!(st.node === 'verify' && target === 'intent')) die(['--new-ms 僅限 verify→intent 邊（pass 後開下一 ms）——其他推進走各自旗標']);
    if (!opts.bossOk) die(['開新里程碑是老闆選擇（pass 邊後 next）——MUST 帶 --boss-ok 留痕']);
    if (!bossFresh(st, 'intent', { passExit: true })) die(['開新 ms 缺新鮮老闆輸入——--boss-ok 由老闆輸入承載（輸入流須有晚於本 ms 進 verify／slug 起始的條目），對抗章不替代老闆章；缺老闆決策即 sb stop-report --question 申報待決後停等', hooksHealthNote()].filter(Boolean));
    if (!opts.adversarial) die(['開新 ms 前 MUST 時點 2 對抗（ms 出口前對抗收斂成果）——sb adversarial <報告> --point 2 後再推進']);
    const p2n = checkPoint2Fresh(st);
    if (p2n) die([p2n]);
    passes.push('時點 2 對抗：pass 後開新 ms（條目新鮮度已驗）');
  }
  // --adversarial＋adversarialLog point 條目對照（對抗產物屬 RAM，不入 SLUG）：
  // 新鮮度＝point 條目 at 晚於 history 中最近一次同 point 邊推進——防舊條目重放（兩個唯增流交叉判定，零新欄位）
  const adv = adversarialEdge(st.node, target);
  if (adv) {
    if (!opts.adversarial) problems.push(`「${st.node} → ${target}」需時點 ${adv.point} 對抗——MUST 帶 --adversarial 宣告（對抗在前、老闆判定在後——pass 才推進）`);
    else {
      const lastEdgeAt = (st.history ?? []).filter((h) => h.from === st.node && h.to === target).at(-1)?.at;
      const entry = (st.adversarialLog ?? []).filter((e) => e.point === adv.point).at(-1);
      if (!entry) problems.push(`adversarialLog 缺時點 ${adv.point} 條目——MUST sb adversarial <報告檔> --point ${adv.point}（外部唯讀子代理，報告落 tmp）後推進`);
      else if (lastEdgeAt && entry.at <= lastEdgeAt) problems.push(`時點 ${adv.point} 對抗條目過期（早於同邊上次推進）——本輪 MUST 重新 sb adversarial --point ${adv.point}`);
      else passes.push(`時點 ${adv.point} 對抗：adversarialLog 條目對照一致（新鮮度已驗）`);
    }
  } else if (opts.adversarial && !opts.newMs) {
    problems.push(`「${st.node} → ${target}」不是對抗邊——--adversarial 留給對抗邊與 pass 出口`);
  }

  const g1 = mdOf(gPath(st, 1)), g2 = mdOf(gPath(st, 2)), g3 = mdOf(gPath(st, 3));

  switch (target) {
    case 'requirement': // 意圖確認邊（--boss-ok 留痕）；requirement 段才寫 G1，無 G 檔閘
      break;

    case 'research': // 假需求閘
      if (!g1) problems.push('G1 不存在（.shiftblame/<slug>/<ms>/G1.md）');
      else {
        const bdd = String(g1).split(/^###\s+AC-/m).slice(1); // BDD 分段格式（主推）
        if (bdd.length) {
          const accAll = bdd.join('\n');
          if (!substantive(accAll)) problems.push('G1 驗收段敷衍——驗收標準是不可查核的空話（假需求訊號）');
          const vague = VAGUE.filter((v) => accAll.includes(v));
          if (vague.length) problems.push(`G1 驗收段含模糊謂詞「${vague.join('、')}」——不可查核（假需求訊號），改寫為可觀察的行為/狀態`);
          if (!problems.length) passes.push('G1 驗收標準可查核（BDD 行為規格：存在＋實質＋無模糊謂詞）');
        } else {
          const acc = section(g1, '驗收');
          if (acc === null) problems.push('G1 缺「驗收」段——需求沒有可查核的「完成」定義（假需求訊號）');
          else {
            if (!substantive(acc)) problems.push('G1 驗收段敷衍——驗收標準是不可查核的空話（假需求訊號）');
            const vague = VAGUE.filter((v) => acc.includes(v));
            if (vague.length) problems.push(`G1 驗收段含模糊謂詞「${vague.join('、')}」——不可查核（假需求訊號），改寫為可觀察的行為/狀態`);
            if (!problems.length) passes.push('G1 驗收標準可查核（存在＋實質＋無模糊謂詞）');
          }
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
      if (st.node === 'plan') { // 放行邊：假規劃閘（§10 核對與時點 1 對抗為文件層＋point 條目對照）；G1 於此封存
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
      // 進 test＝功能迭代與段內修復的切入段（plan→test 放行、提交閘回 test、旗標切段回 test）；假測試由文件層判準擋
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

    case 'intent': // 回頭邊（老闆新輸入回意圖揭露經 intent 路由器路由）：補充／重修／追加子需求／修約——定義級同 ms 開新輪；--new-ms 時 ms++（cmdNext）
      passes.push(st.node === 'verify' && opts?.newMs ? '--new-ms——回 intent 且開新里程碑' : '回 intent——老闆新輸入回意圖揭露經 intent 路由器路由（定義級同 ms 開新輪）');
      break;
  }
  return { problems, passes };
}

// ———— 指令 ————

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore', 'build', 'ci'];
function readStartupState() {
  try { return readJson(STATE_FILE); }
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
  if (st.understandingHold) problems.push('理解停等尚未解除——待老闆終審回覆後初始化');
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
  if (!endedState(st)) die(['收尾查證僅接受合法 ended 狀態']);
  const problems = endedInitProblems(st);
  if (!hasGitMetadata()) problems.push('非 Git 工作區不需合併查證');
  if (!branchName(base)) problems.push('請以 --base 明確指定本機基底分支');
  const dirty = cleanGitProblem();
  if (dirty) problems.push(dirty);
  if (problems.length) die(problems);
  const baseCommit = branchTip(base);
  if (!baseCommit) die(['基底分支不存在或尚無提交']);
  const candidates = st.workBranch ? [st.workBranch] : TYPES.map(type => `${type}/${st.slug}`).filter(name => branchTip(name));
  if (candidates.length !== 1) die(['缺少唯一舊工作分支來源；先恢復舊功能分支再查證，不以目前 HEAD 代替']);
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
function cmdInit(slug, type = 'feat') {
  if (!slug) usage();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(slug)) die([`slug 僅接受英數與連字號（首字英數、≤64 字）：${slug}`], 2);
  if (!TYPES.includes(type)) die([`type 僅接受：${TYPES.join('/')}（預設 feat）——收到：${type}`], 2);
  requireHealthyState();
  const prior = existsSync(STATE_FILE) ? readStartupState() : null;
  const ended = endedState(prior);
  if (existsSync(STATE_FILE) && !uninitializedState(prior) && !directState(prior) && !ended) die([`flow-state 已存在（${STATE_FILE}）且非合法未初始化／直接實行紀錄或 ended——進行中流程、部分初始化或異常資料保持原樣`]);
  if (!ended && prior?.understandingHold) die(['理解停等尚未解除——待老闆終審回覆後初始化']);
  if (!ended && prior?.adversarialConsumed === false) die(['直接實行提交對抗尚未消費——先完成已授權提交，不得攜帶未消費對抗初始化']);
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
    if (!content) content = `---\nslug: ${slug}\ncreated: ${new Date().toISOString().slice(0, 10)}\n---\n\n# ${slug}\n\n（最小種子——由秘書依範本補全結構：§3 待辦／§4 段表＋定案索引／三面向範本節）\n`;
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
    catch { branchNote = '非 git 環境或分支不可建——分支跳過（SKILL §7 分支 MUST 由秘書補）'; }
  }
  }
  // git baseline 錨定（產出遙測的時序基準）：init 時記 HEAD 與起始時間——sb end 以 baseline..HEAD 做 diff 時序分析
  // （資料在 git；非 git 工作區記 null，遙測 diff 缺省）。回合計數屬 slug 生命週期——新 slug 歸零重計。
  const carried = prior ? (ended ? hookRecords(prior) : prior) : {};
  delete carried.turnUsage; delete carried.usageTotals;
  writeFileSync(STATE_FILE, JSON.stringify({ ...carried, slug, ms: '001', node: 'intent', history: [], startedAt: new Date().toISOString(), baseCommit: gitHeadCommit(), ...(workBranch ? { workBranch } : {}) }, null, 2));
  fin([`slug「${slug}」骨架建立：flow-state＋<slug>/001/＋SLUG.md＋archive/ → ${SB_DIR}`, branchNote, `目前段：intent——意圖揭露經 intent 路由器路由後由此開始`, `專案根錨定：${ROOT}${ROOT === resolve(process.cwd()) ? '' : `（由 ${process.cwd()} 向上錨定）`}`]);
}

// sb init --main：完結 ended 生命週期——不開新 slug、不建工作分支，留在 closeout 基底分支直接作業
// （直接實行語意）。與開新 slug 同一道衛生驗證（歸檔完成＋closeout 證據＋分支清除＋樹淨），另驗目前
// 分支＝closeout 基底；完結戳（concludedAt）維持 ended 分類（歸檔與證據保留），之後 commitmsg 走正常
// type 訊息（merge <slug> 固定訊息僅限完結前收尾——合併證據已由 closeout 查證）。
function cmdInitMain(slugArg) {
  if (slugArg) usage();
  const current = requireHealthyState();
  if (!endedState(current.state)) die([`完結僅接受合法 ended 狀態（目前 ${current.kind}）——sb init --main 是 ended 的收束出口；開新流程走 sb init <新slug>`]);
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
    `ended 生命週期已完結（${st.concludedAt}）：留在 ${st.closeout ? `基底分支 ${st.closeout.baseBranch}` : '目前工作區'} 直接作業（直接實行語意——正常提交走 sb adversarial＋sb commitmsg）`,
    '狀態維持 ended 分類（歸檔與 closeout 證據保留）；日後開新 slug：sb init <新slug>（同 ended 驗證重跑）',
  ]);
}

// sb stop-report：停點申報（停點偵測的合法停點載體，SKILL §1.12）——活動流程中停下前申報具體待決。
// 機械只驗「活動態＋實質問題（≥10 字）」，真待決 or 偷懶由曝光＋老闆終審承擔；下次推進（sb next）即清。
function cmdStopReport(question) {
  const q = String(question ?? '').replace(/\s+/g, ' ').trim();
  if ([...q].length < 10) die([`停點申報須附具體待決問題（--question ≥10 字）——「需要老闆決策」不是問題內容；空泛申報＝偷懶，曝光承擔`]);
  const { kind, state: st } = requireHealthyState();
  if (kind !== 'active') die([`停點申報僅限活動流程（目前 ${kind}）——ended／無流程的停點本就合法，無須申報`]);
  if (st.understandingHold) die(['理解停等中——主動 think 停等本就合法，無須停點申報']);
  const lastInputIdx = (st.inputsRotated ?? 0) + (st.inputs ?? []).length - 1;
  if (lastInputIdx < 0) die(['輸入流為空（hooks 未信任或未記錄）——無法標定申報新鮮度：修復 hooks 記錄後重試（sb state 對照心跳）']); // 對抗必修：inputIdx=-1 會使狀態立即 invalid
  st.stopReport = {
    at: new Date().toISOString(),
    inputIdx: lastInputIdx, // 全域輸入編號（新鮮度基準——跨回合即陳舊）
    node: st.node,
    question: q,
    reviewed: false,
  };
  delete st.stopBlockedAt; // 申報完成——本次停點改走申報面放行
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`停點申報留痕：#${st.stopReport.inputIdx} @${st.node}「${q}」——可停；老闆下則輸入時曝光終審（真待決 or 偷懶）；下次推進即清`]);
}

function cmdState() {
  const { kind, state: st } = requireHealthyState();
  if (['missing', 'uninitialized', 'direct'].includes(kind)) {
    out(kind === 'direct' ? '直接實行：合法無段位紀錄；沒有 slug。' : '尚未初始化：沒有已接入的 slug；既有 hooks 紀錄保持原值。');
    out('經 shiftblame:think 依老闆授權路由：不開 slug 可直接實行；明確開 slug 才執行 sb init <slug>。狀態可辨識不等於批准。');
    if (st?.understandingHold) out('  理解停等尚未解除——正式寫入與推進保持凍結');
    return;
  }
  if (st?.node === 'ended') {
    if (!endedState(st)) die(['ended 狀態不完整或未知——保留原檔，查明原因後修復']);
    if (st.concludedAt) {
      out(`slug: ${st.slug}   狀態：ended＋已完結（${st.concludedAt}）——base 分支直接作業中（直接實行語意）`);
      out('  提交走 sb adversarial＋sb commitmsg（正常 type 訊息）；開新工作：經 shiftblame:think 對齊後 sb init <新slug>');
      return;
    }
    out(`slug: ${st.slug}   狀態：ended（已 pass 結束，${st.endedAt}）`);
    const problems = [...endedInitProblems(st), ...closedGitPlan(st).problems];
    if (problems.length) for (const p of problems) out(`  初始化前：${p}`);
    else out('  下一步：經 shiftblame:think 對齊新工作後 sb init <新slug>（開新流程）或 sb init --main（完結 ended 生命週期、留在 base 分支直接作業——不開 slug 不建分支；工作與歸檔路徑須未占用）');
    return;
  }
  if (st.node === 'done') { // 舊版判決通過態（2.2.0 遷移讀出）：出口同 pass，唯讀不改檔
    out(`slug: ${st.slug}   ms: ${st.ms}   段: done（舊版判決通過態——2.2.0 語意＝verify pass 後）`);
    out('  出口同 pass：sb next intent --new-ms --boss-ok --adversarial（下一 ms）或 sb end --boss-ok --adversarial（結束 slug）；重修＝老闆新輸入回意圖揭露經 intent 路由器路由');
    return;
  }
  if (!objectRecord(st) || typeof st.slug !== 'string' || !st.slug || typeof st.ms !== 'string' || !Array.isArray(st.history) || !(Object.hasOwn(FLOW, st.node) || st.node === 'ended')) die(['flow-state 狀態不完整或未知——保留原檔，查明原因後修復；未執行任何狀態變更']);
  if (st.understandingHold) out(`停等理解：輸入 #${st.understandingHold.inputIdx} 主動觸發中——寫入與推進凍結，待老闆終審回覆（兩種觸發樣態，SKILL §0）`);
  out(`slug: ${st.slug}   ms: ${st.ms}${st.rev ? `   輪次: r${String(st.rev).padStart(2, '0')}` : ''}   段: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  if (st.turnUsage?.escalations) out(`迴圈升級：本回合已升級 ${st.turnUsage.escalations} 次（最後 @${st.turnUsage.escalatedAt}）——已自動回 intent，依修正分類補正 G1~G3 後接續（不凍結；同指紋二次升級＝死操作本回合封禁）`);
  else if (st.turnUsage) out(`回合觀測（純量測，無預算無上限）：本回合迄今 ${st.turnUsage.requests} 工具調用——工作做到完成為止`);
  if (st.stopReport) out(`停點申報：#${st.stopReport.inputIdx} @${st.stopReport.node}「${st.stopReport.question}」——老闆終審真待決 or 偷懶（曝光於老闆下則輸入；推進即清）`);
  if ((existsSync(join(SB_DIR, 'SOP.md')) || existsSync(join(SB_DIR, 'ROADMAP.md'))) && st.sopReview?.ms !== st.ms) out(`  待審：SOP／ROADMAP 每 ms 必審（三問：基質可答／元行為證據／仍被觸發）→ sb sopreview <三問結論> 留痕（開新 ms（pass）前機械驗，含機械基本功）`);
  const nexts = [...FLOW[st.node].next];
  if (st.node !== 'intent' && !nexts.includes('intent')) nexts.push('intent');
  for (const n of nexts) {
    if (n === 'intent' && !FLOW[st.node].next.includes('intent')) {
      out('  → intent（回頭：老闆新輸入回意圖揭露經 intent 路由器路由——定義級同 ms 開新輪）');
      continue;
    }
    const { problems, passes } = gate({ ...st }, n, {});
    out(`  → ${n}（${FLOW[n].desc}）`);
    for (const p of passes) out(`      ✓ ${p}`);
    for (const p of problems) out(`      ✗ ${p}`);
  }
  if (st.node === 'verify') out('  pass 出口（時點 2 對抗在前、老闆判定在後——pass 才走）：sb next intent --new-ms --boss-ok --adversarial（下一 ms）或 sb end --boss-ok --adversarial（結束 slug）；fail＝老闆新輸入回意圖揭露');
}

function cmdNext(target, opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (st.node === 'done') st.node = 'verify'; // 舊版判決通過態遷移（2.2.0）：done＝verify pass 後別名——出口同 pass（--new-ms／end），重修走 intent；推進寫檔即自然遷移
  if (st.node === 'ended' || !(st.node in FLOW)) die([`目前狀態 ${st.node ?? '（無）'} 不可推進——slug 已結束或狀態檔不屬於任何段`]);
  if (!(target in FLOW)) die([`未知段「${target}」。流程節點：${Object.keys(FLOW).join(' → ')}`], 2);
  const legal = FLOW[st.node].next.includes(target) || backEdge(st.node, target);
  if (!legal) die([`不合法推進：${st.node} → ${target}（可走：${[...FLOW[st.node].next, 'intent'].join(' / ')}）`]);
  // 迴圈升級（escalatedAt／escalations）屬純觀測——不凍結推進：升級的自動回 intent 由 hooks 承擔（不凍結不停擺，
  // 工作做到完成為止）；量永不構成中斷理由，同指紋二次升級的死操作封禁由 hooks 於工具層承擔。
  // SOP／ROADMAP 每 ms 審查閘：開新 ms 前驗本 ms 已審（AI 開發下單一 ms 足以改變方向）
  if (st.node === 'verify' && opts.newMs) { const p = sopReviewProblem(st); if (p) die([p]); }
  const { problems, passes } = gate(st, target, opts);
  if (problems.length) die(problems);
  const prev = st.node;
  st.node = target;
  delete st.stopReport; delete st.stopBlockedAt; // 工作已續行——停點申報與擋停自限失效（停點偵測，SKILL §1.12）
  // 進研究段重置——舊查證不沿用（fail-closed）；回 intent 開新輪重走時重新驗
  if (prev === 'requirement' && target === 'research') st.externalEvidence = null;
  if (prev === 'plan' && target === 'test') {
    // G1 封存＝放行（分區封存：定義區 hash 記 flow-state；回指區在 hash 外隨執行更新）；回 intent 重定義後重新放行時重封存
    const file = gPath(st, 1);
    const raw = mdOf(file) ?? '';
    const heads = reflectHeads(raw);
    if (heads !== 1) die([`G1 「## 回指記錄」分隔標題出現 ${heads} 次（須恰一次）——放行前修正回指區格式（RAM/ROM 分區，SKILL §0）`]);
    st.g1Contract = { ms: st.ms, file, sha256: sha256Text(defSection(raw)), sealedAt: new Date().toISOString() };
    passes.push(`G1 定義區契約已封存（flow-state）：${st.g1Contract.sha256.slice(0, 12)}`);
  }
  if (target === 'intent') {
    // 回頭邊（老闆新輸入回意圖揭露）：定義級同 ms 開新輪；--new-ms（老闆授權開新里程碑）→ms++
    delete st.g1Contract;
    if (prev === 'verify' && opts.newMs) {
      const prevMs = st.ms; // per-ms 遙測結算對象＝前一 ms（鍵＝被結算 ms）
      st.ms = String(Number(st.ms) + 1).padStart(3, '0');
      delete st.rev; // 新 ms 乾淨輪次——舊 ms 輪號不帶入
      delete st.rewriteSeen; // 舊 ms 的 rewrite 載入鑰匙不帶入（rev per-ms 從 1 重算——殘留 seen 會自動解鎖新 ms 首個修正輪）
      delete st.sopReview; // 審查戳記屬 ms——新 ms 重跑三問後重新留痕
      passes.push(`新里程碑：${st.ms}（--new-ms）`);
      if (existsSync(join(ROOT, '.git')) && (st.msBaseline || st.baseCommit)) {
        const d = gitDiffStats(st.msBaseline || st.baseCommit, gitHeadCommit());
        st.msTelemetry = { ...(st.msTelemetry ?? {}), [prevMs]: { diff: d, settledAt: new Date().toISOString() } }; // per-ms 遙測結算（前一 ms）
      }
      st.msBaseline = gitHeadCommit(); // 新 ms 記自身基準
    } else if (prev !== 'intent') { // intent→intent＝no-op 輪
      // 開新輪：新輪重寫自洽，時序由 history＋輪次計數承擔（歷史不可變性歸 git）
      const revN = countRev(st);
      if (revN) { st.rev = revN; passes.push(`修正輪 r${String(revN).padStart(2, '0')}：新輪重寫自洽（時序由 history 承擔，歷史歸 git）——本輪寫 G 檔前 hooks 驗已調用 shiftblame:rewrite（未載入即擋）`); }
    }
  }
  const entry = { from: prev, to: target, at: new Date().toISOString(), ms: st.ms, bossOk: !!opts.bossOk, adversarial: !!opts.adversarial };
  if (st.turnUsage?.escalatedAt) entry.budgetExhausted = true; // 迴圈升級自動回 intent 留痕（歷史鍵名，語義＝迴圈升級；hooks 觸發，CLI 對照 escalatedAt）
  st.history.push(entry);
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → ${target}`, ...passes]);
}

// sb unlock 不存在：雙流模型——輸入＝獨立理解對象，不是鎖的鑰匙材料。
// 理解經 shiftblame:think 調用（args＝理解宣告）由 hooks 自動落理解流（understandings，雜湊鏈唯增）＋必然曝光；
// 無引句、無消費——輸入與理解流皆唯增，無鑰匙材料。
function cmdUnlockAbsent() {
  die(['sb unlock 不存在——輸入是理解對象不是鑰匙：理解經 shiftblame:think 調用（args＝理解宣告）自動落理解流並曝光；完成類鑰匙＝--boss-ok（老闆決策邊）＋時點對抗']);
}

// SOP／ROADMAP 機械基本功檢查（日期類＋重複類——全機械可判，審查必過）：違規未清即不發審查戳記。
function sopDocProblems() {
  const problems = [];
  for (const name of ['SOP.md', 'ROADMAP.md']) {
    const file = join(SB_DIR, name);
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const close = lines.indexOf('---', 1);
    const fm = lines[0] === '---' && close > 0 ? lines.slice(1, close) : null;
    const body = fm ? lines.slice(close + 1) : lines;
    const updatedRaw = fm ? (fm.map((l) => l.match(/^updated:\s*(\S+)/)?.[1]).find(Boolean) ?? null) : null;
    if (!updatedRaw) problems.push(`${name}: frontmatter 缺 updated 欄——更新日期是審查對照基準（範本必備）`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(updatedRaw) || Number.isNaN(Date.parse(updatedRaw))) problems.push(`${name}: updated「${updatedRaw}」非 YYYY-MM-DD`);
    else {
      const now = new Date();
      const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'); // 當地時區日——UTC 日期會在凌晨誤判假同步
      if (updatedRaw > today) problems.push(`${name}: updated「${updatedRaw}」晚於今日——假同步`);
      if (existsSync(join(ROOT, '.git'))) {
        const g = spawnSync('git', ['log', '-1', '--format=%cs', '--', `.shiftblame/${name}`], { cwd: ROOT, encoding: 'utf8', timeout: 5000 });
        const last = g?.status === 0 ? String(g.stdout ?? '').trim() : ''; // git 失敗（含 .shiftblame/ 未入庫＝框架慣例）→ 跳過落後比對
        if (last && updatedRaw < last) problems.push(`${name}: updated「${updatedRaw}」落後於檔案最後變更（git ${last}）——改了文件沒同步更新日期`);
      }
    }
    const dateLines = body.filter((l) => /^[\s>*-]*(?:\d+\.\s*)?\d{4}-\d{2}-\d{2}/.test(l));
    if (dateLines.length) problems.push(`${name}: ${dateLines.length} 行以日期開頭（歷史日誌特徵——改寫成規則句，流水歸 git 與 tmp）：${dateLines.slice(0, 3).map((l) => l.trim().slice(0, 40)).join('、')}`);
    const norm = (l) => {
      let t = l.replace(/^[\s>*-]+|^\d+\.\s*/, '').replace(/^[\s>*-]+|^\d+\.\s*/, ''); // 雙重剝離——巢狀列表（- 1. x 與 1. x 同判）
      return t.replace(/\s+/g, ' ').trim();
    };
    const seen = new Map();
    for (const l of body) {
      const t = norm(l);
      if (!t || /^\|[\s|:-]+\|?$/.test(t)) continue;
      seen.set(t, (seen.get(t) ?? 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, n]) => n > 1);
    if (dups.length) problems.push(`${name}: ${dups.length} 組完全重複行（追加不更新即重複——合併或刪除）：${dups.slice(0, 3).map(([t, n]) => `「${t.slice(0, 30)}」×${n}`).join('、')}`);
    const heads = new Map();
    for (const l of body) {
      const m = l.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!m) continue;
      const key = m[1].length + '|' + m[2].replace(/\s+/g, ' ');
      heads.set(key, (heads.get(key) ?? 0) + 1);
    }
    const headDups = [...heads.entries()].filter(([, n]) => n > 1);
    if (headDups.length) problems.push(`${name}: 重複標題 ${headDups.length} 組（同名段合一）：${headDups.slice(0, 3).map(([k]) => k.split('|')[1].slice(0, 30)).join('、')}`);
  }
  return problems;
}
// SOP／ROADMAP 每 ms 審查閘（修剪迴路的機械承載）：AI 開發下單一 ms 即足以改變整體方向——
// 開新 ms（--new-ms）與 pass（sb end）前驗本 ms 已審；無 SOP／ROADMAP 的專案不擋。
function sopReviewProblem(st) {
  if (!(existsSync(join(SB_DIR, 'SOP.md')) || existsSync(join(SB_DIR, 'ROADMAP.md')))) return null;
  if (st.sopReview?.ms !== st.ms) return 'SOP／ROADMAP 每 ms 必審——本 ms 尚未審查：對照實況跑三問（基質可答？元行為證據？仍被觸發？）後 sb sopreview <三問結論> 留痕（刪修加減皆可，變更走正常 commit）';
  const docProblems = sopDocProblems(); // 堵先審後改窗口——審查後文件又被改髒，開新 ms 與 pass 出口仍擋
  if (docProblems.length) return 'SOP／ROADMAP 機械基本功未過（審查後文件又被改髒——修復後重跑 sb sopreview）：' + docProblems.join('；');
  return null;
}
// 產出遙測的 diff 統計：git baseline..HEAD 的 numstat 時序分析（基質優先——git 已承擔身分錨定與不可變性，sb 只做彙總）。
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


function cmdSopreview(answers) {
  const q = String(answers ?? '').replace(/\s+/g, ' ').trim();
  if ([...q].length < 10) die(['審查留痕須附三問結論一行（≥10 字）——「審了」不是結論：每問的判斷（基質可答？元行為證據？仍被觸發？）寫進留痕']);
  const current = requireHealthyState();
  if (current.kind !== 'active') die(['SOP／ROADMAP 審查留痕需要有效 slug 流程（直接實行紀錄無 ms 邊界）']);
  const st = current.state;
  if (st.understandingHold) die(['理解停等尚未解除——待老闆終審回覆後留痕']);
  const hasDocs = existsSync(join(SB_DIR, 'SOP.md')) || existsSync(join(SB_DIR, 'ROADMAP.md'));
  const docProblems = hasDocs ? sopDocProblems() : [];
  if (docProblems.length) die(['SOP／ROADMAP 機械基本功未過——審查戳記不發（修復後重跑 sb sopreview）：', ...docProblems]);
  st.sopReview = { ms: st.ms, at: new Date().toISOString(), answers: q.slice(0, 200) };
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([
    `SOP／ROADMAP 審查留痕（ms ${st.ms}）：三問結論「${q.slice(0, 80)}」已落檔；機械基本功（updated 同步／零日期日誌行／零重複）已過`,
    hasDocs ? '審查發現的刪修走正常 commit（same-commit 文件先行）' : '（本工作區無 SOP／ROADMAP——留痕記錄審查週期）',
  ]);
}

// 時點 2 新鮮度（ms 出口——對抗在前老闆判定在後，pass 才走）：point 2 條目須存在、為最新、晚於本 ms 末次進 verify
// 老闆輸入新鮮度（老闆決策邊鑰匙的事實承載）：--boss-ok 由老闆輸入承載——輸入流（hooks UserPromptSubmit
// 唯增記錄）須存在晚於基準的條目，對抗章與理解宣告不替代老闆章；缺老闆決策即 stop-report 申報停等。
// 基準鏈＝max(同邊上次推進 at（不過濾旗標，鏡像時點 1 新鮮度）, 本 ms 末次進 verify at（僅 pass 出口——
// 鏡像時點 2）, slug 起始 at)。純時戳判定零語義（機械不掃詞）——本閘是「老闆在場且開過口」的下限，
// 語義授權由理解流曝光＋老闆終審承擔；偽造輸入紀錄由抽查承擔。
function bossFresh(st, target, { passExit = false } = {}) {
  const ts = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; };
  const sameEdgeAt = (st.history ?? []).filter((h) => h.from === st.node && h.to === target).at(-1)?.at;
  const verifyAt = passExit ? (st.history ?? []).filter((h) => h.to === 'verify' && h.ms === st.ms).at(-1)?.at : undefined;
  const base = Math.max(ts(sameEdgeAt), ts(verifyAt), ts(st.startedAt));
  return (st.inputs ?? []).some((e) => ts(e.at) > base);
}
function checkPoint2Fresh(st) {
  const lastP2 = (st.adversarialLog ?? []).at(-1);
  if (!lastP2 || lastP2.point !== '2') return '時點 2 對抗未宣告或非最新條目——sb adversarial <報告> --point 2（ms 出口前：對抗收斂成果、對抗在前老闆判定在後）';
  const lastVerify = [...(st.history ?? [])].reverse().find((h) => h.to === 'verify');
  if (lastVerify && new Date(lastP2.at) <= new Date(lastVerify.at)) return `時點 2 對抗（${lastP2.at}）早於末次進 verify（${lastVerify.at}）——重審後再推進`;
  return null;
}
function cmdEnd(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = readJson(STATE_FILE);
  if (st.node === 'done') st.node = 'verify'; // 舊版判決通過態遷移（2.2.0）：done＝verify pass 後別名——本指令完成即遷移為 ended
  if (st.node !== 'verify') die([`sb end 僅限 verify 態選 end（目前 ${st.node}）——驗收 pass 邊＋時點 2 對抗（收斂成果審查）先於結束`]);
  if (!opts.bossOk) die(['pass 結束是老闆決策——MUST 帶 --boss-ok 留痕（理解老闆通過授權的語義由理解流曝光承擔）']);
  if (!bossFresh(st, 'ended', { passExit: true })) die(['pass 結束缺新鮮老闆輸入——--boss-ok 由老闆輸入承載（輸入流須有晚於本 ms 進 verify／slug 起始的條目），對抗章不替代老闆章；缺老闆決策即 sb stop-report --question 申報待決後停等', hooksHealthNote()].filter(Boolean));
  if (!opts.adversarial) die(['結束 slug 前 MUST 時點 2 對抗（收斂成果審查）——sb end --boss-ok --adversarial']);
  const p2 = checkPoint2Fresh(st);
  if (p2) die([p2]);
  const sopProblem = sopReviewProblem(st);
  if (sopProblem) die([sopProblem]);
  const problems = [], passes = [];
  checkCleanWorktree(problems, passes, 'pass 前');
  if (problems.length) die(problems);
  // 產出遙測（基質優先）：diff 事實由 git 承擔——sb init 錨定 baseline commit，end 做時序分析；
  // 對抗判定取最後條目（verdict＋審查模型）；計數與耗時來自 hooks 觀測流；缺省一律 null（舊流程／無 git 可比）。
  const head = gitHeadCommit();
  const diff = ((st.msBaseline || st.baseCommit) && head && (st.msBaseline || st.baseCommit) !== head) ? gitDiffStats(st.msBaseline || st.baseCommit, head) : null; // per-ms 結算
  if (diff) st.msTelemetry = { ...(st.msTelemetry ?? {}), [st.ms]: { diff, settledAt: new Date().toISOString() } }; // per-ms 遙測：末段 ms 於 end 出口同步結算
  const lastAdv = (st.adversarialLog ?? []).at(-1) ?? null;
  st.telemetry = {
    diff,
    baseCommit: st.baseCommit ?? null,
    headCommit: head,
    adversarial: lastAdv ? { verdict: lastAdv.verdict, model: lastAdv.model ?? null } : null,
    counts: {
      inputs: (st.inputsRotated ?? 0) + (st.inputs ?? []).length,
      understandings: (st.understandingsRotated ?? 0) + (st.understandings ?? []).length,
      adversarial: (st.adversarialRotated ?? 0) + (st.adversarialLog ?? []).length,
      toolCalls: Object.hasOwn(st, 'usageTotals') ? st.usageTotals.requests : null,
    },
    durationMinutes: st.startedAt ? Math.round(((Date.now() - Date.parse(st.startedAt)) / 60000) * 10) / 10 : null,
  };
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
  st.node = 'ended';
  st.endedAt = new Date().toISOString();
  st.history.push({ from: 'verify', to: 'ended', at: st.endedAt, ms: st.ms, bossOk: true, pass: true });
  // slug 邊界清理（終態留痕後）：累積流（曝光與對照價值隨 slug 終結）直接清空——零副本、零殭屍存續
  const cleared = { inputs: (st.inputsRotated ?? 0) + (st.inputs ?? []).length, understandings: (st.understandingsRotated ?? 0) + (st.understandings ?? []).length, adversarial: (st.adversarialRotated ?? 0) + (st.adversarialLog ?? []).length, history: (st.historyRotated ?? 0) + st.history.length };
  delete st.inputs; delete st.understandings; delete st.adversarialLog; delete st.understandingHold; delete st.externalEvidence; delete st.rev; delete st.rewriteSeen; delete st.g1Contract; st.history = [];
  delete st.sopReview; delete st.baseCommit; delete st.startedAt;
  delete st.turnUsage; delete st.usageTotals; delete st.stopReport; delete st.stopBlockedAt;
  delete st.worktrees; // 冪等清理歷史鍵（已移除的 worktree 帳本欄位——舊 flow-state 兼容清理）
  delete st.rerunExtPending; // 冪等清理歷史鍵（已移除的返工直通 pending——舊 flow-state 兼容清理）
  delete st.budget; delete st.budgetBreaches; // 冪等清理歷史鍵（舊版預算欄位——不相容則 ended 檔自我 invalid）
  delete st.inputsRotated; delete st.understandingsRotated; delete st.understandingSeedHash; delete st.adversarialRotated; delete st.historyRotated;
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  const t = st.telemetry;
  fin([
    'verify → ended（pass）',
    `產出遙測（flow-state 留痕，事實由 git 承擔）：diff ${t.diff ? `${t.diff.additions}+／${t.diff.deletions}-／${t.diff.files} 檔` : '（無可比 baseline——缺省）'}｜對抗 ${t.adversarial ? `${t.adversarial.verdict}${t.adversarial.model ? `（${t.adversarial.model}）` : ''}` : '（無條目）'}｜toolCalls ${t.counts.toolCalls ?? '—'}｜耗時 ${t.durationMinutes ?? '—'} 分`,
    `flow-state 累積流已清（slug 邊界——輸入 ${cleared.inputs}／理解 ${cleared.understandings}／對抗 ${cleared.adversarial}／history ${cleared.history}；零副本）`,
    '收尾歸檔已完成（機械化——聲稱與實做一致）：<slug>/ 已移至 archive/<slug>/（永續層文件已隨各 commit 即時保真——same-commit）',
    ...passes,
  ]);
}



// —— 對抗宣告（提交時點的鑰匙）：MUST 外部唯讀子代理對抗，報告原文落檔後引用 ——
// 機械驗三條：報告檔存在（.shiftblame/tmp 內）→ 含判定行（「對抗判定：通過/不通過」）→ 判定「通過」才可發章
// （判定「通過」即零必修；章僅發於零必修）。自代無合法介面——
// 子代理工具不可用＝流程阻塞等待至可用（自代無合法介面）；偽造報告檔屬手改造假（天花板：抽查承擔）。
function cmdAdversarial(report, point) { // --point 1|2＝時點對抗條目（RAM；不發 commit 章）；無 point＝提交對抗章
  if (!report || !report.trim()) die(['缺報告檔——sb adversarial <子代理對抗報告檔> [--point 1|2]（.shiftblame/tmp/review-*.md；MUST 外部唯讀子代理，報告原文落檔後引用）']);
  const current = requireHealthyState();
  if (current.state?.understandingHold) die(['理解停等尚未解除——不得宣告對抗或發章']);
  if (point && current.kind !== 'active') die(['時點對抗需要有效 slug 流程；不開 slug 的直接實行只宣告提交對抗，不得偽造段位']);
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
  if (verdict !== '通過') die([`對抗判定「${verdict}」＝必修未清——修復後 MUST 再對抗至「通過」才可提交（閘環零必修機械化）`]);
  // 審查模型（遙測素材）：報告內含「審查模型：」行則記錄（外部子代理自報身份），缺省為無鍵——不新增宣告介面
  const model = text.match(/^[ \t]*審查模型[：:][ \t]*([^\n\r]{1,80})/m)?.[1]?.trim() || null;
  const at = new Date().toISOString();
  const entry = { at, report: report.trim(), verdict, node: st.node ?? null, ...(point ? { point } : {}), ...(model ? { model } : {}) };
  (st.adversarialLog ??= []).push(entry);
  if (point) {
    // 時點對抗條目（RAM）——不設 adversarialAt（不發 commit 章）：邊章與 commit 章分流，防「邊章兼作 commit 章」繞道
    writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
    fin([
      `時點${point}對抗條目留痕（@${st.node ?? '未入段'}）：${report.trim()}（判定：${verdict}）——adversarialLog 條目，不發 commit 章`,
    ]);
  }
  st.adversarialAt = at;
  st.adversarialConsumed = false;
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([
    `對抗宣告留痕（@${st.node ?? '未入段'}）：${report.trim()}（判定：${verdict}）`,
    'commitmsg 將驗本宣告（不消費）；hooks 於實際 commit 時消費（一對一）——每個 commit 前都需要新的子代理對抗',
  ]);
}

function cmdCommitmsg(msg) {
  if (!msg) usage();
  const current = requireHealthyState();
  if (current.state?.understandingHold) die(['理解停等尚未解除——不得發出提交印章']);
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
    // 註釋座標結構樣式掃描（SKILL §3 註釋紀律＋§7 同源紀律的機械下限）：
    // staged diff 新增行（+ 行）掃小而穩定的座標結構樣式——時點圈號、時點 N、第 N 輪、兩位以上輪次代號；
    // 框架機制檔（hooks/、cli/、skills/、.codex-plugin/、README.md）豁免——框架本體講流程語言正當。
    // 樣式集是字元結構下限（r 變數命名等誤傷屬如實標註天花板），語義級由提交對抗（攻擊點清單）與老闆抽查承擔。
    const MECH_PATH = /^(?:hooks\/|cli\/|skills\/|\.codex-plugin\/|README\.md)/;
    const COORD_STYLE = /[①②③④⑤⑥⑦⑧⑨⑩]|時點\s*[0-9０-９]|第\s*[0-9０-９一二三四五六七八九十]+\s*輪|\br\d{2,}\b/;
    const coordHits = [];
    const diff = execSync('git -c core.quotePath=false diff --cached -U0 --diff-filter=ACMRTUB', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    let curFile = null;
    for (const line of diff.split('\n')) {
      const fh = line.match(/^\+\+\+ b\/(.+)$/);
      if (fh) { curFile = fh[1]; continue; }
      if (!curFile || MECH_PATH.test(curFile)) continue;
      if (line.startsWith('+') && !line.startsWith('+++') && COORD_STYLE.test(line)) coordHits.push(`${curFile}：${line.slice(1, 60).trim()}`);
    }
    if (coordHits.length) die([`staged 新增行含流程座標結構樣式（註釋紀律——輪次／時點座標屬 .shiftblame/tmp 與 G 檔，註釋只描述代碼行為本身）`, ...coordHits.slice(0, 8)]);
    // 陳述對照閘：文件與實況對照是一等公民——永續層文件（docs/、README、skills/）中
    // 可機械對照的陳述（sb 命令引用／sb 命令行內的 --旗標）↔ sb.mjs 實際命令集/旗標集（源碼單一真相）。
    // 引用不存在的機制即擋——過時假設與虛空捏造的機械防線。
    // 當下層工作文件（G*/SLUG/archive）不掃——用後即弃、過時無罪（兩層文件模型，SKILL §1.7）。
    const eternal = execSync('git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMRTUB', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean)
      .filter((p) => /^(?:docs\/|README\.md|skills\/)/.test(p) && /\.md$/i.test(p));
    if (eternal.length) {
      // 命令與旗標顯式列舉：源碼 regex 抓 case 會混入 gate() 的段名 switch、
      // rest.includes 形旗標（--help）也可能漏判。
      const cmds = new Set(['init', 'state', 'unlock', 'adversarial', 'next', 'end', 'closeout', 'commitmsg', 'sopreview', 'stop-report']);
      const flags = new Set(['--boss-ok', '--adversarial', '--new-ms', '--point', '--base', '--question', '--main', '--help']);
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
  if (current.state?.node === 'verify') die(['驗收段對 repo 唯讀（寫入矩陣）——存檔回 test／build（或任意→intent）後進行']);
  const problems = [];
  // 已歸檔 slug 的合併訊息由 closeout 固定；仍經對抗檢查及精確訊息印章。
  // 完結（sb init --main）後固定合併訊息失效——合併證據已由 closeout 查證，直接作業走正常 type 訊息。
  const isSlugMerge = endedState(current.state) && !current.state.concludedAt && msg === `merge ${current.state.slug}`;
  const m = msg.match(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]+\))?:\s*(.+)$/);
  if (!m && !isSlugMerge) problems.push(endedState(current.state) && current.state.concludedAt && msg === `merge ${current.state.slug}`
    ? 'slug 已完結（sb init --main）——固定合併訊息僅限完結前收尾；直接作業提交走 `<type>: <繁中描述>`'
    : '缺 type 前綴——格式 `<type>: <繁中描述>`（type：feat/fix/docs/style/refactor/perf/test/chore/build/ci）；已歸檔合併限目前 slug 的 `merge <slug>`');
  else if (m) {
    const body = m.at(-1);
    if (body.length < 5) problems.push(`描述過短（${body.length} 字）——單行 10-30 字為準，至少講清楚變更本身`);
    if (body.length > 60) problems.push(`描述過長（${body.length} 字）——單行 10-30 字，內容聚焦變更本身（詳細訊息歸文件）`);
    if (/\b[a-zA-Z]{1,4}-?\d+\b|#\d+/.test(body)) problems.push('含追蹤編號（r24、F4、MS001、G7、#123 等）——commit 訊息純描述變更本身，版本代號以繁中描述（如「第 2 版」），正式名稱表達功能語義，工作紀錄歸 tmp');
    if (/第\s*[0-9０-９一二三四五六七八九十]+\s*[組段輪]|[組段輪]\s*[0-9０-９]/.test(body)) problems.push('含中文流程編號（第 X 組/段/輪）——流程座標屬 G 檔與 SLUG，訊息純描述變更本身');
    if (!/^[\u4e00-\u9fff]/.test(body)) problems.push('描述以繁中開頭——<type>: 後為繁中變更描述（檔名/代號可出現在句中，非句首）');
    if (/斷言先行|測試先行|待終審|量化驗收|開新輪|返工直通/.test(body)) problems.push('含流程時序語——訊息純描述變更本身，開發過程語（斷言先行/測試先行/待終審等）屬 tmp');
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
// sb usage 事件：每次調用（子命令＋參數摘要）落 tmp JSONL——sb 呼叫頻譜的機械觀測層
// （老闆可隨時清理該檔；缺檔自動重建；觀測失敗靜默——遙測失效不影響本命令執行）。
try {
  mkdirSync(TMP, { recursive: true });
  appendFileSync(join(TMP, 'sb-usage.jsonl'), JSON.stringify({ at: new Date().toISOString(), cmd: cmd ?? '(none)', args: rest.join(' ').slice(0, 120) }) + '\n');
} catch { /* 觀測落檔失敗不攔主流程 */ }
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const flags = { bossOk: false, adversarial: false, newMs: false, point: null, base: null, question: null, main: false, task: null, phase: null, verdict: null, report: null };
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--boss-ok') flags.bossOk = true;
  else if (rest[i] === '--adversarial') flags.adversarial = true;
  else if (rest[i] === '--new-ms') flags.newMs = true;
  else if (rest[i] === '--main') { flags.main = true; if (cmd !== 'init') usage(); }
  else if (rest[i] === '--point') { flags.point = rest[++i] ?? ''; if (!['1', '2'].includes(flags.point)) usage(); }
  else if (rest[i] === '--base') { flags.base = rest[++i] ?? ''; if (cmd !== 'closeout' || !flags.base || flags.base.startsWith('-')) usage(); }
  else if (rest[i] === '--question') { flags.question = rest[++i] ?? ''; if (cmd !== 'stop-report' || !flags.question || flags.question.startsWith('-')) usage(); }
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
  case 'stop-report': cmdStopReport(flags.question); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  default: usage();
}
