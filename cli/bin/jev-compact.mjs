import { questionsFor, batchCalls, decideCall, applyDecisions, messageChars } from './vendor/fast-jev-compaction/compact.js';
import { collectToolCalls, fitState } from './vendor/fast-jev-compaction/state.js';
import { credential, containsSensitive } from './jev.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
function validate(messages) {
  if (!Array.isArray(messages) || messages.length > 1000 || Buffer.byteLength(JSON.stringify(messages)) > 900000) throw new Error('size');
  const calls = new Set(), results = new Set();
  for (const m of messages) {
    if (!keys(m,['role','text','toolUses','toolResults']) || !['user','assistant','system'].includes(m.role) || typeof m.text !== 'string' || !Array.isArray(m.toolUses) || (m.toolResults !== undefined && !Array.isArray(m.toolResults))) throw new Error('message');
    for (const call of m.toolUses) {
      if (!keys(call,['tool_use_id','tool','input']) || typeof call.tool_use_id !== 'string' || !call.tool_use_id || calls.has(call.tool_use_id) || typeof call.tool !== 'string' || !object(call.input)) throw new Error('call');
      calls.add(call.tool_use_id);
    }
    for (const result of m.toolResults ?? []) {
      if (!keys(result,['tool_use_id','text','isError']) || typeof result.tool_use_id !== 'string' || results.has(result.tool_use_id) || typeof result.text !== 'string' || (result.isError !== undefined && typeof result.isError !== 'boolean')) throw new Error('result');
      results.add(result.tool_use_id);
    }
  }
  for (const id of results) if (!calls.has(id)) throw new Error('orphan');
}

// 原始 messages 留在呼叫方 RAM；只回傳可裁剪視圖，不寫對話或重跑工具。
export async function compactWorkingMemory(payload, transport = {}) {
  let abortTimer;
  try {
    if (!keys(payload,['messages','goal','replaySafeToolUseIds','pinnedToolUseIds'])) return null;
    const { messages, goal = '', replaySafeToolUseIds = [], pinnedToolUseIds = [] } = payload;
    if (containsSensitive(JSON.stringify({messages,goal}))) return null;
    validate(messages);
    if (typeof goal !== 'string' || !Array.isArray(replaySafeToolUseIds) || !Array.isArray(pinnedToolUseIds) || ![...replaySafeToolUseIds,...pinnedToolUseIds].every(x=>typeof x==='string')) return null;
    const safe = new Set(replaySafeToolUseIds), pinned = new Set(pinnedToolUseIds);
    const options = { goal, keepThreshold:0.2, preserveRecentMessages:6, maxStateTokens:18000, maxRequestTokens:24000, truncateHeadChars:300 };
    const calls = collectToolCalls(messages,options.preserveRecentMessages).map(call=>({...call,pinned:call.pinned || call.isError || !safe.has(call.tool_use_id) || pinned.has(call.tool_use_id)}));
    const candidates = calls.filter(call=>!call.pinned);
    const fitted = candidates.length ? fitState(messages,calls,options) : {state:{},tokens:0,stage:'unchanged'};
    const batches = batchCalls(candidates,fitted.tokens,options);
    const key = transport.getKey ? transport.getKey() : credential();
    if (batches.length && !key) return null;
    const deadline = Date.now() + Math.min(1200,transport.timeoutMs ?? 1200);
    const controller = new AbortController();
    abortTimer = setTimeout(()=>controller.abort(),Math.max(1,deadline-Date.now()));
    const answers = new Map(); let next = 0;
    await Promise.all(Array.from({length:Math.min(8,batches.length)},async()=>{
      while(next<batches.length) {
        if(controller.signal.aborted) throw new Error('cancelled');
        const batch=batches[next++],questions=Object.assign({},...batch.map(questionsFor));
        const remaining=deadline-Date.now();if(remaining<=0) throw new Error('deadline');
        const response=await (transport.fetch ?? fetch)('https://api.typesafe.ai/v1/systemone',{
          method:'POST',redirect:'error',signal:controller.signal,
          headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify({model:'jev-1.13.0',state:fitted.state,questions})
        });
        if(!response.ok) throw new Error('transport');
        const data=await response.json();
        if(!object(data.answers) || Object.keys(data.answers).length!==Object.keys(questions).length) throw new Error('answers');
        for(const name of Object.keys(questions)) {
          const answer=data.answers[name];
          if(!object(answer)||answer.type!=='noul'||typeof answer.noul!=='number'||!Number.isFinite(answer.noul)||answer.noul<0||answer.noul>1) throw new Error('probability');
        }
        for(const call of batch) answers.set(call.id,{keepCall:data.answers[`call_${call.id}`].noul,keepResult:data.answers[`result_${call.id}`].noul});
      }
    })).catch(error=>{controller.abort();throw error;});
    const decisions=calls.map(call=>decideCall(call,answers.get(call.id)??{keepCall:1,keepResult:1},options));
    const view=applyDecisions(messages,decisions,calls,options.truncateHeadChars);
    return {messages:view,decisions,stats:{before:messages.reduce((n,m)=>n+messageChars(m),0),after:view.reduce((n,m)=>n+messageChars(m),0),requests:batches.length,stateTokens:fitted.tokens,stateStage:fitted.stage},rawOwnership:'caller-memory'};
  } catch { return null; }
  finally { clearTimeout(abortTimer); }
}
