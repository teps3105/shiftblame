#!/usr/bin/env node
// Workflow hooks validate concrete boundaries; semantic decisions remain with the agent.

import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectRecord, readFlowState, unchangedG1Approval } from '../cli/bin/flow-state.mjs';
import { commitMessageIssue } from '../cli/bin/commit-format.mjs';
import { acquireLock, hookRecordsPath, readHookRecords, writeAtomic } from '../cli/bin/state-io.mjs';
import { interviewStatus, markSessionStart, recordInterviewEvent } from '../cli/bin/interview.mjs';
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
  '活動 slug 保留 G1／G2 契約與時點獨立審查（時點 3 終審由使用者判定）；技術修復自主續行。',
  '保護使用者變更，以真實結果驗收；未驗如實揭露。細節按需讀取主技能。',
].join('\n');
// 時點審查與終審進行時，代理可先行研究；判定不等研究，研究也不推進流程。
const EARLY_RESEARCH = {
  research: '｜時點 1 審查期間可先行研究：唯讀查證、tmp 筆記、隔離原型；不推進、不改 G1、不提交',
  quality: '｜時點 2 審查期間可先行研究：唯讀查證、tmp 筆記、隔離原型；不推進、不改 G2、不提交',
  verify: '｜時點 3 審查與終審期間可先行研究：唯讀查證、tmp 筆記、隔離原型；不推進、不改受驗來源、不提交',
};
function nodeLine(health, root) {
  if (!health) return '';
  if (health.kind === 'invalid') return '\n[接入異常] 保留原資料，修復後執行 sb state；提交及流程推進保持封閉。';
  const st = health.state;
  let line = health.kind === 'active' ? '\n[段] ' + st.slug + '/' + st.ms + ' @ ' + st.node + (EARLY_RESEARCH[st.node] ?? '') : '\n[接入] ' + health.kind + '；依既有授權工作。';
  const points = suspectPoints(root, health); // 下游連續失敗動搖過的上游時點（時點通過是暫時性的）
  if (points.length) line += '\n[時點待重審] 時點 ' + points.join('、') + ' 的通過已被下游連續失敗動搖——回退重審（' + points.map((p) => SUSPECT_EDGE[p] + ' 再次推進').join('；') + '）後解除。';
  return line;
}

// ———— 失敗信號回退引導：工具連續失敗時引導回上游段，時點通過視為暫時性 ————

const FAIL_NUDGE_AT = 3, FAIL_ASK_AT = 6;
// 各段連續失敗時的回退去處（與 FLOW 相鄰回退邊一致）；requirement 段沒有更上游，不引導。
const FAIL_GUIDE = {
  research: '`sb next requirement` 回需求釐清契約，或確認研究範圍後續行',
  plan: '`sb next research` 回研究——計畫依據被推翻時，時點 1 待重審',
  quality: '`sb next plan` 回計畫——品質安排寫不出，通常是計畫片段與驗收條件的映射不成立',
  build: '`sb next quality` 回區 2 改品質安排（時點 2 待重審）；研究結論被推翻則 `sb next research`（時點 1 待重審）；確認純屬實作失誤才留在本段修',
  verify: '`sb next build` 修實作，或 `sb next quality` 改判準（時點 2 待重審）——驗收失敗不直接通過，也不在本段反覆重跑',
};
// 該段連續失敗時應標記待重審的上游時點：plan 依賴研究（時點 1）、build／verify 依賴品質安排（時點 2）。
const FAIL_SUSPECT = { plan: '1', build: '2', verify: '2' };
// 時點→封存邊：標記後該邊再次推進即重審通過、待重審解除（以 flow-state 的 edgeAt 時序判斷，不需清除寫入）。
const SUSPECT_EDGE = { '1': 'research→plan', '2': 'quality→build' };
function suspectPoints(root, health) {
  if (!root || health?.kind !== 'active') return [];
  const st = health.state;
  const susp = readHookRecords(root).suspect;
  if (!susp) return [];
  return Object.keys(susp).filter((p) => {
    const passedAt = st.edgeAt?.[SUSPECT_EDGE[p]];
    return !passedAt || passedAt < susp[p];
  });
}

// PostToolUseFailure 累計同對話同段的連續失敗；PostToolUse（成功）把同段計數歸零。
// 達 N1 起把當前段依賴的上游時點標記待重審（下游反覆失敗＝上游的暫時性通過失效）。
function bumpFailure(root, sessionId, node, ok) {
  if (!root || !sessionId || !node || !existsSync(join(root, '.shiftblame'))) return null;
  mkdirSync(join(root, '.shiftblame', 'tmp'), { recursive: true });
  const file = hookRecordsPath(root);
  const release = acquireLock(file, { waitMs: 2000, staleMs: 10000 });
  if (!release) return null;
  try {
    const st = readHookRecords(root);
    const fn = st.failureNudge;
    if (ok) {
      if (fn?.node === node) { delete st.failureNudge; writeAtomic(file, JSON.stringify(st, null, 2)); }
      return null;
    }
    const next = fn && fn.session === sessionId && fn.node === node
      ? { ...fn, count: fn.count + 1, at: new Date().toISOString() }
      : { session: sessionId, node, count: 1, at: new Date().toISOString() };
    st.failureNudge = next;
    const point = FAIL_SUSPECT[node];
    if (point && next.count >= FAIL_NUDGE_AT) st.suspect = { ...(st.suspect ?? {}), [point]: next.at };
    writeAtomic(file, JSON.stringify(st, null, 2));
    return next;
  } finally { release(); }
}
function failureLine(fn, node, tool) {
  if (!fn || fn.node !== node || fn.count < FAIL_NUDGE_AT) return '';
  const guide = FAIL_GUIDE[node] ?? '';
  if (fn.count >= FAIL_ASK_AT) {
    return `\n[回退裁示] ${node} 段已連續失敗 ${fn.count} 次` + (tool ? `（${tool}）` : '') + `——先以 AskUserQuestion 向老闆取得「回退重審」或「留在本段續行」的明確決定，未取得前不重試同類操作。回退去處：${guide}。時點通過是暫時性的。`;
  }
  return `\n[回退引導] ${node} 段已連續失敗 ${fn.count} 次` + (tool ? `（${tool}）` : '') + `——先判斷根因層級再決定去處，不在本段反覆硬修：${guide}。受影響的上游時點已標記待重審，回退重審再次推進後自動解除。`;
}
// 失敗裁示閘：連續失敗達 ask 閾值且未取得老闆決定時，任何工具呼叫先問一次（askedAt 記錄已問過，只問一次）。
function failureAskGate(root, input, ctx) {
  if (!root || ctx.health?.kind !== 'active') return null;
  const fn = readHookRecords(root).failureNudge;
  if (!fn || fn.session !== sessionOf(input) || fn.node !== ctx.health.state.node || fn.count < FAIL_ASK_AT || fn.askedAt) return null;
  return fn;
}

// ———— 紀錄：心跳與使用計數（另存 tmp/hook-records.json，不寫 sb 管理的 flow-state） ————

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
const SYSTEM_DRIVE = fold(process.env.SystemDrive || 'C:');
// 系統頂層目錄：POSIX 的第一層（/usr、/etc、/home…）與 Windows 系統磁碟的第一層（C:\Windows、C:\Users…）。
function topLevelSystemDir(abs) {
  if (WIN) { const m = abs.match(/^([a-z]:)[\\/]+[^\\/]+[\\/]*$/i); return !!m && fold(m[1]) === SYSTEM_DRIVE; }
  return /^\/[^/]+\/*$/.test(abs);
}
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
// 自動初始化只建 .shiftblame/、.shiftblame/tmp/ 與忽略全部內容的 .shiftblame/.gitignore，不寫 flow-state。
function ensureWorkspace(root) {
  const dir = join(root, '.shiftblame');
  mkdirSync(join(dir, 'tmp'), { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
}

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
// 本機寫入目標：帶遠端定位欄位（owner、repo、bucket…）的工具寫的是遠端資源，path 不是本機路徑；
// URI（https://、s3://…）同理排除。
const REMOTE_LOCATOR_KEYS = ['owner', 'repo', 'repository', 'repo_id', 'project_id', 'bucket'];
const URI_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
function localWriteTargets(input) {
  if (objectRecord(input) && REMOTE_LOCATOR_KEYS.some((k) => typeof input[k] === 'string' && input[k].trim())) return [];
  return healthWriteTargets(input).filter((t) => !URI_SCHEME.test(t));
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
    // 沒有本機路徑的寫入工具（待辦清單、遠端 API）不會惡化本機狀態。
    const targets = localWriteTargets(input);
    return targets.every((p) => recoveryTarget(ctx, p)) ? null : HEALTH_BLOCKED;
  }
  return null;
}

function checkStateWriteMatrix(ctx, toolInput) {
  if (!['verify', 'done'].includes(ctx.health?.state?.node)) return null;
  for (const target of localWriteTargets(toolInput)) {
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
// 時點關卡停靠提醒：時點 1／2 缺 --adversarial 時停靠（獨立審查通過即自主推進）；時點 3 出口另需 --boss-ok（--new-ms）。
// 契約已核准且未變時沿用原核准。旗標由 CLI 驗證，hook 提供停靠提醒。
function checkLayerStopover(ctx, entry) {
  const sb = sbSub(entry);
  if (!sb || sb.sub !== 'next' || ctx.health?.kind !== 'active') return null;
  const target = sb.rest.find((w) => !w.value.startsWith('-'))?.value;
  if (!['plan', 'build', 'requirement'].includes(target)) return null;
  if (sb.all.some((w) => w.value === '--adversarial')) return null; // 審查旗標在即放行——時點 1／2 自主推進；出口章由 CLI 驗
  const st = ctx.health.state;
  const edge = { research: 'plan', quality: 'build', verify: 'requirement' }[st.node];
  if (edge !== target) return null;
  if (st.node === 'research' && unchangedG1Approval(ctx.root, st)) return null;
  if (st.node === 'verify' && !sb.all.some((w) => w.value === '--new-ms')) return null; // fail＝新輸入經訪談回 requirement，零旗標
  if (st.node === 'research') return '時點 1（research→plan）停靠：須先取得獨立審查並帶 --adversarial 推進——代理自主推進，不等使用者判定（使用者終審在時點 3 出口）。審查期間可先行研究（唯讀查證、tmp 筆記、隔離原型），不推進、不改 G1、不提交；審查前的研究結果不餵給審查者。';
  if (st.node === 'quality') return '時點 2（quality→build）停靠：須先取得獨立審查並帶 --adversarial 推進——代理自主推進，不等使用者判定（使用者終審在時點 3 出口）。審查期間可先行研究（唯讀查證、tmp 筆記、隔離原型），不推進、不改 G2、不提交；審查前的研究結果不餵給審查者。';
  return '時點 3 出口（verify→requirement --new-ms）停靠：獨立驗收審查通過且使用者終審後，帶 --adversarial --boss-ok --new-ms 推進。';
}
// --boss-ok 是使用者終審章：僅 sb end 與 sb next --new-ms（出口）帶旗標時交給使用者在權限提示中確認（平台不支援詢問時放行）。
function bossOkAsk(entry) {
  const sb = sbSub(entry);
  if (!sb || !['next', 'end'].includes(sb.sub) || !sb.all.some((w) => w.value === '--boss-ok')) return null;
  if (sb.sub === 'end') return 'sb end 帶 --boss-ok：表示你已完成時點 3 終審，並同意結束整個 slug——歸檔、合併回基底、刪除本機工作分支。只是目前里程碑通過、後面還有里程碑要做，請拒絕並改用 sb next requirement --new-ms。屬實再允許。';
  if (!sb.all.some((w) => w.value === '--new-ms')) return null; // --boss-ok 只屬於出口；時點 1／2 誤帶由 CLI 擋，不問使用者
  const target = sb.rest.find((w) => !w.value.startsWith('-'))?.value ?? '（未指明）';
  return `sb next ${target} --new-ms 帶 --boss-ok：表示你已完成時點 3 終審並同意開新里程碑（回 requirement）。屬實再允許。`;
}

// ———— 產品訪談閘 ————

// 寫入訪談紀錄的每一輪前，須自上一輪完成（或對話開始）後以提問工具實際提問；未提問即拒絕寫紀錄本身，
// 有提問證據則直接放行。專案檔案寫入、git commit／push 與 sb 流程命令不因訪談未完成而受阻；
// 唯讀查證與 .shiftblame/tmp 筆記照常。經 shell 的寫入只辨識重定向與 tee／Set-Content 類的字面目標。
const INTERVIEW_TEMPLATE = fileURLToPath(new URL('../skills/shiftblame/assets/INTERVIEW.md', import.meta.url));
const interviewRel = (ctx) => relTo(ctx.root, absPath(ctx.root, ctx.interview.path));
// 已對齊（紀錄有完整輪且非恢復待辦）回傳 null；否則回傳缺少什麼。
function interviewNeed(iv) {
  if (!iv.exists) return '紀錄尚未建立';
  const last = iv.rounds.at(-1);
  if (last?.missing.length) return `第 ${last.n} 輪缺少：${last.missing.join('、')}`;
  if (iv.pending && iv.complete <= iv.base) return `恢復的對話須在紀錄末尾追加新的一輪（開場時已完成 ${iv.base} 輪）`;
  if (!iv.complete) return '紀錄中沒有「## 第 N 輪」段落';
  return null;
}
const INTERVIEW_MARKER_DENY = '訪談開場標記由 hook 維護，不可直接寫入——恢復的對話請在訪談紀錄追加新的一輪。';
const interviewEvidenceDeny = (ctx) =>
  `寫入產品訪談紀錄前須先向使用者提問——自上一輪完成後尚無提問工具（AskUserQuestion）呼叫。先以 AskUserQuestion 提問並取得回答，再寫入 ${interviewRel(ctx)}；「使用者確認」欄須來自真實回答。`;
const interviewFiles = (ctx) => ({ record: normPath(ctx.root, ctx.interview.path), marker: normPath(ctx.root, ctx.interview.path.replace(/\.md$/, '.json')) });
function checkInterviewWrite(ctx, tool, input) {
  if (!ctx.interview || !isWriteTool(tool)) return null;
  const files = interviewFiles(ctx);
  for (const target of localWriteTargets(input)) {
    const abs = normPath(ctx.cwd ?? ctx.root, target);
    if (abs === files.marker) return { deny: INTERVIEW_MARKER_DENY };
    if (abs === files.record && !ctx.interview.questioned) return { deny: interviewEvidenceDeny(ctx) };
  }
  return null;
}
const SHELL_WRITE_OPS = new Set(['>', '>>', '>|', '&>', '&>>']);
const SHELL_WRITERS = new Set(['tee', 'tee-object', 'set-content', 'add-content', 'out-file']);
function shellWriteWords(e) {
  const words = e.cmd.redirects.filter((r) => !r.dup && r.target && SHELL_WRITE_OPS.has(r.op)).map((r) => r.target);
  if (SHELL_WRITERS.has(e.name ?? '')) words.push(...e.args.filter((w) => !w.value.startsWith('-')));
  return words.filter((w) => !w.dynamic);
}
function checkInterviewShell(ctx, scan) {
  if (!ctx.interview) return null;
  const files = interviewFiles(ctx);
  for (const e of scan.entries) {
    if (e.query) continue;
    for (const w of shellWriteWords(e)) {
      const abs = normPath(ctx.cwd ?? ctx.root, w.value);
      if (abs === files.marker) return { deny: INTERVIEW_MARKER_DENY };
      if (abs === files.record && !ctx.interview.questioned) return { deny: interviewEvidenceDeny(ctx) };
    }
  }
  return null;
}
// 開場與每次輸入的訪談提示。
function interviewLine(ctx, event) {
  const iv = ctx.interview;
  if (!iv) return '';
  const rel = interviewRel(ctx);
  const need = interviewNeed(iv);
  if (!need) return event === 'SessionStart' ? `\n[訪談] 本對話紀錄 ${rel} 已完成 ${iv.complete} 輪；目標或範圍改變、證據推翻需求假設、slug 定 G1 前與交付前確認時，在同一紀錄追加一輪——每一輪寫入前先以 AskUserQuestion 提問。` : '';
  const resume = iv.base > 0 ? '恢復的對話：在同一紀錄末尾追加新的一輪。' : '';
  if (event === 'UserPromptSubmit') return `\n[訪談] 本對話訪談未完成（${rel}：${need}）——先以 AskUserQuestion 提問，取得回答後寫入紀錄。${resume}`;
  return `\n[訪談] 先做產品訪談：與使用者對齊目標、範圍、限制與驗收——先以 AskUserQuestion 提問並取得回答，再寫入 ${rel}（範本：${INTERVIEW_TEMPLATE}）；未提問就寫入會被擋。${resume}`;
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
// 只解析靜態字詞；結尾的純萬用段（/*、/.*）等同清空其上層目錄。
function protectedTarget(ctx, w) {
  if (!w || w.dynamic || !ctx.cwd) return null;
  let v = w.value.trim().replace(/[\\/]+\.?\*+$/, '');
  if (!v || /[*?[\]{}]/.test(v)) return null;
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
  // 格式與 sb commitmsg 同判據（commit-format.mjs 單一來源）：印章檔在可寫的 tmp、可被手寫，
  // 來源不因此受信——格式由 hook 端獨立複驗，手寫章不豁免。
  const issue = commitMessageIssue(msg);
  if (issue) return `${issue}——hook 與 sb commitmsg 同判據，印章不豁免格式；以合格訊息重跑 sb commitmsg 後再提交`;
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
  // 管線造提交繞過提交閘（不經 -m 訊息格式與印章）：受治理工作區一律擋，提交走 git commit。
  if (['commit-tree', 'am'].includes(g.sub?.value)) return `git ${g.sub.value} 繞過提交閘——提交一律走 git commit（訊息先過 sb commitmsg）`;
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
// 無法展開的巢狀內容：出現遞迴刪除、丟棄變更或同步刪除的字樣即拒絕。
const OVERFLOW_DESTRUCTIVE = /\brm\s+-[A-Za-z]*[rR]|Remove-Item|\b(?:rd|rmdir|del)\s+\/s\b|rmtree|recursive|\bclean\s+-[A-Za-z]*f|reset\s+--hard|\bcheckout\s+(?:-f\b|--force|--\s)|\brestore\s|\bswitch\s[\s\S]*(?:--discard-changes|--force)|\bstash\s+(?:drop|clear)\b|\bbranch\s[\s\S]*(?:-[A-Za-z]*D\b|--delete)|\brsync\b[\s\S]*--del/i;
function shellDecision(ctx, tool, text) {
  const dialect = /powershell|pwsh/i.test(tool) ? 'ps' : 'posix';
  const scan = analyzeCommand(text, dialect);
  const health = checkStateHealth(ctx, tool, null, scan);
  if (health) return deny(health);
  const interview = checkInterviewShell(ctx, scan);
  if (interview?.deny) return deny(interview.deny);
  const { entries, overflow } = scan;
  for (const e of entries) {
    const stop = checkLayerStopover(ctx, e);
    if (stop) return deny(stop);
  }
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
  const asks = [...new Set([...entries.filter((e) => !e.query).map(bossOkAsk)].filter(Boolean))];
  return asks.length ? { ask: asks.join('\n'), context: warn } : { context: warn };
}
function decide(event, input, ctx) {
  if (event === 'SessionStart') return { context: CARD + nodeLine(ctx.health, ctx.root) + interviewLine(ctx, event) };
  if (event === 'UserPromptSubmit') return { context: nodeLine(ctx.health, ctx.root) + interviewLine(ctx, event) };
  if (event === 'PostToolUseFailure') return { context: failureLine(ctx.failure, ctx.health?.state.node, String(input.tool_name ?? input.toolName ?? '')) };
  if (event !== 'PreToolUse') return {};
  const tool = input.tool_name || input.toolName || '';
  // 失敗裁示閘：連續失敗達 ask 閾值且未取得老闆決定時，改動類工具先問一次（唯讀查證不受閘）。
  const gate = failureAskGate(ctx.root, input, ctx);
  if (gate && (isWriteTool(tool) || SHELL_TOOL_RE.test(tool))) {
    markFailureAsked(ctx.root, gate.session, gate.node);
    return { ask: `${gate.node} 段已連續失敗 ${gate.count} 次——先以 AskUserQuestion 向老闆取得「回退重審」或「留在本段續行」的決定，再繼續改動。回退去處：${FAIL_GUIDE[gate.node] ?? '同段內換做法'}` };
  }
  const toolInput = input.tool_input ?? {};
  if (SHELL_TOOL_RE.test(tool)) {
    let command = toolInput.command ?? toolInput.cmd ?? '';
    if (Array.isArray(command)) command = command.map((a) => (/^[\w@%+=:,./-]+$/.test(String(a)) ? String(a) : `'${String(a).replace(/'/g, `'\\''`)}'`)).join(' ');
    return typeof command === 'string' ? shellDecision(ctx, tool, command) : {};
  }
  const health = checkStateHealth(ctx, tool, toolInput, null);
  if (health) return deny(health);
  const interview = checkInterviewWrite(ctx, tool, toolInput);
  if (interview?.deny) return interview;
  if (isWriteTool(tool)) {
    const matrix = checkStateWriteMatrix(ctx, toolInput);
    if (matrix) return deny(matrix);
  }
  return interview ?? {};
}

// 平台對話代號；ZCode 子代理（sess_subagent_…）不帶上層代號，不另做訪談。
function sessionOf(input) {
  const id = [input.session_id, input.sessionId].find((v) => typeof v === 'string' && v.trim());
  return id ? id.trim() : null;
}
const interviewApplies = (root, sessionId) => !!(sessionId && root && !/^sess_subagent_/.test(sessionId) && safeWorkspaceRoot(root) && existsSync(join(root, '.shiftblame', 'tmp')));

// 失敗裁示閘發出 ask 時記錄已問過（askedAt），同一輪升級只問一次。
function markFailureAsked(root, sessionId, node) {
  if (!root || !sessionId || !node) return;
  const file = hookRecordsPath(root);
  const release = acquireLock(file, { waitMs: 2000, staleMs: 10000 });
  if (!release) return;
  try {
    const st = readHookRecords(root);
    if (st.failureNudge?.session === sessionId && st.failureNudge?.node === node) {
      st.failureNudge.askedAt = new Date().toISOString();
      writeAtomic(file, JSON.stringify(st, null, 2));
    }
  } finally { release(); }
}

// 先算決策，再記錄，最後輸出。防護本身出錯時放行，錯誤寫入 .shiftblame/tmp/hook-errors.jsonl。
let result = {};
let root = null, event = '';
try {
  const raw = await readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  event = input.hook_event_name || input.hookEventName || '';
  const cwd = inputCwd(input);
  root = cwd ? findProjectRoot(cwd) : null;
  const sessionId = sessionOf(input);
  // 有對話代號的平台工作階段：在可安全放置的專案根自動建立工作區，供產品訪談紀錄使用。
  if (sessionId && root && RECORD_EVENTS.has(event) && safeWorkspaceRoot(root)) {
    try { ensureWorkspace(root); } catch (error) { logError(root, event, 'workspace', error); }
  }
  let health = root ? readFlowState(root) : null;
  if (health?.kind === 'invalid') health = readFlowState(root); // 並行寫入瞬間可能讀到半寫檔：再讀一次才判定
  let interview = null;
  if (interviewApplies(root, sessionId)) {
    try {
      if (event === 'SessionStart') markSessionStart(root, sessionId, input.source);
      else if (event === 'UserPromptSubmit' || event === 'PreToolUse') {
        // 提問工具（名稱以 ask 開頭，如 AskUserQuestion）的呼叫累計為本輪提問證據；其餘事件只推進基準。
        const ask = event === 'PreToolUse' && /^ask/i.test(String(input.tool_name ?? input.toolName ?? '').split(/__|\./).at(-1) ?? '');
        recordInterviewEvent(root, sessionId, ask ? 'ask' : null);
      }
      interview = interviewStatus(root, sessionId);
    } catch (error) { logError(root, event, 'interview', error); }
  }
  let failure = null; // PostToolUseFailure 累計、PostToolUse 歸零——結果交給 decide 注入回退引導
  if ((event === 'PostToolUseFailure' || event === 'PostToolUse') && health?.kind === 'active') {
    try { failure = bumpFailure(root, sessionId, health.state.node, event === 'PostToolUse'); } catch (error) { logError(root, event, 'failure', error); }
  }
  const ctx = { cwd, root, health, interview, failure, source: typeof input.source === 'string' ? input.source : null };
  try { result = decide(event, input, ctx); } catch (error) { result = {}; logError(root, event, 'decide', error); }
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
