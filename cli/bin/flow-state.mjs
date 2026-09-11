// CLI 與 hooks 共用狀態分類；讀不到有效段位不等於沒有流程。
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const objectRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v, keys) => objectRecord(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const timestamp = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const nonNegativeInt = (v) => Number.isInteger(v) && v >= 0;
// 觀測紀錄（hooks 寫）：心跳／輸入流／理解流／外部證據＋回合計數（turnUsage／usageTotals）＋超限次數（budgetBreaches）
// ＋觀測流輪替偏移（inputsRotated 等＋understandingSeedHash——已輪替前綴的鏈種子；舊檔無偏移＝0，向後相容）。
const HOOK_RECORD_KEYS = ['hooksHeartbeat', 'inputs', 'understandings', 'externalEvidence', 'turnUsage', 'usageTotals', 'budgetBreaches', 'inputsRotated', 'understandingsRotated', 'understandingSeedHash', 'adversarialRotated', 'historyRotated'];
const hookRecords = (st) => Object.fromEntries(HOOK_RECORD_KEYS.filter(k => Object.hasOwn(st, k)).map(k => [k, st[k]]));
// 只接納 hooks 寫出的純紀錄；任一流程欄位（即使 null）或未知欄位都拒絕。
function hooksOnly(st) {
  const allowed = HOOK_RECORD_KEYS;
  if (!objectRecord(st) || !Object.keys(st).length || Object.keys(st).some(k => !allowed.includes(k))) return false;
  if (Object.hasOwn(st, 'hooksHeartbeat') && !(exactKeys(st.hooksHeartbeat, ['at', 'event']) && timestamp(st.hooksHeartbeat.at) && ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop'].includes(st.hooksHeartbeat.event))) return false;
  if (Object.hasOwn(st, 'inputs') && !(Array.isArray(st.inputs) && st.inputs.every(x => exactKeys(x, ['at', 'text']) && timestamp(x.at) && typeof x.text === 'string'))) return false;
  if (Object.hasOwn(st, 'externalEvidence') && !(exactKeys(st.externalEvidence, ['done', 'at', 'tool']) && st.externalEvidence.done === true && timestamp(st.externalEvidence.at) && ['WebSearch', 'WebFetch', 'Agent', 'Task', 'mcp__web_reader__webReader', 'web.run', 'web__run', 'functions.web__run', 'spawn_agent', 'collaboration.spawn_agent', 'functions.spawn_agent', 'webrun', 'collaborationspawn_agent', 'collaborationfollowup_task'].includes(st.externalEvidence.tool))) return false;
  if (Object.hasOwn(st, 'turnUsage')) {
    const tu = st.turnUsage;
    const tuKeys = ['startedAt', 'requests',
      ...(Object.hasOwn(tu, 'exceededAt') ? ['exceededAt'] : []),
      ...(Object.hasOwn(tu, 'escalatedAt') ? ['escalatedAt'] : []),
      ...(Object.hasOwn(tu, 'fingerprints') ? ['fingerprints'] : [])];
    if (!(exactKeys(tu, tuKeys) && timestamp(tu.startedAt) && nonNegativeInt(tu.requests)
      && (!Object.hasOwn(tu, 'exceededAt') || timestamp(tu.exceededAt))
      && (!Object.hasOwn(tu, 'escalatedAt') || timestamp(tu.escalatedAt))
      && (!Object.hasOwn(tu, 'fingerprints') || (objectRecord(tu.fingerprints) && Object.keys(tu.fingerprints).length <= 128 && Object.values(tu.fingerprints).every(nonNegativeInt))))) return false;
  }
  if (Object.hasOwn(st, 'usageTotals') && !(exactKeys(st.usageTotals, ['firstAt', 'requests']) && timestamp(st.usageTotals.firstAt) && nonNegativeInt(st.usageTotals.requests))) return false;
  for (const k of ['budgetBreaches', 'inputsRotated', 'understandingsRotated', 'adversarialRotated', 'historyRotated']) if (Object.hasOwn(st, k) && !nonNegativeInt(st[k])) return false;
  if (Object.hasOwn(st, 'understandingSeedHash') && !/^[0-9a-f]{16}$/.test(st.understandingSeedHash)) return false;
  if (Object.hasOwn(st, 'understandings')) {
    if (!Array.isArray(st.understandings)) return false;
    let prev = st.understandingSeedHash ?? '';
    const inputTop = Math.max(0, (st.inputsRotated ?? 0) + (st.inputs ?? []).length - 1);
    for (const x of st.understandings) {
      if (!(exactKeys(x, ['at', 'uptoInput', 'as', 'reviewed', 'hash']) && timestamp(x.at) && Number.isInteger(x.uptoInput) && x.uptoInput >= 0 && x.uptoInput <= inputTop && typeof x.as === 'string' && typeof x.reviewed === 'boolean')) return false;
      const hash = createHash('sha256').update(prev + String(x.uptoInput) + x.as + x.at).digest('hex').slice(0, 16);
      if (x.hash !== hash) return false;
      prev = hash;
    }
  }
  return true;
}

const branchName = (name) => typeof name === 'string' && name.length > 0 && spawnSync('git', ['check-ref-format', `refs/heads/${name}`], { encoding: 'utf8', timeout: 5000 }).status === 0;
const commitId = (id) => typeof id === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(id);
function validCloseout(st) {
  const c = st.closeout;
  return exactKeys(c, ['slug', 'workBranch', 'workCommit', 'baseBranch', 'at', 'remotes']) && c.slug === st.slug && branchName(c.workBranch) && (!st.workBranch || st.workBranch === c.workBranch) && commitId(c.workCommit) && branchName(c.baseBranch) && c.workBranch !== c.baseBranch && timestamp(c.at) && Array.isArray(c.remotes) && c.remotes.every(r => exactKeys(r, ['name', 'ref', 'configHash']) && typeof r.name === 'string' && r.name.length > 0 && typeof r.ref === 'string' && r.ref.startsWith('refs/heads/') && branchName(r.ref.slice(11)) && /^[0-9a-f]{64}$/.test(r.configHash));
}

// 產出遙測（sb end 留痕於 ended 態）：diff 由 git baseline..HEAD 時序分析得出（基質優先——不另建記錄）；
// 各鍵允許缺省值 null（無 git、舊流程無 baseline、計數缺檔），結構完整即有效。
function validTelemetry(t) {
  if (!exactKeys(t, ['diff', 'baseCommit', 'headCommit', 'adversarial', 'counts', 'durationMinutes', 'budgetBreaches'])) return false;
  if (t.diff !== null && !(exactKeys(t.diff, ['additions', 'deletions', 'files']) && [t.diff.additions, t.diff.deletions, t.diff.files].every(nonNegativeInt))) return false;
  if (!(t.baseCommit === null || commitId(t.baseCommit)) || !(t.headCommit === null || commitId(t.headCommit))) return false;
  if (t.adversarial !== null && !(exactKeys(t.adversarial, ['verdict', 'model']) && t.adversarial.verdict === '通過' && (t.adversarial.model === null || (typeof t.adversarial.model === 'string' && t.adversarial.model.trim().length > 0)))) return false;
  if (!(exactKeys(t.counts, ['inputs', 'understandings', 'adversarial', 'toolCalls']) && Object.values(t.counts).every(v => v === null || nonNegativeInt(v)))) return false;
  if (!(t.durationMinutes === null || (typeof t.durationMinutes === 'number' && t.durationMinutes >= 0))) return false;
  if (!(t.budgetBreaches === null || nonNegativeInt(t.budgetBreaches))) return false;
  return true;
}
// 對抗條目鍵集：point（時點條目）與 model（審查模型——報告內含「審查模型：」行則記，缺省無鍵）皆可選。
const ADV_ENTRY_KEYS = (x) => ['at', 'report', 'verdict', 'node', ...(Object.hasOwn(x, 'point') ? ['point'] : []), ...(Object.hasOwn(x, 'model') ? ['model'] : [])];
const ADV_ENTRY_SHAPE = (x, node) => objectRecord(x) && exactKeys(x, ADV_ENTRY_KEYS(x)) && timestamp(x.at) && typeof x.report === 'string' && x.report.trim() && x.verdict === '通過' && x.node === node
  && (!Object.hasOwn(x, 'point') || ['①', '②', '③'].includes(x.point))
  && (!Object.hasOwn(x, 'model') || (typeof x.model === 'string' && x.model.trim().length > 0));

function endedState(st) {
  const allowed = [...HOOK_RECORD_KEYS, 'slug', 'ms', 'node', 'history', 'endedAt', 'adversarialAt', 'adversarialConsumed', 'adversarialLog', 'rerunExtPending', 'understandingHold', 'workBranch', 'closeout', 'telemetry'];
  if (!objectRecord(st) || Object.keys(st).some(k => !allowed.includes(k))) return false;
  if (st.node !== 'ended' || typeof st.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(st.slug) || typeof st.ms !== 'string' || !/^\d{3,}$/.test(st.ms) || Number(st.ms) < 1 || !timestamp(st.endedAt) || !Array.isArray(st.history) || st.history.length) return false;
  if (Object.hasOwn(st, 'adversarialAt') && !timestamp(st.adversarialAt)) return false;
  if (Object.hasOwn(st, 'workBranch') && !branchName(st.workBranch)) return false;
  if (Object.hasOwn(st, 'closeout') && !validCloseout(st)) return false;
  if (Object.hasOwn(st, 'telemetry') && !validTelemetry(st.telemetry)) return false;
  if (Object.hasOwn(st, 'adversarialLog') && !(Array.isArray(st.adversarialLog) && st.adversarialLog.every((x) => ADV_ENTRY_SHAPE(x, 'ended')))) return false;
  for (const k of ['adversarialConsumed', 'rerunExtPending']) if (Object.hasOwn(st, k) && typeof st[k] !== 'boolean') return false;
  if (Object.hasOwn(st, 'understandingHold') && !(exactKeys(st.understandingHold, ['inputIdx', 'at']) && timestamp(st.understandingHold.at) && Number.isInteger(st.understandingHold.inputIdx) && st.understandingHold.inputIdx >= 0 && st.understandingHold.inputIdx < (st.inputsRotated ?? 0) + (st.inputs ?? []).length)) return false;
  const records = hookRecords(st);
  return !Object.keys(records).length || hooksOnly(records);
}

const validHold = (st) => !Object.hasOwn(st, 'understandingHold') ||
  (exactKeys(st.understandingHold, ['at', 'inputIdx']) && timestamp(st.understandingHold.at) &&
   Number.isInteger(st.understandingHold.inputIdx) && st.understandingHold.inputIdx >= 0 &&
   st.understandingHold.inputIdx < (st.inputsRotated ?? 0) + (st.inputs ?? []).length);
function uninitializedState(st) {
  if (hooksOnly(st)) return true;
  if (!objectRecord(st) || !Object.hasOwn(st, 'understandingHold') ||
      Object.keys(st).some(k => ![...HOOK_RECORD_KEYS, 'understandingHold'].includes(k))) return false;
  return validHold(st) && hooksOnly(hookRecords(st));
}
// 接納工具實際產生的無段位提交紀錄；不接納孤立 null、未知欄位或半個流程。
function directState(st) {
  const allowed = [...HOOK_RECORD_KEYS, 'slug', 'ms', 'node', 'history', 'adversarialLog', 'adversarialAt', 'adversarialConsumed', 'understandingHold'];
  if (!objectRecord(st) || Object.keys(st).some(k => !allowed.includes(k))) return false;
  const records = hookRecords(st);
  if (Object.keys(records).length && !hooksOnly(records)) return false;
  const skeleton = ['slug', 'ms', 'node', 'history'];
  if (skeleton.some(k => Object.hasOwn(st, k)) && !(skeleton.every(k => Object.hasOwn(st, k)) && st.slug === null && st.ms === null && st.node === null && Array.isArray(st.history) && !st.history.length)) return false;
  return validHold(st) && Array.isArray(st.adversarialLog) && st.adversarialLog.length > 0 &&
    st.adversarialLog.every((x) => ADV_ENTRY_SHAPE(x, null)) &&
    timestamp(st.adversarialAt) && st.adversarialAt === st.adversarialLog.at(-1).at && typeof st.adversarialConsumed === 'boolean';
}
const ACTIVE_NODES = new Set(['intent', 'requirement', 'research', 'plan', 'test', 'build', 'verify', 'done']);
// 回合預算（plan 段 sb budget 宣告）與 SOP／ROADMAP 審查戳記（sb sopreview）屬 ms 內欄位——跨 ms（--new-ms）由 CLI 清除。
function activeExtras(st) {
  if (Object.hasOwn(st, 'budget') && !(objectRecord(st.budget) && exactKeys(st.budget, ['requests', 'minutes', 'at', 'ms']) && Number.isInteger(st.budget.requests) && st.budget.requests >= 1 && st.budget.requests <= 10000 && Number.isInteger(st.budget.minutes) && st.budget.minutes >= 1 && st.budget.minutes <= 1440 && timestamp(st.budget.at) && st.budget.ms === st.ms)) return false;
  if (Object.hasOwn(st, 'sopReview') && !(exactKeys(st.sopReview, ['ms', 'at']) && st.sopReview.ms === st.ms && timestamp(st.sopReview.at))) return false;
  if (Object.hasOwn(st, 'baseCommit') && !(st.baseCommit === null || commitId(st.baseCommit))) return false;
  if (Object.hasOwn(st, 'startedAt') && !timestamp(st.startedAt)) return false;
  return true;
}
function activeRecords(st) {
  const records = hookRecords(st);
  // research／返工進段以 null 重置外部證據，屬正常流程產物。
  if (records.externalEvidence === null) delete records.externalEvidence;
  if (Object.keys(records).length && !hooksOnly(records)) return false;
  if (Object.hasOwn(st, 'adversarialLog') && !(Array.isArray(st.adversarialLog) && st.adversarialLog.every(objectRecord))) return false;
  if (Object.hasOwn(st, 'adversarialAt') && !timestamp(st.adversarialAt)) return false;
  if (Object.hasOwn(st, 'adversarialConsumed') && typeof st.adversarialConsumed !== 'boolean') return false;
  return activeExtras(st);
}
function classifyState(st) {
  if (uninitializedState(st)) return 'uninitialized';
  if (directState(st)) return 'direct';
  if (endedState(st)) return 'ended';
  if (objectRecord(st) && typeof st.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(st.slug) &&
      typeof st.ms === 'string' && /^\d{3,}$/.test(st.ms) && Number(st.ms) >= 1 &&
      Array.isArray(st.history) && st.history.every(objectRecord) && ACTIVE_NODES.has(st.node) && validHold(st) && activeRecords(st)) return 'active';
  return 'invalid';
}
function readFlowState(root) {
  const file = join(root, '.shiftblame', 'flow-state.json');
  let result;
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    result = { kind: classifyState(state), state };
  } catch (error) {
    if (error.code !== 'ENOENT') return { kind: 'invalid', state: null };
    try { lstatSync(file); return { kind: 'invalid', state: null }; }
    catch (statError) { if (statError.code !== 'ENOENT') return { kind: 'invalid', state: null }; }
    result = { kind: 'missing', state: null };
  }
  if (['missing', 'uninitialized', 'direct'].includes(result.kind)) {
    try { if (hasFlowArtifacts(root)) result.kind = 'invalid'; }
    catch { result.kind = 'invalid'; } // 查不到目錄內容不等於空工作區。
  }
  return result;
}
function hasFlowArtifacts(root) {
  const dir = join(root, '.shiftblame');
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch (error) {
    if (error.code === 'ENOENT') {
      try { lstatSync(dir); }
      catch (statError) { if (statError.code === 'ENOENT') return false; throw statError; }
    }
    throw error;
  }
  for (const entry of entries) {
    if (entry.name === 'tmp' || entry.name === 'flow-state.json') continue;
    if (entry.name === 'archive') {
      if (readdirSync(join(dir, entry.name)).length) return true;
    } else if (entry.isDirectory() || entry.isSymbolicLink() || /^(?:SLUG|G[123])\.md$/i.test(entry.name)) return true;
  }
  return false;
}
export { objectRecord, exactKeys, timestamp, hookRecords, hooksOnly, uninitializedState, directState,
  endedState, validCloseout, classifyState, readFlowState };
