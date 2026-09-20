#!/usr/bin/env node
/**
 * shiftblame-guard — 反偏移 hooks（ZCode / Codex 共用；Claude-style 協議）
 *
 * 讀 stdin 一個 JSON 事件（hook_event_name、cwd、prompt、tool_name、tool_input…），
 * 依事件分支：
 *   SessionStart    → 注入 §9 載入程序＋完整不變量卡（additionalContext）
 *   UserPromptSubmit→ 注入精簡不變量卡；偵測 <cwd>/.shiftblame 時加注當前節點；回合邊界（模式追蹤重置）
 *   PreToolUse      → 迴圈斷路器（行為模式判定——無變更重跑即擋）；Bash 含
 *                     `git commit`：驗 sb commitmsg 印章（10 分鐘內、訊息相符），無效即 exit 2 阻擋；
 *                     Write/Edit 觸及框架文件（skills／hooks）→ 注入演化提醒；其餘靜默放行
 *
 * 原則：已辨識的流程接入異常拒絕正式寫入及提交；其餘未預期內部錯誤維持既有靜默出口。
 * 煙霧測試：printf '%s' '{"hook_event_name":"UserPromptSubmit","cwd":"."}' | node hooks/shiftblame-guard.mjs
 */

import { existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFlowState } from '../cli/bin/flow-state.mjs';

const STAMP_TTL_MS = 10 * 60 * 1000;

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { raw += c; });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', () => resolve(raw));
  });
}

// additionalContext 注入（根因修復）：hookEventName MUST 填實際事件名（ZCode/Codex strict schema
// 以此歸因驗證——寫死常數會使輸出被丟棄且 run 標記 failed，
// 副作用（寫檔/deny）生效但卡片/曝光注入被丟棄）。函數層防護：事件名非七事件字面值即拒輸出（stderr 診斷）——
// 任何調用點漏傳事件名都不會再生產非法輸出——同類缺陷結構性絕緣。
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'Stop'];
function inject(text, event) {
  if (!HOOK_EVENTS.includes(event)) {
    process.stderr.write(`[shiftblame] inject 事件名無效（${event}）——拒絕輸出，檢查調用點（strict schema 歸因需實際事件名）\n`);
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  }));
  process.exit(0);
}

const projectRoot = (input) => {
  const c = input.cwd;
  // 唯一錨定來源：平台給的絕對 cwd。不猜測、不 fallback——process.cwd() 可能是插件或任意目錄，
  // 相對路徑展開到錯誤資料夾正是本防護要擋的攻擊面。
  return typeof c === 'string' && isAbsolute(c) && existsSync(c) ? c : null;
};

// 子代理工作區（.shiftblame/tmp/**）由 tmp 自由寫入規則承載——子代理零 repo 寫入權，
// 整合由主對話以自身寫入權（段位矩陣＋提交閘）修改回當前分支；無獨立錨定機制。

const CARD = [ // 核心不變量＝主 SKILL §0 十條公理的運行時壓縮（Ax＝公理引用）；RAM/ROM 分層見 A7
  '[shiftblame 不變量]',
  '①老闆主權（A1）：意圖宣告、兩時點 pass/fail、出口、版號、路由與授權只在老闆；沉默≠批准，靜默自裁＝越權；老闆已明確指定者照辦不重問；機制發明須標注「新發明」單獨取得同意。',
  '②對話承載事實（A2）：對話（老闆輸入、理解宣告）由平台承載——不落檔、不綁雜湊；flow-state 只承載當下階段證據（定長欄位，恆有界）；理解經 shiftblame:think args 揭露於對話——理解有誤即越權，老闆終審；偽造由抽查承擔。',
  '③意圖先於行動（A3）：所有老闆輸入第一步調 shiftblame:think（帶 args 理解宣告），不字面執行；理解宣告於對話揭露（機械不凍結——第一步路由由治理紀律承載）。任何新意圖（含兩時點 fail）在該 ms 內一律重走 intent（七段圓環環首）：sb next intent 開新輪（計返工輪＋rewrite 載入閘）——老闆新輪由 hooks 機械推回（無停點申報的中段活動流程即代跑 sb next intent；有申報＝裁決通道，pass 走出口推進、fail／新意圖重走 intent）；「繼續」類中性續行（詞表精確全等）非新輪——不推回，接續原段；段內修復（執行性修復，非老闆輸入驅動）旗標切段，老闆輸入後的段內修復切段＝走私新意圖，CLI 擋；確認→審計（推進指令外部對抗）→分發。新需求問走 main 還是開 slug（免問：續活動 slug／純問題／已指定）。對老闆輸出＝人話（A10）：揭露首行一句翻譯、停等首行待判定事、無開場白無客套。',
  '④段鏈（A4）：七段圓環——intent（環首＝環尾：既是起點也是終點，不屬任何層）＋定義層 requirement→research→plan（逐功能規劃循環→收斂）＋實作層 test→build→verify（逐功能單提交迭代→E2E 收斂）；段間切換一律 sb next 旗標切段；輪內單向、產出即定稿；修正＝重走 intent 開新輪；段內修復旗標切段不計輪。',
  '⑤兩時點（A5）：時點 1 對抗（requirement→research——G1 準則建立後審意圖→需求翻譯）與時點 2 對抗（verify 出口邊——真驗收完成、G1 回指閉環後審驗收結果：GWT 回指、假綠燈）皆對抗在前、老闆判定在後；中鏈零審核（build→verify 機械推進）。推進帶 --adversarial＋--boss-ok——旗標即章（老闆實際輸入由對話承載，機械不驗時戳；語義授權由 think 揭露＋老闆終審承擔；偽造由抽查承擔）；對抗條目與理解宣告不替代老闆章；出口（--new-ms／sb end）＝時點 2 對抗條目＋終審章同一邊；缺老闆決策即 sb stop-report --question 申報停等。',
  '⑥行為證據（A6）：verify＝真驗收執行——GWT 逐條劇本（Given 實際建立→When 實際操作→Then 觀察真實行為）、證據落回指區；驗收依據＝行為是否發生，非測試燈號；未跑必標「未驗」。',
  '⑦寫入分區（A7）：G/SLUG＝ROM（定義區綁定義邊、回指區綁落地邊；返工輪寫 G 前 hooks 驗本輪已調 shiftblame:rewrite）；tmp＋flow-state＝RAM（對話、工作過程與交接文件一律 .shiftblame/tmp/——自由傾倒區）；子代理零 repo 寫入權；staged 系統檔不入庫；路徑 root 錨定絕對展開、git 重定向／alias 攔截；命名與註釋可離開對話辨識、規範溯及既往。',
  '⑧提交（A7）：commit 必過 sb commitmsg（格式＋staged 檢查＋印章；hooks 驗章焚章——審核承載於兩時點）；測試碼＋實作碼同 commit——單功能單提交。',
  '⑨外部性閘：research→plan 邊與返工首推進邊驗至少一次外部調用（requirement→research 進段與返工時重置 externalEvidence）；大型研究 MUST 外部唯讀子代理；偽造抽查承擔。',
  '⑩曝光與停點（A8）：對抗—修復—再對抗閉環至零必修項；錯誤逐項顯式處置（錨定當下交付）。迴圈斷路器常開（行為模式判定，非數量閾值——重複次數不是違規，無變化才是：無變更重跑（同操作再現且期間無寫入）即擋；擋後逐字重發＝升級自動重走 intent 補正續行；升級後仍逐字重發＝本回合封禁；寫入後重跑＝新基礎正當放行；非停等期＝互動式迭代——改一點看一點，不一次改完）。停點偵測（防偷懶停）：活動流程無申報即停擋停一次（條件式、單次消費式——放行即焚攔停標記、不代做路由）。回合結束≠流程完成——插入疑問以 commentary 解答後接續已授權未完工作；final 前確認應回退者已回退、應分發者已分發；合法停點＝整體完成／純問答／sb stop-report 申報具體待決／主動 think 停等／明確暫停／取消／實際阻塞；狀態異常修復後重跑 sb state 查證。',
  '⑪基質與修剪（A9）：基質優先——git／平台已答的另造即拆；規則由元行為證據錨定、修剪而非堆疊；SOP／ROADMAP 每 ms 必審（sb sopreview 三問留痕——開新 ms 前擋）。',
  '⑫摘要不作數（A2）：壓縮摘要與 context 既有敘述不作規範或現狀來源；規範與現狀以外部實體檔案為唯一權威，引用以當次實際讀檔為據，不一致一律以檔案為準；任務起手與恢復接續（含壓縮後）重載對應檔案。',
].join('\n');

const WORK_JUDGMENT_CARD = '\n[Jev 工作判斷常駐] hooks 在強模型讀取前自動完成 Jev 初判；直接使用 facts，只補判 needsReview 的低信心與例外，不評估要不要用 Jev、不準備例行請求、不重判全部資料。未替換時沿原結果工作；授權、流程與真實驗收仍依原規則。';

const SESSION_CARD = [
  CARD,
  WORK_JUDGMENT_CARD,
  '',
  '[冷啟動載入（§9）] 依序唯讀：<repo>/.shiftblame/SOP.md → ROADMAP.md → 當前 slug（SLUG.md＋定案索引——同 slug 過往 ms 一行式定案，回讀由段義務承載）→ archive/（近者先於遠者）。載入後 shiftblame:think 的路由提議才有脈絡依據。',
  '[hooks] 本卡由 plugin hooks 機械注入（SessionStart／UserPromptSubmit／Stop／PreToolUse）；迴圈斷路器（行為模式）、寫入矩陣與 commit 印章硬擋已啟用，失效時回到文件與 CLI 閘門層。',
  '[版號] 版本號屬老闆決策——升版由老闆拍板指定，揭露表寫「版號待老闆指定」。',
].join('\n');

function nodeLine(root) {
  if (!root) return '';
  const health = readFlowState(root);
  if (health.kind === 'invalid') return '\n[接入異常] flow-state 無法辨識——對抗宣告、提交與 git 寫入封閉；診斷與狀態修復自由（修復是異常模式的目的），修復後重跑 sb state。不得把報錯當成無流程。';
  if (['missing', 'uninitialized', 'direct'].includes(health.kind)) return `\n[接入] ${health.kind === 'direct' ? '合法直接實行紀錄' : '尚未初始化 slug'}——依老闆授權路由；不開 slug 可直接實行，狀態可辨識不等於批准。`;
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    let hint = '';
    if (st.node === 'intent') hint = '——七段圓環環首（老闆意圖沉澱，起點也是終點）；任何新意圖在該 ms 內一律重走 intent——sb next intent 同 ms 開新輪、段內修復旗標切段回指定 node';
    if (st.node === 'requirement') hint = '——G1 定義邊：經查證的現況事實＋BDD 七鍵（現狀差異宣言＋GWT 能否從行為矩陣還原一列）；推進前時點 1 對抗（sb adversarial --point 1——審意圖→需求翻譯）＋老闆 pass（--boss-ok），對抗在前老闆判定在後';
    if (st.node === 'research') hint = st.externalEvidence?.done
      ? `——外部證據已記（@${st.externalEvidence.tool}）；G2 結論式產出、向前對齊 G1`
      : '——外部證據未調用：推進 plan 前 MUST 至少一次外部工具（WebSearch／WebFetch／webReader／web.run（web__run） 查證或外部唯讀子代理）——零外部推不過（CARD⑨）';
    if (st.node === 'plan') hint = '——G3 定義邊：驗收排程＋實作計畫＋§10 一致核對；plan→test 機械推進（零審核——時點 1 已於 requirement→research 承載）';
    if (st.node === 'verify') hint = '——真驗收執行：G1 GWT 逐條＝驗收劇本（Given 實際建立→When 實際操作→Then 觀察真實行為→證據落回指區；驗收依據＝行為是否發生，非測試燈號）；驗不過 fail＝老闆新輸入重走 intent（修復旗標切段）；驗收完成、G1 回指閉環後時點 2 對抗（sb adversarial --point 2——審驗收結果：GWT 回指、假綠燈）＋老闆終審 pass 出口 next（--new-ms --adversarial --boss-ok）或 end（--adversarial --boss-ok）';

    let sopNote = '';
    try {
      const parts = [];
      for (const [nm, p] of [['SOP', join(root, '.shiftblame', 'SOP.md')], ['ROADMAP', join(root, '.shiftblame', 'ROADMAP.md')]]) {
        if (existsSync(p)) parts.push(nm + ' ' + readFileSync(p, 'utf8').split(/\r?\n/).length + ' 行');
      }
      if (parts.length) sopNote = `\n[SOP／ROADMAP] ${parts.join('＋')}｜本 ms 審查：${st.sopReview?.ms === st.ms ? `已審 @${st.sopReview.at}` : '未審（開新 ms（pass）前擋——sb sopreview <三問結論>）'}｜審查＝全文＋機械基本功（updated 同步、零日期日誌行、零重複）`;
    } catch { }
    let loopNote = '';
    if (st.turnUsage?.escalations) loopNote = `\n[迴圈升級] 本回合已升級 ${st.turnUsage.escalations} 次（最後 @${st.turnUsage.escalatedAt}）——被擋後逐字重發（忽視回饋）已自動重走 intent 開新輪，依修正分類補正 G1~G3 後接續（不凍結不停擺；升級後仍逐字重發＝死操作本回合封禁；純觀測）`;
    return `\n[段] ${st.slug ?? '?'}/${st.ms ?? '?'} @ ${st.node ?? '?'}${hint}——推進必過 sb next 閘門（sb state 查下一步）。${loopNote}${sopNote}`;
  } catch { return ''; }
}

// —— 對話流不落檔（2.5.2）——
// 對話事實（老闆輸入、理解宣告）由平台對話承載（基質優先——平台已答的另造即拆）；
// flow-state 只承載當下階段證據與機械觀測紀錄，恆有界。理解經 shiftblame:think args 揭露於對話——
// 理解有誤即越權，由老闆終審承擔；無曝光行、無凍結鎖、無輪替。

// —— 回合計數（元行為觀測層）＋迴圈斷路器（行為模式判定——非數量閾值）——
// PreToolUse 每次計數：turnUsage（本回合——老闆輸入重置）＋usageTotals（slug 累計，sb end 遙測素材）。
// 工具調用數＝model 請求數的上界代理（每請求至少產出一個工具調用；批次並行時高估）——誠實標名，真值在平台 DB。
// 計數屬純觀測：無預算、無上限、零干預——工作做到完成為止；量的會計由 sb end 遙測結算（事後可見性）。
// 斷路器擋的是行為模式而非數量——重複次數不是違規，無變化才是：
//   模式① 無變更重跑：同指紋（工具＋操作全量信號 hash）再現，且自其上次出現以來無任何寫入類操作
//          ——世界未變，重跑結果必然相同（死圈特徵）→ 擋該次調用，引導先實際變更再重試。
//   模式② 忽視回饋：被擋後逐字重發同指紋 → 升級：自動重走 intent 開新輪（補正 G1~G3 後續行；不凍結不停擺）。
//   模式③ 死操作：升級補正後仍逐字重發同指紋 → 本回合封禁該操作（其他工作照常推進）。
// 寫入類操作（寫檔工具或含寫入特徵的 shell 命令）一出現＝世界已變 → 重複追蹤全清（同操作重跑有了新基礎——
// test→edit→test 迭代正當，永不誤擋）。shell 寫入特徵為高訊號近似（殘餘如實標註：罕見寫入形誤判唯讀 →
// 誤擋後微調命令即新指紋放行，逐字重發才升級——升級語義是補正不是懲罰，代價可控）。
// escalatedAt／escalations 屬純觀測，非凍結旗標。逃生操作（Skill 與 sb state／sb next intent）豁免。
const FLOW_NODES = new Set(['intent', 'requirement', 'research', 'plan', 'test', 'build', 'verify']);
// 中性續行詞表（精確全等——trim＋英文小寫後比對，非子串掃描）：「繼續」類輸入無新意圖，不算新輪——
// 不推回、不記老闆輸入時戳（視同接續原回合）。保守列舉：未列同義詞偶爾多跑一輪可接受（重走 intent 冪等）；
// 複合輸入（「繼續，但改X」）不精確匹配＝帶新意圖，照常推回。
const CONTINUE_WORDS = new Set(['繼續', '請繼續', '繼續吧', '接著', '接著做', '往下', '往下做', 'continue', 'go on', 'go ahead', 'keep going']);
const isNeutralContinue = (p) => CONTINUE_WORDS.has(String(p ?? '').trim().toLowerCase());
// 疑問輸入偵測（問題類＝零流程位移——CARD⑩ 插入疑問以 commentary 解答後接續原段）：句尾問號（？/?／嗎／呢）
// 或疑問詞開頭。從寬認定（漏推由 think 紀律承載——代理理解為新意圖時仍重走 intent；誤推＝問題被當新輪多跑一輪，不可）。
const QUESTION_TAIL_RE = /[?？嗎呢]$/;
const QUESTION_LEAD_RE = /^(?:為什麼|為何|怎麼|怎樣|怎麼樣|如何|什麼|甚麼|啥|哪個|哪些|哪裡|哪邊|哪一|多少|是否|可不可以|能不能|可否|難道|請問)\b|^(?:what|why|how|when|where|who|whom|which|whose|is|are|was|were|do|does|did|can|could|would|should|will|shall|may|might)\b/i;
const isQuestion = (p) => { const s = String(p ?? '').trim(); return QUESTION_TAIL_RE.test(s) || QUESTION_LEAD_RE.test(s); };
const LOOP_ESCAPE_RE = /\bsb(?:\.mjs)?\s+(?:state(?:\s|$)|next\s+intent\b)/;
const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// shell 寫入特徵（高訊號近似）：重定向、git 寫入、sb 流程寫入命令、套件安裝、就地編輯、檔案操作、直譯器 -e/-c、下載解壓、行程控制
// （sb commitmsg 等子命令會寫 flow-state／印章檔＝世界已變——發章後重跑同命令 commit 屬新基礎正當放行，模式①不得誤擋）
const SHELL_WRITE_HINT_RE = />>?|[^|;&]\bsed\b[^|;&]*(?:-i|--in-place)\b|\bgit\b[^|;&]*\b(?:add|commit|restore|reset|checkout|switch|clean|push|pull|fetch|merge|rebase|tag|rm|mv|stash|cherry-pick|revert|apply|am|init|branch|worktree|clone|submodule|update-index)\b|\bsb(?:\.mjs)?\s+(?:commitmsg|adversarial|next|init|end|start|merge|stop-report|sopreview)\b|\b(?:npm|pnpm|yarn|pip3?|python3?\s+-m\s+pip)\s+(?:install|i|add|uninstall|remove|update|link|create)\b|\b(?:cp|mv|touch|mkdir|rmdir|rd|del|rm|tee|truncate|chmod|chown|ln)\b|\b(?:python3?|py|node)\s+(?:-[A-Za-z]*[ec]\b|-e)\b|\b(?:curl|wget|tar|unzip|gzip|7z)\b|\b(?:kill|killall|taskkill)\b/i;
function toolFingerprint(tool, cmd, toolInput) {
  // 指紋＝「同一操作」的全量信號：shell 取完整命令字串；其他工具取完整參數 JSON——
  // 同檔不同區段的讀取、同檔不同內容的編輯屬多樣操作（各自計數、永遠放行）；逐字重跑的同一失敗操作才同指紋。
  const sig = String(cmd || JSON.stringify(toolInput ?? {})).slice(0, 200);
  return createHash('sha256').update(String(tool ?? '') + '\n' + sig).digest('hex').slice(0, 16);
}
function countUsage(root, tool, cmd, toolInput) {
  if (!root || !existsSync(join(root, '.shiftblame'))) return null;
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return null;
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    const now = new Date().toISOString();
    if (!isRecord(st.turnUsage) || !st.turnUsage.startedAt) st.turnUsage = { startedAt: now, requests: 0 };
    if (!isRecord(st.usageTotals)) st.usageTotals = { firstAt: now, requests: 0 };
    st.turnUsage.requests = (st.turnUsage.requests ?? 0) + 1;
    st.usageTotals.requests = (st.usageTotals.requests ?? 0) + 1;
    // 逃生操作（Skill 與 sb state／sb next intent）豁免——逃生通道可反覆使用，不參與模式判定
    const escapeOp = /^skill$/i.test(String(tool ?? '')) || (SHELL_TOOL_RE.test(String(tool ?? '')) && LOOP_ESCAPE_RE.test(String(cmd ?? '')));
    if (!escapeOp) {
      const t = String(tool ?? '');
      const isWrite = SHELL_TOOL_RE.test(t)
        ? SHELL_WRITE_HINT_RE.test(String(cmd ?? ''))
        : (WRITE_TOOL_RE.test(t) && !READ_EXEMPT_RE.test(t));
      if (isWrite) {
        // 寫入類操作＝世界已變：重複追蹤全清（同操作重跑有了新基礎——正常迭代永不誤擋）
        st.turnUsage.repeats = {};
        st.turnUsage.fpEscalations = {};
      } else {
        const fp = toolFingerprint(tool, cmd, toolInput);
        const repeats = isRecord(st.turnUsage.repeats) ? st.turnUsage.repeats : (st.turnUsage.repeats = {});
        const fpEsc = isRecord(st.turnUsage.fpEscalations) ? st.turnUsage.fpEscalations : (st.turnUsage.fpEscalations = {});
        const preview = String(cmd || toolInput?.file_path || toolInput?.path || toolInput?.skill || tool || '').replace(/\s+/g, ' ').slice(0, 60);
        if (fpEsc[fp]) {
          // 模式③ 死操作：升級補正後仍逐字重發——本回合封禁（其他工作照常推進）
          writeFileSync(statePath, JSON.stringify(st, null, 2));
          return { st, loopDeny: `迴圈斷路器：此操作（${preview}）已升級補正後仍逐字重發——死操作，本回合封禁；變更操作內容（修檔／換參數／調條件）後重試（其他工作照常推進）` };
        }
        if (repeats[fp] === 'denied') {
          // 模式② 忽視回饋：被擋後逐字重發——升級：自動重走 intent 開新輪（補正 G1~G3 後續行，不凍結不停擺）
          fpEsc[fp] = true;
          st.turnUsage.escalations = (st.turnUsage.escalations ?? 0) + 1;
          st.turnUsage.escalatedAt = now; // 純觀測（最後升級時刻）——非凍結旗標
          const retreatable = typeof st.node === 'string' && st.node !== 'intent' && FLOW_NODES.has(st.node);
          let retreatNote;
          if (!retreatable) {
            retreatNote = st.node === 'intent' ? '已在 intent' : `節點 ${st.node ?? '（無）'} 無可回退段——直接依新輪理解續行`;
            writeFileSync(statePath, JSON.stringify(st, null, 2));
          } else {
            writeFileSync(statePath, JSON.stringify(st, null, 2)); // 先落檔——spawn 出的 sb next intent 讀到升級事實
            const sbPath = fileURLToPath(new URL('../cli/bin/sb.mjs', import.meta.url));
            const r = spawnSync(process.execPath, [sbPath, 'next', 'intent'], { cwd: root, encoding: 'utf8', timeout: 20000 });
            retreatNote = r.status === 0 ? '已自動重走 intent 開新輪' : `自動重走 intent 失敗——手動執行 sb next intent：${String(r.stderr || r.stdout || '').trim().slice(0, 160)}`;
          }
          return { st, loopDeny: `迴圈斷路器升級：此操作（${preview}）被擋後逐字重發（忽視回饋）——${retreatNote}；依修正分類補正 G1~G3 後接續（CONFORMS＝細化 G2/G3、G1 不變；真屬 G1 衝突才走 §1.4.1 修約經老闆確認）——工作不停止、不凍結（定義段首走升級重走時仍停在老闆決策邊，屬既有設計）` };
        }
        if (repeats[fp] === 'seen') {
          // 模式① 無變更重跑：同操作再現且期間無寫入——重跑結果必然相同
          repeats[fp] = 'denied';
          writeFileSync(statePath, JSON.stringify(st, null, 2));
          return { st, loopDeny: `迴圈斷路器：此操作（${preview}）與上次完全相同且期間無任何變更——重跑結果必然相同；先實際變更（修根因／改參數／換條件）再重試，微調即新指紋放行；被擋後逐字重發＝忽視回饋，將升級自動重走 intent` };
        }
        repeats[fp] = 'seen'; // 首次出現——記錄放行；淘汰超限舊鍵（恆 ≤128 且當前指紋留存）
        if (Object.keys(repeats).length > 128) {
          const first = Object.keys(repeats).find((k) => k !== fp);
          if (first) delete repeats[first];
        }
      }
    }
    writeFileSync(statePath, JSON.stringify(st, null, 2));
    return { st };
  } catch { return null; }
}

// 回合邊界（UserPromptSubmit）：老闆輸入＝新回合——斷路器模式追蹤與停點自限重置；
// 冪等剝除舊版流鍵（對話流不落檔——舊檔升級即瘦身；新檔本無此鍵）。對話事實由平台承載，此處零內容寫入。
// 老闆輸入＝新輪的機械執行面（2.5.5）：活動流程停在中段而無停點申報 → 代跑 sb next intent 推回 intent 開新輪
// （計輪／edgeAt／rewrite 閘由 CLI 承載）；有停點申報＝裁決通道——零推回（pass 走出口推進、fail／新意圖由代
// 理重走 intent；裁決後把老闆輸入當執行性修復的段內修復切段由 CLI 邊防護擋）。中性續行（「繼續」類——詞表
// 精確全等）豁免：無新意圖＝不算新輪，不推回也不記時戳。lastBossInputAt＝老闆輸入時戳（事實非內容）——
// CLI 段內修復邊防護的新鮮度對照源（晚於進段時間＝老闆輸入後的修復）。
function recordInput(root, prompt) {
  if (!root || !existsSync(join(root, '.shiftblame'))) return null;
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return null;
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    delete st.turnUsage; // 新回合：模式追蹤（repeats／fpEscalations／計數）重置——usageTotals 跨回合累計
    delete st.stopBlockedAt; // 新回合：停點偵測自限重置（本回合至多擋停一次）
    delete st.understandingHold; // 冪等剝除（舊版停等凍結鍵）
    delete st.dialogueLock; delete st.input; // 冪等清理（不相容欄位）
    delete st.inputs; delete st.understandings; // 冪等剝除（舊版雙流——對話事實由平台承載）
    delete st.stamps; delete st.unlockLog; delete st.thinkRouted; // 冪等剝除（2.0x 舊流程鍵——與 migrateStreams 老鍵清單對齊）
    if (isNeutralContinue(prompt)) {
      writeFileSync(statePath, JSON.stringify(st, null, 2));
      return '\n[續行] 中性續行輸入（詞表精確全等）——非新輪：接續原段已授權未完工作；有新意圖時照常從 intent 重走（A3）。';
    }
    if (isQuestion(prompt)) {
      writeFileSync(statePath, JSON.stringify(st, null, 2));
      return '\n[問答] 疑問輸入——零流程位移（不推回、不計新輪）：以 commentary 解答後接續原段已授權未完工作；若回答衍生新工作，照常從 intent 重走（A3）。';
    }
    st.lastBossInputAt = new Date().toISOString(); // 老闆輸入時戳（事實非內容，永不主動清——新鮮度由「晚於進段時間」條件自限）
    writeFileSync(statePath, JSON.stringify(st, null, 2));
    let retreatNote = '';
    if (FLOW_NODES.has(st.node) && st.node !== 'intent' && !isRecord(st.stopReport)) {
      const sbPath = fileURLToPath(new URL('../cli/bin/sb.mjs', import.meta.url));
      const r = spawnSync(process.execPath, [sbPath, 'next', 'intent'], { cwd: root, encoding: 'utf8', timeout: 20000 });
      retreatNote = r.status === 0
        ? '\n[新輪] 老闆新輸入＝新輪——已機械推回 intent（sb next intent 代跑，計返工輪）：任何後續工作從 intent 重走（think 理解宣告先行）；段內修復僅限代理自主執行性修復，老闆輸入驅動的工作一律重走 intent（A3）。'
        : `\n[新輪] 老闆新輪推回失敗（${String(r.stderr || r.stdout || '').trim().slice(0, 160)}）——手動執行 sb next intent 重走；老闆輸入驅動的工作一律從 intent 開始（A3）。`;
    }
    return retreatNote;
  } catch { return null; } /* 狀態異常靜默 */
}

// 理解宣告（think args）落對話不落檔（2.5.2）：hooks 不再記錄理解流——
// 語義授權由 think 於對話揭露，理解有誤即越權由老闆終審承擔；無曝光行、無雜湊鏈。

// rewrite 載入記錄：PreToolUse 偵測 Skill(shiftblame:rewrite) 調用 → 記 { rev, at }（本輪已載入事實）。
// 錨定全名 `^shiftblame:rewrite$`（大小寫敏感）——這是閘鑰匙不是記錄流：任何插件的同名裸技能不得解鎖（比 think 記錄流從嚴）。
// rev＝調用當下的修正輪號（首輪無 rev 記 0）；checkRewriteGate 比對 seen.rev === 當前 rev 即本輪已載入。
function recordRewriteSeen(root, tool, toolInput) {
  if (!root || !/^skill$/i.test(String(tool ?? ''))) return;
  const target = String(toolInput?.skill ?? toolInput?.name ?? '');
  if (target !== 'shiftblame:rewrite') return;
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return;
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    st.rewriteSeen = { rev: st.rev ?? 0, at: new Date().toISOString() };
    writeFileSync(statePath, JSON.stringify(st, null, 2));
  } catch { /* 狀態異常靜默 */ }
}

// 外部證據標記：PreToolUse 偵測外部工具調用——WebSearch／WebFetch／webReader／web.run（web__run）（外部查證）
// 與 Agent／Task（外部唯讀子代理）；Codex 事件實名為 webrun／collaborationspawn_agent／collaborationfollowup_task。精確錨定工具名（冒名、內嵌字串、相近名不標記——平台註冊名是事實）；
// 記錄 {done, at, tool}。重置由 CLI 承擔（requirement→research 進段與返工時清）——hooks 只記事實不重置。
const EXTERNAL_RESEARCH_TOOLS = new Set(['WebSearch', 'WebFetch', 'Agent', 'Task', 'mcp__web_reader__webReader', 'web.run', 'web__run', 'functions.web__run', 'spawn_agent', 'collaboration.spawn_agent', 'functions.spawn_agent', 'webrun', 'collaborationspawn_agent', 'collaborationfollowup_task']);
function markExternalEvidence(root, tool) {
  if (!root) return;
  const name = String(tool ?? '');
  if (!EXTERNAL_RESEARCH_TOOLS.has(name)) return;
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return;
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    st.externalEvidence = { done: true, at: new Date().toISOString(), tool: name };
    writeFileSync(statePath, JSON.stringify(st, null, 2));
  } catch { /* 狀態異常靜默 */ }
}

// 停點申報曝光行：上回以 sb stop-report 申報的待決問題——老闆每則輸入時終審（真待決 or 偷懶）；首曝即標記已審。
// 「本回合申報」對照 turnUsage.startedAt（回合內第一個工具調用時刻——回合邊界由老闆輸入重置 turnUsage 承載）。
function stopReportLine(root, mark = true) {
  if (!root) return '';
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    if (!st.stopReport) return '';
    const r = st.stopReport;
    if (mark && !r.reviewed) {
      r.reviewed = true;
      writeFileSync(statePath, JSON.stringify(st, null, 2));
    }
    const fresh = r.at > (st.turnUsage?.startedAt ?? '');
    return `\n[停點申報] @${r.node} 申報待決：「${flatOneLine(r.question)}」${fresh ? '（本回合申報）' : '（陳舊——屬先前回合，不授權本次停點）'}——老闆終審：真待決 or 偷懶（停點偵測，CARD⑩）。`;
  } catch { return ''; }
}

// 注入行單行化：折疊所有空白類字元（含 U+2028/U+2029 等類換行）＋截斷（200 字）——
// 防申報文本（stopReport.question）於注入文本偽造多行框架內容（寫入側已截；此為展示側同判，純事實防護非語義掃描）
function flatOneLine(s, n = 200) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  const cps = [...t];
  return cps.length > n ? cps.slice(0, n).join('') + '…' : t;
}

// 必然曝光已隨理解流拆除（2.5.2）：理解宣告由 think 於對話揭露——對話即事實，曝光由老闆讀對話承擔。

// 老闆決策邊雙重鎖：兩邊（intent→requirement／requirement→research＝時點 1）的 `sb next <段>` 缺 --boss-ok 即擋；註解中的旗標不算；時點 2＝verify 出口邊（--new-ms／end）旗標組由 CLI 專屬驗證承擔；build→verify＝中鏈機械推進零停靠（working tree 乾淨由 CLI 驗）——hook 零攔
// 兩時點＝對抗在前、老闆判定在後——pass 才 --boss-ok；段內修復與中鏈推進走旗標切段（test→build→verify 迴圈內），不經此兩邊
function checkLayerStopover(root, cmd) {
  if (!root) return null;
  const clean = cmd.replace(/#[^\n]*/g, ''); // 剝除註解——# --boss-ok 不構成旗標
  if (!/\bsb(?:\.mjs)?\s+next\s+(requirement|research)\b/.test(clean) || /(^|\s)--boss-ok(?=\s|$)/.test(clean)) return null;
  try {
    const st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
    const edge = { intent: 'requirement', requirement: 'research' }[st.node];
    const target = clean.match(/\bsb(?:\.mjs)?\s+next\s+(requirement|research)\b/)?.[1];
    if (edge && edge === target) {
      return `老闆決策邊：${st.node}→${target}——--boss-ok 旗標即章（老闆實際輸入由對話承載，機械不驗時戳；語義授權由 think 揭露＋老闆終審承擔），對抗條目不替代老闆章；時點對抗在前、老闆判定在後——pass 才帶 --boss-ok 推進，缺老闆決策即 sb stop-report --question 申報停等（SKILL §3）`;
    }
  } catch { /* 非治理工作區 */ }
  return null;
}

// ———— 狀態寫入攔截：把寫入矩陣機械化 ————
// 測試碼（測試慣例路徑）test＋build 段可寫（實作層——test 撰寫、build 到接合點補寫整合；隨功能實作同 commit 定稿）；
// 實作碼（.shiftblame/ 外 repo 檔）白名單＝build（實作段）／ended（pass 後收尾歸檔）；其餘段對 repo 唯讀（verify 驗收唯讀）。
// 測試不可變性由 git 承擔；Bash 內寫檔不在此層（殘餘；shell 漂移由 verify 邊樹檢查兜底）。

const IMPL_WRITE_NODES = new Set(['build', 'ended']);
// 測試碼認定：真實測試「目錄」或副檔名慣例——不含 _test_ 中綴（避免 src/test_utils.js 誤判）
const TEST_PATH_RE = /(^|\/)(tests?|__tests__|spec)\//i;
const TEST_FILE_RE = /\.(test|spec)\.[A-Za-z0-9]+$|(^|\/)[A-Za-z0-9._-]+_test\.[A-Za-z0-9]+$/i;
// 寫檔類工具名（含刪／搬／更名／雙用途 manage/put）；明顯讀取類豁免（不攔唯讀）
const WRITE_TOOL_RE = /write|edit|patch|save|create|apply|delete|remove|move|rename|truncate|put|manage|store|upload|set_|update/i;
const READ_EXEMPT_RE = /read|list|search|stat|exists|get|query|fetch|browse|tree|info|show|find|screenshot|cursor|mouse|key\b|scroll|click/i;

const nodeOf = (root) => readFlowState(root).state?.node ?? null;
const SHELL_TOOL_RE = /^(?:(?:functions|tools)[._])?(?:bash|shell|execute_bash|execute_bash_command|exec_command)$/i;

// 路徑類鍵（蛇形與駝峰；寫入矩陣／停等凍結／框架提醒共用）
const PATH_KEYS = ['file_path', 'path', 'filename', 'target', 'file', 'filePath', 'abs_path', 'destination', 'dest'];

// ———— G 檔寫入矩陣（RAM/ROM：定義區綁定義邊唯寫、回指區綁落地段唯寫）————
// G1→requirement/verify、G2→research/build、G3→plan/test——落地段獲得承載檔回指區寫入權；
// 跨區（落地段改定義區）仍是綁架上游死路，由 CLI 分區 hash 於 sb next 兜底（hooks 無檔內分區粒度——殘餘如實標註）。
// archive/ 由 CLI 於收尾時寫入（放行）。
const G_WRITE_NODES = { 1: new Set(['requirement', 'verify']), 2: new Set(['research', 'build']), 3: new Set(['plan', 'test']) };
const G_FILE_RE = /^\.shiftblame\/[^/]+\/[^/]+\/(archive\/)?G([123])\.md$/i; // i＋輸入 toLowerCase——大小寫不敏感（Windows FS）
function checkGFileMatrix(root, toolInput) {
  if (!root) return null;
  let st; try { st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8')); } catch { return null; }
  const node = st?.node;
  if (!node || node === 'ended') return null; // 非治理工作區 / 收尾歸檔移動放行
  for (const k of PATH_KEYS) {
    const v = toolInput?.[k];
    if (typeof v !== 'string' || !v.trim() || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) continue;
    const rel = relative(root, absPath(root, v)).replace(/\\/g, '/');
    const m = rel.toLowerCase().match(G_FILE_RE); // 大小寫不敏感——Windows FS 不校正路徑大小寫（realpathSync 保留輸入），小寫形繞過死路
    if (!m) continue;
    if (m[1]) continue; // archive/ 由 CLI 寫入——放行
    const g = Number(m[2]);
    if (!G_WRITE_NODES[g].has(node)) {
      const owner = { 1: 'requirement（定義區）／verify（回指區）', 2: 'research（定義區）／build（回指區）', 3: 'plan（定義區）／test（回指區）' }[g];
      return `[shiftblame] 段 ${node} 對 G${g}.md 無寫入權——G${g} 定義區／回指區寫入權屬 ${owner}；跨區（落地段改定義區）＝綁架上游死路，修正＝重走 intent 開新輪（sb next intent）（RAM/ROM，SKILL §0/§5）`;
    }
  }
  return null;
}

// ———— 返工輪 rewrite 載入閘：修正輪（rev 有值）寫 G 檔前必須本輪已載入 shiftblame:rewrite ————
// 語義：G1~G3 是當下事實的單一權威——返工輪重寫紀律（定義區整檔重寫、回指區同鍵覆寫，skills/rewrite）不靠自發，
// 機械驗 rewriteSeen.rev === 當前 rev（每輪重新載入一次，載入後本輪全放行）。閘面＝整檔（hooks 無檔內分區粒度），
// 非 archive；SLUG.md 不在此閘（秘書層恆可寫——SLUG 收斂紀律由技能承載）。殘餘與天花板（如實）：
// Bash 內直寫 G 檔不在此層（同寫入矩陣殘餘面）；自調 hooks 偽造 PreToolUse 可自鑰匙（同 externalEvidence 天花板——抽查承擔）；
// 調用≠消化——機械只驗調用事實，重寫品質由 verify 驗收與老闆抽查承擔。
function checkRewriteGate(root, toolInput) {
  if (!root) return null;
  let st; try { st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8')); } catch { return null; }
  if (st?.rewriteSeen?.rev === (st?.rev ?? null)) return null; // 本輪已載入（含首輪無 rev 且未載入——rev 無值不設防）
  if (st?.rev == null) return null; // 首輪（從未返工）不設防——全新定義無堆疊風險
  for (const k of PATH_KEYS) {
    const v = toolInput?.[k];
    if (typeof v !== 'string' || !v.trim() || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) continue;
    const rel = relative(root, absPath(root, v)).replace(/\\/g, '/');
    const m = rel.toLowerCase().match(G_FILE_RE);
    if (!m || m[1]) continue; // 只閘作用中 G 檔——archive/ 歸檔歷史不在此閘
    return `[shiftblame] 修正輪 r${String(st.rev).padStart(2, '0')} 寫 G${m[2]}.md 前須先調用 shiftblame:rewrite（返工重寫為當下事實——定義區整檔重寫、回指區同鍵覆寫；載入後本輪放行）（SKILL §1.1／skills/rewrite）`;
  }
  return null;
}

// 停等凍結與未覆蓋即凍結已隨對話流拆除（2.5.2）：
// 理解第一步路由（think）由治理紀律承載——機械不再以流覆蓋狀態凍結寫入；
// 主動 think 停等與未理解就行動，由對話可見性＋老闆終審承擔。
// 攔截面常數保留（流程接入異常封閉層 checkStateHealth 使用）：
const HOLD_GIT_WRITE_RE = /\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*(?:add|commit|restore|reset|checkout|switch|clean|push|pull|fetch|merge|rebase|tag|rm|mv|stash|cherry-pick|revert|apply|am|init|branch|worktree|clone|submodule|update-ref|symbolic-ref|filter-branch|notes|reflog|gc|prune|update-index|read-tree|write-tree|hash-object|mktag|fast-import)\b/i;
const HOLD_SB_PUSH_RE = /\bsb(?:\.mjs)?\s+(?:init|next|end|adversarial|commitmsg|sopreview|closeout)\b/;

// 路徑展開元規則（系統性）：一切判斷路徑 MUST 展開為 repo root 錨定的絕對路徑——
// 相對路徑一律以 root 展開（進程 cwd 與 repo 無關）。
// 正規化：剝 `\\?\`／`\\?\UNC\` 裝置前綴（防 relative() 失效全繞）；Win32 尾端點與尾空白；
// 已存在路徑解析 realpath（防 junction／短名偽裝）。
function absPath(root, p) {
  const anchored = isAbsolute(p) ? p : join(root, p); // root 必參：呼叫點皆有 root 早退——無 root 場景不該走到這
  let s = anchored.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/i, '');
  s = s.split(/[\\/]/).map((seg) => seg.replace(/[. ]+$/, '')).join('/');
  try {
    if (existsSync(s)) return realpathSync(s);
  } catch { /* 不存在＝新建檔，用字面正規化結果 */ }
  return s;
}

function healthWriteTargets(input) {
  const targets = PATH_KEYS.map(k => input?.[k]).filter(v => typeof v === 'string' && v.trim());
  if (typeof input?.uri === 'string' && /^file:/i.test(input.uri)) targets.push(input.uri.replace(/^file:\/\//i, ''));
  const patch = typeof input === 'string' ? input : input?.patch ?? input?.input;
  if (typeof patch === 'string') for (const m of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)) targets.push(m[1].trim());
  return targets;
}
function recoveryTarget(root, target) {
  const rel = relative(absPath(root, root), absPath(root, target)).replace(/\\/g, '/');
  return rel === '.shiftblame/flow-state.json' || rel.startsWith('.shiftblame/tmp/');
}
function checkStateHealth(root, tool, command, input) {
  if (!root || readFlowState(root).kind !== 'invalid') return null;
  const blocked = '流程接入異常——正式文件與程式碼寫入、對抗宣告及提交均停止；保留原檔；狀態修復（flow-state／tmp）與唯讀診斷可寫，修復後重跑 sb state 查證；維持錯誤判定至可辨識';
  if (SHELL_TOOL_RE.test(tool)) {
    // 異常模式的目的是修復——診斷與修復（唯讀查證、修復腳本、flow-state／tmp 寫入）自由；
    // 封閉的是會消費或惡化異常狀態的動作：git 寫入與 sb 流程命令（複用停等凍結的攔截面）。
    // 破壞性命令防護與 commit 四閘在本檢查放行後照常生效（放行＝進入後續攔截，非跳過）。
    const cmd = command.trim();
    if (HOLD_GIT_WRITE_RE.test(cmd) || HOLD_SB_PUSH_RE.test(cmd)) {
      return '流程接入異常——git 寫入與 sb 流程命令保持封閉（會消費或惡化異常狀態）；診斷與狀態修復自由（唯讀查證、修復腳本、flow-state／tmp 寫入——修復是異常模式的目的）；修復後重跑 sb state 查證，維持錯誤判定至可辨識';
    }
    return null;
  }
  const action = tool.split(/__|\./).at(-1);
  const readAction = /^(?:read|list|search|stat|exists|get|query|fetch|browse|tree|info|show|find|screenshot)(?:_|$)/i.test(action);
  if (WRITE_TOOL_RE.test(tool) && !readAction) {
    const targets = healthWriteTargets(input);
    return targets.length && targets.every(p => recoveryTarget(root, p)) ? null : blocked;
  }
  return null;
}

function checkStateWriteMatrix(root, toolInput) {
  if (!root) return null;
  // 抽取所有路徑類鍵（PATH_KEYS；uri 去除 scheme）——逐一生效，防 decoy 鍵欺騙
  const targets = [];
  for (const k of PATH_KEYS) {
    const v = toolInput?.[k];
    if (typeof v === 'string' && v.trim() && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) targets.push(v);
  }
  if (typeof toolInput?.uri === 'string' && /^file:/i.test(toolInput.uri)) targets.push(toolInput.uri.replace(/^file:\/\//i, ''));
  if (!targets.length) return null; // 無可辨識路徑：不猜測
  const node = nodeOf(root);
  if (!node) return null; // 非治理工作區（無狀態檔）
  for (const target of targets) {
    const p = absPath(root, target);
    const rel = relative(root, p).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue; // 專案外：不歸此矩陣管
    if (rel === '.shiftblame' || rel.startsWith('.shiftblame/')) {
      // ROM 區雜檔閘：<slug>/<nnn>/（含 archive/）僅承載 G1~G3.md——中間產物一律 tmp
      if (/^\.shiftblame\/(?:archive\/)?(?!tmp\/)[^/]+\/[^/]+\/.+$/i.test(rel) && !/^\.shiftblame\/(?:archive\/)?[^/]+\/[^/]+\/G[123]\.md$/i.test(rel)) {
        return `[shiftblame] ROM 區（${rel}）僅承載 G1~G3.md——中間產物／筆記／報告一律落 .shiftblame/tmp/（唯一自由傾倒區；SLUG.md 在 <slug>/ 層由秘書維護）`;
      }
      continue; // 工作區其餘永遠可寫（tmp 傾倒、SLUG、flow-state）
    }
    const isTest = TEST_PATH_RE.test(rel) || TEST_FILE_RE.test(rel);
    if (isTest) {
      if (node !== 'test' && node !== 'build') return `[shiftblame] 測試碼（${rel}）寫入權屬 test＋build 段（實作層——test 撰寫功能測試、build 到接合點補寫整合；隨功能實作同 commit 定稿）；重修回 test 段後建立新 commit（SKILL 寫入矩陣）`;
    } else if (!IMPL_WRITE_NODES.has(node)) {
      return `[shiftblame] 段 ${node} 對 repo 實作檔（${rel}）唯讀——實作寫入限 build 段（ended 態收尾歸檔）；老闆新輸入重走 intent 開新輪後才可寫（SKILL 寫入矩陣）`;
    }
  }
  return null;
}

// ———— 破壞性命令防護：相對路徑＋遞迴刪除／覆蓋＝錯誤資料夾摧毀組合 ————

// 絕對＝完整錨定。~ 與 $HOME 不視為錨定（~/.. 可鑽出 home）；根目錄本身（/、C:\）即令絕對也拒
const ABS_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/;
const isAbs = (p) => {
  const s = p.replace(/^["']|["']$/g, '').trim();
  if (!ABS_PATH.test(s)) return false;
  if (/^\/$|^[A-Za-z]:[\\/]?$/.test(s)) return false; // 根目錄目標：災難級，視同未錨定
  return true;
};

const DENY_RELATIVE = (what, why) =>
  `破壞性操作（${what}）使用相對路徑——${why} 相對路徑會落在執行當下的 CWD（可能已漂移），MUST 以絕對路徑改寫後重試（SKILL §9 破壞性命令防護）`;

// 取引數串（到 ; && || | 換行為止）中的非旗標 tokens；filterSlash 僅 Windows del/rd 分支用——
// POSIX rm 的絕對路徑以 / 開頭，絕不可在此濾除（否則根目錄刪除全部漏網）
const argTokens = (segment, { filterSlash = false } = {}) =>
  (segment.match(/(?:"[^"]+"|'[^']+'|[^\s;&|]+)/g) ?? [])
    .map((t) => t.replace(/^["']|["']$/g, ''))
    .filter((t) => !t.startsWith('-') && (!filterSlash || !t.startsWith('/')));

const ROOTLIKE = /^\/+$|^\*$|^[A-Za-z]:[\\/]+?$|^\/$/;

function scanInlineDestructive(cmd) {
  // POSIX rm（大小寫不拘）：僅真遞迴旗標（r/R/recursive）觸發；-f 單檔刪除不擋。
  // token 不濾 /（POSIX 絕對路徑）——根目錄或磁碟根目標即令絕對也拒
  for (const m of cmd.matchAll(/\brm\s+((?:-{1,2}[A-Za-z-]+\s+)+)((?:"[^"]*"|'[^']*'|[^\s;&|]+)(?:\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+))*)/gi)) {
    if (!/[rR]|recursive/.test(m[1].replace(/-{1,2}/g, ''))) continue;
    const toks = argTokens(m[2]);
    const root = toks.find((x) => ROOTLIKE.test(x));
    if (root) return `破壞性操作目標是根目錄（${root}）——災難級目標一律拒絕，MUST 指明確切的絕對子路徑（SKILL §9）`;
    const rel = toks.filter((x) => !isAbs(x));
    if (rel.length) return DENY_RELATIVE(`rm ${m[1].trim()}`, `目標 ${rel[0]}`);
  }
  // find … -delete／-exec rm／| xargs rm：遞迴刪除，搜尋根必須絕對
  if (/\bfind\b[^\n]*\s-delete\b/i.test(cmd) || /\bfind\b[^\n]*-exec\s+rm|\bxargs\s+rm\b/i.test(cmd)) {
    const m = cmd.match(/\bfind\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/i);
    const target = m ? (m[1] ?? m[2] ?? m[3]) : '';
    if (!target || !isAbs(target)) return DENY_RELATIVE('find 遞迴刪除', `搜尋根 ${target || '（未指明）'}`);
  }
  // Windows del/rd/rmdir /s；robocopy /MIR（清空式鏡像＝刪除）
  for (const m of cmd.matchAll(/\b(?:del|rd|rmdir)\s+([^;&|\n]*\/[sS][^;&|\n]*)/gi)) {
    const rel = argTokens(m[1]).filter((x) => !/^[/-]/.test(x) && !isAbs(x));
    if (rel.length) return DENY_RELATIVE('del/rd /s', `目標 ${rel[0]}`);
  }
  for (const m of cmd.matchAll(/\brobocopy\s+((?:"[^"]*"|'[^']*'|[^\s;&|]+)\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+))\s+[^;&|\n]*\/[Mm][Ii][Rr]/g)) {
    const toks = argTokens(m[1]);
    if (toks.length >= 2 && !isAbs(toks[1])) return DENY_RELATIVE('robocopy /MIR', `目標 ${toks[1]}`);
  }
  // PowerShell Remove-Item 及別名（ri/erase；PS 下 rm/del 亦為其別名）：段落含 -Recurse/-r 旗標時，
  // 段內 MUST 出現絕對路徑參數——旗標在前、管線輸入、相對路徑一律 fail-closed
  for (const m of cmd.matchAll(/\b(?:Remove-Item|ri|erase)\s+([^;&|\n]*)/gi)) {
    const seg = m[1];
    if (!/(?:-Recurse\b|-r\b|-rec\b)/i.test(seg)) continue;
    if (argTokens(seg).some((x) => isAbs(x))) continue;
    return DENY_RELATIVE('Remove-Item -Recurse', '段落內無絕對路徑目標（管線輸入或相對路徑）');
  }
  // git 破壞性（clean -f／reset --hard，容許全域旗標插入，大小寫不拘）：未 -C 絕對錨定即擋
  if (/\bgit[\s\S]{0,120}?\bclean\b[^;&|\n]*-[a-zA-Z]*f|\bgit[\s\S]{0,120}?\breset\s+--hard/i.test(cmd)) {
    const c = cmd.match(/-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/);
    if (!c || !isAbs(c[1] ?? c[2] ?? c[3] ?? '')) {
      return 'git 破壞性操作（clean -f／reset --hard）未以 -C <絕對路徑> 錨定目標 repo——CWD 漂移即摧毀錯誤專案，MUST 加 -C <絕對路徑> 重試';
    }
  }
  // 行內直譯器刪除 API＋相對字面路徑（容許 f-string 前綴；rmtree 涵蓋 from-import 改名後的裸呼叫）
  for (const m of cmd.matchAll(/(?:shutil\.)?\brmtree\(\s*[fFrRbB]?(['"])([^'"]+)\1/g)) {
    if (!isAbs(m[2])) return DENY_RELATIVE('rmtree', `目標 ${m[2]}`);
  }
  for (const m of cmd.matchAll(/\.(?:rm|rmdir)(?:Sync)?\s*\(\s*[fFrRbB]?(['"`])([^'"`]+)\1[^)]*recursive/g)) {
    if (!isAbs(m[2])) return DENY_RELATIVE('fs.rm/rmdir(recursive)', `目標 ${m[2]}`);
  }
  // 重定向截斷（>> 除外）：容許 `x>f`、`:>f`、`2>f` 形；lookbehind 擋 >> 與 |>
  for (const m of cmd.matchAll(/(?<![>&|])>\s*(?!\/dev\/null\b|\bNUL\b)(?!>)(?:"([^"]+)"|'([^']+)'|([^\s;&|>]+))/g)) {
    const t = m[1] ?? m[2] ?? m[3] ?? '';
    if (t && !isAbs(t)) return DENY_RELATIVE('重定向截斷 >', `目標 ${t}（追加用 >>、丟棄用 > /dev/null）`);
  }
  return null;
}

// 直跑腳本檔（python/py/node <file>）：讀檔掃描——遞迴刪除 API＋相對字面路徑＝擋；僅 API＝警告注入
function scanScriptFile(cmd, root) {
  const m = cmd.match(/(?:^|\s)(?:python3?|py(?:\s+-\d)?|node)\s+(?:-[A-Za-z]+\s+)*(")?([^"&|;\s]+?\.(?:py|js|mjs|cjs|ts))\1/);
  if (!m) return null;
  if (!root) return null;
  const scriptPath = absPath(root, m[2]); // root 錨定展開（元規則：不以進程 cwd 展開）
  const scriptRel = relative(root, scriptPath).replace(/\\/g, '/');
  // 測試碼內容本就含破壞字串 fixtures——測試路徑的腳本免除內容掃描（否則直跑測試被自己的防護擋下）
  if (TEST_PATH_RE.test(scriptRel) || TEST_FILE_RE.test(scriptRel) || /(^|\/)(tests?|__tests__|spec)\//i.test(scriptRel)) return null;
  let text;
  try {
    text = readFileSync(scriptPath, 'utf-8');
  } catch { return null; }
  const hasApi = /(?:shutil\.)?\brmtree\(/.test(text) || /\.(?:rm|rmdir)(?:Sync)?\s*\([^)]*recursive/.test(text);
  if (!hasApi) return null;
  const literals = [
    ...text.matchAll(/(?:shutil\.)?\brmtree\(\s*[fFrRbB]?(['"])([^'"]+)\1/g),
    ...text.matchAll(/\.(?:rm|rmdir)(?:Sync)?\s*\(\s*[fFrRbB]?(['"`])([^'"`]+)\1[^)]*recursive/g),
  ].map((h) => h[2]);
  const rel = literals.filter((p) => !isAbs(p));
  if (rel.length) return { deny: DENY_RELATIVE(`${m[2]} 內遞迴刪除`, `目標 ${rel[0]}`) };
  return { warn: `[shiftblame] ${m[2]} 含遞迴刪除 API（rmtree／fs.rm recursive）——確認其路徑以絕對路徑錨定、且目標資料夾正確後才執行（SKILL §9）。` };
}

// 從單一命令段抽取 git commit -m 的訊息（雙引號處理 \" 與 \\，單引號原樣；容許 -m"..." 緊貼形）
function extractCommitMessage(seg) {
  if (/-F\b|--file\b/.test(seg)) return { error: '檔案訊息（-F）無法驗證——commit 訊息 MUST 以 -m 傳遞並先過 sb commitmsg' };
  const m = seg.match(/(?:^|[;&|]\s*|\s)git\s+(?:-[A-Za-z-]+(?:\s+(?:"[^"]*"|'[^']*'|[^\s;&|]+))?\s+)*commit\b[\s\S]*?(?:^|\s)-m\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/i);
  if (!m) return { error: '找不到 -m 引號訊息——commit 訊息 MUST 以 -m "…" 傳遞並先過 sb commitmsg 驗證' };
  const msg = m[1] !== undefined
    ? m[1].replace(/\\(["\\])/g, '$1')
    : m[2];
  // 多重 -m 會串接段落，只驗第一段等於夾帶未驗內容——直接拒絕
  if ((seg.match(/(?:^|\s)-m\s+/g) ?? []).length > 1) return { error: '多個 -m 不支援——框架要求單行訊息，以單一 -m 傳遞並過 sb commitmsg' };
  return { msg };
}

// 命令含 git commit 的判定：按段（; && || | 換行切分）——段內同時出現 git 與 commit 即觸發，
// 無字窗限制；-C 與 -m 只認同段，防複合行誤抓
const commitSegments = (cmd) =>
  cmd.split(/[;\n]|&&|\|\|/).filter((seg) => /\bgit\b/i.test(seg) && /\bcommit\b/i.test(seg));

const normPath = (root, p) => { try { return absPath(root, String(p)).toLowerCase(); } catch { return String(p).toLowerCase(); } }; // root 錨定（防偽造章相對 cwd 比對錯位）

// staged 不入庫（系統檔）：不解析 git add 的 pathspec，讀 git 展開後的事實清單，一律 absPath(root, p)
// 展開為絕對（路徑展開元規則）再判系統檔（.shiftblame/——傾倒區唯一，全程不追蹤 MUST gitignore）。
// quotePath=false（CJK 檔名不引號逃逸）；--diff-filter=ACMRTUB——純刪除（D）放行＝git rm --cached 清理通道。
function checkStaged(root) {
  if (!root) return null;
  try {
    const out = execFileSync('git', ['-C', root, '-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--diff-filter=ACMRTUB'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const hits = out.split('\n').map((l) => l.trim()).filter(Boolean).filter((p) => {
      const rel = (() => { try { return relative(root, absPath(root, p)).replace(/\\/g, '/').toLowerCase(); } catch { return p.toLowerCase(); } })();
      return rel === '.shiftblame' || rel.startsWith('.shiftblame/'); // toLowerCase：realpathSync 保留輸入大小寫不校正為磁碟真名
    });
    if (hits.length) return `系統檔不入庫——staged 含 ${hits.slice(0, 5).join('、')}${hits.length > 5 ? ` 等 ${hits.length} 檔` : ''}（.shiftblame/ MUST gitignore；先 git restore --staged 移除再提交）`;
  } catch { /* git 不可用（非 git repo）→ 印章層照常把關 */ }
  return null;
}

// commit-time 暫存繞過：commit 子命令後的 token 白名單制——只允許 -m/--message（＋訊息值）與已知安全無值旗標；
// 其餘任何 token（-a/--only/合體旗標/裸 pathspec/-m 之後的 pathspec/-- 後一切）即擋：
// 這些形態在 commit 內部展開暫存，hooks 跑時 diff --cached 尚未含——MUST 先 git add 顯式暫存，以無 pathspec 之 commit 提交。
// 訊息值整體跳過（引號區段為單一 token——訊息內含「-a」等字樣不誤傷）；commit 定位只認獨立 token（-c 鍵名內的 commit 不誤傷）。
const COMMIT_SAFE_FLAGS = new Set(['-m', '--message', '-q', '--quiet', '-v', '--verbose', '-n', '--no-verify', '-s', '--signoff', '--no-edit', '--allow-empty', '--amend', '--no-gpg-sign', '--allow-empty-message']);
function checkCommitTimeStaging(seg) {
  const cm = /(?:^|\s)commit(?=\s|$)/g;
  let last = null, m2;
  while ((m2 = cm.exec(seg))) last = m2; // 取最後一個獨立 commit token（-c key=…commit… 不含獨立 token）
  if (!last) return null;
  const tail = seg.slice(last.index + last[0].length);
  const tokens = tail.match(/"[^"]*"|'[^']*'|[^\s"']+/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-m' || t === '--message') { i++; continue; } // 跳過訊息值（引號 token 或單詞）
    if (COMMIT_SAFE_FLAGS.has(t)) continue;
    if (t.startsWith('--message=')) continue;
    return `commit-time 暫存繞過（「${t}」）——commit 子命令後僅允許 -m/--message 與安全旗標（${[...COMMIT_SAFE_FLAGS].slice(0, 6).join(' ')}…）；MUST 先 git add 顯式暫存，以無 pathspec 之 commit 提交`;
  }
  return null;
}

// git alias 定義攔截：alias 可把 commit 包進無「commit」字樣的子命令（印章／對抗／staged／commit-time 四閘全繞）
// （CARD⑥：commit 必過 sb commitmsg）。既有 alias 屬環境事實（SKILL 天花板：老闆抽查 git config --get-regexp ^alias.）。
function checkGitAliasWrite(cmd) {
  if (/\bgit\b[^\n|;&]*\sconfig\b[^\n]*alias\./.test(cmd)) {
    return 'git alias 定義攔截——alias 可包裝 commit 繞過全部 commit 閘（印章／對抗宣告／staged／commit-time）；MUST 使用完整 git 指令';
  }
  return null;
}

// git 路徑重定向攔截（路徑展開元規則的閘面）：重定向改變 git 的路徑語義——staged 檢查與印章 cwd 比對
// 都以 input.cwd 錨定，看不見重定向，章可攜至未驗 repo（對抗者實證）。一律掃即擋；錨定唯一正道＝-C <絕對root>。
function checkGitRedirect(cmd) {
  // 大小寫不敏感（Windows 環境變數查找不敏感——git_dir= 同 GIT_DIR=）＋反斜線正規化副本雙掃
  // （bash 引號移除吞反斜線：env GIT_DIR\= 與 GIT\_DIR= 仍是重定向）
  const scan = /(?:^|[^A-Za-z0-9_])(?:GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE|GIT_OBJECT_DIRECTORY|GIT_CEILING_DIRECTORIES|GIT_COMMON_DIR|GIT_ALTERNATE_OBJECT_DIRECTORIES)\s*=/i;
  if (scan.test(cmd) || scan.test(cmd.replace(/\\/g, ''))
    || /(?:^|\s)--(?:git-dir|work-tree|index-file|object-dir(?:ectory)?|super-prefix)(?=[\s=])/.test(cmd)) {
    return 'git 路徑重定向攔截（GIT_DIR／--git-dir／--work-tree 等，含大小寫與反斜線跳脫形態）——重定向使 staged 與印章檢查的 root 錨定失效；MUST 以 -C <絕對root> 錨定';
  }
  return null;
}

// -C 目標錨定（跨 repo 提交）：git 段含絕對 -C 目標時，該目標即本段提交的查證錨點——staged／印章／
// 停等與唯讀檢查／文件鐵律全改對目標 repo 生效（章落目標專案），外部 session 以
// git -C <絕對路徑> 提交內部 repo 因此成為合法且全額驗證的路徑；相對 -C 一律擋（路徑展開元規則）。
function gitCRoot(seg, root) {
  const c = seg.match(/(?:^|\s)-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/);
  if (!c) return { root, error: null };
  const target = c[1] ?? c[2] ?? c[3] ?? '';
  if (!isAbs(target)) return { root, error: 'git -C 須用絕對路徑（路徑展開元規則）——相對 -C 會展開到非預期資料夾' };
  return { root: target, error: null };
}

function checkCommitStamp(root, seg) {
  if (readFlowState(root).kind === 'invalid') return '流程接入異常——修復並以 sb state 查證後才可提交；既有印章不代表狀態有效';
  const extracted = extractCommitMessage(seg);
  if (extracted.error) return extracted.error;
  // 文件鐵律（框架 repo 專屬——雙錨定 skills/shiftblame/SKILL.md＋hooks/shiftblame-guard.mjs）：框架文件隨演化
  // 必須理順邏輯後實質重寫（重看條目、重評估、重設計），追加補釘堆疊即擋。機械判準：修改的框架 .md 於 staged diff
  // 「新增＞0 且刪除＝0」（相對 HEAD）＝純追加；新增檔以 --diff-filter=A 名單豁免（numstat 同形不可判）；純刪除（修剪）放行；
  // merge／rebase 進行中豁免（衝突收尾與歷史重放非演化編輯）。繞過面如實標註：改一字＋整段追加可過本閘（量測分工——
  // 品質由兩時點對抗與老闆終審承擔）。
  if (existsSync(join(root, 'skills', 'shiftblame', 'SKILL.md')) && existsSync(join(root, 'hooks', 'shiftblame-guard.mjs'))) {
    try {
      if (!existsSync(join(root, '.git', 'MERGE_HEAD')) && !existsSync(join(root, '.git', 'REBASE_HEAD'))) {
        const numstat = spawnSync('git', ['-C', root, 'diff', '--cached', '--numstat'], { encoding: 'utf8', timeout: 5000 });
        const addedList = spawnSync('git', ['-C', root, 'diff', '--cached', '--name-only', '--diff-filter=A'], { encoding: 'utf8', timeout: 5000 });
        if (numstat?.status === 0 && addedList?.status === 0) {
          const newFiles = new Set(String(addedList.stdout ?? '').split('\n').map((l) => l.replace(/^"|"$/g, '')));
          const offenders = [];
          for (const line of String(numstat.stdout ?? '').split('\n')) {
            const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
            const path = m ? m[3].replace(/^"|"$/g, '') : '';
            const inScope = /^README\.md$/i.test(path) || /^docs\//i.test(path) || /^skills\//i.test(path);
            if (!m || !/\.md$/i.test(path) || !inScope || m[1] === '-') continue;
            if (m[1] === '-' || newFiles.has(path)) continue; // 二進制／新增檔豁免（numstat 同形不可判——以 filter 名單為準）
            if (Number(m[1]) > 0 && Number(m[2]) === 0) offenders.push(path); // HEAD 已有且純追加
          }
          if (offenders.length) return '文件鐵律：框架文件隨演化必須理順邏輯後實質重寫（重看條目、重評估、重設計），非追加補釘堆疊——以下檔案本批僅追加零刪改，重寫既有本文後再提交：' + offenders.slice(0, 5).join('、');
        }
      }
    } catch { /* 檢查不可行時回退既有閘（兩時點對抗與老闆終審承擔） */ }
  }
  const stampPath = join(root, '.shiftblame', 'tmp', 'commit-stamp.json');
  if (!existsSync(stampPath)) return '缺少 commit 印章——在本次提交的錨定專案（git -C 有目標時＝該目標 repo）跑 sb commitmsg "<訊息>"，再以相同訊息 commit';
  try {
    const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
    if (!stamp.cwd || !stamp.message || !stamp.issuedAt) return 'commit 印章欄位不全（偽造跡象）——重跑 sb commitmsg';
    if (!isAbs(stamp.cwd)) return 'commit 印章 cwd 非絕對——重跑 sb commitmsg（合法章 cwd 恆為絕對 ROOT）';
    if (normPath(root, stamp.cwd) !== normPath(root, root)) return 'commit 印章屬於其他專案——印章綁定提交錨點 repo；在本次 commit 的錨定專案（-C 目標或 hook cwd）重跑 sb adversarial＋sb commitmsg';
    const age = Date.now() - new Date(stamp.issuedAt).getTime();
    if (age > STAMP_TTL_MS) return 'commit 印章已逾期（>10 分鐘）——重跑 sb commitmsg "<訊息>"';
    if (age < -60000) return 'commit 印章時間戳在未來——僅接受剛產生的印章，重跑 sb commitmsg';
    if (stamp.message !== extracted.msg) return 'commit 訊息與印章不符——以完全相同的訊息重跑 sb commitmsg 後再 commit';
    // 2.4.0：提交對抗閘已移除（審核資源前移需求與驗收兩時點——段內提交僅機械格式面：印章＋格式＋唯讀與停等檢查）；
    // 印章消費不再核對 flow-state 對抗宣告，手寫印章偽造由抽查與老闆終審承擔
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    let st = null;
    try { st = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* 無狀態檔 */ }
    if (st?.node === 'verify') return '驗收段對 repo 唯讀——不得提交';
    unlinkSync(stampPath); // 一次性消費：一枚印章授權一次 commit，重複 commit 須重新驗證
    return null; // 通過
  } catch { return 'commit 印章無法讀取——重跑 sb commitmsg "<訊息>"'; }
}

// hooks 健康心跳：每次成功執行更新 hooksHeartbeat 欄位——CLI 的外部證據閘被擋時對照，
// 區分「老闆未授權」（心跳新鮮：hooks 活著、標記真實缺失）與「hooks 疑似故障」（心跳停滯：記錄器死了、
// 閘的條件永遠無法滿足＝死鎖）——診斷只揭露不降級（fail-closed 不變；逃生門屬合法漏洞）。
function beatHeartbeat(root, event) {
  if (!root || !existsSync(join(root, '.shiftblame'))) return; // 守門：僅既有工作區寫心跳（流浪 cwd 保持原樣——框架元規則）
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    const st = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
    st.hooksHeartbeat = { at: new Date().toISOString(), event };
    writeFileSync(statePath, JSON.stringify(st, null, 2));
  } catch { /* 心跳失敗不影響主流程 */ }
}

// 紀錄器異常期間的輸入保存（recovery-inputs.jsonl）已隨輸入流拆除（2.5.2）：
// 對話為事實權威（平台承載）——異常期間的輸入無需另造備份，恢復核對以實際對話為準。

const deny = (reason) => { process.stderr.write(`[shiftblame] ${reason}\n`); process.exit(2); };

try {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const event = input.hook_event_name || input.hookEventName || '';
  const root = projectRoot(input);
  const healthy = !root || readFlowState(root).kind !== 'invalid';
  // 異常原檔保持原樣，不能由新增心跳把空物件／部分資料洗成有效紀錄。
  if (healthy && event !== 'PostToolUse' && event !== 'PostToolUseFailure') beatHeartbeat(root, event);

  if (event === 'PostToolUse' || event === 'PostToolUseFailure') {
    if (healthy) {
      const { requestJudgment } = await import('./jev-client.mjs');
      const judgment = await requestJudgment(root, 'filter', input);
      if (judgment) process.stdout.write(JSON.stringify({ continue: false, stopReason: judgment }));
    }
    process.exit(0);
  }

  if (event === 'SessionStart') {
    // 壓縮後自動注入（compact 來源同走此事件）：靜態卡＋動態狀態卡——壓縮摘要抹掉過程後，
    // 機械事實（段位／停點申報）立即回流對話，恢復依據檔案非摘要。
    inject(SESSION_CARD + nodeLine(root) + stopReportLine(root, false), 'SessionStart');
  }

  if (event === 'UserPromptSubmit') {
    // 回合邊界：模式追蹤與停點自限重置＋舊流鍵冪等剝除（對話事實由平台承載，零內容寫入）
    // ＋老闆輸入＝新輪機械推回（無停點申報的中段活動流程——sb next intent 代跑；nodeLine 於推回後讀檔即顯 @intent）
    const retreatNote = healthy ? recordInput(root, input.prompt) : '';
    inject(CARD + WORK_JUDGMENT_CARD + nodeLine(root) + retreatNote + stopReportLine(root, healthy), 'UserPromptSubmit');
  }

  if (event === 'Stop') {
    // 停點偵測（防偷懶停，CARD⑩）：條件式（活動流程 intent~verify 才查）、單次消費式（stop_hook_active 或
    // 本回合已擋過即放行——放行同時焚毀 stopBlockedAt：殘留標記至多錯放一次即自清，新回合重閘由
    // UserPromptSubmit 刪除＋放行消費雙路徑保證）、不代做路由（不改 node、不跑 sb next、不判語義——只強制「續行 or 申報」二選一）。
    // 機械只判「有無本回合申報」（stopReport.at 晚於 turnUsage.startedAt＝回合內第一個工具調用；
    // turnUsage 缺席＝本回合零工具調用——殘留舊申報不放行，不得跨回合頂替），
    // 真待決 or 偷懶由申報曝光＋老闆終審承擔；invalid／missing／uninitialized／direct／done／ended 一律放行；
    // 主動 think 停等＝待老闆終審的待決——依 SKILL 以 sb stop-report 申報後放行。
    if (!root || !healthy) process.exit(0);
    try {
      const statePath = join(root, '.shiftblame', 'flow-state.json');
      if (!existsSync(statePath)) process.exit(0);
      const st = JSON.parse(readFileSync(statePath, 'utf8'));
      if (st.node === 'done' || st.node === 'ended' || !FLOW_NODES.has(st.node)) process.exit(0);
      if (isRecord(st.stopReport) && st.turnUsage?.startedAt && st.stopReport.at > st.turnUsage.startedAt) process.exit(0); // 本回合已申報——放行（回合錨：申報須晚於本回合第一個工具調用）
      if (input.stop_hook_active === true || st.stopBlockedAt) {
        if (st.stopBlockedAt) { delete st.stopBlockedAt; writeFileSync(statePath, JSON.stringify(st, null, 2)); } // 放行即消費——單次標記一次性，不跨回合殘留
        process.exit(0); // 單次自限——不無限循環擋停
      }
      st.stopBlockedAt = new Date().toISOString();
      writeFileSync(statePath, JSON.stringify(st, null, 2));
      process.stderr.write('[shiftblame] 停點偵測：流程進行中（' + (st.slug ?? '?') + '/' + (st.ms ?? '?') + ' @ ' + st.node + '）而無停點申報——若確實需要老闆決策／缺必要輸入（含主動 think 停等），先執行 sb stop-report --question「具體待決問題（≥10 字）」再停（申報會曝光供老闆終審）；否則續行已授權未完工作。偷懶停由曝光＋老闆終審承擔。\n');
      process.exit(2);
    } catch { process.exit(0); }
  }

  if (event === 'PreToolUse') {
    const tool = input.tool_name || input.toolName || '';
    const cmd = typeof input.tool_input?.command === 'string' ? input.tool_input.command : typeof input.tool_input?.cmd === 'string' ? input.tool_input.cmd : '';
    const healthError = checkStateHealth(root, tool, cmd, input.tool_input ?? {});
    if (healthError) deny(healthError);
    if (healthy) recordRewriteSeen(root, tool, input.tool_input);
    if (healthy) markExternalEvidence(root, tool);
    // 回合計數（元行為觀測，零干預）＋迴圈斷路器（行為模式判定——無變更重跑才擋；寫入後重跑＝新基礎正當放行）
    const usage = healthy ? countUsage(root, tool, cmd, input.tool_input ?? {}) : null;
    if (usage?.loopDeny) deny(usage.loopDeny);
    if (SHELL_TOOL_RE.test(tool)) {
      // 層間停靠雙重鎖（繞過 checkpoint 進實作層）
      const stopover = checkLayerStopover(root, cmd);
      if (stopover) deny(stopover);
      // git alias 定義攔截（alias 可包裝 commit 繞過四閘）
      const aliasWrite = checkGitAliasWrite(cmd);
      if (aliasWrite) deny(aliasWrite);
      // git 路徑重定向攔截：GIT_DIR/--git-dir/--work-tree 改變 git 路徑語義（root 錨定的 staged／印章檢查失效）
      const redirect = checkGitRedirect(cmd);
      if (redirect) deny(redirect);
      // 先擋破壞性＋相對路徑（含行內各語言刪除 API 與直跑腳本檔掃描）
      const destructive = scanInlineDestructive(cmd);
      if (destructive) deny(destructive);
      const script = root ? scanScriptFile(cmd, root) : null;
      if (script?.deny) deny(script.deny);
      if (script?.warn) inject(script.warn, 'PreToolUse');
      // 分段印章閘：每個含 git+commit 的段逐一驗（無字窗；段外旗標不干擾）
      const segs = commitSegments(cmd);
      for (const seg of segs) {
        if (!root) process.exit(0); // 無絕對錨定可用：不猜測，交由其他層
        // commit-time 暫存繞過（-a/--only/pathspec）先擋——diff --cached 看不見提交期展開
        const cts = checkCommitTimeStaging(seg);
        if (cts) deny(cts);
        // -C 錨定（跨 repo 提交）：絕對 -C 目標＝本段的查證錨點——後續閘全對目標 repo 生效
        const anchor = gitCRoot(seg, root);
        if (anchor.error) deny(anchor.error);
        // 暫存不入庫（staged 事實清單）先擋——印章只燒乾淨內容
        const staged = checkStaged(anchor.root);
        if (staged) deny(staged);
        const reason = checkCommitStamp(anchor.root, seg);
        if (reason) deny(reason);
      }
      process.exit(0); // 各段通過：靜默放行
    }
    if (WRITE_TOOL_RE.test(tool) && !READ_EXEMPT_RE.test(tool)) {
      // G 檔寫入矩陣（RAM/ROM 分區）：定義區綁定義邊（G1→requirement／G2→research／G3→plan）／回指區綁落地段（G1←verify／G2←build／G3←test）——跨區由 CLI 分區 hash 兜底
      const gMatrix = checkGFileMatrix(root, input.tool_input ?? {});
      if (gMatrix) deny(gMatrix);
      // 返工輪 rewrite 載入閘：修正輪（rev 有值）寫 G 檔前必須本輪已調用 shiftblame:rewrite（段位違規優先報）
      const rewriteGate = checkRewriteGate(root, input.tool_input ?? {});
      if (rewriteGate) deny(rewriteGate);
      // 狀態寫入矩陣：段越界寫檔即擋（含 MCP 寫檔／刪搬類工具；decoy 鍵逐一生效）
      const matrix = checkStateWriteMatrix(root, input.tool_input ?? {});
      if (matrix) deny(matrix);
      // 提醒比對只認路徑鍵（防 content 字串誤觸）；verify 報告逐鍵精確匹配
      const pathStr = PATH_KEYS.map((k) => input.tool_input?.[k]).filter((v) => typeof v === 'string').join(' ');
      const isVerify = /(^|[\\/])verify-[^\\/]+\.md($|\s)/i.test(pathStr) && !/(^|[\\/])review-verify-/i.test(pathStr);
      if (/SKILL\.md|hooks[\\/]|package\.json|plugin\.json|marketplace\.json/i.test(pathStr)) {
        inject(/[\\/](package|plugin|marketplace)\.json/i.test(pathStr)
          ? '[shiftblame] 版號屬老闆決策——版本欄位僅在老闆明確指示版號後才可改動（SKILL §2）；其他修正照授權範圍執行。'
          : '[shiftblame] 你正在修改框架文件（skills／hooks）——框架演化屬語義變更：MUST 先意圖揭露經老闆確認後才可執行；已授權則照授權範圍執行（think 理解揭露於對話承擔）。', 'PreToolUse');
      } else if (isVerify) {
        inject('[shiftblame] verify 報告 MUST 含 ## 人話 段——做了什麼／修了什麼／改了什麼（問題來源→處置→結果的因果鏈）；七判準任一不合格即判決不通過（SKILL §3 人話翻譯三關卡）。', 'PreToolUse');
      }
      process.exit(0);
    }
    process.exit(0);
  }

  process.exit(0); // 未知事件：靜默放行
} catch {
  process.exit(0); // 防護損壞時保持工作暢通
}
