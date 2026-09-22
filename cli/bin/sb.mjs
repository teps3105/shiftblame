#!/usr/bin/env node
// sb — shiftblame 流程狀態機 CLI：閘門只讀 git 事實與 flow-state.json。
//
// 對抗兩類系統性問題：
//   1. 「不自知推進」——agent 自以為該推進就推進，跳過檢查/確認而不自覺。
//      對策：七段圓環（intent 環首＝環尾）＋兩層兩段式段鏈＋回頭邊（任意段→intent 重走開新輪）＋每個推進點的前置閘門；推進
//      MUST 跑 `sb next`，閘門不過即擋（exit 1）。技術問題依證據回責任段修正；老闆新意圖重走 intent，決策邊承接授權。
//   2. 「五假」——假需求、假規劃由 G 檔結構閘機械查核；假對抗由 --adversarial＋lastAdv 時點條目對照
//      驗證宣告條目與新鮮度；假驗收由老闆 checkpoint（--boss-ok 旗標即章＋think 理解揭露）
//      與時點對抗承擔（閘門不讀 tmp）。
//
// 無依賴（node:fs / node:crypto / node:path / node:child_process）。在 <repo>（專案根）
// 執行；寫入僅 <repo>/.shiftblame/（狀態檔 flow-state.json 與 tmp/）。
// exit：0 = pass（放行），1 = 閘門擋下，2 = 用法錯誤。

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, realpathSync, renameSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, basename } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { objectRecord, hookRecords, uninitializedState, directState, endedState, validCloseout, readFlowState, migrateStreams, unchangedG1Approval } from './flow-state.mjs';
import { externalToolConfigStatus } from './external-tools.mjs';

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

// ———— 段節點鏈（七段圓環——intent 環首＝環尾＋兩層兩段式）：定義層 requirement→research→plan（逐功能規劃循環→規劃收斂）；
// 時點 1 對抗＋老闆 pass 於 requirement→research 邊（G1 準則建立後審「意圖→需求翻譯」）；plan→test 機械推進（假規劃閘，零審核）；
// 實作層 test→build→verify（逐功能：提交閘 commit 回 test；紅燈段內修復旗標切段——build→test、verify→build→test；
// 中鏈零審核資源，僅機械格式閘——build→verify 亦機械推進：E2E 全綠＋working tree 乾淨即過）；verify＝真驗收執行——G1 GWT
// 逐條＝驗收劇本（Given 實際建立→When 實際操作→Then 觀察真實行為→證據落回指區），驗收依據＝行為是否真的發生而非
// 測試燈號；驗收完成、G1 回指閉環後時點 2 對抗＋老闆終審 pass 於 verify 出口邊（審驗收結果——GWT 回指意圖、假綠燈：
// 測試綠但 AC 從行為矩陣還原不出＝綠燈無效；出口同一邊兩章：verify→intent 帶 --new-ms 開新 ms，或 sb end 結束 slug）。 ————

const FLOW = {
  intent:  { next: ['requirement'], desc: '七段圓環環首＝環尾（老闆意圖沉澱，不屬任何層）：任何新意圖在該 ms 內一律重走 intent 開新輪；verify 出口邊閉環落點' },
  requirement: { next: ['research'], desc: 'G1 定義邊：經查證的現況事實＋BDD 行為規格；首次或變更需時點 1 對抗＋老闆 pass；定義未變且無封存後新意圖時沿用原核准' },
  research:{ next: ['plan', 'requirement'], desc: 'G2 定義邊：技術分析（外部證據打底）；回 requirement＝旗標切段（逐功能循環／CONFORMS 補正——不計返工輪，進段重置外部證據；G1 未變且無新意圖時沿用原封存，重新核准後才重封存）' },
  plan:    { next: ['test', 'research', 'requirement'], desc: 'G3 定義邊：驗收排程＋實作計畫；plan→test 機械推進（假規劃閘，零審核）；回 research／requirement＝旗標切段（逐功能循環「下一功能」／CONFORMS 補正——不計返工輪）' },
  test:    { next: ['build', 'plan'], desc: 'G3 落地邊：撰寫功能測試；計畫前提、操作或可測性有問題時回 plan 修正，保留 G1 契約與輪次' },
  build:   { next: ['verify', 'test'], desc: 'G2 落地邊：實作＋提交閘 commit（單功能單提交）；段內修復旗標切段回 test；收斂期 E2E 全綠＋working tree 乾淨即 build→verify 機械推進（中鏈零審核）' },
  verify:  { next: ['intent', 'test', 'build'], desc: '真驗收執行：G1 GWT 逐條＝驗收劇本——實操觀察真實行為、證據落回指區（驗收依據＝行為是否發生，非測試燈號）；驗出技術問題時自主回 test／build 修復，依根因可續退 plan／research；老闆判 fail 或需求修約才重走 intent；驗收完成、G1 回指閉環後時點 2 對抗＋老闆終審 pass 出口→intent（--new-ms --adversarial --boss-ok／end --adversarial --boss-ok）' },
};

// 回頭邊（任何新意圖一律重走 intent）：任意節點→intent 合法——同 ms 開新輪（計返工輪＋rewrite 載入閘）；
// verify 出口邊（時點 2 對抗＋老闆終審 pass）帶 --new-ms 開新 ms 或 sb end 結束 slug。
const backEdge = (from, to) => to === 'intent';

// 前進鑰匙三層（SKILL 授權章）：
//   ① 理解宣告（對話承載）：think args 揭露語義授權——flow-state 不另造對話流記錄（2.5.2），CLI 不重複
//   ② 老闆決策邊鑰匙＝--boss-ok 留痕＋時點對抗；--new-ms 開新里程碑（verify→intent 邊，pass 後）
//   ③ --boss-ok 旗標即章：老闆實際輸入由對話承載（基質優先——平台已答，不另造記錄）；機械不驗時戳，
//      語義授權由 think 揭露＋老闆終審承擔；偽造由抽查承擔
// 兩時點：時點 1＝requirement→research（G1 準則建立後審意圖→需求翻譯）；時點 2＝verify 出口邊（驗收完成、
// G1 回指閉環後審驗收結果——GWT 回指、假綠燈）；中鏈（research→plan→test→build→verify）零審核資源——老闆不看
// 中間產物，問題在前期（翻譯錯）與驗收後（對不上）暴露，中間機械推進；verify＝真驗收執行，出口＝時點 2 對抗＋老闆證據終審。
const needsBossOk = (from, to) =>
  (from === 'intent' && to === 'requirement') || (from === 'requirement' && to === 'research');

// --adversarial＝時點對抗宣告＋lastAdv 時點條目對照（缺條目或過期即擋）。
// 時點 1＝requirement→research 邊——審意圖→需求翻譯（GWT 從行為矩陣還原、翻譯保真）；
// 時點 2＝verify→intent 出口邊——驗收完成、G1 回指閉環後審驗收結果：GWT 回指意圖、假綠燈（測試綠但 AC
// 從行為矩陣還原不出＝綠燈無效）；出口（sb end／next --new-ms）＝時點 2 對抗條目＋老闆終審章同一邊
// （--adversarial＋--boss-ok；時點 2 老闆 pass 即終審 pass）。
// 段內提交閘無對抗（2.4.0 移除）——commitmsg 格式驗證＋印章承載提交機械，審核不在提交時點。
const ADVERSARIAL_EDGES = [
  { from: 'requirement', to: 'research', point: '1' },
  { from: 'verify', to: 'intent', point: '2' },
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

七段圓環（intent 環首＝環尾——不屬任何層；兩層兩段式）
      → 定義層 requirement →時點 1 對抗＋老闆 pass（審意圖→需求翻譯）→ research → plan
      （逐功能規劃循環→規劃收斂；plan→test 機械推進——中鏈零審核資源）
      → 實作層 test → build → verify（逐功能：提交閘 commit 回 test 接下一功能；
      依證據回退 research→requirement、plan→research、test→plan、build→test、verify→build）→ E2E 全綠＋working tree 乾淨 →build→verify 機械推進
      → verify 真驗收（GWT 逐條實操、行為證據落回指區、G1 回指閉環）→ 時點 2 對抗＋老闆終審 pass 出口
      （sb next intent --new-ms --adversarial --boss-ok 開下一 ms，或 sb end --adversarial --boss-ok 結束 slug——出口同一邊兩章）
      （任何新意圖在該 ms 內一律重走 intent：任意節點→intent 同 ms 開新輪＋rewrite 載入閘；
      技術修復由 agents 自動旗標切段不停等不計輪；老闆決策邊 --boss-ok＋時點對抗 --adversarial，同一 G1 且無新意圖沿用核准）

雙流模型：輸入＝獨立理解對象，不是鎖的鑰匙——
      輸入流唯增（hooks 記錄，永不覆蓋消費）；理解流由 shiftblame:think 調用（args＝理解宣告）
      自動落檔＋必然曝光（老闆每則輸入審視未審理解與未覆蓋輸入）；未覆蓋即凍結由 hooks 機械強制。
      無鎖、無解鎖命令、無引句。

用法：
  sb init <slug> [type]                 開 slug：建全骨架（flow-state＋<slug>/001/＋SLUG.md＋archive/＋<type>/<slug> 分支；type 預設 feat）
  sb state                              顯示目前段、可走下一步與其前置條件
  sb adversarial <報告檔> --point 1|2    時點對抗宣告（條目入 lastAdv 定長欄位）：
                                        落檔 .shiftblame/tmp/ 後引用檔案；機械驗：檔案存在＋含判定行＋判定為「通過」
                                        （必修全清才可宣告）；--point 必帶（1＝requirement→research；2＝verify 出口）
  sb next <段> [--boss-ok] [--adversarial] [--new-ms]
                                        推進（閘門不過即擋）
                                        外部證據閘：research→plan 邊驗
                                        「至少一次外部工具調用」（hooks 標記 externalEvidence——
                                        平台查證／外部唯讀子代理（內建精確名單＋.shiftblame/external-tools.json 設定擴充）；
                                        重走 intent 開新輪時進 research 段重置、該邊重新驗）；零外部推不過
                                        --boss-ok：老闆授權留痕（intent→requirement、requirement→research 邊＋pass 出口：--new-ms／sb end）
                                        --new-ms：開新里程碑（僅 verify→intent 出口邊，時點 2 對抗＋老闆終審 pass 後；MUST --adversarial --boss-ok）
                                        --adversarial：時點對抗宣告（requirement→research＝時點 1；verify→intent 出口＝時點 2——
                                        對抗在前、老闆判定在後）；需 sb adversarial --point 對應條目
                                        （lastAdv，時點 1 晚於同邊上次推進；時點 2 晚於本 ms 末次進 verify）
  sb end [--base <本機分支>] --adversarial --boss-ok
                                        時點 2 對抗＋老闆終審 pass 後結束 slug（僅 verify 態——出口同一邊兩章）：
                                        收尾歸檔＋一條龍 git 收尾（--no-ff 合併回基底（訊息固定 merge <slug>）＋
                                        內建查證留痕＋刪本機工作分支——任一步失敗整體擋下，狀態保持 verify 重試）
                                        ＋產出遙測（git baseline..HEAD diff 統計＋對抗判定＋計數＋耗時——寫 flow-state，
                                        事實由 git 承擔）；基底自動偵測（slug 起始提交所在唯一本機分支），
                                        零命中或歧義即擋要求 --base 明示，不猜主幹名稱
  sb sopreview "<逐檔三態計數>"        SOP／ROADMAP 審查留痕（整檔重寫自洽——逐條三問裁定：基質可答／
                                        元行為證據／仍被觸發；淘汰即刪，先刪改後留痕）：
                                        「SOP 逐條重評估：刪N 改N 留N（增N 選配）；ROADMAP 逐條重評估：刪N 改N 留N」；
                                        slug 期間開新 ms（--new-ms）與 sb end 前機械驗本 ms 已審且戳記未失效
                                        （綁定各檔 sha256——審後改檔即重審）；非 slug 期間以 commit 為審查邊
                                        （每次提交前驗戳記）；無 SOP／ROADMAP 的專案不擋
  sb closeout --base <本機分支>           事後查證與例外修復留痕（end 已一條龍代做合併與刪本機分支——手動整合後查證）；
                                        init 再驗本機與遠端舊分支已清除
  sb commitmsg "<訊息>"                  提交訊息機械驗證＋陳述對照閘（永續層文件的 sb 命令／旗標
                                        引用 ↔ CLI 實況——單一真相取自 sb.mjs 源碼；引用不存在的
                                        機制即擋）＋staged 系統檔檢查；
                                        通過時寫 commit-stamp.json，hooks 對 git commit 硬擋無印章者

完成類鑰匙：--boss-ok（老闆決策邊留痕）＋時點對抗＋理解流必然曝光——
  老闆「結束」→ sb end --adversarial --boss-ok（出口邊選 end）；「下一個／開新 ms」→ sb next intent --new-ms --adversarial --boss-ok（出口邊選 next）；
  老闆任何新輸入（含兩時點 fail）→ 重走 intent（shiftblame:think）——sb next intent 同 ms 開新輪，
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
  // GWT 機械掃描黑名單（2.4.0 時點 1 前移的機械下限——規格工程化樣式，r59 反面例）：
  // 使用者欄自曝開發者視角／When 主語是工程活動包裝（執行測試、跑閘）／Then 是工程品質指標（全綠、無殘留）。
  // 機械只擋最穩定的字面樣式（下限）；語義級「AC 從行為矩陣還原不出一列」由時點 1 對抗攻防承載（REQUIREMENT 行為矩陣判準）。
  const gwtBlacklist = (id, key, value) => {
    if (key === '使用者' && /開發者視角|工程視角/.test(value)) problems.push(`G1 ${id} 使用者欄自曝「${/開發者視角|工程視角/.exec(value)[0]}」——使用者欄填標的方角色，工程行為包裝成需求即偽 AC（行為矩陣判準）`);
    if (key === 'When' && /^(執行|跑|運行)/.test(value) && /（測試|測試碼|規格閘|驗證閘|檢查|套件）/i.test(value)) problems.push(`G1 ${id} When 主語是工程活動（${value.slice(0, 24)}…）——When 主語＝標的方經產品介面操作，測試整備走測試碼與 G2（行為矩陣判準）`);
    if (key === 'Then' && /全綠|全部通過|全數通過|無殘留|無引用/.test(value)) problems.push(`G1 ${id} Then 是工程品質指標（${value.slice(0, 24)}…）——Then＝標的方可觀察結果（看到、得到、避免什麼），非工程指標`);
  };
  if (rows.length) { // 單行格式——相容驗證
    const ids = rows.map((row) => row.id);
    if (unique(ids).length !== ids.length) problems.push('G1 驗收契約含重複 AC-ID——每個 AC-ID MUST 唯一');
    const required = ['需求', '使用者', '前置', '操作', '可觀察結果', '失敗邊界', '證據'];
    for (const row of rows) {
      const missing = required.filter((key) => !filled(row.fields[key]));
      if (missing.length) problems.push(`G1 ${row.id} 缺實質欄位：${missing.join('、')}`);
      if (row.fields['證據'] !== 'BEHAVIOR') problems.push(`G1 ${row.id} 證據 MUST 為 BEHAVIOR——結構正確不能代替使用者需求`);
      gwtBlacklist(row.id, '使用者', row.fields['使用者'] ?? '');
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
        gwtBlacklist(ids[i], key, val);
      }
      if (!/證據[:：]\s*BEHAVIOR/.test(b)) problems.push(`G1 ${ids[i]} 證據 MUST 為 BEHAVIOR——結構正確不能代替使用者需求`);
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
    problems.push(`骨架不完整：${join(SB_DIR, st.slug, 'SLUG.md')} 不存在——由秘書手建（.shiftblame/ 永遠可寫；重跑 init 會覆蓋 flow-state，既有工作區禁止）`);
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
      else if (sha256Text(defSection(raw)) !== st.g1Contract.sha256) problems.push('G1 定義區已偏離封存時契約——定義級變更走回 intent（sb next intent）同 ms 開新輪（計返工輪＋rewrite 載入閘）；回指區更新不觸契約');
      else passes.push(`G1 定義區 hash 核對：${st.g1Contract.sha256.slice(0, 12)}（封存於 flow-state；回指區在 hash 外）`);
    }
  }

  // 外部證據閘：research→plan 邊驗「進段後至少一次外部工具調用」（hooks 標記 externalEvidence；
  // 每次進 research 都重置，包含 plan→research 的技術修正）。
  if (st.node === 'research' && target === 'plan' && !st.externalEvidence?.done) {
    problems.push('research 段零外部調用——G2 以外部證據打底：MUST 至少一次外部工具調用（平台查證／外部唯讀子代理——判準＝內建精確名單＋.shiftblame/external-tools.json 設定擴充；hooks 於調用時標記 externalEvidence）才可推進 plan。規模自由（一次精準查證到完整調研皆可），外部性是機械底線（CARD⑨）');
    const cfg = externalToolConfigStatus(ROOT);
    if (cfg.reason) problems.push(`〔設定擴充未生效〕.shiftblame/external-tools.json ${cfg.reason}——生效條件：git 追蹤且工作樹乾淨（經提交審查面）`);
    const note = hooksHealthNote(); if (note) problems.push(note);
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

  // 同一段可從前進或回退邊進入，使用最近的進段事實判定新輸入；缺進段紀錄時沿既有行為放行。
  const RETREAT_EDGES = { research: ['requirement'], plan: ['research', 'requirement'], test: ['plan'], build: ['test'], verify: ['test', 'build'] };
  if (RETREAT_EDGES[st.node]?.includes(target) && st.lastBossInputAt) {
    const enteredAt = Object.entries(st.edgeAt ?? {}).filter(([edge]) => edge.endsWith(`→${st.node}`)).map(([, at]) => at).sort().at(-1);
    if (enteredAt && st.lastBossInputAt > enteredAt) {
      problems.push(`老闆輸入後的段內修復切段（${st.node} → ${target}）＝把老闆新意圖當執行性修復消化——老闆任何輸入驅動的工作一律重走 intent 開新輪（sb next intent，計返工輪）；段內修復僅限代理自主執行性修復（A3）`);
    }
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
      if (st.node !== 'research') break; // 測試揭露計畫問題時，允許先回到計畫修正。
      if (!g2) problems.push('G2 不存在');
      else if (!substantive(g2, 30)) problems.push('G2 內容空泛——研究產出無實質內容，規劃無依據（精簡研究也要有真結論，不是空話）');
      else passes.push('G2 實質存在');
      break;

    case 'test':
      if (st.node === 'plan') { // 機械推進閘（plan→test 零審核——2.4.0）：假規劃閘（G3 結構驗證）；§10 一致核對與時點 1 對抗已於 requirement→research 邊承載
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

// sb stop-report 已除（2.6.3）：停點申報實測為「找理由停」的橡皮章——停等的正當性改由位置承載
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
  if (st.node === 'done') { // 舊版判決通過態（2.2.0 遷移讀出）：出口同 pass，唯讀不改檔
    out(`slug: ${st.slug}   ms: ${st.ms}   段: done（舊版判決通過態——2.2.0 語意＝verify pass 後）`);
    out('  出口同 pass：sb next intent --new-ms --adversarial --boss-ok（下一 ms）或 sb end --adversarial --boss-ok（結束 slug）；重修＝老闆新輸入重走 intent 開新輪');
    return;
  }
  if (!objectRecord(st) || typeof st.slug !== 'string' || !st.slug || typeof st.ms !== 'string' || !(Object.hasOwn(FLOW, st.node) || st.node === 'ended')) die(['flow-state 狀態不完整或未知——保留原檔，查明原因後修復；未執行任何狀態變更']);
  out(`slug: ${st.slug}   ms: ${st.ms}${st.rev ? `   輪次: r${String(st.rev).padStart(2, '0')}` : ''}   段: ${st.node}（${FLOW[st.node].desc}）`);
  if (st.g1Contract?.ms === st.ms) out(`G1 contract: ${st.g1Contract.sha256}（${st.g1Contract.file}）`);
  if (st.turnUsage?.escalations) out(`迴圈升級：本回合已升級 ${st.turnUsage.escalations} 次（最後 @${st.turnUsage.escalatedAt}）——已自動重走 intent，依修正分類補正 G1~G3 後接續（不凍結；同指紋二次升級＝死操作本回合封禁）`);
  else if (st.turnUsage) out(`回合觀測（純量測，無預算無上限）：本回合迄今 ${st.turnUsage.requests} 工具調用——工作做到完成為止`);
  if ((existsSync(join(SB_DIR, 'SOP.md')) || existsSync(join(SB_DIR, 'ROADMAP.md'))) && st.sopReview?.ms !== st.ms) out(`  待審：SOP／ROADMAP 每 ms 必審＝整檔重寫自洽（逐條三問裁定、淘汰即刪——先刪改後留痕）→ sb sopreview "SOP 逐條重評估：刪N 改N 留N；ROADMAP …"（開新 ms（pass）與結束前機械驗，戳記綁定 sha256）`);
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
  delete st.stopBlockedAt; // 工作已續行——擋停自限失效（停等位置導向，SKILL §1.12）
  // 重新研究須有本次外部查證；需求未變的回查保留原始核准時間與契約。
  if (target === 'research') st.externalEvidence = null;
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
      delete st.rewriteSeen; // 舊 ms 的 rewrite 載入鑰匙不帶入（rev per-ms 從 1 重算——殘留 seen 會自動解鎖新 ms 首個修正輪）
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
      if (revN) { st.rev = revN; passes.push(`修正輪 r${String(revN).padStart(2, '0')}：新輪重寫自洽（時序由 edgeAt 承擔，歷史歸 git）——本輪寫 G 檔前 hooks 驗已調用 shiftblame:rewrite（未載入即擋）`); }
    }
  }
  // 邊推進留痕（定長欄位——各邊最後時戳，閘門新鮮度對照用；迴圈升級旗標由 hooks 的 escalatedAt 對照）
  st.edgeAt = { ...(st.edgeAt ?? {}), [`${prev}→${target}`]: new Date().toISOString() };
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([`${prev} → ${target}`, ...passes]);
}

// sb unlock 不存在：理解由對話承載——think args 理解宣告在對話流即可見（2.5.2 起不落檔），
// 無引句、無鑰匙材料、無檔案記錄；完成類鑰匙＝--boss-ok（老闆決策邊）＋時點對抗。
function cmdUnlockAbsent() {
  die(['sb unlock 不存在——理解經 shiftblame:think 揭露（args 理解宣告，對話承載）即可行動；完成類鑰匙＝--boss-ok（老闆決策邊）＋時點對抗']);
}

// SOP／ROADMAP 機械基本功檢查（日期類＋重複類＋治理內容類——全機械可判，審查必過）：違規未清即不發審查戳記。
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
    // 治理檔內容掃描（兩組）：任務代號——任務層識別字與路由歸屬屬任務文件與臨時工作區；
    // 框架重述——治理規範單一來源於中央技能文件，專案治理檔重述框架規則或範本即雙重來源。
    // 範本自身已去框架化（零代號字樣、零框架語彙），正文零例外。樣式集是字元結構下限，
    // 語義級（如 URL slug 領域術語）由審查三問與老闆抽查承擔。
    const TASK_CODE = [
      [/\bslug\b/i, '任務工作項目識別字（slug）'],
      [/\bAC-\d+\b/, '驗收條目編號'],
      [/\bT\d{1,2}\b/, '技術條目編號'],
      [/\bG[123]\b/, '三面向文檔指涉'],
      [/\.shiftblame[\/\\]\S+[\/\\]\d{3}/, '任務目錄路徑'],
      [/<(?:slug|nnn|ms)>/i, '未替換佔位字樣'],
      [/\bshiftblame\b/i, '框架名稱（治理規範單一來源於中央技能文件）'],
      [/\bsb\s+(?:init|state|unlock|adversarial|next|end|closeout|commitmsg|sopreview|stop-report)\b/, '框架指令引用'],
      [/(?:七段|兩時點|時點\s*[12]|時點對抗|審查戳記|審查留痕)/, '流程機制語彙'],
      [/(?:boss-ok|adversarial|new-ms|flow-state|same-commit|sopreview|commitmsg|stop-report|closeout)/i, '流程旗標／命令名'],
      [/\b(?:SKILL|MECHANISMS)\b/, '框架文件指涉'],
      [/秘書/, '框架角色語彙'],
    ];
    for (const [re, label] of TASK_CODE) {
      const hits = body.filter((l) => re.test(l));
      if (hits.length) problems.push(`${name}: ${hits.length} 行含${label}（治理檔以產品／專案語言表達，條目內容與流程規則留在各自載體）：${hits.slice(0, 3).map((l) => l.trim().slice(0, 40)).join('、')}`);
    }
    // 任務工作項目識別字（slug 名）產品包裝化掃描：2.6.2 擋字面代號後的洗白殘餘——代理把 slug 名
    // 當產品概念寫進治理檔。複合名（含 -／_）與產品詞彙同形率極低故硬擋；單字 slug 名（如 login）
    // 與產品詞彙同形不可機械辨——語義級天花板，由審查三問與老闆抽查承擔。
    for (const sn of knownSlugNames()) {
      if (!/[-_]/.test(sn)) continue;
      const re = new RegExp(`(?<![a-z0-9_-])${sn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9_-])`, 'i');
      const hits = body.filter((l) => re.test(l));
      if (hits.length) problems.push(`${name}: ${hits.length} 行含任務工作項目識別字「${sn}」（產品包裝化——治理檔以產品語言改寫或刪除）：${hits.slice(0, 3).map((l) => l.trim().slice(0, 40)).join('、')}`);
    }
  }
  return problems;
}
// 已知任務工作項目識別字（slug 名）：活動 slug（flow-state）＋歸檔 slug（archive/）。
function knownSlugNames() {
  const names = [];
  try {
    const st = readJson(STATE_FILE);
    if (objectRecord(st) && typeof st.slug === 'string' && st.slug) names.push(st.slug);
  } catch { /* 無狀態檔＝無活動 slug */ }
  try {
    for (const e of readdirSync(join(SB_DIR, 'archive'), { withFileTypes: true })) if (e.isDirectory()) names.push(e.name);
  } catch { /* 無 archive＝無歸檔 slug */ }
  return [...new Set(names)];
}
// 治理檔現存清單（SOP／ROADMAP——存在者才受審查閘管轄）。
function govDocFiles() {
  return ['SOP.md', 'ROADMAP.md'].filter((n) => existsSync(join(SB_DIR, n)));
}
// SOP／ROADMAP 每 ms 審查閘（修剪迴路的機械承載）：審查＝整檔重寫自洽（rewrite 紀律——逐條三問
// 裁定：基質可答？元行為證據？仍被觸發？——納入／改寫／淘汰，淘汰即刪；先刪改、後留痕）。
// AI 開發下單一 ms 即足以改變整體方向——開新 ms（--new-ms）與 pass（sb end）前驗本 ms 已審
// 且戳記未失效（綁定各檔 sha256——審後改檔即失效重審）；無 SOP／ROADMAP 的專案不擋。
function sopReviewProblem(st) {
  const files = govDocFiles();
  if (!files.length) return null;
  if (st.sopReview?.ms !== st.ms) return 'SOP／ROADMAP 每 ms 必審＝整檔重寫自洽（逐條三問裁定、淘汰即刪——先刪改後留痕）：sb sopreview "SOP 逐條重評估：刪N 改N 留N（增N）；ROADMAP 逐條重評估：刪N 改N 留N"（各檔分別申報）';
  const bound = st.sopReview.files;
  if (!objectRecord(bound)) return '審查戳記未綁定檔案內容（舊格式戳記）——重跑 sb sopreview（新戳記綁定各檔 sha256，審後改檔即失效）';
  const drifted = [];
  for (const n of files) if (bound[n] !== sha256Text(readFileSync(join(SB_DIR, n), 'utf8'))) drifted.push(n);
  for (const n of Object.keys(bound)) if (!files.includes(n)) drifted.push(`${n}（審後新增）`);
  if (drifted.length) return `審查後治理檔已變更（${drifted.join('、')}）——重跑 sb sopreview 重新綁定`;
  const docProblems = sopDocProblems(); // 堵先審後改窗口——審查後文件又被改髒，開新 ms 與 pass 出口仍擋
  if (docProblems.length) return 'SOP／ROADMAP 機械基本功未過（審查後文件又被改髒——修復後重跑 sb sopreview）：' + docProblems.join('；');
  return null;
}
// 非 slug 期間（直接實行／完結後主基底作業）的審查閘：以 commit 為審查邊——每次提交驗戳記
// 綁定當下檔案內容且錨定當下 HEAD（每 commit 重綁——防治理檔停在多個任務前的過時狀態；
// 無 git 場景退 hash 綁定）。
function sopReviewProblemDirect(st) {
  const files = govDocFiles();
  if (!files.length) return null;
  if (!objectRecord(st?.sopReview) || !objectRecord(st.sopReview.files)) return '非 slug 期間治理檔以 commit 為審查邊——本次提交前 sb sopreview "SOP 逐條重評估：刪N 改N 留N（增N）；ROADMAP 逐條重評估：刪N 改N 留N"（戳記綁定各檔 sha256）';
  const head = gitHeadCommit();
  if (head && st.sopReview.head !== head) return '審查戳記未錨定當下 HEAD（戳記後已有新提交）——重跑 sb sopreview 後再提交';
  const bound = st.sopReview.files;
  const drifted = [];
  for (const n of files) if (bound[n] !== sha256Text(readFileSync(join(SB_DIR, n), 'utf8'))) drifted.push(n);
  for (const n of Object.keys(bound)) if (!files.includes(n)) drifted.push(`${n}（審後新增）`);
  if (drifted.length) return `審查後治理檔已變更（${drifted.join('、')}）——重跑 sb sopreview 重新綁定`;
  const docProblems = sopDocProblems();
  if (docProblems.length) return 'SOP／ROADMAP 機械基本功未過（修復後重跑 sb sopreview）：' + docProblems.join('；');
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


// 逐檔三態計數解析：結論對每個存在的治理檔必須含其段（SOP／ROADMAP），段內含 刪N 改N 留N（增N 選配）。
// 「審了」「三問全過」不是結論——每檔的逐條裁定結果以計數申報，抽查對照（A2：宣告由對話可見、老闆終審）。
function sopConclusionProblems(q, files) {
  const problems = [];
  for (const n of files) {
    const tag = n === 'SOP.md' ? 'SOP' : 'ROADMAP';
    const idx = q.indexOf(tag);
    if (idx < 0) { problems.push(`${tag} 未申報逐條裁定——格式「${tag} 逐條重評估：刪N 改N 留N（增N 選配）」`); continue; }
    let end = q.length;
    for (const o of files) {
      if (o === n) continue;
      const oi = q.indexOf(o === 'SOP.md' ? 'SOP' : 'ROADMAP', idx + tag.length);
      if (oi >= 0 && oi < end) end = oi;
    }
    const seg = q.slice(idx, end);
    for (const label of ['刪', '改', '留']) if (!new RegExp(label + '\\s*\\d+').test(seg)) problems.push(`${tag} 段缺「${label}N」計數——逐條三問裁定（基質可答？元行為證據？仍被觸發？）後申報三態計數；先刪改、後留痕`);
  }
  return problems;
}

function cmdSopreview(answers) {
  const q = String(answers ?? '').replace(/\s+/g, ' ').trim();
  const files = govDocFiles();
  const conclusionProblems = sopConclusionProblems(q, files);
  if (conclusionProblems.length) die(['審查結論須逐檔申報三態計數（整檔重寫自洽——逐條三問裁定、淘汰即刪）：', ...conclusionProblems]);
  const current = requireHealthyState();
  const st = current.state;
  const docProblems = files.length ? sopDocProblems() : [];
  if (docProblems.length) die(['SOP／ROADMAP 機械基本功未過——審查戳記不發（修復後重跑 sb sopreview）：', ...docProblems]);
  const filesBound = Object.fromEntries(files.map((n) => [n, sha256Text(readFileSync(join(SB_DIR, n), 'utf8'))]));
  if (current.kind === 'active') {
    st.sopReview = { ms: st.ms, at: new Date().toISOString(), answers: q.slice(0, 200), files: filesBound };
  } else if (current.kind === 'uninitialized' || current.kind === 'direct' || (current.kind === 'ended' && st.concludedAt)) {
    st.sopReview = { at: new Date().toISOString(), answers: q.slice(0, 200), files: filesBound, ...(gitHeadCommit() ? { head: gitHeadCommit() } : {}) };
  } else {
    die([`SOP／ROADMAP 審查留痕需要活動 slug 流程或直接實行紀錄（目前 ${current.kind}）——非 slug 期間審查邊＝每次提交（sb commitmsg 前驗戳記）`]);
  }
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([
    `SOP／ROADMAP 審查留痕：逐檔三態計數「${q.slice(0, 80)}」已落檔；戳記綁定各檔 sha256（審後改檔即失效）；機械基本功（updated 同步／零日期日誌行／零重複／零任務代號（含 slug 名）／零框架重述）已過`,
    files.length ? '審查發現的刪修走正常 commit（same-commit 文件先行）；開新 ms／結束（slug）或每次提交（非 slug 期間）前機械驗戳記' : '（本工作區無 SOP／ROADMAP——留痕記錄審查週期）',
  ]);
}

// 收尾合併一條龍（2.6.4——代理零收尾記憶負擔）：歸檔後機械完成 git 收尾段——
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

// --boss-ok＝旗標即章（2.5.2）：老闆實際輸入由對話承載（基質優先——平台已答，flow-state 不另造記錄）；
// 機械不驗時戳，語義授權由 think 揭露＋老闆終審承擔；偽造由抽查承擔。
function cmdEnd(opts) {
  if (!existsSync(STATE_FILE)) die([`${STATE_FILE} 不存在——先跑 sb init <slug>`]);
  const st = migrateStreams(readJson(STATE_FILE));
  if (st.node === 'done') st.node = 'verify'; // 舊版判決通過態遷移（2.2.0）：done＝verify pass 後別名——本指令完成即遷移為 ended
  if (st.node !== 'verify') die([`sb end 僅限 verify 態選 end（目前 ${st.node}）——真驗收（GWT 逐條實操、行為證據落回指區）完成、G1 回指閉環後時點 2 對抗＋老闆終審 pass 先於結束`]);
  if (!opts.bossOk) die(['結束是老闆終審決策——MUST 帶 --boss-ok 留痕（理解老闆通過授權的語義由 think 揭露承擔）']);
  if (!opts.adversarial) die(['結束出口＝時點 2 對抗條目＋老闆終審章同一邊（verify 出口邊）——MUST 帶 --adversarial（驗收完成後 sb adversarial --point 2 審驗收結果至通過）']);
  const pt2Entry = st.lastAdv?.['2'];
  const verifyEnteredAt = st.edgeAt?.['build→verify'];
  if (!pt2Entry) die(['lastAdv 缺時點 2 條目——驗收完成、G1 回指閉環後 MUST sb adversarial <報告檔> --point 2（審驗收結果：GWT 回指、假綠燈、錯誤處置完整性）才可出口']);
  if (verifyEnteredAt && pt2Entry.at <= verifyEnteredAt) die(['時點 2 對抗條目過期（早於本 ms 進 verify）——本輪 MUST 重新 sb adversarial --point 2（驗收後審驗收結果）才可出口']);
  const sopProblem = sopReviewProblem(st);
  if (sopProblem) die([sopProblem]);
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
  // 收尾合併一條龍（2.6.4）：歸檔後機械完成 git 收尾段——偵測基底→merge --no-ff→查證→留痕→刪分支；
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
  // 舊版流鍵冪等清理（對話流不落檔——2.5.2，零副本、零殭屍存續）
  delete st.lastAdv; delete st.edgeAt;
  delete st.inputs; delete st.understandings; delete st.adversarialLog; delete st.understandingHold; delete st.externalEvidence; delete st.rev; delete st.rewriteSeen; delete st.g1Contract; delete st.history;
  delete st.sopReview; delete st.baseCommit; delete st.startedAt;
  delete st.turnUsage; delete st.usageTotals; delete st.stopBlockedAt;
  delete st.worktrees; // 冪等清理歷史鍵（已移除的 worktree 帳本欄位——舊 flow-state 兼容清理）
  delete st.rerunExtPending; // 冪等清理歷史鍵（已移除的返工直通 pending——舊 flow-state 兼容清理）
  delete st.adversarialAt; delete st.adversarialConsumed; // 冪等清理歷史鍵（提交對抗章——2.4.0 移除，舊 flow-state 兼容清理）
  delete st.budget; delete st.budgetBreaches; // 冪等清理歷史鍵（舊版預算欄位——不相容則 ended 檔自我 invalid）
  delete st.inputsRotated; delete st.understandingsRotated; delete st.understandingSeedHash; delete st.adversarialRotated; delete st.historyRotated;
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  const t = st.telemetry;
  fin([
    'verify → ended（pass）',
    `產出遙測（flow-state 留痕，事實由 git 承擔）：diff ${t.diff ? `${t.diff.additions}+／${t.diff.deletions}-／${t.diff.files} 檔` : '（無可比 baseline——缺省）'}｜對抗 ${t.adversarial ? `${t.adversarial.verdict}${t.adversarial.model ? `（${t.adversarial.model}）` : ''}` : '（無條目）'}｜toolCalls ${t.counts.toolCalls ?? '—'}｜耗時 ${t.durationMinutes ?? '—'} 分`,
    'slug 邊界清理完成（flow-state 純狀態機——對話流不落檔；lastAdv/edgeAt 隨 slug 終結清除，舊版流鍵冪等清空）',
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
  // 定長欄位（2.5.2）：各時點保留最後條目（point 為鍵）——閘門新鮮度對照用，累積流不落檔
  st.lastAdv = { ...(st.lastAdv ?? {}), [point]: entry };
  writeFileSync(STATE_FILE, JSON.stringify(st, null, 2));
  fin([
    `時點${point}對抗條目留痕（@${st.node ?? '未入段'}）：${report.trim()}（判定：${verdict}）——lastAdv 定長欄位；推進帶 --adversarial 由 CLI 對照條目與新鮮度`,
  ]);
}

function cmdCommitmsg(msg) {
  if (!msg) usage();
  const current = requireHealthyState();
  // 非 slug 期間（直接實行／完結後主基底作業）治理檔審查閘：以 commit 為審查邊——
  // 每次提交驗審查戳記綁定當下檔案內容並錨定當下 HEAD（防治理檔停在多個任務前的過時狀態，
  // 2.6.3——非 slug 期間不再零觸發）。
  if (current.kind === 'uninitialized' || current.kind === 'direct' || (current.kind === 'ended' && current.state?.concludedAt)) {
    const sopDirect = sopReviewProblemDirect(current.state);
    if (sopDirect) die([sopDirect]);
  }
  // 2.4.0：提交對抗閘已移除（審核資源前移需求與驗收兩時點；老闆不看中間產物，提交審核＝審核無人讀）。
  // 提交閘僅存機械面：commitmsg 格式驗證＋staged 系統檔檢查＋座標樣式掃描＋陳述對照閘＋印章（hooks 於 git commit 驗章焚章）。
  // 發章：hooks PreToolUse 對 git commit 硬擋的憑證——10 分鐘內、訊息相符才放行。
  // 發章前 staged 同檢（與 hooks 同判據——雙層一致）：讀 git 展開的事實清單（cwd=ROOT 錨定），
  // 判系統檔 .shiftblame/（傾倒區唯一）。
  // quotePath=false 防引號逃逸＋--diff-filter 排除純刪除——清理通道放行；非 git 工作區跳過
  try {
    const staged = execSync('git -c core.quotePath=false diff --cached --name-only --diff-filter=ACMRTUB', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean).filter((p) => /^\.shiftblame(?:\/|$)/i.test(p));
    if (staged.length) die([`系統檔不入庫——staged 含 ${staged.slice(0, 5).join('、')}${staged.length > 5 ? ` 等 ${staged.length} 檔` : ''}（.shiftblame/ MUST gitignore；先 git restore --staged 移除再發章）`]);
    // README 唯一根目錄（DOCS.md §0 文件位置——MUST）：README.md 只允許存在於 repo 根目錄一份——
    // 模塊／子目錄另寫 README（含索引用途的 docs/README.md）即多重來源；其餘專案文件統一 docs/。
    // 溯及既往：掃 git 追蹤集（不限 staged）——存量違規擋提交直至刪除或搬移改名；大小寫不敏感；
    // 判定樣式小而穩定（路徑含分隔符且以 readme.md 結尾）；非 git 工作區由下方 catch 跳過（hooks 寫入攔截層照常把關）。
    const readmeHits = execSync('git -c core.quotePath=false ls-files', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map((l) => l.trim()).filter(Boolean)
      .filter((p) => p.includes('/') && /(^|\/)readme\.md$/i.test(p));
    if (readmeHits.length) die([`README 唯一根目錄——追蹤檔含非根目錄 README（模塊 README 與 docs/README.md 索引皆多重來源；其餘專案文件統一 docs/，DOCS.md §0 文件位置）：`, ...readmeHits.slice(0, 8), '先刪除或搬移改名（如 docs/<主題>.md）並提交，再發章']);
    // 註釋座標結構樣式掃描（SKILL §3 註釋紀律＋§7 同源紀律的機械下限）：
    // staged diff 新增行（+ 行）掃小而穩定的座標結構樣式——時點圈號、時點 N、第 N 輪、兩位以上輪次代號、
    // 任務代號（驗收條目編號／任務目錄路徑／未替換佔位字樣）與框架指令引用（治理規範單一來源於中央技能文件）；
    // 框架機制檔（hooks/、cli/、skills/、.codex-plugin/、README.md）豁免——框架本體講流程語言正當。
    // 樣式集是字元結構下限（r 變數命名等誤傷屬如實標註天花板），語義級由老闆抽查承擔。
    const MECH_PATH = /^(?:hooks\/|cli\/|skills\/|\.codex-plugin\/|\.claude-plugin\/|README\.md)/;
    const COORD_STYLE = /[①②③④⑤⑥⑦⑧⑨⑩]|時點\s*[0-9０-９]|第\s*[0-9０-９一二三四五六七八九十]+\s*輪|\br\d{2,}\b|\bAC-\d+\b|\.shiftblame[\/\\]\S+[\/\\]\d{3}|<(?:slug|nnn|ms)>|\bsb\s+(?:init|state|unlock|adversarial|next|end|closeout|commitmsg|sopreview|stop-report)\b/;
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
      const cmds = new Set(['init', 'state', 'unlock', 'adversarial', 'next', 'end', 'closeout', 'commitmsg', 'sopreview']);
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
  const isSlugMerge = endedState(current.state, ROOT) && !current.state.concludedAt && msg === `merge ${current.state.slug}`;
  const m = msg.match(/^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([^)]+\))?:\s*(.+)$/);
  if (!m && !isSlugMerge) problems.push(endedState(current.state, ROOT) && current.state.concludedAt && msg === `merge ${current.state.slug}`
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
  default: usage();
}
