#!/usr/bin/env node
/**
 * shiftblame-guard — 反偏移 hooks（ZCode / Codex 共用；Claude-style 協議）
 *
 * 讀 stdin 一個 JSON 事件（hook_event_name、cwd、prompt、tool_name、tool_input…），
 * 依事件分支：
 *   SessionStart    → 注入 §9 載入程序＋完整不變量卡（additionalContext）
 *   UserPromptSubmit→ 注入精簡不變量卡；偵測 <cwd>/.shiftblame 時加注當前節點
 *   PreToolUse      → Bash 含 `git commit`：驗 sb commitmsg 印章（10 分鐘內、訊息相符），
 *                     無效即 exit 2 阻擋；Write/Edit 觸及框架文件（skills／hooks）→ 注入三步序提醒；
 *                     其餘靜默放行
 *
 * 原則：已辨識的流程接入異常拒絕正式寫入及提交；其餘未預期內部錯誤維持既有靜默出口。
 * 煙霧測試：printf '%s' '{"hook_event_name":"UserPromptSubmit","cwd":"."}' | node hooks/shiftblame-guard.mjs
 */

import { existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
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

const CARD = [ // 核心不變量；RAM/ROM 分層（G/SLUG=ROM、tmp+flow-state=RAM）；審計＝確認→分發邊的外部對抗
  '[shiftblame 不變量]',
  '①老闆輸入先路由 shiftblame:think（全域路由，不屬於任何段）；意圖對抗先行（逼出無歧義即執行，不無限卡）：補充／修正→回 intent 同 ms 重走；確認→審計（推進指令外部對抗）→分發——銜接律：審計邊終點＝推進起點。問題類輸入直接解答不對抗；收斂定案權在老闆。',
  '②八段：intent→requirement→research→plan→test→build→verify→done。回頭自由（→intent 零旗標／done→test／done→intent --new-ms）；前進要鑰匙（--boss-ok＋時點對抗）。',
  '③時點對抗（plan→test①／verify→test②／verify→done③——產出對抗，與審計分屬）：--adversarial＋adversarialLog point 條目對照（新鮮度＝晚於同邊上次推進），不一致即擋。',
  '④雙流：輸入流唯增（事實，不覆蓋不消費）；理解流＝shiftblame:think args（雜湊鏈唯增，含意圖／問題分類標注）；正當性＝理解宣告＋必然曝光，無前置攔截。',
  '⑤曝光＝核心制衡：每則輸入展示未審理解＋未覆蓋輸入——越權當場可見；偽造由抽查承擔。',
  '⑥commit 必過 sb commitmsg（hooks 硬擋）；staged 系統檔不入庫（.shiftblame/）；路徑 root 錨定絕對展開；git 重定向／alias 攔截；verify 對 repo 唯讀。G/SLUG＝ROM（自足定義＋回指）；對話、工作過程與交接文件一律 .shiftblame/tmp/；flow-state 承載機械狀態。路徑、檔名、slug、命名與註釋須可離開對話辨識；規範溯及既往，舊內容同樣盤點清理。',
  '⑦版號屬老闆決策。',
  '⑧提交＝對抗時點：sb adversarial（外部唯讀子代理＋報告落檔＋判定「通過」）→ sb commitmsg 發章不消費 → hooks 於 commit 消費焚章（一對一）；返工直通 --rerun；假對抗抽查承擔。',
  '⑨外部性閘：research→plan 邊與返工首推進邊驗至少一次外部調用（requirement→research 進段與返工時重置 externalEvidence）；大型研究 MUST 外部唯讀子代理；偽造抽查承擔。',
  '⑩回合結束≠流程完成：插入疑問以 commentary 解答後接續已授權未完工作；補充／修正先實際 sb next intent，再 sb state 查證同 slug／ms 並更新理解（無流程不為形式建 slug，done 依既有規則）。final 前確認應回退者已回退、應分發者已分發；僅整體完成、無未完工作的純問答、具體待決／必要輸入、主動 think 停等、明確暫停／取消或實際阻塞可停。Stop 靜默放行不代做路由；接續由主對話承擔，不靠無條件續跑或 Stop 重試。',
  '⑪回合成本＝軟性會計（plan 段 sb budget 宣告；超限記錄＋曝光＋sb end 遙測結算，工作中斷零發生）＋迴圈斷路器（同操作回合內第 4 次重複即擋並要求改變策略、第 7 次升級凍結回 intent——防遞迴無限擴大；持續推進的多樣操作永遠放行）；SOP／ROADMAP 每 ms 必審（sb sopreview 三問留痕——開新 ms／PASS 前擋）；基質優先：git／平台已答的另造即拆（重複造輪子），規則由元行為證據錨定、修剪而非堆疊。',
].join('\n');

const SESSION_CARD = [
  CARD,
  '',
  '[冷啟動載入（§9）] 依序唯讀：<repo>/.shiftblame/SOP.md → ROADMAP.md → 當前 slug（SLUG.md＋定案索引——同 slug 過往 ms 一行式定案，回讀由段義務承載）→ archive/（近者先於遠者）。載入後 shiftblame:think 的路由提議才有脈絡依據。',
  '[hooks] 本卡由 plugin hooks 機械注入（SessionStart／UserPromptSubmit／Stop／PreToolUse）；輸入流／理解流記錄與 commit 印章硬擋已啟用，失效時回到文件與 CLI 閘門層。',
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
    if (st.node === 'intent') hint = '——shiftblame:think 路由起點；老闆補充／重修／追加→同 ms 重走線性';
    if (st.node === 'requirement') hint = '——G1 定義邊：經查證的現況事實＋BDD 六鍵（requirement→research 邊格式閘）';
    if (st.node === 'research') hint = st.externalEvidence?.done
      ? `——外部證據已記（@${st.externalEvidence.tool}）；G2 結論式產出、向前對齊 G1`
      : '——外部證據未調用：推進 plan 前 MUST 至少一次外部工具（WebSearch／WebFetch／webReader／web.run（web__run） 查證或外部唯讀子代理）——零外部推不過（CARD⑨）';
    if (st.node === 'plan') hint = '——放行前：§10 核對＋時點①對抗（--adversarial＋adversarialLog point 條目）＋停靠簡報（老闆授權後帶 --boss-ok 推進）';
    if (st.node === 'verify') hint = '——中間態：老闆未宣稱 done 前停留於此；判決（AC 判定寫 G1 回指區）＋時點②對抗；不滿意→test 重修或回 intent';
    if (st.node === 'done') hint = '——完成態：重修→test（零旗標）；補充→intent（同 ms）；開新 ms 帶 --new-ms 或 sb end --boss-ok（PASS 留痕）';
    let budget = '';
    if (st.budget) budget = `\n[回合預算] ≤ ${st.budget.requests} 工具調用／≤ ${st.budget.minutes} 分鐘${st.turnUsage ? `｜本回合 ${st.turnUsage.requests} 調用${st.turnUsage.escalatedAt ? '——迴圈升級：凍結中，待老闆下一則輸入' : st.turnUsage.exceededAt ? '——已超限（成本警示中，工作照常）' : ''}` : ''}`;
    return `\n[段] ${st.slug ?? '?'}/${st.ms ?? '?'} @ ${st.node ?? '?'}${hint}——推進必過 sb next 閘門（sb state 查下一步）。${budget}`;
  } catch { return ''; }
}

// —— 輸入流（雙流模型）——
// 雙流模型：輸入＝獨立理解對象，不是鎖的鑰匙材料——
// 輸入流唯增（每則輸入永久是事實，永不覆蓋、永不消費、無時序跳躍與翻舊帳概念——無需引用故無引句問題）；
// 理解流由 agent 經 shiftblame:think 路由產生（調用 args＝理解宣告），曝光是核心制衡（老闆每則輸入時審視）。
// 主動觸發形態（兩種觸發樣態）：老闆輸入以 shiftblame:think 調用形式開頭（/shiftblame:think、$shiftblame:think 連結或裸名）
// ＝主動觸發訊號——顯式語法（性質同 --boss-ok 旗標），非 agent 偵測老闆意圖的詞集
const ACTIVE_TRIGGER_RE = /^\s*(?:[/\$])?shiftblame:think\b/i;

// —— 觀測流輪替（flow-state 恆有界）——
// 閘門對照所需的近期事實留檔內；較舊且對照價值已耗盡者（已審理解、舊對抗條目、舊 history）輪替至
// tmp/flow-rotated.jsonl——事實保留（老闆清理 tmp 時隨之消失），flow-state 非無限累加。
// 偏移欄位（*Rotated／understandingSeedHash）記已輪替前綴；驗證器接納且舊檔無偏移＝0（向後相容）。
// 未審理解永留檔內（曝光義務優先於輪替）。
const ROTATE_LIMITS = { inputs: [40, 20], understandings: [40, 20], adversarialLog: [12, 6], history: [120, 60] };
function rotateStreams(root, st) {
  const events = [];
  const now = new Date().toISOString();
  for (const [stream, [limit, keep]] of Object.entries(ROTATE_LIMITS)) {
    const arr = st[stream] ?? [];
    if (!Array.isArray(arr) || arr.length <= limit) continue;
    let cut = arr.length - keep;
    if (stream === 'understandings') { // 未審理解不輪替——曝光義務
      let reviewedPrefix = 0;
      while (reviewedPrefix < arr.length && arr[reviewedPrefix]?.reviewed) reviewedPrefix++;
      cut = Math.min(cut, reviewedPrefix);
    }
    if (cut <= 0) continue;
    for (const e of arr.slice(0, cut)) events.push({ at: now, stream, entry: e });
    if (stream === 'inputs') st.inputsRotated = (st.inputsRotated ?? 0) + cut;
    if (stream === 'understandings') { st.understandingsRotated = (st.understandingsRotated ?? 0) + cut; st.understandingSeedHash = arr[cut - 1]?.hash ?? st.understandingSeedHash; }
    if (stream === 'adversarialLog') st.adversarialRotated = (st.adversarialRotated ?? 0) + cut;
    if (stream === 'history') st.historyRotated = (st.historyRotated ?? 0) + cut;
    st[stream] = arr.slice(cut);
  }
  if (!events.length) return;
  try {
    const dir = join(root, '.shiftblame', 'tmp');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'flow-rotated.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } catch { /* 輪替落檔失敗：檔內截斷照常（殘餘由抽查承擔） */ }
}

// —— 回合計數（元行為觀測層）＋回合成本控制與迴圈斷路器 ——
// PreToolUse 每次計數：turnUsage（本回合——老闆輸入重置）＋usageTotals（slug 累計，sb end 遙測素材）。
// 工具調用數＝model 請求數的上界代理（每請求至少產出一個工具調用；批次並行時高估）——誠實標名，真值在平台 DB。
// 預算（plan 段 sb budget 宣告）＝軟性成本會計：超限只記錄（budgetBreaches）＋曝光（sb state／輸入卡／end 遙測），
// 工作照常推進零中斷——量不是中斷理由；常態超支由老闆依遙測調整預算或拆分。
// 迴圈斷路器（常開，無預算亦生效）＝遞迴防護：重複才是死圈特徵——同指紋（工具＋操作摘要 hash）回合內
// 第 4 次出現即擋該次調用（要求改變策略：重跑同樣的失敗＝無限循環）；被擋後仍重複至第 7 次＝升級：
// 凍結本回合工具（Skill 與 sb state／sb next intent 豁免）＋自動回 intent（執行段；CLI 對照 escalatedAt 留 budgetExhausted）。
const BUDGET_NODES = new Set(['test', 'build', 'verify', 'done']);
const BUDGET_ESCAPE_RE = /\bsb(?:\.mjs)?\s+(?:state(?:\s|$)|next\s+intent\b)/;
const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const LOOP_DENY_AT = 4;
const LOOP_ESCALATE_AT = 7;
function toolFingerprint(tool, cmd, toolInput) {
  const sig = String(cmd || toolInput?.file_path || toolInput?.path || toolInput?.skill || toolInput?.name || JSON.stringify(toolInput ?? {})).slice(0, 200);
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
    // 指紋計數（迴圈偵測素材；上限 128 鍵——超限時淘汰非當前指紋的最小計數鍵，保證恆 ≤128 且當前指紋恆留存）
    const fp = toolFingerprint(tool, cmd, toolInput);
    const prints = isRecord(st.turnUsage.fingerprints) ? st.turnUsage.fingerprints : (st.turnUsage.fingerprints = {});
    prints[fp] = (prints[fp] ?? 0) + 1;
    if (Object.keys(prints).length > 128) {
      let minKey = null, minVal = Infinity;
      for (const [k, v] of Object.entries(prints)) if (k !== fp && v < minVal) { minKey = k; minVal = v; }
      if (minKey) delete prints[minKey];
    }
    // 預算超限＝軟性會計（記錄＋曝光；零中斷）
    if (isRecord(st.budget) && Number.isInteger(st.budget.requests) && Number.isInteger(st.budget.minutes)) {
      const minutes = (Date.now() - Date.parse(st.turnUsage.startedAt)) / 60000;
      if ((st.turnUsage.requests > st.budget.requests || minutes > st.budget.minutes) && !st.turnUsage.exceededAt) {
        st.turnUsage.exceededAt = now;
        st.budgetBreaches = (st.budgetBreaches ?? 0) + 1;
      }
    }
    writeFileSync(statePath, JSON.stringify(st, null, 2));
    // 迴圈斷路器：同操作重複即擋（要求改變策略）；被擋仍重複至升級線＝凍結＋自動回 intent（真死圈）。
    // 豁免面與升級凍結一致（Skill 與 sb state／sb next intent——擋截訊息引導的逃生操作本身可重複使用）。
    const escapeOp = /^skill$/i.test(String(tool ?? '')) || (SHELL_TOOL_RE.test(String(tool ?? '')) && BUDGET_ESCAPE_RE.test(String(cmd ?? '')));
    if (!escapeOp && prints[fp] >= LOOP_DENY_AT && prints[fp] < LOOP_ESCALATE_AT) {
      const preview = String(cmd || toolInput?.file_path || toolInput?.path || toolInput?.skill || tool || '').replace(/\s+/g, ' ').slice(0, 60);
      return { st, loopDeny: `迴圈斷路器：此操作（${preview}）本回合已第 ${prints[fp]} 次相同重複——重跑同樣的失敗＝無限循環；改變策略（修根因／換方法／不同操作）後繼續，或待老闆下一則輸入開新回合；成本現況由 sb state 查閱`, frozen: false };
    }
    if (!escapeOp && (prints[fp] >= LOOP_ESCALATE_AT || st.turnUsage.escalatedAt)) {
      if (!st.turnUsage.escalatedAt) {
        st.turnUsage.escalatedAt = now;
        writeFileSync(statePath, JSON.stringify(st, null, 2));
      }
      let retreated = st.node === 'intent';
      if (BUDGET_NODES.has(st.node)) {
        const sbPath = fileURLToPath(new URL('../cli/bin/sb.mjs', import.meta.url));
        const r = spawnSync(process.execPath, [sbPath, 'next', 'intent'], { cwd: root, encoding: 'utf8', timeout: 20000 });
        retreated = r.status === 0;
        if (r.status !== 0) process.stderr.write(`[shiftblame] 迴圈升級自動回 intent 失敗（手動執行 sb next intent）：${String(r.stderr || r.stdout || '').trim().slice(0, 200)}\n`);
      }
      return { st, frozen: true, retreated };
    }
    return { st, frozen: false };
  } catch { return null; }
}
function loopFreezeReason(usage, tool, cmd) {
  if (/^skill$/i.test(String(tool ?? ''))) return null; // 理解宣告落流自由
  if (SHELL_TOOL_RE.test(String(tool ?? '')) && BUDGET_ESCAPE_RE.test(String(cmd ?? ''))) return null; // sb state／sb next intent（拆分逃生）
  const st = usage.st;
  return `迴圈升級（同操作本回合重複 ≥ ${LOOP_ESCALATE_AT} 次且被擋後仍重複）——${usage.retreated || st.node === 'intent' ? '已自動回 intent（拆分重規劃；history 留 budgetExhausted）' : '本回合 MUST 回 intent'}；工具凍結至老闆下一則輸入（新回合重置）；改變策略即可避免：重複重跑同一失敗才是被擋的行為，持續推進的多樣操作永遠放行`;
}

function recordInput(root, prompt) {
  if (!root || !existsSync(join(root, '.shiftblame'))) return null;
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    const st = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { slug: null, ms: null, node: null, history: [] };
    const wasHold = st.understandingHold ?? null;
    let releaseNote = null;
    (st.inputs ??= []).push({ at: new Date().toISOString(), text: String(prompt ?? '') }); // 唯增事實流
    delete st.turnUsage; // 新回合：回合計數重置（回合級預算的邊界＝老闆輸入；usageTotals 跨回合累計）
    // 兩種觸發樣態：老闆以 shiftblame:think 調用形式輸入＝主動觸發→停等（理解呈現即停）；
    // 老闆回覆＝終審解凍（確認→分發；修正輪的再停等由 SKILL 條文承擔）——inputIdx 採全域編號（含已輪替前綴）
    if (ACTIVE_TRIGGER_RE.test(String(prompt ?? ''))) {
      st.understandingHold = { inputIdx: (st.inputsRotated ?? 0) + st.inputs.length - 1, at: new Date().toISOString() };
    } else if (wasHold) {
      delete st.understandingHold;
      releaseNote = `\n[停等解除] 輸入 #${wasHold.inputIdx} 的理解停等已由老闆回覆解除——回覆為確認即分發執行；為修正則理解更新後仍停等老闆再確認（兩種觸發樣態，SKILL §0）。`;
    }
    delete st.dialogueLock; // 冪等清理（不相容欄位）
    delete st.input;        // 冪等清理（不相容欄位）
    rotateStreams(root, st); // 觀測流輪替（flow-state 恆有界；事實落 tmp）
    writeFileSync(statePath, JSON.stringify(st, null, 2));
    return releaseNote;
  } catch { return null; } /* 狀態異常靜默 */
}

// 理解流記錄：PreToolUse 偵測 Skill(shiftblame:think) 調用且 args 有實質理解（≥10 字）→ 落一筆理解
// （錨定 `^(?:shiftblame:)?think$` 全等防偽技能名；args 即理解宣告——寫入側折疊換行＋截 200 字，同曝光防護判準；
// 雜湊鏈唯增；uptoInput＝理解涵蓋至第幾則輸入——曝光對照輸入流可見哪些輸入尚無理解覆蓋）
function recordUnderstanding(root, tool, toolInput) {
  if (!root || !/^skill$/i.test(String(tool ?? ''))) return;
  const target = String(toolInput?.skill ?? toolInput?.name ?? '');
  if (!/^(?:shiftblame:)?think$/i.test(target)) return;
  const as = String(toolInput?.args ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if ([...as].length < 10) return; // 理解必須有實質——空泛 args 不落檔（該輸入保持「尚無理解」曝光可見）
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return;
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    const idx = Math.max(0, (st.inputsRotated ?? 0) + (st.inputs ?? []).length - 1); // 全域輸入編號（含已輪替前綴——與停等編號同基準）
    const at = new Date().toISOString();
    const prevHash = (st.understandings ?? []).at(-1)?.hash ?? '';
    const hash = createHash('sha256').update(prevHash + String(idx) + as + at).digest('hex').slice(0, 16);
    (st.understandings ??= []).push({ at, uptoInput: idx, as, reviewed: false, hash });
    writeFileSync(statePath, JSON.stringify(st, null, 2));
  } catch { /* 狀態異常靜默 */ }
}

// 外部證據標記：PreToolUse 偵測外部工具調用——WebSearch／WebFetch／webReader／web.run（web__run）（外部查證）
// 與 Agent／Task（外部唯讀子代理）；Codex 事件實名為 webrun／collaborationspawn_agent／collaborationfollowup_task。精確錨定工具名（冒名、內嵌字串、相近名不標記——平台註冊名是事實）；
// 記錄 {done, at, tool}。重置由 CLI 承擔（requirement→research 進段與 --rerun 返工時清）——hooks 只記事實不重置。
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

// 狀態回流：輸入流＋理解覆蓋狀態（雙流模型——機械只呈事實，理解由 shiftblame:think 承擔、曝光由老闆終審）
function flowLine(root) {
  if (!root) return '';
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    const inputs = st.inputs ?? [];
    if (!inputs.length) return '';
    const covered = (st.understandings ?? []).at(-1)?.uptoInput ?? -1;
    const uncovered = (st.inputsRotated ?? 0) + inputs.length - 1 - covered;
    return `\n[輸入流] 共 ${(st.inputsRotated ?? 0) + inputs.length} 則${st.inputsRotated ? `（檔內 ${inputs.length}＋已輪替 ${st.inputsRotated}）` : ''}；最新「${flatOneLine(inputs.at(-1).text, 80)}」｜理解覆蓋至 #${covered}${uncovered > 0 ? `——⚠ ${uncovered} 則尚無理解覆蓋（agent 未理解就動手＝此處可見，曝光承擔）` : '（全覆蓋）'}——每則輸入經 shiftblame:think 調用（args＝理解宣告）落理解流；無鎖、無解鎖、無引句。`;
  } catch { return ''; }
}

// 停等行：understandingHold 進行中，每則輸入明示凍結語義——理解呈現即停、寫入凍結、待老闆終審
function holdLine(root) {
  if (!root) return '';
  try {
    const st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
    if (!st.understandingHold) return '';
    return `\n[停等理解] 輸入 #${st.understandingHold.inputIdx} 主動觸發（shiftblame:think 調用形式）——理解呈現（六欄）即停：本輪行動凍結（寫入類工具與流程推進硬擋；唯讀、外部查證、tmp 證據傾倒自由），待老闆終審回覆（兩種觸發樣態，SKILL §0）。`;
  } catch { return ''; }
}

// 曝光行單行化：折疊所有空白類字元（含 U+2028/U+2029 等類換行）＋截斷（200 字）——
// 防存量／手改 understandings 條目於注入文本偽造多行框架內容（寫入側已擋換行與超長；此為展示側同判，純事實防護非語義掃描）
function flatOneLine(s, n = 200) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  const cps = [...t];
  return cps.length > n ? cps.slice(0, n).join('') + '…' : t;
}

// 必然曝光（雙流模型核心制衡）：老闆每則輸入時展示未審視的理解宣告（理解有誤即越權，當場可見）；
// mark=true 時標記已審（UserPromptSubmit 用 mark=true；SessionStart 壓縮後注入用 mark=false——保留老闆輸入時的曝光）
function understandingReviewLine(root, mark = true) {
  if (!root) return '';
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    const pending = (st.understandings ?? []).filter((e) => !e.reviewed);
    if (!pending.length) return '';
    if (mark) {
      for (const e of pending) e.reviewed = true;
      writeFileSync(statePath, JSON.stringify(st, null, 2));
    }
    return `\n[理解審視] ${pending.map((e) => `#≤${e.uptoInput}→「${flatOneLine(e.as)}」@${flatOneLine(e.at)}`).join('；')}——理解有誤即屬 agent 越權，請立即指出（雜湊鏈唯增，抽查對照對話實蹟）。`;
  } catch { return ''; }
}

// 老闆決策邊雙重鎖：三邊（intent→requirement／plan→test／verify→done）的 `sb next <段>` 缺 --boss-ok 即擋；註解中的旗標不算
// --rerun 返工直通與 CLI 同判據放行（同 ms 曾達 test、非 verify 出發）——兩層判定必須一致，否則直通死路＋假留痕
function checkLayerStopover(root, cmd) {
  if (!root) return null;
  const clean = cmd.replace(/#[^\n]*/g, ''); // 剝除註解——# --boss-ok 不構成旗標
  if (!/\bsb(?:\.mjs)?\s+next\s+(requirement|test|done)\b/.test(clean) || /(^|\s)--boss-ok(?=\s|$)/.test(clean)) return null;
  try {
    const st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
    const edge = { intent: 'requirement', plan: 'test', verify: 'done' }[st.node];
    const target = clean.match(/\bsb(?:\.mjs)?\s+next\s+(requirement|test|done)\b/)?.[1];
    if (edge && edge === target) {
      const rerun = /(^|\s)--rerun\s+(impl|definition)(?=\s|$)/.exec(clean);
      if (rerun && st.node !== 'verify') {
        const reached = (st.history ?? []).some((h) => h.ms === st.ms && ['test', 'build', 'verify', 'done'].includes(h.to));
        if (reached) return null; // 返工直通（時點①分流判定留痕於 CLI history；verify→done 永不直通）
        return `--rerun 僅限同 ms 返工重走（本 ms 尚未到達 test）——首次推進之老闆決策邊走完整確認`;
      }
      return `老闆決策邊：${st.node}→${target}——經老闆授權（理解流曝光承擔）後帶 --boss-ok 推進，或返工直通帶 --rerun（同 ms 曾達 test；SKILL §3）`;
    }
  } catch { /* 非治理工作區 */ }
  return null;
}

// ———— 狀態寫入攔截：把寫入矩陣機械化 ————
// 測試碼（測試慣例路徑）僅 test 段可寫；實作碼（.shiftblame/ 外 repo 檔）
// 白名單＝build（實作段）／ended（PASS 後收尾歸檔）；其餘段對 repo 唯讀（verify 驗收唯讀、done 等待態唯讀）。
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
// G1→requirement/verify、G2→research/build、G3→plan/test（＋done §2.5）——落地段獲得承載檔回指區寫入權；
// 跨區（落地段改定義區）仍是綁架上游死路，由 CLI 分區 hash 於 sb next 兜底（hooks 無檔內分區粒度——殘餘如實標註）。
// archive/ 由 CLI 於收尾時寫入（放行）。
const G_WRITE_NODES = { 1: new Set(['requirement', 'verify']), 2: new Set(['research', 'build']), 3: new Set(['plan', 'test', 'done']) };
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
      const owner = { 1: 'requirement（定義區）／verify（回指區）', 2: 'research（定義區）／build（回指區）', 3: 'plan（定義區）／test（回指區；done §2.5）' }[g];
      return `[shiftblame] 段 ${node} 對 G${g}.md 無寫入權——G${g} 定義區／回指區寫入權屬 ${owner}；跨區（落地段改定義區）＝綁架上游死路，修正＝回 intent 開新輪（sb next intent）（RAM/ROM，SKILL §0/§5）`;
    }
  }
  return null;
}

// ———— 停等凍結（兩種觸發樣態）：hold 期間寫入類工具與流程推進硬擋 ————
// 老闆主動觸發（shiftblame:think 調用形式）的理解停等輪：理解呈現即停——
// 攔：repo 寫入（非 .shiftblame/）、git 寫入命令、sb 流程推進命令。
// 放行：Skill 調用（shiftblame:think 理解宣告落流）、唯讀與外部查證（Read/Grep/WebSearch/WebFetch/Agent…）、
// Bash 唯讀查證（git log/status/diff、node/python 探針、npm test）、.shiftblame/ tmp 證據傾倒。
const HOLD_GIT_WRITE_RE = /\bgit(?:\.exe)?\s+(?:-c\s+\S+\s+)*(?:add|commit|restore|reset|checkout|switch|clean|push|pull|fetch|merge|rebase|tag|rm|mv|stash|cherry-pick|revert|apply|am|init|branch|worktree|clone|submodule|update-ref|symbolic-ref|filter-branch|notes|reflog|gc|prune|update-index|read-tree|write-tree|hash-object|mktag|fast-import)\b/i;
const HOLD_SB_PUSH_RE = /\bsb(?:\.mjs)?\s+(?:init|next|end|adversarial|commitmsg|budget|sopreview|closeout)\b/;
function checkHoldFreeze(root, tool, cmd, toolInput) {
  if (!root) return null;
  let st; try { st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8')); } catch { return null; }
  const hold = st.understandingHold;
  if (!hold) return null;
  const t = String(tool ?? '');
  if (/^skill$/i.test(t)) return null; // 技能載入與 shiftblame:think 調用（理解宣告落流）自由——實際寫入由工具層攔
  if (SHELL_TOOL_RE.test(t)) {
    if (HOLD_GIT_WRITE_RE.test(cmd) || HOLD_SB_PUSH_RE.test(cmd)) {
      return `[shiftblame] 停等凍結（輸入 #${hold.inputIdx} 理解待老闆終審）——流程推進與 git 寫入本輪凍結；唯讀查證自由，理解呈現後待老闆回覆（兩種觸發樣態，SKILL §0）`;
    }
    return null; // 唯讀查證命令（git log/status、node/python 探針、npm test）放行
  }
  if (WRITE_TOOL_RE.test(t) && !READ_EXEMPT_RE.test(t)) {
    for (const k of PATH_KEYS) {
      const v = toolInput?.[k];
      if (typeof v !== 'string' || !v.trim() || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) continue;
      const rel = relative(root, absPath(root, v)).replace(/\\/g, '/');
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue; // 專案外不歸此管
      if (rel === '.shiftblame' || rel.startsWith('.shiftblame/')) continue; // tmp 證據傾倒自由
      return `[shiftblame] 停等凍結（輸入 #${hold.inputIdx} 理解待老闆終審）——repo 寫入本輪凍結（tmp 證據傾倒自由）；理解呈現後待老闆回覆（兩種觸發樣態，SKILL §0）`;
    }
    return null;
  }
  return null; // Read／Grep／Glob／WebSearch／WebFetch／webReader／web.run（web__run）／Agent 等唯讀與外部查證自由
}

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
      if (node !== 'test') return `[shiftblame] 測試碼（${rel}）已定稿（全程唯讀）；重修回 test 段（或任意→intent 重走）後建立新 commit（SKILL 寫入矩陣）`;
    } else if (!IMPL_WRITE_NODES.has(node)) {
      return `[shiftblame] 段 ${node} 對 repo 實作檔（${rel}）唯讀——實作寫入限 build 段（ended 態收尾歸檔）；回 intent 重走或 done→test 重修後才可寫（SKILL 寫入矩陣）`;
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

function checkCommitStamp(root, seg) {
  if (readFlowState(root).kind === 'invalid') return '流程接入異常——修復並以 sb state 查證後才可提交；既有印章不代表狀態有效';
  const extracted = extractCommitMessage(seg);
  if (extracted.error) return extracted.error;
  // -C 目標（如有）必須絕對且等於印章專案根（印章綁定本 repo，限同段）
  const c = seg.match(/(?:^|\s)-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/);
  if (c) {
    const target = c[1] ?? c[2] ?? c[3] ?? '';
    if (!isAbs(target) || normPath(root, target) !== normPath(root, root)) {
      return 'git -C 目標與印章專案不符——印章不可攜帶到其他 repo；在目標專案重跑 sb commitmsg，且 -C 使用絕對路徑';
    }
  }
  const stampPath = join(root, '.shiftblame', 'tmp', 'commit-stamp.json');
  if (!existsSync(stampPath)) return '缺少 commit 印章——先跑 sb commitmsg "<訊息>"（SKILL 提交規範）再以相同訊息 commit';
  try {
    const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
    if (!stamp.cwd || !stamp.message || !stamp.issuedAt) return 'commit 印章欄位不全（偽造跡象）——重跑 sb commitmsg';
    if (!isAbs(stamp.cwd) || normPath(root, stamp.cwd) !== normPath(root, root)) return 'commit 印章 cwd 非絕對或屬於其他專案——在本專案重跑 sb commitmsg（合法章 cwd 恆為絕對 ROOT）';
    const age = Date.now() - new Date(stamp.issuedAt).getTime();
    if (age > STAMP_TTL_MS) return 'commit 印章已逾期（>10 分鐘）——重跑 sb commitmsg "<訊息>"';
    if (age < -60000) return 'commit 印章時間戳在未來——僅接受剛產生的印章，重跑 sb commitmsg';
    if (stamp.message !== extracted.msg) return 'commit 訊息與印章不符——以完全相同的訊息重跑 sb commitmsg 後再 commit';
    // 提交對抗閘（與 sb commitmsg 同判據）：手寫印章檔繞過 commitmsg 的路徑在此補死——
    // 消費印章同時核對 flow-state 對抗宣告（存在且未消費）並一併消費（返工修復至提交必然觸發，CARD⑧）
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    let st = null;
    try { st = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* 無狀態檔 */ }
    if (st?.understandingHold) return '理解停等尚未解除——不得提交';
    if (st?.node === 'verify') return '驗收段對 repo 唯讀——不得提交';
    if (!st || !st.adversarialAt || st.adversarialConsumed) {
      return '提交前需對抗記錄——外部唯讀子代理對抗、報告落檔後 sb adversarial <報告檔> 宣告（判定須「通過」；對抗閘全路徑生效）';
    }
    st.adversarialConsumed = true;
    writeFileSync(statePath, JSON.stringify(st, null, 2));
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

function preservePendingInput(root, prompt) {
  try {
    const dir = join(root, '.shiftblame', 'tmp');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'recovery-inputs.jsonl'), JSON.stringify({ at: new Date().toISOString(), text: String(prompt ?? '') }) + '\n');
    return '\n[待恢復輸入] 本則原始輸入已保存於 .shiftblame/tmp/recovery-inputs.jsonl，尚未進入輸入流；恢復時依實際對話與保存事件核對補回，保留原檔，不重播理解或授權。';
  } catch { return '\n[待恢復輸入] 暫存也無法寫入；本則輸入僅留在實際對話，修復紀錄器時先核對補回。'; }
}

const deny = (reason) => { process.stderr.write(`[shiftblame] ${reason}\n`); process.exit(2); };

try {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const event = input.hook_event_name || input.hookEventName || '';
  const root = projectRoot(input);
  const healthy = !root || readFlowState(root).kind !== 'invalid';
  // 異常原檔保持原樣，不能由新增心跳把空物件／部分資料洗成有效紀錄。
  if (healthy) beatHeartbeat(root, event);

  if (event === 'SessionStart') {
    // 壓縮後自動注入（compact 來源同走此事件）：靜態卡＋動態狀態卡——壓縮摘要抹掉過程後，
    // 機械事實（段位／輸入流與理解覆蓋／未審理解／停等狀態）立即回流對話，恢復依據檔案非摘要。
    inject(SESSION_CARD + nodeLine(root) + flowLine(root) + understandingReviewLine(root, false) + holdLine(root), 'SessionStart');
  }

  if (event === 'UserPromptSubmit') {
    const releaseNote = healthy ? recordInput(root, input.prompt ?? '') : preservePendingInput(root, input.prompt ?? '');
    inject(CARD + nodeLine(root) + flowLine(root) + understandingReviewLine(root, healthy) + (releaseNote ?? '') + holdLine(root), 'UserPromptSubmit'); // 異常曝光保持唯讀，原始輸入另存待恢復
  }

  if (event === 'Stop') {
    process.exit(0); // 僅放行回合結束；不判定流程完成、不代做 intent 路由。主對話依 CARD⑩ 在 final 前接續或揭露停點。
  }

  if (event === 'PreToolUse') {
    const tool = input.tool_name || input.toolName || '';
    const cmd = typeof input.tool_input?.command === 'string' ? input.tool_input.command : typeof input.tool_input?.cmd === 'string' ? input.tool_input.cmd : '';
    const healthError = checkStateHealth(root, tool, cmd, input.tool_input ?? {});
    if (healthError) deny(healthError);
    if (healthy) recordUnderstanding(root, tool, input.tool_input);
    if (healthy) markExternalEvidence(root, tool);
    // 回合計數（元行為觀測）＋成本軟性會計＋迴圈斷路器（同操作重複才擋；持續推進的多樣操作永遠放行）
    const usage = healthy ? countUsage(root, tool, cmd, input.tool_input ?? {}) : null;
    if (usage?.loopDeny) deny(usage.loopDeny);
    if (usage?.frozen) { const freezeReason = loopFreezeReason(usage, tool, cmd); if (freezeReason) deny(freezeReason); }
    const freeze = checkHoldFreeze(root, tool, cmd, input.tool_input ?? {}); // 停等凍結（主動觸發輪——寫入與推進硬擋）
    if (freeze) deny(freeze);
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
        // 暫存不入庫（staged 事實清單）先擋——印章只燒乾淨內容
        const staged = checkStaged(root);
        if (staged) deny(staged);
        const reason = checkCommitStamp(root, seg);
        if (reason) deny(reason);
      }
      process.exit(0); // 各段通過：靜默放行
    }
    if (WRITE_TOOL_RE.test(tool) && !READ_EXEMPT_RE.test(tool)) {
      // G 檔寫入矩陣（RAM/ROM 分區）：定義區綁定義邊（G1→requirement／G2→research／G3→plan）／回指區綁落地段（G1←verify／G2←build／G3←test；done §2.5）——跨區由 CLI 分區 hash 兜底
      const gMatrix = checkGFileMatrix(root, input.tool_input ?? {});
      if (gMatrix) deny(gMatrix);
      // 狀態寫入矩陣：段越界寫檔即擋（含 MCP 寫檔／刪搬類工具；decoy 鍵逐一生效）
      const matrix = checkStateWriteMatrix(root, input.tool_input ?? {});
      if (matrix) deny(matrix);
      // 提醒比對只認路徑鍵（防 content 字串誤觸）；verify 報告逐鍵精確匹配
      const pathStr = PATH_KEYS.map((k) => input.tool_input?.[k]).filter((v) => typeof v === 'string').join(' ');
      const isVerify = /(^|[\\/])verify-[^\\/]+\.md($|\s)/i.test(pathStr) && !/(^|[\\/])review-verify-/i.test(pathStr);
      if (/SKILL\.md|hooks[\\/]|package\.json|plugin\.json|marketplace\.json/i.test(pathStr)) {
        inject(/[\\/](package|plugin|marketplace)\.json/i.test(pathStr)
          ? '[shiftblame] 版號屬老闆決策——版本欄位僅在老闆明確指示版號後才可改動（SKILL §2）；其他修正照授權範圍執行。'
          : '[shiftblame] 你正在修改框架文件（skills／hooks）——框架演化屬語義變更：MUST 先意圖揭露經老闆確認後才可執行；已授權則照授權範圍執行（理解流曝光承擔）。', 'PreToolUse');
      } else if (isVerify) {
        inject('[shiftblame] verify 報告 MUST 含 ## 人話 段——做了什麼／修了什麼／改了什麼（問題來源→處置→結果的因果鏈）；七判準任一不合格即判決不通過（SKILL §3 人話三時點③）。', 'PreToolUse');
      }
      process.exit(0);
    }
    process.exit(0);
  }

  process.exit(0); // 未知事件：靜默放行
} catch {
  process.exit(0); // 防護損壞時保持工作暢通
}
