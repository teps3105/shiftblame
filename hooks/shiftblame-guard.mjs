#!/usr/bin/env node
// Workflow hooks validate concrete boundaries; semantic decisions remain with the agent.

import { existsSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { objectRecord, readFlowState, unchangedG1Approval } from '../cli/bin/flow-state.mjs';
import { analyzeCommand, baseName, findRoots, gitInvocation, MAX_DEPTH } from './shell-scan.mjs';

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
const emit = (text, event) => {
  if (!text || !HOOK_EVENTS.includes(event)) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
};

// 專案根：由平台提供的絕對 cwd 往上找 .git 或 .shiftblame（與 sb 的 findRoot 一致）；找不到時以 cwd 本身為根。
function findProjectRoot(start) {
  for (let dir = start; ;) {
    if (existsSync(join(dir, '.git')) || existsSync(join(dir, '.shiftblame'))) return dir;
    const up = dirname(dir);
    if (up === dir) return start;
    dir = up;
  }
}
const inputCwd = (input) => {
  const c = input.cwd;
  return typeof c === 'string' && isAbsolute(c) && existsSync(c) ? c : null;
};

const CARD = [
  '[shiftblame]',
  '依使用者目標與既有授權完成工作；只有實質需求或授權差異才確認。',
  '活動 slug 保留 G1 契約、兩時點獨立審查與使用者判定；技術修復自主續行。',
  '保護使用者變更，以真實結果驗收；未驗如實揭露。細節按需讀取主技能。',
].join('\n');
// 兩時點的獨立審查與使用者判定進行時，代理可先行研究；判定不等研究，研究也不推進流程。
const EARLY_RESEARCH = {
  requirement: '｜時點 1 審查／判定期間可先行研究：唯讀查證、tmp 筆記、隔離原型；不推進、不改 G1、不提交',
  verify: '｜時點 2 審查／判定期間可先行研究：唯讀查證、tmp 筆記、隔離原型；不推進、不改受驗來源、不提交',
};
function nodeLine(health) {
  if (!health) return '';
  if (health.kind === 'invalid') return '\n[接入異常] 保留原資料，修復後執行 sb state；提交及流程推進保持封閉。';
  const st = health.state;
  return health.kind === 'active' ? '\n[段] ' + st.slug + '/' + st.ms + ' @ ' + st.node + (EARLY_RESEARCH[st.node] ?? '') : '\n[接入] ' + health.kind + '；依既有授權工作。';
}

// ———— 紀錄：心跳與使用計數（只寫 hooks 自己的欄位；異常原檔保持原樣） ————

const RECORD_EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop']);
// 先寫同目錄暫存檔再改名，讀取端不會讀到寫到一半的狀態；改名失敗（檔案被鎖）時退回直接寫入。
function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, file);
  } catch {
    try { unlinkSync(tmp); } catch { /* 暫存檔可能未建立 */ }
    writeFileSync(file, text);
  }
}
// Counts record attempted calls only. They never infer progress or prohibit retries.
function record(root, event) {
  if (!root || !RECORD_EVENTS.has(event) || !existsSync(join(root, '.shiftblame'))) return; // 流浪 cwd 不建工作區
  try {
    const health = readFlowState(root); // 決策後重讀，縮小與並行寫入者的競爭窗口
    if (health.kind === 'invalid') return;
    const st = objectRecord(health.state) ? health.state : {};
    const now = new Date().toISOString();
    st.hooksHeartbeat = { at: now, event };
    if (event === 'UserPromptSubmit') delete st.turnUsage;
    if (event === 'PreToolUse') {
      st.turnUsage = { startedAt: st.turnUsage?.startedAt ?? now, requests: (st.turnUsage?.requests ?? 0) + 1 };
      st.usageTotals = { firstAt: st.usageTotals?.firstAt ?? now, requests: (st.usageTotals?.requests ?? 0) + 1 };
    }
    writeAtomic(join(root, '.shiftblame', 'flow-state.json'), JSON.stringify(st, null, 2));
  } catch { /* Observability must not block work. */ }
}

// ———— 路徑 ————

const WIN = process.platform === 'win32';
// Windows 與 macOS 的預設檔案系統不分大小寫：比對系統路徑時先折疊。
const fold = WIN || process.platform === 'darwin' ? (s) => s.toLowerCase() : (s) => s;
// Git Bash 路徑 /c/Users/… 在 Windows 上等於 C:/Users/…。
const msysPath = (p) => (WIN && /^\/[A-Za-z](?:\/|$)/.test(p) ? `${p[1].toUpperCase()}:/${p.slice(3)}` : p);
// 相對路徑以平台提供的 cwd 展開。先剝 `\\?\`／`\\?\UNC\` 裝置前綴並解析 `..`，再去掉各段 Win32 會忽略的尾端點與
// 尾空白後重新解析（`.. ` 會被 Win32 當成 `..`）；最近的既有上層取 realpath，使捷徑與實體路徑比對一致。
function absPath(base, p) {
  const s = msysPath(String(p)).replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/i, '');
  const first = resolve(msysPath(base), s);
  const trimmed = resolve(first.split(/[\\/]/).map((seg, i) => (i ? seg.replace(/[. ]+$/, '') || seg.replace(/ +$/, '') : seg)).join('/'));
  const rest = [];
  for (let dir = trimmed; ;) {
    try {
      if (existsSync(dir)) return rest.length ? join(realpathSync(dir), ...rest.reverse()) : realpathSync(dir);
    } catch { /* 無法解析時用字面結果 */ }
    const up = dirname(dir);
    if (up === dir) return trimmed;
    rest.push(basename(dir));
    dir = up;
  }
}
const relTo = (root, abs) => relative(absPath(root, root), abs).replace(/\\/g, '/');
const normPath = (base, p) => { try { return fold(absPath(base, String(p))); } catch { return fold(String(p)); } };
const systemRel = (rel) => { const r = fold(rel); return r === '.shiftblame' || r.startsWith('.shiftblame/'); };

// 絕對＝完整錨定；~ 與 $HOME 不視為錨定。根目錄本身（/、C:\、/c）即使是絕對路徑也視同未錨定。
const ABS_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/;
const ROOT_LIKE = /^(?:[\\/]+\*?|[A-Za-z]:[\\/]*\*?|\/[A-Za-z]\/?\*?)$/;
const isAbs = (p) => { const s = String(p).trim(); return ABS_PATH.test(s) && !ROOT_LIKE.test(s); };
// 含變數或命令替換的字詞以其前方字面部分判斷錨定：/tmp/$x 已錨定，$HOME/x 與 /$x 未錨定。
const literalHead = (w) => (w.dynamic ? w.value.split(/[$`]|%[A-Za-z_]/)[0] : w.value);
const anchoredWord = (w) => isAbs(literalHead(w));
const rootLikeWord = (w) => !w.dynamic && ROOT_LIKE.test(w.value.trim());

// ———— 狀態與寫入矩陣 ————

// Tool capabilities are classified by the final action, never provider substrings.
const WRITE_TOOL_RE = /write|edit|patch|save|create|apply|delete|remove|move|rename|truncate|put|manage|store|upload|set_|update/i;
const READ_ACTION_RE = /^(?:read|list|search|stat|exists|get|query|fetch|browse|tree|info|show|find|screenshot)(?:_|$)/i;
const isWriteTool = (tool) => { const action = String(tool).split(/__|\./).at(-1); return WRITE_TOOL_RE.test(action) && !READ_ACTION_RE.test(action); };
const SHELL_TOOL_RE = /^(?:(?:functions|tools)[._])?(?:bash|shell|powershell|pwsh|execute_bash|execute_bash_command|exec_command)$/i;
const PATH_KEYS = ['file_path', 'path', 'filename', 'target', 'file', 'filePath', 'notebook_path', 'abs_path', 'destination', 'dest', 'new_path', 'to'];

function healthWriteTargets(input) {
  const targets = PATH_KEYS.map((k) => input?.[k]).filter((v) => typeof v === 'string' && v.trim());
  if (typeof input?.uri === 'string' && /^file:/i.test(input.uri)) targets.push(input.uri.replace(/^file:\/\//i, ''));
  const patch = typeof input === 'string' ? input : input?.patch ?? input?.input;
  if (typeof patch === 'string') for (const m of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)) targets.push(m[1].trim());
  return targets;
}
function recoveryTarget(ctx, target) {
  const rel = fold(relTo(ctx.root, absPath(ctx.cwd, target)));
  return rel === '.shiftblame/flow-state.json' || rel.startsWith('.shiftblame/tmp/');
}
// 接入異常時封閉會消費或惡化異常狀態的動作：git 寫入與 sb 流程命令；唯讀診斷與狀態修復照常。
const HOLD_GIT_SUBS = new Set(['add', 'commit', 'restore', 'reset', 'checkout', 'switch', 'clean', 'push', 'pull', 'fetch', 'merge', 'rebase', 'tag', 'rm', 'mv', 'stash', 'cherry-pick', 'revert', 'apply', 'am', 'init', 'branch', 'worktree', 'clone', 'submodule', 'update-ref', 'symbolic-ref', 'filter-branch', 'notes', 'reflog', 'gc', 'prune', 'update-index', 'read-tree', 'write-tree', 'hash-object', 'mktag', 'fast-import']);
const HOLD_GIT_WRITE_RE = new RegExp(`\\bgit(?:\\.exe)?\\b[\\s\\S]*\\b(?:${[...HOLD_GIT_SUBS].join('|')})\\b`, 'i');
const HOLD_SB_SUBS = new Set(['init', 'next', 'end', 'adversarial', 'commitmsg', 'sopreview', 'closeout']);
const HOLD_SB_RE = /\bsb(?:\.mjs)?\s+(?:init|next|end|adversarial|commitmsg|sopreview|closeout)\b/;
const HEALTH_BLOCKED = '流程接入異常——正式文件與程式碼寫入、審查宣告及提交暫停；保留原檔。可寫狀態修復（flow-state／tmp）與唯讀診斷，修復後重跑 sb state 查證。';
const HEALTH_HOLD = '流程接入異常——git 寫入與 sb 流程命令暫停（會消費或惡化異常狀態）；唯讀查證、修復腳本與 flow-state／tmp 修復照常，修復後重跑 sb state 查證。';

function checkStateHealth(ctx, tool, input, scan) {
  if (ctx.health?.kind !== 'invalid') return null;
  if (scan) {
    for (const e of scan.entries) {
      if (e.name === 'git') {
        const g = gitInvocation(e.args);
        if (g.sub && (g.sub.dynamic || HOLD_GIT_SUBS.has(g.sub.value.toLowerCase()))) return HEALTH_HOLD;
      }
      const sb = sbSub(e);
      if (sb && HOLD_SB_SUBS.has(sb.sub)) return HEALTH_HOLD;
    }
    if (scan.overflow.some((t) => HOLD_GIT_WRITE_RE.test(t) || HOLD_SB_RE.test(t))) return HEALTH_HOLD;
    return null;
  }
  if (isWriteTool(tool)) {
    const targets = healthWriteTargets(input);
    return targets.length && targets.every((p) => recoveryTarget(ctx, p)) ? null : HEALTH_BLOCKED;
  }
  return null;
}

function checkStateWriteMatrix(ctx, toolInput) {
  if (!['verify', 'done'].includes(ctx.health?.state?.node)) return null;
  for (const target of healthWriteTargets(toolInput)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(target)) continue;
    const rel = relTo(ctx.root, absPath(ctx.cwd, target));
    if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel) || systemRel(rel)) continue;
    // Untracked ignored outputs are outside the versioned acceptance source.
    // A tracked file remains protected even when an ignore rule matches it.
    if (!/^\.git(?:\/|$)/i.test(rel)) {
      const ignored = spawnSync('git', ['-C', ctx.root, 'check-ignore', '-q', '--', rel], { timeout: 5000 });
      const tracked = spawnSync('git', ['-C', ctx.root, 'ls-files', '--error-unmatch', '--', rel], { timeout: 5000 });
      if (ignored.status === 0 && tracked.status === 1) continue;
    }
    return '驗收來源保持穩定（' + rel + '）；需修改來源時先回實作，再重驗受影響結果。';
  }
  return null;
}

// ———— sb 流程命令 ————

// 辨識 sb、sb.mjs、node …/sb.mjs 與 npx sb；回傳子命令與其後參數。
function sbSub(entry) {
  let args = null;
  if (entry.name === 'sb' || entry.name === 'sb.mjs') args = entry.args;
  else if (entry.name === 'node' || entry.name === 'bun' || entry.name === 'deno') {
    for (let i = 0; i < entry.args.length; i++) {
      const v = entry.args[i].value;
      if (['-e', '-p', '--eval', '--print'].includes(v)) return null;
      if (['-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions'].includes(v)) { i++; continue; }
      if (v.startsWith('-') || v === 'run') continue;
      const name = baseName(v);
      if (name === 'sb' || name === 'sb.mjs') args = entry.args.slice(i + 1);
      break;
    }
  }
  if (!args) return null;
  const k = args.findIndex((w) => !w.value.startsWith('-'));
  return k < 0 ? null : { sub: args[k].value, rest: args.slice(k + 1), all: args };
}
// 使用者決策邊（intent→requirement、requirement→research＝時點 1）：`sb next` 需帶 --boss-ok；
// 需求契約已核准且未變時沿用原核准。時點 2 在 verify 出口，旗標由 CLI 驗證。
function checkLayerStopover(ctx, entry) {
  const sb = sbSub(entry);
  if (!sb || sb.sub !== 'next' || ctx.health?.kind !== 'active') return null;
  const target = sb.rest.find((w) => !w.value.startsWith('-'))?.value;
  if (!['requirement', 'research'].includes(target) || sb.all.some((w) => w.value === '--boss-ok')) return null;
  const st = ctx.health.state;
  const edge = { intent: 'requirement', requirement: 'research' }[st.node];
  if (edge !== target) return null;
  if (st.node === 'requirement' && unchangedG1Approval(ctx.root, st)) return null;
  if (st.node === 'intent') return '使用者決策邊（intent→requirement）：使用者確認意圖後，帶 --boss-ok 推進。';
  return '使用者決策邊（requirement→research＝時點 1）：獨立審查通過且使用者判定後，帶 --adversarial --boss-ok 推進。等待期間可先行研究（唯讀查證、tmp 筆記、隔離原型），不推進、不改 G1、不提交；判定前的研究結果不餵給審查者。';
}

// ———— git 設定與路徑重定向 ————

const CONFIG_READ = new Set(['--get', '--get-all', '--get-regexp', '--get-urlmatch', '--get-color', '--get-colorbool', '-l', '--list', '--unset', '--unset-all']);
// alias 可把 commit 包進不含 commit 字樣的子命令，使提交閘全部失效；既有 alias 屬環境事實，不在此攔截。
function checkGitAlias(entries, text) {
  const deny = 'git alias 定義攔截——alias 可包裝 commit 而繞過全部提交檢查；請改用完整 git 指令';
  if (/\bGIT_CONFIG_(?:PARAMETERS|KEY_\d+)\b/i.test(text) && /alias\./i.test(text)) return deny;
  for (const e of entries) {
    if (e.name !== 'git') continue;
    const g = gitInvocation(e.args);
    if ([...g.c, ...g.configEnv].some((v) => /^alias\./i.test(v))) return deny;
    if (g.sub?.value !== 'config') continue;
    const first = g.subArgs.find((w) => !w.value.startsWith('-'))?.value;
    const read = g.subArgs.some((w) => CONFIG_READ.has(w.value)) || ['get', 'list', 'unset'].includes(first);
    if (!read && g.subArgs.some((w) => /^alias\./i.test(w.value))) return deny;
  }
  return null;
}
// git 路徑重定向：GIT_DIR 等環境變數與 --git-dir／--work-tree 會讓 staged 與印章檢查的錨定失效。
// 環境變數以原文掃描（不分大小寫，另以去反斜線副本再掃），全域選項以結構判斷。
const REDIRECT_ENV_RE = /(?:^|[^A-Za-z0-9_])(?:GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE|GIT_OBJECT_DIRECTORY|GIT_CEILING_DIRECTORIES|GIT_COMMON_DIR|GIT_ALTERNATE_OBJECT_DIRECTORIES)\s*=/i;
function checkGitRedirect(entries, text, overflow) {
  const deny = 'git 路徑重定向攔截（GIT_DIR／--git-dir／--work-tree 等，含大小寫與反斜線跳脫形態）——重定向使 staged 與印章檢查的錨定失效；請改用 -C <絕對路徑>';
  if (REDIRECT_ENV_RE.test(text) || REDIRECT_ENV_RE.test(text.replace(/\\/g, ''))) return deny;
  if (entries.some((e) => e.name === 'git' && gitInvocation(e.args).redirect.length)) return deny;
  if (overflow.some((t) => /(?:^|\s)--(?:git-dir|work-tree|index-file|object-dir(?:ectory)?|super-prefix)(?=[\s=])/.test(t))) return deny;
  return null;
}

// ———— 破壞性命令防護：相對路徑＋遞迴刪除／覆蓋＝錯誤資料夾摧毀組合 ————

const DENY_RELATIVE = (what, target) =>
  `破壞性操作（${what}）的目標未以絕對路徑錨定（${target}）——相對路徑或變數會隨執行當下的工作目錄漂移；請改寫為絕對路徑後重試`;
const DENY_ROOT = (target) => `破壞性操作的目標是根目錄（${target}）——一律拒絕；請指明確切的絕對子路徑`;
const targetLabel = (w) => (w ? w.raw || w.value : '未指明');
function checkTargets(what, targets, entry) {
  if (!targets.length) return DENY_RELATIVE(what, '未指明，來自管線或預設目錄');
  for (const t of targets) {
    if (entry?.findExec && t.value.includes('{}')) {
      const bad = entry.findRoots.length ? entry.findRoots.find((r) => !anchoredWord(r)) : { raw: '.' };
      if (bad) return DENY_RELATIVE(`find -exec ${what}`, `搜尋根 ${targetLabel(bad)}`);
      continue;
    }
    if (rootLikeWord(t)) return DENY_ROOT(t.value);
    if (!anchoredWord(t)) return DENY_RELATIVE(what, targetLabel(t));
  }
  return null;
}
const PS_REMOVE = new Set(['remove-item', 'ri', 'rm', 'del', 'erase', 'rd', 'rmdir']);
const WIN_SWITCH = /^\/[A-Za-z?]+(?::.*)?$/;
const PS_PATH_PARAM = /^-(?:p|pa|pat|path|pspath|lp|l|li|lit|lite|liter|litera|literal|literalp|literalpa|literalpat|literalpath)$/i;
const PS_VALUE_PARAM = /^-(?:filter|include|exclude|credential|stream|f|fi|fil|filt|filte|i|in|inc|incl|inclu|includ|e|ex|exc|excl|exclu|exclud|c|cr|cre|cred|crede|creden|credent|credenti|credentia|s|st|str|stre|strea)$/i;
function psRemoveTargets(args) {
  let recursive = false;
  const targets = [];
  for (let i = 0; i < args.length; i++) {
    const w = args[i], v = w.value;
    if (!w.quoted && /^-r/i.test(v)) { if (!/:\s*\$false$/i.test(v)) recursive = true; continue; }
    if (!w.quoted && PS_PATH_PARAM.test(v.replace(/:.*$/, ''))) {
      if (v.includes(':')) targets.push({ ...w, value: v.slice(v.indexOf(':') + 1), raw: v });
      else if (args[i + 1]) { targets.push(args[i + 1]); i++; }
      continue;
    }
    if (!w.quoted && PS_VALUE_PARAM.test(v)) { i++; continue; }
    if (!w.quoted && v.startsWith('-')) continue;
    targets.push(w);
  }
  return { recursive, targets };
}
const RM_LIKE = new Set(['rm', 'rmdir', 'shred', 'unlink']);
function destructiveReason(entry, entries) {
  const { name, args, dialect } = entry;
  if (!name) return null;
  // xargs rm：刪除對象來自管線，只接受同一管線中較早、由絕對根出發的 find。
  if (RM_LIKE.has(name) && entry.stdinArgs && dialect !== 'ps') {
    const at = entries.indexOf(entry);
    const finds = entries.filter((e, k) => k < at && e.name === 'find' && !e.findExec && e.cmd.pipeline === entry.cmd.pipeline);
    const roots = finds.flatMap((f) => { const r = findRoots(f); return r.length ? r : [{ raw: '.', value: '.' }]; });
    const bad = !finds.length ? { raw: '管線上游不是 find' } : roots.find((r) => !anchoredWord(r) || rootLikeWord(r));
    if (bad) return DENY_RELATIVE(`xargs ${name}`, `來源：${targetLabel(bad)}`);
  }
  if (name === 'rm' && dialect !== 'ps') {
    let recursive = false, options = true;
    const targets = [];
    for (const w of args) {
      if (options && w.value === '--') { options = false; continue; }
      if (options && /^-[A-Za-z]+$/.test(w.value)) { if (/[rR]/.test(w.value)) recursive = true; continue; }
      if (options && w.value.startsWith('--')) { if (w.value === '--recursive') recursive = true; continue; }
      targets.push(w);
    }
    if (!recursive || (entry.stdinArgs && !targets.length)) return null;
    return checkTargets('rm -r', targets, entry);
  }
  if (name === 'remove-item' || name === 'ri' || (dialect === 'ps' && PS_REMOVE.has(name))) {
    const { recursive, targets } = psRemoveTargets(args);
    if (recursive) {
      const reason = checkTargets(`${entry.nameWord.value} -Recurse`, targets.filter((w) => !WIN_SWITCH.test(w.value)), entry);
      if (reason) return reason;
    }
  }
  if (['del', 'erase', 'rd', 'rmdir'].includes(name) && args.some((w) => /^\/s$/i.test(w.value))) {
    return checkTargets(`${name} /s`, args.filter((w) => !WIN_SWITCH.test(w.value)), entry);
  }
  if (name === 'find' && args.some((w) => w.value === '-delete' || (/^-(?:exec|execdir|ok|okdir)$/.test(w.value)))) {
    const execRm = args.some((w, i) => /^-(?:exec|execdir|ok|okdir)$/.test(w.value) && ['rm', 'rmdir', 'shred', 'unlink'].includes(baseName(args[i + 1]?.value ?? '')));
    if (args.some((w) => w.value === '-delete') || execRm) {
      const roots = findRoots(entry);
      if (!roots.length) return DENY_RELATIVE('find 遞迴刪除', '未指明搜尋根，預設為 .');
      const bad = roots.find((r) => !anchoredWord(r) || rootLikeWord(r));
      if (bad) return rootLikeWord(bad) ? DENY_ROOT(bad.value) : DENY_RELATIVE('find 遞迴刪除', `搜尋根 ${targetLabel(bad)}`);
    }
  }
  if (name === 'robocopy' && args.some((w) => /^\/(?:mir|purge)$/i.test(w.value))) {
    const positional = args.filter((w) => !WIN_SWITCH.test(w.value));
    const dest = positional[1];
    if (!dest || !anchoredWord(dest)) return DENY_RELATIVE('robocopy /MIR', `目標 ${targetLabel(dest)}`);
  }
  if (name === 'git') {
    const g = gitInvocation(args);
    const sub = g.sub?.value;
    const force = sub === 'clean' && g.subArgs.some((w) => w.value === '--force' || /^-[A-Za-z]*f/.test(w.value));
    const hard = sub === 'reset' && g.subArgs.some((w) => w.value === '--hard');
    if ((force || hard) && !(g.C.length && g.C.every((w) => w && anchoredWord(w)))) {
      return 'git 破壞性操作（clean -f／reset --hard）未以 -C <絕對路徑> 錨定目標 repo——工作目錄漂移就會清掉錯誤的專案；請加上 -C <絕對路徑> 後重試';
    }
  }
  return null;
}
const SINK_RE = /^(?:\/dev\/(?:null|stdout|stderr|tty|fd\/\d+)|nul:?|con|\$null)$/i;
function redirectReason(entry) {
  for (const r of entry.cmd.redirects) {
    if (r.dup || !['>', '>|', '&>'].includes(r.op)) continue; // >> 追加、輸入與 fd 複製不截斷
    const t = r.target;
    if (!t) return DENY_RELATIVE('重定向截斷 >', '缺少目標');
    if (SINK_RE.test(t.value.trim()) || /^[<>]\(/.test(t.raw)) continue;
    if (!anchoredWord(t)) return DENY_RELATIVE('重定向截斷 >', `${targetLabel(t)}；追加用 >>，丟棄輸出用 /dev/null 或 $null`);
  }
  return null;
}

// 直譯器內嵌刪除 API＋相對字面路徑（容許 f-string 前綴；rmtree 涵蓋 from-import 改名後的裸呼叫）。
const INTERPRETER_RE = /^(?:python[\d.]*|py|node|deno|bun)$/;
function inlineApiReason(text) {
  for (const m of text.matchAll(/(?:shutil\.)?\brmtree\(\s*[fFrRbB]?(['"])([^'"]+)\1/g)) {
    if (!isAbs(m[2])) return DENY_RELATIVE('rmtree', m[2]);
  }
  for (const m of text.matchAll(/\.(?:rm|rmdir)(?:Sync)?\s*\(\s*[fFrRbB]?(['"`])([^'"`]+)\1[^)]*recursive/g)) {
    if (!isAbs(m[2])) return DENY_RELATIVE('fs.rm/rmdir(recursive)', m[2]);
  }
  return null;
}
// 直跑腳本檔（python/py/node <file>）：讀檔掃描——遞迴刪除 API＋相對字面路徑＝拒絕；只有 API＝提醒。
const TEST_PATH_RE = /(^|\/)(tests?|__tests__|spec)\//i;
const TEST_FILE_RE = /\.(test|spec)\.[A-Za-z0-9]+$|(^|\/)[A-Za-z0-9._-]+_test\.[A-Za-z0-9]+$/i;
function scriptOf(entry) {
  if (!/^(?:python[\d.]*|py|node)$/.test(entry.name ?? '')) return null;
  const args = entry.args;
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    if (['-c', '-e', '-p', '--eval', '--print', '-m'].includes(v)) return null;
    if (['-X', '-W', '-Q', '-r', '--require', '--import', '--loader', '--experimental-loader', '-C', '--conditions'].includes(v)) { i++; continue; }
    if (v.startsWith('-')) continue;
    return !args[i].dynamic && /\.(?:py|js|mjs|cjs|ts)$/i.test(v) ? v : null;
  }
  return null;
}
function scanScriptFile(ctx, entry) {
  const script = scriptOf(entry);
  if (!script || !ctx.cwd) return null;
  const scriptPath = absPath(ctx.cwd, script);
  const scriptRel = relTo(ctx.root, scriptPath);
  // 測試碼本就含破壞字串 fixtures——測試路徑的腳本免除內容掃描
  if (TEST_PATH_RE.test(scriptRel) || TEST_FILE_RE.test(scriptRel)) return null;
  let text;
  try { text = readFileSync(scriptPath, 'utf-8'); } catch { return null; }
  const hasApi = /(?:shutil\.)?\brmtree\(/.test(text) || /\.(?:rm|rmdir)(?:Sync)?\s*\([^)]*recursive/.test(text);
  if (!hasApi) return null;
  const reason = inlineApiReason(text);
  if (reason) return { deny: `${script} 內${reason}` };
  return { warn: `[shiftblame] ${script} 含遞迴刪除 API（rmtree／fs.rm recursive）——確認路徑以絕對路徑錨定、目標資料夾正確後才執行。` };
}

// ———— 提交閘：-C 錨定、參數白名單、staged 系統檔、印章 ————

// commit 子命令後只允許單一 -m／--message 字面訊息與不改變暫存內容的旗標；-a、--only、pathspec 會在提交時才暫存，
// diff --cached 看不見。
const COMMIT_SAFE_FLAGS = new Set(['-q', '--quiet', '-v', '--verbose', '-n', '--no-verify', '-s', '--signoff', '--no-edit', '--allow-empty', '--amend', '--no-gpg-sign', '--allow-empty-message']);
const MESSAGE_SOURCE = /^(?:-F|--file|-C|-c|--reuse-message|--reedit-message|--fixup|--squash|-t|--template)(?:=|$)|^-[Fct]./;
function commitMessage(subArgs) {
  const msgs = [];
  for (let i = 0; i < subArgs.length; i++) {
    const w = subArgs[i], v = w.value;
    if (v === '-m' || v === '--message') {
      const m = subArgs[i + 1];
      if (!m) return { error: '找不到 -m 訊息——提交訊息須以單一 -m 字面值傳遞，並先執行 sb commitmsg' };
      msgs.push(m); i++; continue;
    }
    if (v.startsWith('--message=')) { msgs.push({ ...w, value: v.slice(10) }); continue; }
    if (/^-m./s.test(v)) { msgs.push({ ...w, value: v.slice(2) }); continue; }
    if (COMMIT_SAFE_FLAGS.has(v)) continue;
    if (MESSAGE_SOURCE.test(v)) return { error: `提交訊息須以單一 -m 字面值傳遞（「${v}」的訊息無法與印章比對）；先執行 sb commitmsg "<訊息>"` };
    return { error: `commit-time 暫存繞過（「${v}」）——commit 子命令後只允許 -m/--message 與安全旗標（-q -v -n -s --no-edit --allow-empty --amend …）；請先以 git add 暫存，再以不帶路徑的 commit 提交` };
  }
  if (!msgs.length) return { error: '找不到 -m 訊息——提交訊息須以單一 -m 字面值傳遞，並先執行 sb commitmsg' };
  if (msgs.length > 1) return { error: '多個 -m 不支援——以單一 -m 傳遞單行訊息，並先執行 sb commitmsg' };
  if (msgs[0].dynamic) return { error: '提交訊息含變數或命令替換，無法與印章比對——請改用字面值' };
  return { msg: msgs[0].value };
}
// staged 不入庫（系統檔）：讀 git 展開後的事實清單；純刪除（D）放行＝git rm --cached 清理通道。
function checkStaged(anchor) {
  try {
    const out = execFileSync('git', ['-C', anchor, '-c', 'core.quotePath=false', 'diff', '--cached', '--name-only', '--diff-filter=ACMRTUB'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    // git 在不分大小寫的系統上保留使用者輸入的大小寫（.SHIFTBLAME/x）：一律折疊後比對。
    const hits = out.split('\n').map((l) => l.trim()).filter(Boolean).filter((p) => {
      const rel = (() => { try { return relTo(anchor, absPath(anchor, p)); } catch { return p; } })();
      return systemRel(rel.toLowerCase());
    });
    if (hits.length) return `系統檔不入庫——staged 含 ${hits.slice(0, 5).join('、')}${hits.length > 5 ? ` 等 ${hits.length} 檔` : ''}（.shiftblame/ 須列入 .gitignore；先 git restore --staged 移除再提交）`;
  } catch { /* git 不可用（非 git repo）→ 印章層照常把關 */ }
  return null;
}
function checkCommitStamp(anchor, msg) {
  const health = readFlowState(anchor);
  if (health.kind === 'invalid') return '流程接入異常——修復並以 sb state 查證後才可提交；既有印章不代表狀態有效';
  const stampPath = join(anchor, '.shiftblame', 'tmp', 'commit-stamp.json');
  if (!existsSync(stampPath)) return '缺少 commit 印章——在本次提交的錨定專案（git -C 有目標時＝該目標 repo）執行 sb commitmsg "<訊息>"，再以相同訊息提交';
  let stamp;
  try { stamp = JSON.parse(readFileSync(stampPath, 'utf8')); } catch { return 'commit 印章無法讀取——重跑 sb commitmsg "<訊息>"'; }
  if (!objectRecord(stamp) || !stamp.cwd || !stamp.message || !stamp.issuedAt) return 'commit 印章欄位不全——重跑 sb commitmsg "<訊息>"';
  if (!isAbs(stamp.cwd)) return 'commit 印章 cwd 非絕對——重跑 sb commitmsg（sb 簽發的印章一律記錄絕對專案根）';
  if (normPath(anchor, stamp.cwd) !== normPath(anchor, anchor)) return 'commit 印章屬於其他專案——印章綁定提交的錨定 repo；在本次提交的錨定專案（-C 目標或目前專案）重跑 sb commitmsg';
  const age = Date.now() - new Date(stamp.issuedAt).getTime();
  if (!Number.isFinite(age) || age > STAMP_TTL_MS) return 'commit 印章已逾期（>10 分鐘）或時間無效——重跑 sb commitmsg "<訊息>"';
  if (age < -60000) return 'commit 印章時間戳在未來——只接受剛簽發的印章，重跑 sb commitmsg';
  if (stamp.message !== msg) return 'commit 訊息與印章不符——以完全相同的訊息重跑 sb commitmsg 後再提交';
  if (['verify', 'done'].includes(health.state?.node)) return '驗收段對 repo 唯讀——不得提交；需修改時先回實作段';
  try { unlinkSync(stampPath); } catch { return 'commit 印章無法消費——確認 .shiftblame/tmp 可寫後重跑 sb commitmsg'; }
  return null; // 一次性消費：一枚印章授權一次提交
}
function checkCommit(ctx, entry, seen) {
  const g = gitInvocation(entry.args);
  if (g.sub?.dynamic) return 'git 子命令須為字面值——變數或命令替換組成的子命令無法確認是否為提交';
  if (g.sub?.value !== 'commit') return null;
  if (g.C.some((w) => !w || w.dynamic || !anchoredWord(w))) return 'git -C 須用絕對路徑——相對或變數 -C 會展開到非預期資料夾';
  const lastC = g.C.at(-1);
  const anchor = lastC ? findProjectRoot(absPath(lastC.value, lastC.value)) : ctx.root;
  if (!anchor) return null; // 無絕對錨定可用：不猜測
  const parsed = commitMessage(g.subArgs);
  if (parsed.error) return parsed.error;
  // 管線餵 shell 時同一段文字可能以多個候選腳本展開：完全相同的提交只核對一次，避免第二次因印章已消費而誤擋。
  const key = `${normPath(anchor, anchor)}\0${g.subArgs.map((w) => w.value).join('\0')}`;
  if (seen.has(key)) return null;
  const reason = checkStaged(anchor) ?? checkCommitStamp(anchor, parsed.msg);
  if (!reason) seen.add(key);
  return reason;
}

// ———— 決策 ————

const deny = (reason) => ({ deny: reason });
function shellDecision(ctx, tool, text) {
  const dialect = /powershell|pwsh/i.test(tool) ? 'ps' : 'posix';
  const scan = analyzeCommand(text, dialect);
  const health = checkStateHealth(ctx, tool, null, scan);
  if (health) return deny(health);
  const { entries, overflow } = scan;
  for (const e of entries) {
    const stop = checkLayerStopover(ctx, e);
    if (stop) return deny(stop);
  }
  const alias = checkGitAlias(entries, text);
  if (alias) return deny(alias);
  const redirect = checkGitRedirect(entries, text, overflow);
  if (redirect) return deny(redirect);
  if (overflow.some((t) => /\bgit\b[\s\S]*\bcommit\b/i.test(t) || /\brm\s+-[A-Za-z]*[rR]|Remove-Item|\b(?:rd|rmdir|del)\s+\/s\b|rmtree|recursive|\bclean\s+-[A-Za-z]*f|reset\s+--hard/i.test(t))) {
    return deny(`巢狀 shell 超過 ${MAX_DEPTH} 層或內容過多，無法確認其中的提交或刪除——請直接執行內層命令`);
  }
  let warn = null;
  for (const e of entries) {
    if (e.query) continue;
    const reason = destructiveReason(e, entries) ?? redirectReason(e);
    if (reason) return deny(reason);
  }
  if (entries.some((e) => INTERPRETER_RE.test(e.name ?? ''))) {
    const inline = inlineApiReason(text);
    if (inline) return deny(inline);
  }
  for (const e of entries) {
    const script = ctx.root ? scanScriptFile(ctx, e) : null;
    if (script?.deny) return deny(script.deny);
    if (script?.warn) warn = script.warn;
  }
  const seen = new Set();
  for (const e of entries) {
    if (e.query) continue;
    if (e.name === 'git') {
      const reason = checkCommit(ctx, e, seen);
      if (reason) return deny(reason);
    } else if (!e.name && e.nameWord?.dynamic && e.args.some((w) => w.value === 'commit')) {
      return deny('提交命令須以字面 git 呼叫——變數或命令替換組成的命令無法套用提交檢查');
    }
  }
  return { context: warn };
}
function decide(event, input, ctx) {
  if (event === 'SessionStart') return { context: CARD + nodeLine(ctx.health) };
  if (event === 'UserPromptSubmit') return { context: nodeLine(ctx.health) };
  if (event !== 'PreToolUse') return {};
  const tool = input.tool_name || input.toolName || '';
  const toolInput = input.tool_input ?? {};
  if (SHELL_TOOL_RE.test(tool)) {
    let command = toolInput.command ?? toolInput.cmd ?? '';
    if (Array.isArray(command)) command = command.map((a) => (/^[\w@%+=:,./-]+$/.test(String(a)) ? String(a) : `'${String(a).replace(/'/g, `'\\''`)}'`)).join(' ');
    return typeof command === 'string' ? shellDecision(ctx, tool, command) : {};
  }
  const health = checkStateHealth(ctx, tool, toolInput, null);
  if (health) return deny(health);
  if (isWriteTool(tool)) {
    const matrix = checkStateWriteMatrix(ctx, toolInput);
    if (matrix) return deny(matrix);
  }
  return {};
}

// 先算決策，再記錄，最後輸出；記錄前重讀狀態，異常時保持原檔。
let result = {};
try {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const event = input.hook_event_name || input.hookEventName || '';
  const cwd = inputCwd(input);
  const root = cwd ? findProjectRoot(cwd) : null;
  let health = root ? readFlowState(root) : null;
  if (health?.kind === 'invalid') health = readFlowState(root); // 並行寫入瞬間可能讀到半寫檔：再讀一次才判定
  const ctx = { cwd, root, health };
  try { result = decide(event, input, ctx); } catch { result = {}; }
  if (health?.kind !== 'invalid') record(root, event);
  if (result.deny) {
    process.stderr.write(`[shiftblame] ${result.deny}\n`);
    process.exit(2);
  }
  emit(result.context, event);
} catch { /* 防護損壞時保持工作暢通 */ }
process.exit(0);
