#!/usr/bin/env node
// Workflow hooks validate concrete boundaries; semantic decisions remain with the agent.

import { existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { readFlowState, unchangedG1Approval } from '../cli/bin/flow-state.mjs';

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

// additionalContext 使用實際事件名稱；只輸出宿主 schema 支援的事件。
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
  // 所有目標以平台提供且存在的絕對 cwd 錨定。
  return typeof c === 'string' && isAbsolute(c) && existsSync(c) ? c : null;
};

const CARD = [
  '[shiftblame]',
  '依使用者目標與既有授權完成工作；只有實質需求或授權差異才確認。',
  '活動 slug 保留 G1 契約、兩時點獨立審查與使用者判定；技術修復自主續行。',
  '保護使用者變更，以真實結果驗收；未驗如實揭露。細節按需讀取主技能。',
].join('\n');
function nodeLine(root) {
  if (!root) return '';
  const health=readFlowState(root);
  if (health.kind==='invalid') return '\n[接入異常] 保留原資料，修復後執行 sb state；提交及流程推進保持封閉。';
  const st=health.state;
  return health.kind==='active' ? '\n[段] '+st.slug+'/'+st.ms+' @ '+st.node : '\n[接入] '+health.kind+'；依既有授權工作。';
}
// Counts record attempted calls only. They never infer progress or prohibit retries.
function countUsage(root) {
  if (!root) return;
  const statePath=join(root,'.shiftblame','flow-state.json');
  if (!existsSync(statePath)) return;
  try {
    const st=readFlowState(root).state;
    const now=new Date().toISOString();
    st.turnUsage={startedAt:st.turnUsage?.startedAt??now,requests:(st.turnUsage?.requests??0)+1};
    st.usageTotals={firstAt:st.usageTotals?.firstAt??now,requests:(st.usageTotals?.requests??0)+1};
    writeFileSync(statePath,JSON.stringify(st,null,2));
  } catch { /* Observability must not block work. */ }
}
function recordInput(root) {
  if (!root) return;
  const statePath=join(root,'.shiftblame','flow-state.json');
  if (!existsSync(statePath)) return;
  try {
    const st=readFlowState(root).state;
    delete st.turnUsage;
    writeFileSync(statePath,JSON.stringify(st,null,2));
  } catch { /* Invalid state is preserved for recovery. */ }
}

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
    if (st.node === 'requirement' && target === 'research' && unchangedG1Approval(root, st)) return null;
    if (edge && edge === target) {
      return `老闆決策邊：${st.node}→${target}——--boss-ok 旗標即章（老闆實際輸入由對話承載，機械不驗時戳；語義授權由 think 揭露＋老闆終審承擔），對抗條目不替代老闆章；時點對抗在前、老闆判定在後——pass 才帶 --boss-ok 推進，缺老闆決策即在決策邊停等（回覆說明待決——對話承載，SKILL §3）`;
    }
  } catch { /* 非治理工作區 */ }
  return null;
}

// Tool capabilities are classified by the final action, never provider substrings.
const WRITE_TOOL_RE = /write|edit|patch|save|create|apply|delete|remove|move|rename|truncate|put|manage|store|upload|set_|update/i;
const READ_ACTION_RE = /^(?:read|list|search|stat|exists|get|query|fetch|browse|tree|info|show|find|screenshot)(?:_|$)/i;
const isWriteTool=tool=>{const action=String(tool).split(/__|\./).at(-1);return WRITE_TOOL_RE.test(action)&&!READ_ACTION_RE.test(action);};
const nodeOf = root => readFlowState(root).state?.node ?? null;
const SHELL_TOOL_RE = /^(?:(?:functions|tools)[._])?(?:bash|shell|execute_bash|execute_bash_command|exec_command)$/i;
const PATH_KEYS = ['file_path','path','filename','target','file','filePath','abs_path','destination','dest','new_path','to'];

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
  if (isWriteTool(tool)) {
    const targets = healthWriteTargets(input);
    return targets.length && targets.every(p => recoveryTarget(root, p)) ? null : blocked;
  }
  return null;
}

function checkStateWriteMatrix(root, toolInput) {
  if (!root || !['verify', 'done'].includes(nodeOf(root))) return null;
  for (const target of healthWriteTargets(toolInput)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(target)) continue;
    const rel=relative(root,absPath(root,target)).replace(/\\/g,'/');
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || rel==='.shiftblame' || rel.startsWith('.shiftblame/')) continue;
    // Untracked ignored outputs are outside the versioned acceptance source.
    // A tracked file remains protected even when an ignore rule matches it.
    if (!/^\.git(?:\/|$)/i.test(rel)) {
      const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', '--', rel], { timeout: 5000 });
      const tracked = spawnSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', rel], { timeout: 5000 });
      if (ignored.status === 0 && tracked.status === 1) continue;
    }
    return '驗收來源保持穩定（'+rel+'）；需修改來源時先回實作，再重驗受影響結果。';
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
  const TEST_PATH_RE = /(^|\/)(tests?|__tests__|spec)\//i;
  const TEST_FILE_RE = /\.(test|spec)\.[A-Za-z0-9]+$|(^|\/)[A-Za-z0-9._-]+_test\.[A-Za-z0-9]+$/i;
  const m = cmd.match(/(?:^|\s)(?:python3?|py(?:\s+-\d)?|node)\s+(?:-[A-Za-z]+\s+)*(")?([^"&|;\s]+?\.(?:py|js|mjs|cjs|ts))\1/);
  if (!m) return null;
  if (!root) return null;
  const scriptPath = absPath(root, m[2]); // 以平台提供的 repo root 展開
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
  // Permit a standalone read; compound commands still receive the full scan.
  if (/^\s*git\s+config\s+(?:(?:--local|--global|--system|--show-origin|--show-scope)\s+)*(?:--get|--get-all|--get-regexp)\s+(?:[A-Za-z0-9_.^$*?\\-]+|"[A-Za-z0-9_.^$*?\\-]+"|'[A-Za-z0-9_.^$*?\\-]+')\s*$/.test(cmd)) return null;
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
  const stampPath = join(root, '.shiftblame', 'tmp', 'commit-stamp.json');
  if (!existsSync(stampPath)) return '缺少 commit 印章——在本次提交的錨定專案（git -C 有目標時＝該目標 repo）跑 sb commitmsg "<訊息>"，再以相同訊息 commit';
  try {
    const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
    if (!stamp.cwd || !stamp.message || !stamp.issuedAt) return 'commit 印章欄位不全（偽造跡象）——重跑 sb commitmsg';
    if (!isAbs(stamp.cwd)) return 'commit 印章 cwd 非絕對——重跑 sb commitmsg（合法章 cwd 恆為絕對 ROOT）';
    if (normPath(root, stamp.cwd) !== normPath(root, root)) return 'commit 印章屬於其他專案——印章綁定提交錨點 repo；在本次 commit 的錨定專案（-C 目標或 hook cwd）重跑 sb commitmsg';
    const age = Date.now() - new Date(stamp.issuedAt).getTime();
    if (age > STAMP_TTL_MS) return 'commit 印章已逾期（>10 分鐘）——重跑 sb commitmsg "<訊息>"';
    if (age < -60000) return 'commit 印章時間戳在未來——僅接受剛產生的印章，重跑 sb commitmsg';
    if (stamp.message !== extracted.msg) return 'commit 訊息與印章不符——以完全相同的訊息重跑 sb commitmsg 後再 commit';
    // 提交印章核對 repo、訊息與時效；審查及授權另由正式流程承載
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    let st = null;
    try { st = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* 無狀態檔 */ }
    if (['verify', 'done'].includes(st?.node)) return '驗收段對 repo 唯讀——不得提交';
    unlinkSync(stampPath); // 一次性消費：一枚印章授權一次 commit，重複 commit 須重新驗證
    return null; // 通過
  } catch { return 'commit 印章無法讀取——重跑 sb commitmsg "<訊息>"'; }
}

// A heartbeat records that the hook ran, not that an operation succeeded.
function beatHeartbeat(root, event) {
  if (!root || !existsSync(join(root, '.shiftblame'))) return; // 守門：僅既有工作區寫心跳（流浪 cwd 保持原樣——框架元規則）
  try {
    const statePath = join(root, '.shiftblame', 'flow-state.json');
    const st = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
    st.hooksHeartbeat = { at: new Date().toISOString(), event };
    writeFileSync(statePath, JSON.stringify(st, null, 2));
  } catch { /* 心跳失敗不影響主流程 */ }
}

// 授權與對話事實由平台承載；狀態修復後核對原對話。

const deny = (reason) => { process.stderr.write(`[shiftblame] ${reason}\n`); process.exit(2); };

try {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const event = input.hook_event_name || input.hookEventName || '';
  const root = projectRoot(input);
  const healthy = !root || readFlowState(root).kind !== 'invalid';
  // 異常原檔保持原樣，健康狀態確認後才更新心跳。
  if (healthy) beatHeartbeat(root, event);

  if (event === 'SessionStart') {
    // 壓縮後自動注入（compact 來源同走此事件）：靜態卡＋動態狀態卡——壓縮摘要抹掉過程後，
    // 機械事實（段位／審查戳記）立即回流對話，恢復依據檔案非摘要。
    inject(CARD + nodeLine(root), 'SessionStart');
  }

  if (event === 'UserPromptSubmit') {
    if (healthy) recordInput(root);
    inject(nodeLine(root), 'UserPromptSubmit');
  }
  if (event === 'Stop') process.exit(0);

  if (event === 'PreToolUse') {
    const tool = input.tool_name || input.toolName || '';
    const cmd = typeof input.tool_input?.command === 'string' ? input.tool_input.command : typeof input.tool_input?.cmd === 'string' ? input.tool_input.cmd : '';
    const healthError = checkStateHealth(root, tool, cmd, input.tool_input ?? {});
    if (healthError) deny(healthError);
    if (healthy) countUsage(root);
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
      if (script?.warn) inject(script.warn, 'PreToolUse');
      process.exit(0); // 各段通過：靜默放行
    }
    if (isWriteTool(tool)) {
      const matrix=checkStateWriteMatrix(root,input.tool_input??{});
      if (matrix) deny(matrix);
    }
    process.exit(0);
  }

  process.exit(0); // 未知事件：靜默放行
} catch {
  process.exit(0); // 防護損壞時保持工作暢通
}
