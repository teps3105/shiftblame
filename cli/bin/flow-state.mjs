// CLI 與 hooks 共用狀態分類；讀不到有效段位不等於沒有流程。
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const objectRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v, keys) => objectRecord(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const timestamp = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const nonNegativeInt = (v) => Number.isInteger(v) && v >= 0;
// 觀測紀錄（hooks 寫）：心跳／外部證據／rewrite 載入鑰匙＋回合計數（turnUsage／usageTotals）。
// 對話性質流（輸入流／理解流雜湊鏈）不落檔——對話事實由平台承載（基質優先），flow-state 只承載當下階段證據。
const HOOK_RECORD_KEYS = ['hooksHeartbeat', 'externalEvidence', 'turnUsage', 'usageTotals', 'rewriteSeen'];
const hookRecords = (st) => Object.fromEntries(HOOK_RECORD_KEYS.filter(k => Object.hasOwn(st, k)).map(k => [k, st[k]]));
// 只接納 hooks 寫出的純紀錄；任一流程欄位（即使 null）或未知欄位都拒絕。
function hooksOnly(st) {
  const allowed = HOOK_RECORD_KEYS;
  if (!objectRecord(st) || !Object.keys(st).length || Object.keys(st).some(k => !allowed.includes(k))) return false;
  if (Object.hasOwn(st, 'hooksHeartbeat') && !(exactKeys(st.hooksHeartbeat, ['at', 'event']) && timestamp(st.hooksHeartbeat.at) && ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop'].includes(st.hooksHeartbeat.event))) return false;
  if (Object.hasOwn(st, 'externalEvidence') && !(exactKeys(st.externalEvidence, ['done', 'at', 'tool']) && st.externalEvidence.done === true && timestamp(st.externalEvidence.at) && ['WebSearch', 'WebFetch', 'Agent', 'Task', 'mcp__web_reader__webReader', 'web.run', 'web__run', 'functions.web__run', 'spawn_agent', 'collaboration.spawn_agent', 'functions.spawn_agent', 'webrun', 'collaborationspawn_agent', 'collaborationfollowup_task'].includes(st.externalEvidence.tool))) return false;
  if (Object.hasOwn(st, 'rewriteSeen') && !(exactKeys(st.rewriteSeen, ['rev', 'at']) && nonNegativeInt(st.rewriteSeen.rev) && timestamp(st.rewriteSeen.at))) return false; // shiftblame:rewrite 本輪載入事實（返工輪寫 G 閘的鑰匙）
  if (Object.hasOwn(st, 'turnUsage')) {
    const tu = st.turnUsage;
    const tuKeys = ['startedAt', 'requests',
      ...(Object.hasOwn(tu, 'escalatedAt') ? ['escalatedAt'] : []),
      ...(Object.hasOwn(tu, 'escalations') ? ['escalations'] : []),
      ...(Object.hasOwn(tu, 'fpEscalations') ? ['fpEscalations'] : []),
      ...(Object.hasOwn(tu, 'repeats') ? ['repeats'] : [])];
    if (!(exactKeys(tu, tuKeys) && timestamp(tu.startedAt) && nonNegativeInt(tu.requests)
      && (!Object.hasOwn(tu, 'escalatedAt') || timestamp(tu.escalatedAt))
      && (!Object.hasOwn(tu, 'escalations') || nonNegativeInt(tu.escalations))
      && (!Object.hasOwn(tu, 'fpEscalations') || (objectRecord(tu.fpEscalations) && Object.keys(tu.fpEscalations).length <= 128 && Object.values(tu.fpEscalations).every(v => v === true)))
      && (!Object.hasOwn(tu, 'repeats') || (objectRecord(tu.repeats) && Object.keys(tu.repeats).length <= 128 && Object.values(tu.repeats).every(v => v === 'seen' || v === 'denied'))))) return false;
  }
  if (Object.hasOwn(st, 'usageTotals') && !(exactKeys(st.usageTotals, ['firstAt', 'requests']) && timestamp(st.usageTotals.firstAt) && nonNegativeInt(st.usageTotals.requests))) return false;
  return true;
}

const branchName = (name) => typeof name === 'string' && name.length > 0 && spawnSync('git', ['check-ref-format', `refs/heads/${name}`], { encoding: 'utf8', timeout: 5000 }).status === 0;
const commitId = (id) => typeof id === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(id);
function validCloseout(st) {
  const c = st.closeout;
  return exactKeys(c, ['slug', 'workBranch', 'workCommit', 'baseBranch', 'at', 'remotes']) && c.slug === st.slug && branchName(c.workBranch) && (!st.workBranch || st.workBranch === c.workBranch) && commitId(c.workCommit) && branchName(c.baseBranch) && c.workBranch !== c.baseBranch && timestamp(c.at) && Array.isArray(c.remotes) && c.remotes.every(r => exactKeys(r, ['name', 'ref', 'configHash']) && typeof r.name === 'string' && r.name.length > 0 && typeof r.ref === 'string' && r.ref.startsWith('refs/heads/') && branchName(r.ref.slice(11)) && /^[0-9a-f]{64}$/.test(r.configHash));
}

// 舊檔載入即遷移（對話性質流不落檔——讀取端統一剝除；寫入點自然落新形）：
// 輸入流／理解流（含雜湊鏈與輪替偏移）直接刪——對話事實由平台承載；
// 對抗流轉各時點最後條目（lastAdv）、推進流轉各邊最後時戳（edgeAt）——閘門新鮮度對照語義不變，承載由無界清單改定長欄位。
function migrateStreams(st) {
  if (!objectRecord(st)) return st;
  const ended = st.node === 'ended'; // ended 白名單不含 lastAdv/edgeAt——對抗流與推進流對已終態無閘門對照價值，只刪不轉
  delete st.inputs; delete st.understandings; delete st.understandingHold;
  delete st.inputsRotated; delete st.understandingsRotated; delete st.understandingSeedHash;
  delete st.adversarialRotated; delete st.historyRotated;
  if (Array.isArray(st.adversarialLog)) {
    if (!ended) {
      const lastAdv = st.lastAdv ?? {};
      for (const p of ['1', '2']) {
        const e = st.adversarialLog.filter((x) => x?.point === p).at(-1);
        if (e && !objectRecord(lastAdv[p])) lastAdv[p] = { at: e.at, report: e.report, verdict: e.verdict, node: e.node, ...(e.model ? { model: e.model } : {}) };
      }
      if (Object.keys(lastAdv).length) st.lastAdv = lastAdv;
    }
    delete st.adversarialLog;
  }
  if (Array.isArray(st.history)) {
    if (!ended) {
      const edgeAt = st.edgeAt ?? {};
      for (const h of st.history) if (h?.from && h?.to && timestamp(h.at)) edgeAt[`${h.from}→${h.to}`] = h.at;
      if (Object.keys(edgeAt).length) st.edgeAt = edgeAt;
    }
    delete st.history;
  }
  delete st.adversarialAt; delete st.adversarialConsumed;
  // 舊版流程鍵冪等剝除（2.0x 時代欄位——讀取端統一清理；active 容忍未知鍵但 ended 白名單拒絕）
  delete st.stamps; delete st.unlockLog; delete st.thinkRouted; delete st.dialogueLock; delete st.input; delete st.testBaseline; delete st.rerunExtPending;
  if (ended) delete st.g1Contract; // 契約屬活動流程欄位（cmdEnd 冪等清理承載）——舊 ended 檔未經新 cmdEnd，此處補剝
  if (objectRecord(st.stopReport) && Object.hasOwn(st.stopReport, 'inputIdx')) {
    const { inputIdx, ...rest } = st.stopReport;
    st.stopReport = rest;
  }
  if (objectRecord(st?.turnUsage)) { // 斷路器形態遷移：舊計數形（fingerprints／fpEscalations 數字值）歸零重觀察；
    // 新形標記（fpEscalations 值===true）＝模式②升級事實，保留——否則 sb next 讀寫一輪即剝除，模式③永不觸發
    delete st.turnUsage.fingerprints;
    if (objectRecord(st.turnUsage.fpEscalations)) for (const k of Object.keys(st.turnUsage.fpEscalations)) { if (st.turnUsage.fpEscalations[k] !== true) delete st.turnUsage.fpEscalations[k]; }
  }
  return st;
}

// 產出遙測（sb end 留痕於 ended 態）：diff 由 git baseline..HEAD 時序分析得出（基質優先——不另建記錄）；
// 各鍵允許缺省值 null（無 git、舊流程無 baseline、計數缺檔），結構完整即有效。counts 形狀世代相容（舊檔含已拆流計數）。
function validTelemetry(t) {
  if (!exactKeys(t, ['diff', 'baseCommit', 'headCommit', 'adversarial', 'counts', 'durationMinutes'])) return false;
  if (t.diff !== null && !(exactKeys(t.diff, ['additions', 'deletions', 'files']) && [t.diff.additions, t.diff.deletions, t.diff.files].every(nonNegativeInt))) return false;
  if (!(t.baseCommit === null || commitId(t.baseCommit)) || !(t.headCommit === null || commitId(t.headCommit))) return false;
  if (t.adversarial !== null && !(exactKeys(t.adversarial, ['verdict', 'model']) && t.adversarial.verdict === '通過' && (t.adversarial.model === null || (typeof t.adversarial.model === 'string' && t.adversarial.model.trim().length > 0)))) return false;
  if (!(objectRecord(t.counts) && Object.values(t.counts).every(v => v === null || nonNegativeInt(v)))) return false;
  if (!(t.durationMinutes === null || (typeof t.durationMinutes === 'number' && t.durationMinutes >= 0))) return false;
  return true;
}
// 對抗條目鍵集：point（時點條目）與 model（審查模型——報告內含「審查模型：」行則記，缺省無鍵）皆可選。
const ADV_ENTRY_KEYS = (x) => ['at', 'report', 'verdict', 'node', ...(Object.hasOwn(x, 'point') ? ['point'] : []), ...(Object.hasOwn(x, 'model') ? ['model'] : [])];
const ADV_ENTRY_SHAPE = (x, node) => objectRecord(x) && exactKeys(x, ADV_ENTRY_KEYS(x)) && timestamp(x.at) && typeof x.report === 'string' && x.report.trim() && x.verdict === '通過' && x.node === node
  && (!Object.hasOwn(x, 'point') || ['1', '2'].includes(x.point))
  && (!Object.hasOwn(x, 'model') || (typeof x.model === 'string' && x.model.trim().length > 0));

function endedState(st) {
  const allowed = [...HOOK_RECORD_KEYS, 'slug', 'ms', 'node', 'endedAt', 'workBranch', 'closeout', 'telemetry', 'msBaseline', 'msTelemetry', 'concludedAt'];
  if (!objectRecord(st) || Object.keys(st).some(k => !allowed.includes(k))) return false;
  if (st.node !== 'ended' || typeof st.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(st.slug) || typeof st.ms !== 'string' || !/^\d{3,}$/.test(st.ms) || Number(st.ms) < 1 || !timestamp(st.endedAt)) return false;
  if (Object.hasOwn(st, 'concludedAt') && !timestamp(st.concludedAt)) return false; // sb init --main 完結戳（維持 ended 分類——main 直接作業）
  if (Object.hasOwn(st, 'workBranch') && !branchName(st.workBranch)) return false;
  if (Object.hasOwn(st, 'closeout') && !validCloseout(st)) return false;
  if (Object.hasOwn(st, 'telemetry') && !validTelemetry(st.telemetry)) return false;
  if (Object.hasOwn(st, 'msBaseline') && !(st.msBaseline === null || commitId(st.msBaseline))) return false; // per-ms 遙測基準（ended 帶全帳本）
  if (Object.hasOwn(st, 'msTelemetry') && !(objectRecord(st.msTelemetry) && Object.entries(st.msTelemetry).every(([k, v]) => /^\d{3,}$/.test(k) && objectRecord(v) && exactKeys(v, ['diff', 'settledAt']) && v.diff !== null && exactKeys(v.diff, ['additions', 'deletions', 'files']) && [v.diff.additions, v.diff.deletions, v.diff.files].every(nonNegativeInt) && timestamp(v.settledAt)))) return false;
  const records = hookRecords(st);
  return !Object.keys(records).length || hooksOnly(records);
}

function uninitializedState(st) {
  return hooksOnly(st);
}
// 接納工具實際產生的無段位提交紀錄；不接納孤立 null、未知欄位或半個流程。
function directState(st) {
  const allowed = [...HOOK_RECORD_KEYS, 'slug', 'ms', 'node'];
  if (!objectRecord(st) || Object.keys(st).some(k => !allowed.includes(k))) return false;
  const skeleton = ['slug', 'ms', 'node'];
  if (skeleton.some(k => Object.hasOwn(st, k)) && !(skeleton.every(k => Object.hasOwn(st, k)) && st.slug === null && st.ms === null && st.node === null)) return false;
  const records = hookRecords(st);
  return !Object.keys(records).length || hooksOnly(records);
}
const ACTIVE_NODES = new Set(['intent', 'requirement', 'research', 'plan', 'test', 'build', 'verify', 'done']);
// SOP／ROADMAP 審查戳記（sb sopreview）屬 ms 內欄位——跨 ms（--new-ms）由 CLI 清除。
function activeExtras(st) {
  // worktrees（已移除的多代理工作樹帳本）殘留鍵由 sb end 冪等清理，此處不驗不拒（舊檔兼容）。
  if (Object.hasOwn(st, 'sopReview') && !(exactKeys(st.sopReview, ['ms', 'at', ...(Object.hasOwn(st.sopReview, 'answers') ? ['answers'] : [])]) && st.sopReview.ms === st.ms && timestamp(st.sopReview.at)
    && (!Object.hasOwn(st.sopReview, 'answers') || (typeof st.sopReview.answers === 'string' && [...st.sopReview.answers.trim()].length >= 10)))) return false;
  if (Object.hasOwn(st, 'baseCommit') && !(st.baseCommit === null || commitId(st.baseCommit))) return false;
  if (Object.hasOwn(st, 'startedAt') && !timestamp(st.startedAt)) return false;
  if (Object.hasOwn(st, 'msBaseline') && !(st.msBaseline === null || commitId(st.msBaseline))) return false; // per-ms 遙測基準
  if (Object.hasOwn(st, 'msTelemetry') && !(objectRecord(st.msTelemetry) && Object.entries(st.msTelemetry).every(([k, v]) => /^\d{3,}$/.test(k) && objectRecord(v) && exactKeys(v, ['diff', 'settledAt']) && v.diff !== null && exactKeys(v.diff, ['additions', 'deletions', 'files']) && [v.diff.additions, v.diff.deletions, v.diff.files].every(nonNegativeInt) && timestamp(v.settledAt)))) return false;
  if (Object.hasOwn(st, 'stopReport') && !(objectRecord(st.stopReport) && exactKeys(st.stopReport, ['at', 'node', 'question', 'reviewed'])
    && timestamp(st.stopReport.at)
    && typeof st.stopReport.node === 'string' && ACTIVE_NODES.has(st.stopReport.node)
    && typeof st.stopReport.question === 'string' && [...st.stopReport.question.trim()].length >= 10
    && typeof st.stopReport.reviewed === 'boolean')) return false;
  if (Object.hasOwn(st, 'stopBlockedAt') && !timestamp(st.stopBlockedAt)) return false;
  return true;
}
function activeRecords(st) {
  const records = hookRecords(st);
  // research／返工進段以 null 重置外部證據，屬正常流程產物。
  if (records.externalEvidence === null) delete records.externalEvidence;
  if (Object.keys(records).length && !hooksOnly(records)) return false;
  if (Object.hasOwn(st, 'lastAdv') && !(objectRecord(st.lastAdv) && Object.entries(st.lastAdv).every(([k, v]) => ['1', '2'].includes(k) && ADV_ENTRY_SHAPE(v, v.node)))) return false;
  if (Object.hasOwn(st, 'edgeAt') && !(objectRecord(st.edgeAt) && Object.values(st.edgeAt).every(timestamp))) return false;
  return activeExtras(st);
}
function classifyState(st) {
  if (uninitializedState(st)) return 'uninitialized';
  if (directState(st)) return 'direct';
  if (endedState(st)) return 'ended';
  if (objectRecord(st) && typeof st.slug === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(st.slug) &&
      typeof st.ms === 'string' && /^\d{3,}$/.test(st.ms) && Number(st.ms) >= 1 &&
      ACTIVE_NODES.has(st.node) && activeRecords(st)) return 'active';
  return 'invalid';
}
function readFlowState(root) {
  const file = join(root, '.shiftblame', 'flow-state.json');
  let result;
  try {
    const state = migrateStreams(JSON.parse(readFileSync(file, 'utf8')));
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
export { objectRecord, exactKeys, timestamp, hookRecords, hooksOnly, migrateStreams, uninitializedState, directState,
  endedState, validCloseout, classifyState, readFlowState };
