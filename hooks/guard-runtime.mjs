#!/usr/bin/env node
// Workflow hooks validate concrete boundaries; semantic decisions remain with the agent.

import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { commitMessageIssue, stagedFiles, stagedSystemMessage } from '../cli/bin/commit-format.mjs';
import { acquireLock, hookRecordsPath, objectRecord, readHookRecords, writeAtomic } from '../cli/bin/state-io.mjs';
import { policy } from '../cli/bin/policy.mjs';
import { ensureWorkspaceStorage } from '../cli/bin/workspace.mjs';
import { findRoot as findProjectRoot, topLevelSystemDir } from '../cli/bin/project-root.mjs';
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

// 專案根：由平台提供的絕對 cwd 往上找 .git 或 .shiftblame（findProjectRoot 與 sb 共用，磁碟根與系統頂層目錄不作錨點）；找不到時以 cwd 本身為根。
const inputCwd = (input) => {
  const c = input.cwd;
  return typeof c === 'string' && isAbsolute(c) && existsSync(c) ? c : null;
};

const CARD = [
  '[shiftblame]',
  '依使用者目標與既有授權把整個範圍做完；只有主技能列的三種停止條件才停下提問。',
  '保護使用者變更，以真實結果驗收；未驗如實揭露。細節按需讀取主技能。',
].join('\n');

// ———— 紀錄：心跳與使用計數（另存 tmp/hook-records.json） ————

const RECORD_EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop']);
// Counts record attempted calls only. They never infer progress or prohibit retries.
// 讀改寫以排他鎖串行，並行的工具呼叫各自計數、不互相覆蓋；短時間等不到鎖就略過這次紀錄。
function record(root, event) {
  if (!root || !RECORD_EVENTS.has(event) || !existsSync(join(root, '.shiftblame'))) return; // 流浪 cwd 不建工作區
  mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
  const file = hookRecordsPath(root);
  const release = acquireLock(file, { waitMs: 2000, staleMs: 10000 });
  if (!release) return;
  try {
    const st = readHookRecords(root);
    const now = new Date().toISOString();
    st.hooksHeartbeat = { at: now, event };
    if (event === 'UserPromptSubmit') delete st.turnUsage;
    if (event === 'PreToolUse') {
      st.turnUsage = { startedAt: st.turnUsage?.startedAt ?? now, requests: (st.turnUsage?.requests ?? 0) + 1 };
      st.usageTotals = { firstAt: st.usageTotals?.firstAt ?? now, requests: (st.usageTotals?.requests ?? 0) + 1 };
    }
    writeAtomic(file, JSON.stringify(st, null, 2));
  } finally { release(); }
}
// 防護失敗時放行工作，但留下紀錄供查證（只寫既有工作區）。
function logError(root, event, where, error) {
  try {
    if (!root || !existsSync(join(root, '.shiftblame'))) return;
    mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
    const line = { at: new Date().toISOString(), event: event || null, where, message: String(error?.stack ?? error).slice(0, 2000) };
    appendFileSync(join(root, '.shiftblame', 'tmp', 'hook-errors.jsonl'), JSON.stringify(line) + '\n');
  } catch { /* 記錄失敗不影響工作 */ }
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
const relTo = (root, abs) => relative(absPath(root, root), absPath(root, abs)).replace(/\\/g, '/');
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

// ———— 保護目錄與工作區 ————

const HOME_DIR = (() => { try { const h = homedir(); return h ? normPath(h, h) : null; } catch { return null; } })();
// 系統頂層目錄（topLevelSystemDir）與專案根錨定共用同一判定，見 cli/bin/project-root.mjs。
const within = (inner, outer) => { const r = relative(outer, inner); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); };
// 不可整個刪除或清空的目錄：根目錄、家目錄、專案根、這些目錄的上層，以及系統頂層目錄。abs 須為 normPath 結果。
function protectedDir(ctx, abs) {
  if (dirname(abs) === abs) return '根目錄';
  if (HOME_DIR && abs === HOME_DIR) return '家目錄';
  if (HOME_DIR && within(HOME_DIR, abs)) return '家目錄的上層';
  const root = ctx.root ? normPath(ctx.root, ctx.root) : null;
  if (root && abs === root) return '專案根';
  if (root && within(root, abs)) return '專案根的上層';
  return topLevelSystemDir(abs) ? '系統頂層目錄' : null;
}
// 可自動建立工作區的專案根：不是根目錄、家目錄或其上層，也不是系統頂層目錄。
function safeWorkspaceRoot(root) {
  const abs = normPath(root, root);
  if (dirname(abs) === abs || topLevelSystemDir(abs)) return false;
  return !(HOME_DIR && within(HOME_DIR, abs));
}
// 自動初始化只建 .shiftblame/、.shiftblame/tmp/ 與忽略全部內容的 .shiftblame/.gitignore。
function ensureWorkspace(root) {
  ensureWorkspaceStorage(root);
}

// ———— 寫入工具與目標 ————

// Tool capabilities are classified by the final action, never provider substrings.
const WRITE_TOOL_RE = /write|edit|patch|save|create|apply|delete|remove|move|rename|truncate|put|manage|store|upload|set_|update/i;
const READ_ACTION_RE = /^(?:read|list|search|stat|exists|get|query|fetch|browse|tree|info|show|find|screenshot)(?:_|$)/i;
const isWriteTool = (tool) => { const action = String(tool).split(/__|\./).at(-1); return WRITE_TOOL_RE.test(action) && !READ_ACTION_RE.test(action); };
const SHELL_TOOL_RE = /^(?:(?:functions|tools)[._])?(?:bash|shell|powershell|pwsh|execute_bash|execute_bash_command|exec_command)$/i;
const PATH_KEYS = ['file_path', 'path', 'filename', 'target', 'file', 'filePath', 'notebook_path', 'abs_path', 'destination', 'dest', 'new_path', 'to'];

function writeTargets(input) {
  const targets = PATH_KEYS.map((k) => input?.[k]).filter((v) => typeof v === 'string' && v.trim());
  if (typeof input?.uri === 'string' && /^file:/i.test(input.uri)) targets.push(input.uri.replace(/^file:\/\//i, ''));
  const patch = typeof input === 'string' ? input : input?.patch ?? input?.input;
  if (typeof patch === 'string') for (const m of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)) targets.push(m[1].trim());
  return targets;
}
// 本機寫入目標：帶遠端定位欄位（owner、repo、bucket…）的工具寫的是遠端資源，path 不是本機路徑；
// URI（https://、s3://…）同理排除。
const REMOTE_LOCATOR_KEYS = ['owner', 'repo', 'repository', 'repo_id', 'project_id', 'bucket'];
const URI_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
function localWriteTargets(input) {
  if (objectRecord(input) && REMOTE_LOCATOR_KEYS.some((k) => typeof input[k] === 'string' && input[k].trim())) return [];
  return writeTargets(input).filter((t) => !URI_SCHEME.test(t));
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
const DENY_PROTECTED = (kind, target) => `破壞性操作的目標是${kind}（${target}）——一律拒絕；請指明確切的絕對子路徑`;
const targetLabel = (w) => (w ? w.raw || w.value : '未指明');
// Windows 上無磁碟代號的單段 POSIX 絕對路徑（/usr、/etc）在 Git Bash 指 Git 安裝目錄的第一層，不是目前磁碟的同名目錄：
// 不依 cwd 所在磁碟展開，與 POSIX 同樣視為系統頂層目錄。單一字母（/c）是 MSYS 的磁碟根，由 msysPath 轉換。
const WIN_POSIX_TOP = /^\/(?![A-Za-z]\/*$)[^\\/]+\/*$/;
// 只解析靜態字詞；結尾的純萬用段（/*、/.*）等同清空其上層目錄。
function protectedTarget(ctx, w) {
  if (!w || w.dynamic || !ctx.cwd) return null;
  let v = w.value.trim().replace(/[\\/]+\.?\*+$/, '');
  if (!v || /[*?[\]{}]/.test(v)) return null;
  if (WIN && WIN_POSIX_TOP.test(v)) return DENY_PROTECTED('系統頂層目錄', targetLabel(w));
  if (/^[A-Za-z]:$/.test(v)) v += '\\';
  const kind = protectedDir(ctx, normPath(ctx.cwd, v));
  return kind ? DENY_PROTECTED(kind, targetLabel(w)) : null;
}
// find 沒有篩選條件時，刪除範圍就是整個搜尋根。
const FIND_TEST = /^-(?:i?name|i?path|i?wholename|i?regex|i?lname|type|xtype|newer\S*|[acm](?:time|min|newer)|used|size|perm|user|group|nouser|nogroup|uid|gid|empty|links|inum|samefile|readable|writable|executable|fstype|context)$/;
function protectedFindRoot(ctx, roots, words) {
  if (words.some((w) => FIND_TEST.test(w.value))) return null;
  for (const r of roots) { const reason = protectedTarget(ctx, r); if (reason) return reason; }
  return null;
}
function checkTargets(ctx, what, targets, entry) {
  if (!targets.length) return DENY_RELATIVE(what, '未指明，來自管線或預設目錄');
  for (const t of targets) {
    if (entry?.findExec && t.value.includes('{}')) {
      const bad = entry.findRoots.length ? entry.findRoots.find((r) => !anchoredWord(r)) : { raw: '.' };
      if (bad) return DENY_RELATIVE(`find -exec ${what}`, `搜尋根 ${targetLabel(bad)}`);
      const guarded = protectedFindRoot(ctx, entry.findRoots, entry.cmd.words);
      if (guarded) return guarded;
      continue;
    }
    if (rootLikeWord(t)) return DENY_ROOT(t.value);
    if (!anchoredWord(t)) return DENY_RELATIVE(what, targetLabel(t));
    const guarded = protectedTarget(ctx, t);
    if (guarded) return guarded;
  }
  return null;
}
// 會丟棄未提交變更或刪除分支的 git 操作；回傳操作名稱，其他情況回傳 null。
function gitDiscard(sub, subArgs) {
  const vals = subArgs.map((w) => w.value);
  const short = (re) => vals.some((v) => /^-[A-Za-z]+$/.test(v) && re.test(v.slice(1)));
  const firstWord = vals.find((v) => !v.startsWith('-'));
  switch (sub) {
    case 'clean': return vals.includes('--force') || short(/f/) ? 'clean -f' : null;
    case 'reset': return vals.includes('--hard') ? 'reset --hard' : null;
    case 'checkout': {
      if (vals.includes('--force') || short(/f/)) return 'checkout -f';
      const k = vals.indexOf('--');
      if (k >= 0 && k < vals.length - 1) return 'checkout -- <路徑>';
      return vals.some((v) => /^(?:\.|\.[\\/].*|:\/.*|:\(.*)$/.test(v)) ? 'checkout <路徑>' : null;
    }
    case 'restore': {
      let staged = false, worktree = false, paths = false;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (v === '--') { paths ||= i < vals.length - 1; break; }
        if (v === '--staged') staged = true;
        else if (v === '--worktree') worktree = true;
        else if (v === '--source') i++;
        else if (v.startsWith('--pathspec-from-file')) paths = true;
        else if (/^-[A-Za-z]+$/.test(v)) { if (v.includes('S')) staged = true; if (v.includes('W')) worktree = true; if (v.endsWith('s')) i++; }
        else if (!v.startsWith('-')) paths = true;
      }
      // 只有 --staged 是取消暫存，不動工作樹。
      return paths && (!staged || worktree) ? 'restore' : null;
    }
    case 'switch': return vals.includes('--discard-changes') || vals.includes('--force') || short(/f/) ? 'switch --discard-changes' : null;
    case 'stash': return ['drop', 'clear'].includes(firstWord) ? `stash ${firstWord}` : null;
    case 'branch': {
      const del = vals.includes('--delete') || short(/d/);
      const force = vals.includes('--force') || short(/f/);
      return short(/D/) || (del && force) ? 'branch -D' : null;
    }
    default: return null;
  }
}
// rsync --delete 會刪除目的地中來源沒有的檔案：本機目的地須以絕對路徑錨定。
const RSYNC_DELETE = /^--(?:del|delete(?:-(?:before|during|delay|after|excluded|missing-args))?)$/;
const RSYNC_VALUE = new Set(['-e', '--rsh', '--rsync-path', '-f', '--filter', '--exclude', '--include', '--exclude-from', '--include-from', '--files-from', '-T', '--temp-dir', '--compare-dest', '--copy-dest', '--link-dest', '-B', '--block-size', '--backup-dir', '--suffix', '--chmod', '--chown', '--usermap', '--groupmap', '--timeout', '--contimeout', '--port', '--sockopts', '--password-file', '--log-file', '--log-file-format', '--out-format', '--bwlimit', '--max-size', '--min-size', '--max-delete', '--partial-dir', '--modify-window', '--iconv', '--checksum-choice', '--compress-choice', '--compress-level', '--skip-compress', '--info', '--debug', '--stop-after', '--stop-at', '--write-batch', '--only-write-batch', '--read-batch', '--protocol', '-M', '--remote-option', '--outbuf', '--address', '--config', '--dparam', '--early-input']);
const RSYNC_REMOTE = /^(?:rsync:\/\/|(?:[^@\s\\/:]+@)?[^\s\\/:]{2,}:)/;
function rsyncDelete(args) {
  const positional = [];
  let del = false, options = true;
  for (let i = 0; i < args.length; i++) {
    const v = args[i].value;
    if (options && v === '--') { options = false; continue; }
    if (options && v.startsWith('--')) {
      const name = v.replace(/=.*$/, '');
      if (RSYNC_DELETE.test(name)) del = true;
      if (!v.includes('=') && RSYNC_VALUE.has(name)) i++;
      continue;
    }
    if (options && /^-[A-Za-z0-9]/.test(v)) {
      const k = v.slice(1).search(/[efTBM]/);
      if (k >= 0 && k === v.length - 2) i++;
      continue;
    }
    positional.push(args[i]);
  }
  return del && positional.length >= 2 ? positional.at(-1) : null;
}
const PS_REMOVE = new Set(['remove-item', 'ri', 'rm', 'del', 'erase', 'rd', 'rmdir']);
// cmd 風格開關（/s、/q、/MIR）只存在於 Windows；POSIX 上 /usr 這類單層字詞是絕對路徑，不可濾掉。
const WIN_SWITCH = WIN ? /^\/[A-Za-z?]+(?::.*)?$/ : /(?!)/;
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
function destructiveReason(ctx, entry, entries) {
  const { name, args, dialect } = entry;
  if (!name) return null;
  // xargs rm：刪除對象來自管線，只接受同一管線中較早、由絕對根出發的 find。
  if (RM_LIKE.has(name) && entry.stdinArgs && dialect !== 'ps') {
    const at = entries.indexOf(entry);
    const finds = entries.filter((e, k) => k < at && e.name === 'find' && !e.findExec && e.cmd.pipeline === entry.cmd.pipeline);
    const roots = finds.flatMap((f) => { const r = findRoots(f); return r.length ? r : [{ raw: '.', value: '.' }]; });
    const bad = !finds.length ? { raw: '管線上游不是 find' } : roots.find((r) => !anchoredWord(r) || rootLikeWord(r));
    if (bad) return DENY_RELATIVE(`xargs ${name}`, `來源：${targetLabel(bad)}`);
    for (const f of finds) { const guarded = protectedFindRoot(ctx, findRoots(f), f.args); if (guarded) return guarded; }
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
    return checkTargets(ctx, 'rm -r', targets, entry);
  }
  if (name === 'remove-item' || name === 'ri' || (dialect === 'ps' && PS_REMOVE.has(name))) {
    const { recursive, targets } = psRemoveTargets(args);
    if (recursive) {
      const reason = checkTargets(ctx, `${entry.nameWord.value} -Recurse`, targets.filter((w) => !WIN_SWITCH.test(w.value)), entry);
      if (reason) return reason;
    }
  }
  if (['del', 'erase', 'rd', 'rmdir'].includes(name) && args.some((w) => /^\/s$/i.test(w.value))) {
    return checkTargets(ctx, `${name} /s`, args.filter((w) => !WIN_SWITCH.test(w.value)), entry);
  }
  if (name === 'find' && args.some((w) => w.value === '-delete' || (/^-(?:exec|execdir|ok|okdir)$/.test(w.value)))) {
    const execRm = args.some((w, i) => /^-(?:exec|execdir|ok|okdir)$/.test(w.value) && ['rm', 'rmdir', 'shred', 'unlink'].includes(baseName(args[i + 1]?.value ?? '')));
    if (args.some((w) => w.value === '-delete') || execRm) {
      const roots = findRoots(entry);
      if (!roots.length) return DENY_RELATIVE('find 遞迴刪除', '未指明搜尋根，預設為 .');
      const bad = roots.find((r) => !anchoredWord(r) || rootLikeWord(r));
      if (bad) return rootLikeWord(bad) ? DENY_ROOT(bad.value) : DENY_RELATIVE('find 遞迴刪除', `搜尋根 ${targetLabel(bad)}`);
      const guarded = protectedFindRoot(ctx, roots, args);
      if (guarded) return guarded;
    }
  }
  if (name === 'robocopy' && args.some((w) => /^\/(?:mir|purge)$/i.test(w.value))) {
    const dest = args.filter((w) => !WIN_SWITCH.test(w.value))[1];
    return dest ? checkTargets(ctx, 'robocopy /MIR', [dest], entry) : DENY_RELATIVE('robocopy /MIR', '目標 未指明');
  }
  if (name === 'rsync') {
    const dest = rsyncDelete(args);
    if (dest && !(!dest.dynamic && RSYNC_REMOTE.test(dest.value))) return checkTargets(ctx, 'rsync --delete', [dest], entry);
  }
  if (name === 'git') {
    const g = gitInvocation(args);
    const op = g.sub && !g.sub.dynamic ? gitDiscard(g.sub.value.toLowerCase(), g.subArgs) : null;
    if (op && !(g.C.length && g.C.every((w) => w && anchoredWord(w)))) {
      return `git 破壞性操作（${op}）未以 -C <絕對路徑> 錨定目標 repo——會丟棄未提交變更或刪除分支，工作目錄漂移就會作用在錯誤的專案；請加上 -C <絕對路徑> 後重試`;
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
  const { system } = stagedFiles(anchor);
  return system.length ? stagedSystemMessage(system) : null;
}
function checkCommitStamp(anchor, msg) {
  // 格式與 sb commitmsg 同判據（commit-format.mjs 單一來源）：印章檔在可寫的 tmp、可被手寫，
  // 來源不因此受信——格式由 hook 端獨立複驗，手寫章不豁免。
  const issue = commitMessageIssue(msg);
  if (issue) return `${issue}——hook 與 sb commitmsg 同判據，印章不豁免格式；以合格訊息重跑 sb commitmsg 後再提交`;
  const stampPath = join(anchor, '.shiftblame', 'tmp', 'commit-stamp.json');
  if (!existsSync(stampPath)) return '缺少 commit 印章——在本次提交的錨定專案（git -C 有目標時＝該目標 repo）執行 sb commitmsg "<訊息>"，再以相同訊息提交';
  let stamp;
  try { stamp = JSON.parse(readFileSync(stampPath, 'utf8')); } catch { return 'commit 印章無法讀取——重跑 sb commitmsg "<訊息>"'; }
  if (!objectRecord(stamp) || !stamp.cwd || !stamp.message || !stamp.issuedAt) return 'commit 印章欄位不全——重跑 sb commitmsg "<訊息>"';
  if (!isAbs(stamp.cwd)) return 'commit 印章 cwd 非絕對——重跑 sb commitmsg（sb 簽發的印章一律記錄絕對專案根）';
  if (normPath(anchor, stamp.cwd) !== normPath(anchor, anchor)) return 'commit 印章屬於其他專案——印章綁定提交的錨定 repo；在本次提交的錨定專案（-C 目標或目前專案）重跑 sb commitmsg';
  const head = headOf(anchor);
  if (Object.hasOwn(stamp, 'approvedHead') && stamp.approvedHead !== head) {
    try { unlinkSync(stampPath); } catch { /* 作廢章留著也只會再被擋，下次 sb commitmsg 覆寫 */ }
    return 'commit 印章已用於先前的提交（放行後 HEAD 已前進）——一枚印章授權一次提交；重跑 sb commitmsg "<訊息>"';
  }
  const age = Date.now() - new Date(stamp.issuedAt).getTime();
  if (!Number.isFinite(age) || age > STAMP_TTL_MS) return 'commit 印章已逾期（>10 分鐘）或時間無效——重跑 sb commitmsg "<訊息>"';
  if (age < -60000) return 'commit 印章時間戳在未來——只接受剛簽發的印章，重跑 sb commitmsg';
  if (stamp.message !== msg) return 'commit 訊息與印章不符——以完全相同的訊息重跑 sb commitmsg 後再提交';
  // 放行不刪章：hook 看不到這次呼叫最後是否執行（同命令另一錨定、其他 hook 或權限確認都可能拒絕）。
  // 首次放行記下當時 HEAD；提交落地使 HEAD 前進，此章隨即作廢——一枚印章授權一次提交。
  if (!Object.hasOwn(stamp, 'approvedHead')) {
    try { writeAtomic(stampPath, JSON.stringify({ ...stamp, approvedHead: head }, null, 2)); } catch { return 'commit 印章無法標記——確認 .shiftblame/tmp 可寫後重跑 sb commitmsg'; }
  }
  return null;
}
// 未有提交（unborn）或不是 git repo 時為 null；首次提交後 HEAD 出現，同樣視為前進。
function headOf(anchor) {
  try {
    return execFileSync('git', ['-C', anchor, 'rev-parse', '--verify', '-q', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch { return null; }
}
function checkCommit(ctx, entry, seen) {
  const g = gitInvocation(entry.args);
  if (g.sub?.dynamic) return 'git 子命令須為字面值——變數或命令替換組成的子命令無法確認是否為提交';
  if (!policy.requireCommitStamp) {
    if (g.sub?.value !== 'commit') return null;
    if (g.C.some(w => w.dynamic || !anchoredWord(w))) return 'git -C 須用絕對路徑';
    return checkStaged(g.C.at(-1)?.value ?? ctx.root);
  }
  // 管線造提交繞過提交閘（不經 -m 訊息格式與印章）：受治理工作區一律擋，提交走 git commit。
  if (['commit-tree', 'am'].includes(g.sub?.value)) return `git ${g.sub.value} 繞過提交閘——提交一律走 git commit（訊息先過 sb commitmsg）`;
  if (g.sub?.value !== 'commit') return null;
  if (g.C.some((w) => !w || w.dynamic || !anchoredWord(w))) return 'git -C 須用絕對路徑——相對或變數 -C 會展開到非預期資料夾';
  const lastC = g.C.at(-1);
  const anchor = lastC ? findProjectRoot(absPath(lastC.value, lastC.value)) : ctx.root;
  if (!anchor) return null; // 無絕對錨定可用：不猜測
  const parsed = commitMessage(g.subArgs);
  if (parsed.error) return parsed.error;
  // 管線餵 shell 時同一段文字可能以多個候選腳本展開：完全相同的提交只核對一次。
  // 印章放行時不刪除，同命令對同一 repo 的第二個不同提交須在此擋下——一枚印章授權一次提交。
  const repo = normPath(anchor, anchor);
  const args = g.subArgs.map((w) => w.value).join('\0');
  if (seen.has(repo)) return seen.get(repo) === args ? null : '同一命令對同一 repo 有多個不同提交——一枚印章授權一次提交；拆成分次提交，每次先跑 sb commitmsg';
  const reason = checkStaged(anchor) ?? checkCommitStamp(anchor, parsed.msg);
  if (!reason) seen.set(repo, args);
  return reason;
}

// ———— 決策 ————

const deny = (reason) => ({ deny: reason });
// 無法展開的巢狀內容：出現遞迴刪除、丟棄變更或同步刪除的字樣即拒絕。
const OVERFLOW_DESTRUCTIVE = /\brm\s+-[A-Za-z]*[rR]|Remove-Item|\b(?:rd|rmdir|del)\s+\/s\b|rmtree|recursive|\bclean\s+-[A-Za-z]*f|reset\s+--hard|\bcheckout\s+(?:-f\b|--force|--\s)|\brestore\s|\bswitch\s[\s\S]*(?:--discard-changes|--force)|\bstash\s+(?:drop|clear)\b|\bbranch\s[\s\S]*(?:-[A-Za-z]*D\b|--delete)|\brsync\b[\s\S]*--del/i;
function shellDecision(ctx, tool, text) {
  const dialect = /powershell|pwsh/i.test(tool) ? 'ps' : 'posix';
  const scan = analyzeCommand(text, dialect);
  const { entries, overflow } = scan;
  const alias = checkGitAlias(entries, text);
  if (alias) return deny(alias);
  const redirect = checkGitRedirect(entries, text, overflow);
  if (redirect) return deny(redirect);
  if (overflow.some((t) => /\bgit\b[\s\S]*\bcommit\b/i.test(t) || OVERFLOW_DESTRUCTIVE.test(t))) {
    return deny(`巢狀 shell 超過 ${MAX_DEPTH} 層或內容過多，無法確認其中的提交或刪除——請直接執行內層命令`);
  }
  let warn = null;
  for (const e of entries) {
    if (e.query) continue;
    const reason = destructiveReason(ctx, e, entries) ?? redirectReason(e);
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
  const seen = new Map();
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
  if (event === 'SessionStart') return { context: CARD };
  if (event !== 'PreToolUse') return {};
  const tool = input.tool_name || input.toolName || '';
  const toolInput = input.tool_input ?? {};
  if (SHELL_TOOL_RE.test(tool)) {
    let command = toolInput.command ?? toolInput.cmd ?? '';
    if (Array.isArray(command)) command = command.map(a => "'" + String(a).replaceAll("'", "'\\''") + "'").join(' ');
    return typeof command === 'string' ? shellDecision(ctx, tool, command) : {};
  }
  return {};
}
const personalHook = policy.createHook?.({ acquireLock, hookRecordsPath, readHookRecords, writeAtomic, absPath, relTo, normPath, isWriteTool, localWriteTargets, objectRecord, safeWorkspaceRoot, ensureWorkspace, logError, analyzeCommand, SHELL_TOOL_RE, RECORD_EVENTS, systemRel, gitInvocation });

// 先算決策，再記錄，最後輸出。防護本身出錯時放行，錯誤寫入 .shiftblame/tmp/hook-errors.jsonl。
let result = {};
let root = null, event = '';
try {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  event = input.hook_event_name || input.hookEventName || '';
  const cwd = inputCwd(input);
  root = cwd ? findProjectRoot(cwd) : null;
  const ctx = { cwd, root, source: typeof input.source === 'string' ? input.source : null };
  try {
    const base = decide(event, input, ctx);
    const extra = personalHook?.(event, input, ctx) ?? {};
    result = { ...base, ...extra, context: [base.context, extra.context].filter(Boolean).join('\n') };
    if (base.deny) result.deny = base.deny;
  } catch (error) { result = { deny: `政策執行失敗：${error.message}` }; logError(root, event, 'decide', error); }
  try { record(root, event); } catch (error) { logError(root, event, 'record', error); }
  if (result.deny) {
    process.stderr.write(`[shiftblame] ${result.deny}\n`);
    process.exit(2);
  }
  if (result.ask && event === 'PreToolUse') {
    const out = { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[shiftblame] ${result.ask}` };
    if (result.context) out.additionalContext = result.context;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: out }));
    process.exit(0);
  }
  emit(result.context, event);
} catch (error) { logError(root, event, 'main', error); }
process.exit(0);
