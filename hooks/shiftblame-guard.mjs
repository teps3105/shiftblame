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
 * 原則：防護損壞不得阻斷工作——任何內部錯誤一律靜默 exit 0（deny 是唯一刻意非零出口）。
 * 煙霧測試：printf '%s' '{"hook_event_name":"UserPromptSubmit","cwd":"."}' | node hooks/shiftblame-guard.mjs
 */

import { existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';

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

function inject(text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'additionalContext', additionalContext: text },
  }));
  process.exit(0);
}

const projectRoot = (input) => {
  const c = input.cwd;
  // 唯一錨定來源：平台給的絕對 cwd。不猜測、不 fallback——process.cwd() 可能是插件或任意目錄，
  // 相對路徑展開到錯誤資料夾正是本防護要擋的攻擊面。
  return typeof c === 'string' && isAbsolute(c) && existsSync(c) ? c : null;
};

const CARD = [
  '[shiftblame 不變量]',
  '①老闆輸入先路由 sb-think（全域路由，不屬於任何段）：補充／修正→回 intent 同 ms 重走線性；確認／開工→分發執行。',
  '②八段：intent→audit→research→plan→test→build→verify→done。回頭自由（任意→intent 零旗標、done→test 重修）；前進要鑰匙（--boss-ok 留痕＋對話鎖＋授權印章）。',
  '③三時點對抗（plan→test①／verify→test②／verify→done③）：--adversarial 宣告＋SLUG.md 對照，不一致即擋。',
  '④令行靜止：每則老闆輸入上鎖，唯 sb unlock --quoted 引本則非否定候選原句解鎖；鎖定期間只讀不寫；呈現待決方案以〔待確認〕結尾（Stop 偵測自動上鎖）。',
  '⑤授權＝機械過濾＋候選內判讀：hooks 於每則老闆輸入時覆蓋記錄當前輸入（時序元規則：最新覆蓋舊則，機械抗壓縮）＋掃描候選詞（自然語言寬表）＋標記否定共現，注入過濾產物；解鎖（sb unlock --quoted "引句"）僅可引本則原文且須覆蓋非否定候選，消費即失效；--stamp done|pass|newMs 寫授權印章。捏造／跳時序／無候選／否定候選皆機械擋；解鎖引句於老闆下則輸入自動展示（必然曝光，老闆終審）。',
  '⑥commit 必過 sb commitmsg（hooks 硬擋）；staged 暫存不入庫（tmp/ 與 .shiftblame/——hooks 讀 git 展開事實清單擋）；驗收段（verify）對 repo 唯讀。',
  '⑦版號屬老闆決策——不得自行升版或預設版號。',
  '⑧對抗—修復—再對抗閉環（機械化）：提交＝對抗時點——sb adversarial <報告檔>（MUST 外部唯讀子代理，報告落檔；機械驗：檔在 .shiftblame 內＋判定行＋判定「通過」才可發章）；sb commitmsg 發章只驗不消費，hooks 於實際 commit 時消費並焚章（一對一）——返工修復必然終於 commit，閘必然觸發；自寫／重用報告檔屬假對抗（抽查 adversarialLog 承擔）。返工直通走 --rerun（時點①分流判定，SKILL §3）。',
].join('\n');

const SESSION_CARD = [
  CARD,
  '',
  '[冷啟動載入（§9）] 依序唯讀：<repo>/.shiftblame/SOP.md → ROADMAP.md → archive/ → 當前 slug（SLUG.md 與目前段）。載入後 sb-think 的路由提議才有脈絡依據。',
  '[hooks] 本卡由 plugin hooks 機械注入（SessionStart／UserPromptSubmit／Stop／PreToolUse）；對話鎖、授權錨定與 commit 印章硬擋已啟用，失效時回到文件與 CLI 閘門層。',
  '[版號] 版本號屬老闆決策——不得自行升版或預設版號，揭露表寫「版號待老闆指定」。',
].join('\n');

function nodeLine(root) {
  if (!root) return '';
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    let hint = '';
    if (st.node === 'intent') hint = '——sb-think 路由起點；老闆補充／重修／追加→同 ms 重走線性';
    if (st.node === 'plan') hint = '——放行前：§10 核對＋時點①對抗（--adversarial＋SLUG.md 記錄）＋停靠簡報（老闆授權 sb unlock 後帶 --boss-ok 推進）';
    if (st.node === 'verify') hint = '——中間態：老闆未宣稱 done 前停留於此；判決＋時點②對抗；不滿意→test 重修或回 intent';
    if (st.node === 'done') hint = '——完成態：重修→test（零旗標）；補充→intent（同 ms）；開新 ms（印章）或 sb end（PASS 印章）';
    return `\n[段] ${st.slug ?? '?'}/${st.ms ?? '?'} @ ${st.node ?? '?'}${hint}——推進必過 sb next 閘門（sb state 查下一步）${st.dialogueLock ? '；對話鎖中（唯讀，等 sb unlock 引老闆原句）' : ''}。`;
  } catch { return ''; }
}

// —— 對話鎖（令行靜止）＋授權機械過濾（時序元規則）——
// 時序元規則：每則老闆輸入「覆蓋」前一則（flow-state 只存當前輸入）——跳時序不是被擋，是無物可引。
// 抗壓縮：對話壓縮把過程變摘要；機械層（檔案事實）永遠持有最後一則原文與標記——時序判定只依賴機械事實。
// 輸入時刻過濾：候選詞（自然語言寬表）掃描＋否定共現標記（否定詞與候選同句→該候選標否定），
// 回流給 agent 的是過濾產物（原文＋候選標記）——理解只能在候選內運作，不能創造候選。
function handleBossInput(root, prompt) {
  if (!root || !existsSync(join(root, '.shiftblame'))) return;
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    const st = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { slug: null, ms: null, node: null, history: [] };
    const text = String(prompt ?? '');
    st.input = { at: new Date().toISOString(), text, candidates: scanConsent(text), consumed: false }; // 覆蓋：最新輸入是唯一有效語境
    st.dialogueLock = true; // 新鎖定期：唯 sb unlock --quoted 引本則非否定候選原句可解
    st.stamps = {};          // 陳舊授權失效（印章只隨對應 unlock 寫入）
    writeFileSync(statePath, JSON.stringify(st, null, 2));
  } catch { /* 狀態異常靜默 */ }
}

// 候選詞集（自然語言寬表；語例非判準——機械只標候選，真假由 agent 於候選內判讀）
const CONSENT_WORDS = {
  go:    ['開工', '開始', '繼續', '去做', '去吧', '放行', '就這樣', '動工', 'go', 'ok'],
  nod:   ['確認', '沒錯', '對', '可以', '好', '行'],
  done:  ['done', '完成', '收工'],
  pass:  ['pass', '通過', '過了'],
  newMs: ['下一個', '開新的', '新開一個'],
};
// 肯定複合詞（含否定字但語義為肯定）——先於否定判定剔除並登記為非否定候選
const AFFIRM_COMPOUND = ['沒錯', '不錯'];
// 否定共現：否定詞與候選詞同「句」（中英標點切分）→ 該候選標否定；
// 中文含「不」（不行/不好/不可以/不對/好久不見/對不起…fail-closed 標否定）；英文 not/don't/never/stop/wait/no 同列
const NEG_RE = /(還沒|尚未|沒有|沒|未|別|不要|先不|不|非|\bnot\b|\bdon'?t\b|\bnever\b|\bstop\b|\bwait\b|\bno\b)/i;

// 掃描當前輸入的候選詞與否定標記（英文不分大小寫；回傳 [{word, type, negated}]）
// 每句重建無 g 正則（防 lastIndex 汙染跨句漏標）；肯定複合詞先剔除再判否定（「沒錯」非否定、「不行」否定）
// 分句含半形標點（. , ; ! ?）——英文輸入「ok. not ok? ok!」逐句判定
function scanConsent(text) {
  const out = [];
  // 數字內標點保護（3.14／1,000）——先佔位再分句，防止數字小數點偽句界使否定判定跨句分離；
  // 佔位符不參與任何詞匹配（候選與否定詞皆不含數字標點），無需還原
  const guarded = text.replace(/(?<=\d)[.,](?=\d)/g, '\u0000');
  const sentences = guarded.split(/(?<=[，。！？；、\n,.!?;])/); // 保留分隔符的切分——否定判定以句為單位
  for (const sen of sentences) {
    let rest = sen;
    for (const aff of AFFIRM_COMPOUND) {
      const re = new RegExp(aff, 'i');
      while (re.test(rest)) {
        out.push({ word: aff, type: 'nod', negated: false });
        rest = rest.replace(re, '　'); // 剔除已登記的肯定複合詞——剩餘片段不再參與否定/候選判定
      }
    }
    const negated = NEG_RE.test(rest);
    for (const [type, words] of Object.entries(CONSENT_WORDS)) {
      for (const w of words) {
        if (new RegExp(w.charCodeAt(0) > 127 ? w : `\\b${w}\\b`, 'i').test(rest)) {
          out.push({ word: w, type, negated });
        }
      }
    }
  }
  return out;
}

// 過濾產物回流：agent 拿到的注入是「當前輸入＋機械標記」，不是原始輸入再自行過濾
function inputLine(root) {
  if (!root) return '';
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const inp = JSON.parse(readFileSync(statePath, 'utf8')).input;
    if (!inp || typeof inp.text !== 'string') return '';
    const parts = (inp.candidates ?? []).map((c) => `${c.word}(${c.type}${c.negated ? '，否定' : ''})`);
    return `\n[當前輸入]${inp.consumed ? '（已消費——同一則不得再引，等老闆下一則）' : ''}「${inp.text}」候選：${parts.join('、') || '無（fail-closed：無候選則不可解鎖，停等老闆澄清）'}——解鎖僅可引本則非否定候選原句（sb unlock --quoted）。`;
  } catch { return ''; }
}

// 必然曝光：老闆每則輸入時展示未審視的解鎖引句（斷章即當場可見）；mark=true 時標記已審
// （UserPromptSubmit 用 mark=true；SessionStart 壓縮後注入用 mark=false——保留老闆輸入時的曝光）
function unlockReviewLine(root, mark = true) {
  if (!root) return '';
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    const pending = (st.unlockLog ?? []).filter((e) => !e.reviewed);
    if (!pending.length) return '';
    if (mark) {
      for (const e of pending) e.reviewed = true;
      writeFileSync(statePath, JSON.stringify(st, null, 2));
    }
    return `\n[解鎖審視] ${pending.map((e) => `「${e.quoted}」${e.stamp ? `（印章 ${e.stamp}）` : ''}@${e.node ?? '?'} ${e.at}`).join('；')}——非你授權即屬 agent 越權，請立即指出。`;
  } catch { return ''; }
}

function checkDialogueLock(root) {
  if (!root) return null;
  try {
    const p = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(p)) return null;
    const st = JSON.parse(readFileSync(p, 'utf8'));
    if (st.dialogueLock) return '對話鎖中——理解老闆輸入後以 sb unlock --quoted 引本鎖定期內原句解鎖（閱讀理解＋留痕曝光）；理解／呈現／唯讀自由，一切寫入被擋（令行靜止，SKILL 授權章）。';
  } catch { return null; }
  return null;
}

// 老闆決策邊雙重鎖：三邊（intent→audit／plan→test／verify→done）的 `sb next <段>` 缺 --boss-ok 即擋；註解中的旗標不算
// --rerun 返工直通與 CLI 同判據放行（同 ms 曾達 test、非 verify 出發）——兩層判定必須一致，否則直通死路＋假留痕
function checkLayerStopover(root, cmd) {
  if (!root) return null;
  const clean = cmd.replace(/#[^\n]*/g, ''); // 剝除註解——# --boss-ok 不構成旗標
  if (!/\bsb(?:\.mjs)?\s+next\s+(audit|test|done)\b/.test(clean) || /(^|\s)--boss-ok(?=\s|$)/.test(clean)) return null;
  try {
    const st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
    const edge = { intent: 'audit', plan: 'test', verify: 'done' }[st.node];
    const target = clean.match(/\bsb(?:\.mjs)?\s+next\s+(audit|test|done)\b/)?.[1];
    if (edge && edge === target) {
      const rerun = /(^|\s)--rerun\s+(impl|definition)(?=\s|$)/.exec(clean);
      if (rerun && st.node !== 'verify') {
        const reached = (st.history ?? []).some((h) => h.ms === st.ms && ['test', 'build', 'verify', 'done'].includes(h.to));
        if (reached) return null; // 返工直通（時點①分流判定留痕於 CLI history；verify→done 永不直通）
        return `--rerun 僅限同 ms 返工重走（本 ms 尚未到達 test）——首次推進之老闆決策邊不得以返工直通繞過`;
      }
      return `老闆決策邊：${st.node}→${target}——經老闆授權（sb unlock 引原句）後帶 --boss-ok 推進，或返工直通帶 --rerun（同 ms 曾達 test；SKILL §3）`;
    }
  } catch { /* 非治理工作區 */ }
  return null;
}

// ———— 狀態寫入攔截：把寫入矩陣機械化 ————
// 測試碼（測試慣例路徑）僅 test 段可寫；實作碼（.shiftblame/ 外 repo 檔）
// 白名單＝build（實作段）／ended（PASS 後收尾保鮮）；其餘段對 repo 唯讀（verify 驗收唯讀、done 等待態唯讀）。
// 測試不可變性由 git 承擔；Bash 內寫檔不在此層（殘餘；shell 漂移由 verify 邊樹檢查兜底）。

const IMPL_WRITE_NODES = new Set(['build', 'ended']);
// 測試碼認定：真實測試「目錄」或副檔名慣例——不含 _test_ 中綴（避免 src/test_utils.js 誤判）
const TEST_PATH_RE = /(^|\/)(tests?|__tests__|spec)\//i;
const TEST_FILE_RE = /\.(test|spec)\.[A-Za-z0-9]+$|(^|\/)[A-Za-z0-9._-]+_test\.[A-Za-z0-9]+$/i;
// 寫檔類工具名（含刪／搬／更名／雙用途 manage/put）；明顯讀取類豁免（不攔唯讀）
const WRITE_TOOL_RE = /write|edit|patch|save|create|apply|delete|remove|move|rename|truncate|put|manage|store|upload|set_|update/i;
const READ_EXEMPT_RE = /read|list|search|stat|exists|get|query|fetch|browse|tree|info|show|find|screenshot|cursor|mouse|key\b|scroll|click/i;

const nodeOf = (root) => {
  try { return JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8')).node ?? null; }
  catch { return null; }
};

// 路徑正規化：剝 `\\?\`／`\\?\UNC\` 裝置前綴（防 relative() 失效全繞）；Win32 尾端點與尾空白；
// 已存在路徑解析 realpath（防 junction／短名偽裝）
function canonicalPath(p) {
  let s = p.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/i, '');
  s = s.split(/[\\/]/).map((seg) => seg.replace(/[. ]+$/, '')).join('/');
  try {
    if (existsSync(s)) return realpathSync(s);
  } catch { /* 不存在＝新建檔，用字面正規化結果 */ }
  return s;
}

function checkStateWriteMatrix(root, toolInput) {
  if (!root) return null;
  // 抽取所有路徑類鍵（蛇形與駝峰；uri 去除 scheme）——逐一生效，防 decoy 鍵欺騙
  const keys = ['file_path', 'path', 'filename', 'target', 'file', 'filePath', 'abs_path', 'destination', 'dest'];
  const targets = [];
  for (const k of keys) {
    const v = toolInput?.[k];
    if (typeof v === 'string' && v.trim() && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) targets.push(v);
  }
  if (typeof toolInput?.uri === 'string' && /^file:/i.test(toolInput.uri)) targets.push(toolInput.uri.replace(/^file:\/\//i, ''));
  if (!targets.length) return null; // 無可辨識路徑：不猜測
  const norm = (x) => { try { return resolve(canonicalPath(x)).toLowerCase(); } catch { return String(x).toLowerCase(); } };
  const rootNorm = norm(root);
  const node = nodeOf(root);
  if (!node) return null; // 非治理工作區（無狀態檔）
  for (const target of targets) {
    const p = canonicalPath(isAbsolute(target) ? target : resolve(root, target));
    const rel = relative(root, p).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue; // 專案外：不歸此矩陣管
    if (rel === '.shiftblame' || rel.startsWith('.shiftblame/')) continue; // 工作區永遠可寫
    const isTest = TEST_PATH_RE.test(rel) || TEST_FILE_RE.test(rel);
    if (isTest) {
      if (node !== 'test') return `[shiftblame] 測試碼（${rel}）已定稿——段 ${node} 不得修改測試；重修回 test 段（或任意→intent 重走）後建立新 commit（SKILL 寫入矩陣）`;
    } else if (!IMPL_WRITE_NODES.has(node)) {
      return `[shiftblame] 段 ${node} 對 repo 實作檔（${rel}）唯讀——實作寫入限 build 段（ended 態收尾保鮮）；回 intent 重走或 done→test 重修後才可寫（SKILL 寫入矩陣）`;
    }
  }
  return null;
}

// ———— 破壞性命令防護：相對路徑＋遞迴刪除／覆蓋＝錯誤資料夾摧毀組合 ————

// 絕對＝完整錨定。~ 與 $HOME 不再視為錨定（~/.. 可鑽出 home）；根目錄本身（/、C:\）即令絕對也拒
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
  const scriptPath = resolve(root ?? process.cwd(), m[2]);
  const scriptRel = relative(root ?? process.cwd(), scriptPath).replace(/\\/g, '/');
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

const normPath = (p) => { try { return resolve(String(p)).toLowerCase(); } catch { return String(p).toLowerCase(); } };

// 暫存不入庫：不解析 git add 的 pathspec（相對路徑/./萬用/絕對——命令字串解析永遠追不上 git 展開規則），
// 讀 git 自己展開後的事實清單（diff --cached --name-only，輸出相對 repo root）比對禁入模式。
// tmp/＝repo 根暫存傾倒區（含根層名為 tmp 的檔案）；.shiftblame/＝流程本地檔（含其 tmp）全程不追蹤——MUST gitignore。
// 大小寫不敏感（Windows 檔案系統 TMP/ 同目錄）；quotePath=false（CJK 檔名不引號逃逸）；
// --diff-filter=ACMRTUB——純刪除（D）放行：git rm --cached 的清理 commit 是唯一合法減少通道。
const STAGED_BAN_RE = /^(?:tmp|\.shiftblame)(?:\/|$)/i;
function checkStaged(root) {
  if (!root) return null;
  try {
    const out = execFileSync('git', ['-C', root, '-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--diff-filter=ACMRTUB'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const hits = out.split('\n').map((l) => l.trim()).filter(Boolean).filter((p) => STAGED_BAN_RE.test(p));
    if (hits.length) return `暫存目錄不得入庫——staged 含 ${hits.slice(0, 5).join('、')}${hits.length > 5 ? ` 等 ${hits.length} 檔` : ''}（tmp/ 與 .shiftblame/ MUST gitignore；先 git restore --staged 移除再提交）`;
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

// git alias 定義禁止：alias 可把 commit 包進無「commit」字樣的子命令，繞過印章／對抗／staged／commit-time 四閘
// （CARD⑥：commit 必過 sb commitmsg）。既有 alias 屬環境事實（SKILL 天花板：老闆抽查 git config --get-regexp ^alias.）。
function checkGitAliasWrite(cmd) {
  if (/\bgit\b[^\n|;&]*\sconfig\b[^\n]*alias\./.test(cmd)) {
    return 'git alias 定義禁止——alias 可包裝 commit 繞過全部 commit 閘（印章／對抗宣告／staged／commit-time）；MUST 使用完整 git 指令';
  }
  return null;
}

function checkCommitStamp(root, seg) {
  const extracted = extractCommitMessage(seg);
  if (extracted.error) return extracted.error;
  // -C 目標（如有）必須絕對且等於印章專案根——印章不得攜帶到其他 repo（限同段）
  const c = seg.match(/(?:^|\s)-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/);
  if (c) {
    const target = c[1] ?? c[2] ?? c[3] ?? '';
    if (!isAbs(target) || normPath(target) !== normPath(root)) {
      return 'git -C 目標與印章專案不符——印章不可攜帶到其他 repo；在目標專案重跑 sb commitmsg，且 -C 使用絕對路徑';
    }
  }
  const stampPath = join(root, '.shiftblame', 'tmp', 'commit-stamp.json');
  if (!existsSync(stampPath)) return '缺少 commit 印章——先跑 sb commitmsg "<訊息>"（SKILL 提交規範）再以相同訊息 commit';
  try {
    const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
    if (!stamp.cwd || !stamp.message || !stamp.issuedAt) return 'commit 印章欄位不全（偽造跡象）——重跑 sb commitmsg';
    if (normPath(stamp.cwd) !== normPath(root)) return 'commit 印章屬於其他專案——在本專案重跑 sb commitmsg';
    const age = Date.now() - new Date(stamp.issuedAt).getTime();
    if (age > STAMP_TTL_MS) return 'commit 印章已逾期（>10 分鐘）——重跑 sb commitmsg "<訊息>"';
    if (age < -60000) return 'commit 印章時間戳在未來——僅接受剛產生的印章，重跑 sb commitmsg';
    if (stamp.message !== extracted.msg) return 'commit 訊息與印章不符——以完全相同的訊息重跑 sb commitmsg 後再 commit';
    // 提交對抗閘（與 sb commitmsg 同判據）：手寫印章檔繞過 commitmsg 的路徑在此補死——
    // 消費印章同時核對 flow-state 對抗宣告（存在且未消費）並一併消費（返工修復至提交必然觸發，CARD⑧）
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    let st = null;
    try { st = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* 無狀態檔 */ }
    if (!st || !st.adversarialAt || st.adversarialConsumed) {
      return '提交前需對抗記錄——外部唯讀子代理對抗、報告落檔後 sb adversarial <報告檔> 宣告（判定須「通過」；印章檔不得繞過對抗閘）';
    }
    st.adversarialConsumed = true;
    writeFileSync(statePath, JSON.stringify(st, null, 2));
    unlinkSync(stampPath); // 一次性消費：一枚印章授權一次 commit，重複 commit 須重新驗證
    return null; // 通過
  } catch { return 'commit 印章無法讀取——重跑 sb commitmsg "<訊息>"'; }
}

const deny = (reason) => { process.stderr.write(`[shiftblame] ${reason}\n`); process.exit(2); };

try {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const event = input.hook_event_name || input.hookEventName || '';
  const root = projectRoot(input);

  if (event === 'SessionStart') {
    // 壓縮後自動注入（compact 來源同走此事件）：靜態卡＋動態狀態卡——壓縮摘要抹掉過程後，
    // 機械事實（段位／鎖態／當前輸入原文與標記／未審引句）立即回流對話，恢復依據檔案非摘要。
    inject(SESSION_CARD + nodeLine(root) + inputLine(root) + unlockReviewLine(root, false));
  }

  if (event === 'UserPromptSubmit') {
    handleBossInput(root, input.prompt ?? ''); // 對話鎖＋機械過濾（覆蓋式當前輸入＋候選標記）
    inject(CARD + nodeLine(root) + inputLine(root) + unlockReviewLine(root)); // 過濾產物回流＋解鎖引句必然曝光
  }

  if (event === 'Stop') {
    // agent 回合結束輸出含〔待確認〕→上鎖（執行中呈現新決策；平台未提供輸出文本時靜默跳過）
    const texts = (v) => { // 遞迴攤平字串／陣列／{content|text} 嵌套為字串陣列（blocks 形平台）
      if (typeof v === 'string') return [v];
      if (Array.isArray(v)) return v.flatMap(texts);
      if (v && typeof v === 'object') return texts(v.content ?? v.text ?? '');
      return [];
    };
    const msgs = [].concat(input.messages ?? []).map(texts).filter((parts) => parts.join('').trim());
    const last = texts(input.last_message ?? input.lastMessage ?? msgs.at(-1) ?? []).join('');
    if (root && typeof last === 'string' && last.includes('〔待確認〕')) {
      try {
        const p = join(root, '.shiftblame', 'flow-state.json');
        if (existsSync(p)) {
          const st = JSON.parse(readFileSync(p, 'utf8'));
          st.dialogueLock = true;
          writeFileSync(p, JSON.stringify(st, null, 2));
        }
      } catch { /* 靜默 */ }
    }
    process.exit(0);
  }

  if (event === 'PreToolUse') {
    const tool = input.tool_name || input.toolName || '';
    const cmd = typeof input.tool_input?.command === 'string' ? input.tool_input.command : '';
    if (/^(bash|shell|execute_bash|execute_bash_command)$/i.test(tool)) {
      // 解鎖通道放行僅限「單體」sb unlock 命令：整條命令按 \n ; & | 切段後必須恰一段，
      // 且該段以 node …sb.mjs unlock / sb unlock 開頭——註解、字串內嵌、&&/;/| 借道全擋；
      // 命令代入（$()／反引號／<()／>()——shell 在命令查找前展開）與冒名路徑（.shiftblame 髒區、
      // 非 sb.mjs 檔名）同為非單體，擋（SKILL 天花板：非 .shiftblame 冒名 sb.mjs 屬殘餘，曝光承擔）
      const unlockSegs = cmd.split(/[\n;&|]/).map((s) => s.trim()).filter(Boolean);
      const isUnlockCmd = unlockSegs.length === 1
        && !/[$]\(|`|<\(|>\(/.test(unlockSegs[0])
        && /^(?:node\s+(?!\S*\.shiftblame)\S*[\\/]sb\.mjs|sb)\s+unlock\b/.test(unlockSegs[0]);
      // 對話鎖最高優先：鎖定期間 Bash 全擋（唯讀研究用平台讀檔工具；sb unlock 除外——否則死鎖）
      if (!isUnlockCmd) {
        const lock = checkDialogueLock(root);
        if (lock) deny(lock);
      }
      // 層間停靠雙重鎖（繞過 checkpoint 進實作層）
      const stopover = checkLayerStopover(root, cmd);
      if (stopover) deny(stopover);
      // git alias 定義禁止（alias 可包裝 commit 繞過四閘）
      const aliasWrite = checkGitAliasWrite(cmd);
      if (aliasWrite) deny(aliasWrite);
      // 先擋破壞性＋相對路徑（含行內各語言刪除 API 與直跑腳本檔掃描）
      const destructive = scanInlineDestructive(cmd);
      if (destructive) deny(destructive);
      const script = root ? scanScriptFile(cmd, root) : null;
      if (script?.deny) deny(script.deny);
      if (script?.warn) inject(script.warn);
      // 分段印章閘：每個含 git+commit 的段逐一驗（無字窗；段外旗標不干擾）
      const segs = commitSegments(cmd);
      for (const seg of segs) {
        if (!root) process.exit(0); // 無絕對錨定可用：不猜測，交由其他層
        // commit-time 暫存繞過（-a/--only/pathspec）先擋——diff --cached 看不見提交期展開
        const cts = checkCommitTimeStaging(seg);
        if (cts) deny(cts);
        // 暫存不入庫（staged 事實清單）先擋——髒內容不得燒掉印章消費
        const staged = checkStaged(root);
        if (staged) deny(staged);
        const reason = checkCommitStamp(root, seg);
        if (reason) deny(reason);
      }
      process.exit(0); // 各段通過：靜默放行
    }
    if (WRITE_TOOL_RE.test(tool) && !READ_EXEMPT_RE.test(tool)) {
      // 對話鎖最高優先：鎖定期間一切寫入擋（含 .shiftblame 內——未授權內容不得落任何檔）
      const lock = checkDialogueLock(root);
      if (lock) deny(lock);
      // 狀態寫入矩陣：段越界寫檔即擋（含 MCP 寫檔／刪搬類工具；decoy 鍵逐一生效）
      const matrix = checkStateWriteMatrix(root, input.tool_input ?? {});
      if (matrix) deny(matrix);
      // 提醒比對只認路徑鍵（防 content 字串誤觸）；verify 報告逐鍵精確匹配
      const pathKeys = ['file_path', 'path', 'filename', 'target', 'file', 'filePath', 'abs_path', 'destination', 'dest'];
      const pathStr = pathKeys.map((k) => input.tool_input?.[k]).filter((v) => typeof v === 'string').join(' ');
      const isVerify = /(^|[\\/])verify-[^\\/]+\.md($|\s)/i.test(pathStr) && !/(^|[\\/])review-verify-/i.test(pathStr);
      if (/SKILL\.md|hooks[\\/]|package\.json|plugin\.json|marketplace\.json/i.test(pathStr)) {
        inject(/[\\/](package|plugin|marketplace)\.json/i.test(pathStr)
          ? '[shiftblame] 版號屬老闆決策——版本欄位僅在老闆明確指示版號後才可改動（SKILL §2）；其他修正照授權範圍執行。'
          : '[shiftblame] 你正在修改框架文件（skills／hooks）——框架演化屬語義變更：MUST 先意圖揭露經老闆確認並說「開工」後才可執行（令行靜止）；已授權則照授權範圍執行。');
      } else if (isVerify) {
        inject('[shiftblame] verify 報告 MUST 含 ## 人話 段——做了什麼／修了什麼／改了什麼（問題來源→處置→結果的因果鏈）；七判準任一不合格即判決不通過（SKILL §3 人話三時點③）。');
      }
      process.exit(0);
    }
    process.exit(0);
  }

  process.exit(0); // 未知事件：靜默放行
} catch {
  process.exit(0); // 防護損壞不得阻斷工作
}
