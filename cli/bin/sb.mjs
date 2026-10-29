#!/usr/bin/env node
// sb — Shiftblame 的提交訊息、文件與交接檢查。
// 在專案根以 git 事實與正式文件核對提交前提；語義與真實驗收由對話及行為證據承載。
// 使用 Node 內建模組；工作記錄存於 <repo>/.shiftblame/tmp/。
// exit：0 = 通過，1 = 條件不符，2 = 用法錯誤。

import { appendFileSync, cpSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { commitMessageIssue, stagedFiles, stagedSystemMessage } from './commit-format.mjs';
import { policy } from './policy.mjs';
import { runHandoff } from './handoff.mjs';
import { findRoot } from './project-root.mjs';
import { inspectWorkspace, runWorkspace, ensureWorkspaceStorage } from './workspace.mjs';

// 專案根錨定：從執行目錄向上找 .git／既有 .shiftblame（子目錄執行時錨定到正確工作區；磁碟根與系統頂層目錄不作錨點）
// （相對路徑展開到錯誤資料夾是破壞與污染的共同來源；所有狀態路徑一律錨定絕對根）
const ROOT = findRoot(process.cwd());
const SB_DIR = join(ROOT, '.shiftblame');
const TMP = join(SB_DIR, 'tmp');

const out = (m) => console.log(m);
const die = (msgs, code = 1) => { console.error('FAIL'); for (const m of msgs) console.error(`  ✗ ${m}`); process.exit(code); };
const fin = (msgs) => { console.log('pass'); for (const m of msgs) console.log(`  ✓ ${m}`); process.exit(0); };
const usage = (code = 2) => {
  console[code ? 'error' : 'log']([
    'sb — Shiftblame 提交、文件與交接檢查',
    '',
    '用法：',
    '  sb state                              顯示專案根、工作區與交接入口',
    '  sb commitmsg "<訊息>"                 檢查非空單行訊息與 staged 工作區檔案，產生可選提交章',
    '  sb rewrite                            快照 README 與 docs；外部政策可加入文件檢查',
    '  sb workspace <migrate|init|check|clean>      遷移、建立或核對本機文件與 local exclude',
    '  sb handoff save <task> <notes.md>     保存具名工作的機械快照',
    '  sb handoff list                       列出具名工作及損壞診斷',
    '  sb handoff show <task>                讀取指定交接並核對目前差異',
    '  sb handoff load [task]                讀取目前 Git 與指定工作的交接',
    '  sb handoff refresh                    從當前 Git 更新交接文件',
    '  sb --help',
  ].join('\n'));
  process.exit(code);
};

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

// Optional policy owns document conventions; the default only preserves an editable snapshot.
const documentPolicy = policy.createCli?.({ ROOT, SB_DIR, TMP, die, fin, inspectWorkspace });
function cmdRewrite() {
  if (documentPolicy?.rewrite) return documentPolicy.rewrite();
  const target = join(TMP, 'rewrite-backup', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if ((entry.isFile() && /^readme(?:\.[^/]+)?$/i.test(entry.name)) || (entry.isDirectory() && entry.name === 'docs')) {
      cpSync(join(ROOT, entry.name), join(target, entry.name), { recursive: true });
    }
  }
  let local;
  try { const layout = inspectWorkspace(ROOT); local = [layout.agents, layout.roadmap]; }
  catch { local = [join(ROOT, 'AGENTS.md'), join(ROOT, 'ROADMAP.md')]; }
  for (const file of local.filter(existsSync)) {
    const rel = file.slice(resolve(ROOT).length + 1);
    mkdirSync(dirname(join(target, rel)), { recursive: true });
    cpSync(file, join(target, rel));
  }
  fin([`文件快照：${target}`, '依專案慣例檢閱內容、連結與實際行為；未設定額外文件政策']);
}

function cmdState() {
  out(`專案根：${ROOT}`);
  out(`工作區：${existsSync(SB_DIR) ? `${SB_DIR}（不入庫）` : '尚未建立（使用 CLI 時按需建立）'}`);
  out('交接：sb handoff load 從當前 Git 重新整理；show <task> 可查閱舊快照。');
}

function cmdCommitmsg(msg) {
  if (!msg) usage();
  const { staged, system } = stagedFiles(ROOT);
  if (system.length) die([stagedSystemMessage(system)]);
  // Validator failures must remain failures, including exceptions from external policy.
  documentPolicy?.checkStaged?.(staged);
  const issue = commitMessageIssue(msg);
  if (issue) die([issue]);
  // The stamp is consumed only when the selected policy requires it.
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, 'commit-stamp.json'), JSON.stringify({ message: msg, cwd: ROOT, issuedAt: new Date().toISOString() }, null, 2));
  fin([`提交訊息合格：${msg}`, `印章已寫入 ${join(TMP, 'commit-stamp.json')}；僅啟用提交章政策時由 hook 核對`]);
}

// ———— main ————

const [cmd, ...rest] = process.argv.slice(2);
// sb usage 事件：每次調用（子命令＋參數摘要）落 tmp JSONL——sb 呼叫頻譜的機械觀測層
// （使用者可隨時清理該檔；缺檔自動重建；觀測失敗靜默——遙測失效不影響本命令執行）。
let usageLogged = false;
function logUsage() {
  if (usageLogged) return;
  usageLogged = true;
  try {
    ensureWorkspaceStorage(ROOT);
    appendFileSync(join(TMP, 'sb-usage.jsonl'), JSON.stringify({ at: new Date().toISOString(), cmd: cmd ?? '(none)', args: rest.join(' ').slice(0, 120) }) + '\n');
  } catch { /* 觀測落檔失敗不攔主流程 */ }
}
// handoff 自行由 Git 錨定 canonical repo；安全檢查前不得由既有遙測寫入任何目錄。
if (cmd === 'workspace') {
  try {
    if (rest.length !== 1) throw Error('用法：sb workspace <migrate|init|check|clean>');
    const result = runWorkspace(rest[0]);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
} else if (cmd === 'handoff') {
  if (rest.includes('--help')) usage(0);
  try { process.exitCode = await runHandoff(rest); }
  catch (error) { console.error(`FAIL\n  ✗ ${error.message}`); process.exitCode = 1; }
} else {
// 只寫入既有工作區或目前所在的 Git 專案根：非 Git 資料夾（如家目錄）不因查詢多出工作區，
// 否則其下子資料夾都會向上錨定到這裡。
if (existsSync(SB_DIR) || (ROOT === resolve(process.cwd()) && hasGitMetadata())) logUsage();
if (!cmd) usage();
if (cmd === '--help' || rest.includes('--help')) usage(0);
const pos = [];
for (const arg of rest) {
  if (arg.startsWith('--')) usage(); // 未知旗標（拼錯）直接提示 usage
  pos.push(arg);
}
switch (cmd) {
  case 'state': if (pos.length) usage(); cmdState(); break;
  case 'commitmsg': cmdCommitmsg(pos.join(' ')); break;
  case 'rewrite': cmdRewrite(); break;
  default: usage();
}
}
