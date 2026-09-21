// 外部研究工具判準——hooks 標記側、CLI 閘門與狀態驗證共用的單一事實來源。
// 跨平台通用結構：內建精確名單（各平台已查證的註冊事件名）＋repo 設定擴充
// （<root>/.shiftblame/external-tools.json，僅 git 追蹤且工作樹乾淨時生效——
// 設定內容經提交審查面，agent 未提交的自寫設定不生效，防自肥外部性閘）。
// 精確錨定不變：全等匹配，大小寫／相近名／內嵌字串不計；MCP 以 server 為信任單位
// （設定條目 mcp__ 開頭且 __ 結尾＝承接整個 server，其餘條目一律精確全等）。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const BUILTIN_EXTERNAL_TOOLS = Object.freeze([
  'WebSearch', 'WebFetch', 'Agent', 'Task',
  'mcp__web_reader__webReader',
  'web.run', 'web__run', 'functions.web__run',
  'spawn_agent', 'collaboration.spawn_agent', 'functions.spawn_agent',
  'webrun', 'collaborationspawn_agent', 'collaborationfollowup_task',
]);
const BUILTIN = new Set(BUILTIN_EXTERNAL_TOOLS);

const TOOL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const MAX_CONFIG_TOOLS = 64;
const CONFIG_REL = join('.shiftblame', 'external-tools.json');

// 工具名形狀（設定條目與狀態驗證共用；externalEvidence 的成員資格由 isExternalResearchTool 全驗——紀錄只能來自 hooks）
export const isToolName = (v) => typeof v === 'string' && TOOL_NAME_RE.test(v);

// { unavailable }＝git 無法執行；{ out: null }＝有 git 但指令失敗；{ out }＝成功輸出。
const gitOut = (root, args) => {
  try {
    const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    if (r.error) return { unavailable: true };
    return r.status === 0 ? { out: r.stdout } : { out: null };
  } catch { return { unavailable: true }; }
};

// 設定擴充狀態：{ "tools": ["ExactName", "mcp__server__"] }。
// 未追蹤／未提交變更／非 git／形狀無效 → 整份不生效（fail-closed），reason 供閘門提示。
export function externalToolConfigStatus(root) {
  if (!root || !existsSync(join(root, CONFIG_REL))) return { active: false, tools: [], reason: '' };
  const tracked = gitOut(root, ['ls-files', '--error-unmatch', '--', CONFIG_REL]);
  if (tracked.unavailable) return { active: false, tools: [], reason: 'git 無法執行（fail-closed）' };
  if (tracked.out === null) {
    return { active: false, tools: [], reason: '未以 git 追蹤（提交後生效）' };
  }
  const status = gitOut(root, ['status', '--porcelain', '--', CONFIG_REL]);
  if (status.unavailable) return { active: false, tools: [], reason: 'git 無法執行（fail-closed）' };
  if (((status.out ?? 'dirty')).trim().length > 0) {
    return { active: false, tools: [], reason: '有未提交變更（提交後生效）' };
  }
  let parsed;
  try { parsed = JSON.parse(readFileSync(join(root, CONFIG_REL), 'utf8')); } catch { return { active: false, tools: [], reason: 'JSON 無法解析' }; }
  const tools = parsed?.tools;
  // mcp__server__ 前綴條件：以 __ 分段且 server 段非空（裸 'mcp__' 是整個 MCP 命名空間萬用——拒）。
  const entryOk = (t) => isToolName(t) && (t === 'mcp__' ? false : (!t.endsWith('__') || t.startsWith('mcp__')));
  if (!Array.isArray(tools) || !tools.length || tools.length > MAX_CONFIG_TOOLS
    || Object.keys(parsed).length !== 1 || !tools.every(entryOk)) {
    return { active: false, tools: [], reason: '格式無效（須 { "tools": [名稱陣列] }，條目為精確工具名或 mcp__server__ 前綴）' };
  }
  return { active: true, tools: [...new Set(tools)], reason: '' };
}

export function isExternalResearchTool(name, root) {
  const n = String(name ?? '');
  if (!isToolName(n)) return false;
  if (BUILTIN.has(n)) return true;
  const cfg = externalToolConfigStatus(root);
  if (!cfg.active) return false;
  return cfg.tools.some((e) => (e.endsWith('__') ? n.startsWith(e) : n === e));
}
