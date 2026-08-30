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

import { existsSync, readFileSync, realpathSync, unlinkSync } from 'node:fs';
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
  '①老闆輸入先路由 sb-think 理解後分發，不字面執行；追加語義 steering 走三步序：意圖揭露→文件修正→實作。',
  '②三時點強制對抗（放行前方向／判決前成果／收斂複驗），記錄四段、複核列點綁出處、反向對抗判定。',
  '③驗收不得自寫自測即宣稱通過；commit 必過 sb commitmsg（hooks 已機械硬擋）。',
  '④層內連續、層間停靠；階段完成不是停點。',
].join('\n');

const SESSION_CARD = [
  CARD,
  '',
  '[冷啟動載入（§9）] 依序唯讀：<repo>/.shiftblame/SOP.md → ROADMAP.md → archive/ → 當前 slug（SLUG.md 與目前節點）。載入後 sb-think 的路由提議才有脈絡依據。',
  '[hooks] 本卡由 plugin hooks 機械注入（SessionStart／UserPromptSubmit／PreToolUse）；commit 印章硬擋已啟用，失效時回到文件與 CLI 閘門層。',
].join('\n');

function nodeLine(root) {
  if (!root) return '';
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    if (!existsSync(statePath)) return '';
    const st = JSON.parse(readFileSync(statePath, 'utf8'));
    let hint = '';
    if (st.node === 'release') hint = '——放行簡報揭露後停等老闆確認，推進帶 sb next test --boss-ok（層間 checkpoint）';
    if (st.node === 'plan') hint = '——放行前先備齊對抗方向檢閱與 §10 記錄';
    return `\n[節點] ${st.slug ?? '?'}/${st.ms ?? '?'} @ ${st.node ?? '?'}${hint}——推進必過 sb next 閘門（sb state 查下一步）；G1 契約鎖定中，改 G1 須 sb amend --boss-ok。`;
  } catch { return ''; }
}

// 層間停靠雙重鎖：node=release 時 `sb next test`（含 sb.mjs 形）無 --boss-ok 即擋；註解中的旗標不算
function checkLayerStopover(root, cmd) {
  if (!root) return null;
  const clean = cmd.replace(/#[^\n]*/g, ''); // 剝除註解——# --boss-ok 不構成旗標
  if (!/\bsb(?:\.mjs)?\s+next\s+test\b/.test(clean) || /(^|\s)--boss-ok(?=\s|$)/.test(clean)) return null;
  try {
    const st = JSON.parse(readFileSync(join(root, '.shiftblame', 'flow-state.json'), 'utf8'));
    if (st.node === 'release') return '層間停靠：release→test 是老闆確認點——放行簡報經老闆確認後帶 --boss-ok 推進，不得自行進入實作層（SKILL §11）';
  } catch { /* 非治理工作區 */ }
  return null;
}

// ———— 狀態寫入攔截：把 §1.7 寫入矩陣機械化 ————
// 測試碼（test-lock.json 所列或測試慣例路徑）僅 test 節點可寫；實作碼（.shiftblame/ 外 repo 檔）
// 白名單＝build（實作狀態）／release（direct 微修窗）／pass（收尾保鮮）；其餘節點 repo 唯讀。
// Bash 內寫檔與 MCP 讀取類工具不在此層（殘餘；shell 漂移由 verdict 樹檢查兜底）。

const IMPL_WRITE_NODES = new Set(['build', 'release', 'pass']);
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
  let lockedTests = [];
  try {
    const lock = JSON.parse(readFileSync(join(root, '.shiftblame', 'tmp', 'test-lock.json'), 'utf8'));
    lockedTests = (lock.entries ?? []).map((e) => e.file);
  } catch { /* 尚無測試鎖定 */ }
  const norm = (x) => { try { return resolve(canonicalPath(x)).toLowerCase(); } catch { return String(x).toLowerCase(); } };
  const lockedNorm = new Set(lockedTests.map(norm));
  const rootNorm = norm(root);
  const node = nodeOf(root);
  if (!node) return null; // 非治理工作區（無狀態檔）
  for (const target of targets) {
    const p = canonicalPath(isAbsolute(target) ? target : resolve(root, target));
    const rel = relative(root, p).replace(/\\/g, '/');
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) continue; // 專案外：不歸此矩陣管
    if (rel === '.shiftblame' || rel.startsWith('.shiftblame/')) continue; // 工作區永遠可寫
    const isTest = lockedNorm.has(resolve(p).toLowerCase()) || TEST_PATH_RE.test(rel) || TEST_FILE_RE.test(rel);
    if (isTest) {
      if (node !== 'test') return `[shiftblame] 測試碼（${rel}）已鎖定——節點 ${node} 不得修改測試；顯式回測試狀態須經 verdict→test 回邊並附定義錯誤理由（SKILL §1.7 寫入矩陣）`;
    } else if (!IMPL_WRITE_NODES.has(node)) {
      return `[shiftblame] 節點 ${node} 對 repo 實作檔（${rel}）唯讀——實作寫入限 build 狀態（或 release 之 direct 微修、pass 收尾保鮮）（SKILL §1.7 寫入矩陣）`;
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
  if (!existsSync(stampPath)) return '缺少 commit 印章——先跑 sb commitmsg "<訊息>"（sb-commit 流程，SKILL §7）再以相同訊息 commit';
  try {
    const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
    if (!stamp.cwd || !stamp.message || !stamp.issuedAt) return 'commit 印章欄位不全（偽造跡象）——重跑 sb commitmsg';
    if (normPath(stamp.cwd) !== normPath(root)) return 'commit 印章屬於其他專案——在本專案重跑 sb commitmsg';
    const age = Date.now() - new Date(stamp.issuedAt).getTime();
    if (age > STAMP_TTL_MS) return 'commit 印章已逾期（>10 分鐘）——重跑 sb commitmsg "<訊息>"';
    if (age < -60000) return 'commit 印章時間戳在未來——僅接受剛產生的印章，重跑 sb commitmsg';
    if (stamp.message !== extracted.msg) return 'commit 訊息與印章不符——以完全相同的訊息重跑 sb commitmsg 後再 commit';
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
    inject(SESSION_CARD);
  }

  if (event === 'UserPromptSubmit') {
    inject(CARD + nodeLine(root));
  }

  if (event === 'PreToolUse') {
    const tool = input.tool_name || input.toolName || '';
    const cmd = typeof input.tool_input?.command === 'string' ? input.tool_input.command : '';
    if (/^bash$/i.test(tool)) {
      // 層間停靠雙重鎖（先於其他檢查：繞過 checkpoint 進實作層是最高優先攔截）
      const stopover = checkLayerStopover(root, cmd);
      if (stopover) deny(stopover);
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
        const reason = checkCommitStamp(root, seg);
        if (reason) deny(reason);
      }
      process.exit(0); // 各段通過：靜默放行
    }
    if (WRITE_TOOL_RE.test(tool) && !READ_EXEMPT_RE.test(tool)) {
      // 狀態寫入矩陣優先：節點越界寫檔即擋（含 MCP 寫檔／刪搬類工具；decoy 鍵逐一生效）
      const matrix = checkStateWriteMatrix(root, input.tool_input ?? {});
      if (matrix) deny(matrix);
      const detail = JSON.stringify(input.tool_input ?? {});
      if (/SKILL\.md|hooks[\\/]/.test(detail)) {
        inject('[shiftblame] 你正在修改框架文件（skills／hooks）——框架演化屬語義變更：若尚未經老闆確認，MUST 先意圖揭露取得授權，並依三步序 文件修正→實作 推進（SKILL §2）；已授權則照授權範圍執行。');
      } else if (/direct-change\.md/.test(detail)) {
        inject('[shiftblame] direct-change.md 的 來源= 僅限 agent 自行循環發現的微修可宣告——老闆發現的意圖不豁免，回 sb-think 意圖路由；虛報來源屬造假。');
      } else if (/commit-stamp\.json/.test(detail)) {
        inject('[shiftblame] commit-stamp.json 僅由 sb commitmsg 產生——手寫印章屬偽造（SKILL §1.8），將於外部審計暴露。');
      }
      process.exit(0);
    }
    process.exit(0);
  }

  process.exit(0); // 未知事件：靜默放行
} catch {
  process.exit(0); // 防護損壞不得阻斷工作
}
