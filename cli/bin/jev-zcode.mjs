import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { judgeRoute } from './jev-route.mjs';

const sessions = new WeakMap();
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
let networkActive = 0;
const secretValue = value => /\b(?:sk|ghp|gho|github_pat|xoxb|xoxp)[_-][\w-]+|\beyJ[\w-]+\.[\w-]+\.[\w-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|Bearer\s+[A-Za-z0-9._~+\/-]{12,}|https?:\/\/[^\s"<>]*[?@][^\s"<>]+|(?:api[_ -]?key|password|secret|密碼|憑證)["']?\s*[:=]\s*["']?[A-Za-z0-9+\/_-]{12,}/i.test(value);

// 適用範圍是已有參數的唯讀候選。生成與缺證為同次分類的明確出口，沒有全域數字門檻。
// 模型、題型及範圍一起驗證；原生 executor 仍負責操作授權。
export const hostProfile = Object.freeze({
  model: 'jev-1.13.0',
  accept: decision => decision.judgments.every(answer => {
    const selected = answer.probabilities[answer.choice];
    return Object.entries(answer.probabilities).every(([key,value]) => key === answer.choice || selected > value);
  })
});

function turnState(runtime) {
  const active = runtime.getActiveTurnInfo?.();
  if (!active?.turnId || !runtime.sessionId) return null;
  const key = `${runtime.sessionId}/${active.turnId}/${active.inputId ?? ''}`;
  let state = sessions.get(runtime);
  if (state?.key !== key) {
    state = { key, seenProvider: false, pending: new Set(),
      metrics: { providerRequests: 0, jevAttempts: 0, directCalls: 0, fallbackCalls: 0, jevMs: 0, routeVisits:0, lastSkip:null, viewBytes:0 } };
    sessions.set(runtime, state);
  }
  return state;
}

function publish(runtime, state) {
  // 只有有治理工作區的專案保存定長計數；不保存輸入、對話、判斷內容或工具參數。
  try {
    const root = realpathSync(runtime.workingDirectory);
    let dir = join(root, '.shiftblame');
    if (!existsSync(dir) || lstatSync(dir).isSymbolicLink()) return;
    for (const name of ['tmp', 'jev']) {
      dir = join(dir, name);
      if (!existsSync(dir)) mkdirSync(dir);
      if (lstatSync(dir).isSymbolicLink()) return;
    }
    const file = join(dir, `runtime-${String(runtime.sessionId).replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
    if (existsSync(file) && lstatSync(file).isSymbolicLink()) return;
    writeFileSync(file, JSON.stringify({ turn: state.key, ...state.metrics }));
  } catch { /* 計數保存失敗不改變工具或生成路徑。 */ }
}

export function noteProviderRequest(runtime) {
  const state = turnState(runtime);
  if (!state) return;
  state.seenProvider = true;
  state.metrics.providerRequests++;
  publish(runtime, state);
}

function textContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.some(block => !['text','reasoning'].includes(block?.type) || typeof block.text !== 'string')) return null;
  return content.map(block => block.text).join('\n');
}

export function observe(request, onSkip = () => {}) {
  if (!Array.isArray(request.messages)) return null;
  const boundary = request.latestRealUserMessageIndex;
  if (!Number.isInteger(boundary) || request.messages[boundary]?.role !== 'user') return null;
  const context = [], observations = [], completed = new Set(), calls = new Map();
  const toolMap = new Map(request.tools.map(tool => [tool.name, tool]));
  for (const [index, message] of request.messages.entries()) {
    if (!['system', 'developer', 'user', 'assistant', 'tool'].includes(message.role)) return null;
    const content = textContent(message.content ?? '');
    if (content === null || secretValue(content)) return null;
    const row = { role: message.role, content:Array.isArray(message.content)?message.content.map(({type,text})=>({type,text})):content };
    if (message.toolCalls !== undefined) {
      if (!Array.isArray(message.toolCalls) || message.toolCalls.some(call => typeof call.id !== 'string' || typeof call.name !== 'string' || !plain(call.input))) return null;
      row.toolCalls = message.toolCalls.map(({id,name,input}) => ({id,name,input}));
      if (index > boundary) for (const call of row.toolCalls) calls.set(call.id, call);
    }
    if (message.role === 'tool') {
      Object.assign(row, {toolCallId:message.toolCallId, toolName:message.toolName, isError:message.isError === true});
      if (index > boundary) {
        observations.push({ toolCallId: message.toolCallId, tool: message.toolName, error: message.isError === true, content });
        const call = calls.get(message.toolCallId);
        if (call && !message.isError) {
          // 寫入會使舊讀取失效；相同狀態的成功讀取不用再交模型決定是否重做。
          if (toolMap.get(call.name)?.readOnly !== true) completed.clear();
          else completed.add(digest({name:call.name,input:call.input}));
        }
      }
    }
    context.push(row);
  }
  if (!observations.length) return null;
  const state = { goal: textContent(request.messages[boundary].content), currentUserMessageIndex: boundary, context,
    observationIndices:context.flatMap((row,index)=>index>boundary && row.role==='tool'?[index]:[]) };
  const serialized = JSON.stringify(state);
  const bytes=Buffer.byteLength(serialized);
  if (bytes > 60000) { onSkip('context_budget',bytes); return null; }
  if (secretValue(serialized)) { onSkip('sensitive_value',bytes); return null; }
  return { state, completed, observations };
}

export async function routeModelRequest(runtime, request, options = {}) {
  request.abortSignal?.throwIfAborted();
  const state = turnState(runtime);
  if (!state) return null;
  state.metrics.routeVisits++;
  const skip=(reason,bytes=0)=>{state.metrics.lastSkip=reason;state.metrics.viewBytes=bytes;publish(runtime,state);return null;};
  // 當回合第一次生成保留意圖揭露；只接手其後真正存在工具狀態的低階決策。
  if (!state.seenProvider) return skip('initial_generation');
  if (!Array.isArray(request.tools) || networkActive >= 8) return skip('capacity_or_tools');
  let viewReason='message_shape',viewBytes=0;
  const view = observe(request,(reason,bytes)=>{viewReason=reason;viewBytes=bytes;});
  if (!view) return skip(viewReason,viewBytes);
  const observed = view.state;
  for (const item of view.observations) {
    state.pending.delete(item.toolCallId);
  }
  if (state.pending.size) return skip('pending_execution');
  if (view.observations.at(-1)?.error) return skip('tool_error');
  const eligibleTools = request.tools.filter(tool => tool.readOnly === true && tool.destructive !== true &&
    tool.requiresUserInteraction !== true && tool.sideEffectScope === 'none');
  if (!eligibleTools.length) return skip('no_eligible_tool');
  // 接入者須提供完成驗證的策略；沒有策略不發送一個注定不會採用的 Jev 請求。
  if (typeof options.accept !== 'function' || typeof options.model !== 'string') return skip('profile_missing');
  state.metrics.lastSkip=null;
  state.metrics.viewBytes=Buffer.byteLength(JSON.stringify(view.state));
  networkActive++;
  let result;
  try { result = await judgeRoute({ model: options.model, state: observed, tools: eligibleTools }, { ...options, signal: request.abortSignal }); }
  finally { networkActive--; }
  request.abortSignal?.throwIfAborted();
  state.metrics.jevAttempts += result.metrics?.transportAttempts ?? 0;
  state.metrics.jevMs += result.metrics?.elapsedMs ?? 0;
  const repeated = result.mode === 'candidate' && view.completed.has(digest(result.call));
  const accepted = result.mode === 'candidate' && !repeated && await options.accept(result, observed) === true;
  request.abortSignal?.throwIfAborted();
  if (!accepted) {
    state.metrics.fallbackCalls++; publish(runtime, state); return null;
  }
  request.abortSignal?.throwIfAborted();
  const id = `jev_${randomUUID()}`;
  state.pending.add(id);
  state.metrics.directCalls++; publish(runtime, state);
  return { text: '', finishReason: 'tool-calls', usage: {}, toolCalls: [{ id, ...result.call }],
    providerMetadata: { jevDirect: true, jevUsage: result.usage } };
}
