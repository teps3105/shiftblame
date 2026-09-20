// 在宿主同一次程式執行內接續決策及原生工具；不建立 MCP 連線或存放對話。
// 純 JavaScript，可由 Node 或 code-mode 載入；宿主提供原生工具宣告與已驗證接合策略。
const copy = value => JSON.parse(JSON.stringify(value));
const keyOf = call => JSON.stringify([call.name,call.input]);
const quote = value => "'" + String(value).replace(/'/g,"''") + "'";
function nativeResultState(result,call) {
  if(call.name==='exec_command') {
    if(result?.session_id!==undefined&&result.exit_code==null)return 'running';
    return Number.isInteger(result?.exit_code)?(result.exit_code===0?'success':'error'):'unknown';
  }
  if(result?.isError===true)return 'error';
  return Array.isArray(result?.content)?'success':'unknown';
}
function base64(value) {
  const bytes=Array.from(encodeURIComponent(value).replace(/%([0-9A-F]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16))),c=>c.charCodeAt(0));
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let out='';
  for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]??0)<<8)|(bytes[i+2]??0);
    out+=alphabet[(n>>>18)&63]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');}
  return out;
}

function workerJudge({tools,root,pluginRoot,model}) {
  if(typeof tools.exec_command!=='function')throw new Error('宿主未提供原生程序工具');
  return async ({state,candidates,definitions})=>{
    const payload={model,state,candidates,tools:definitions??[...new Set(candidates.map(call=>call.name))].map(name=>({name}))};
    const encoded=base64(JSON.stringify(payload));
    // Windows 命令列有長度上限；保留完整 RAM 視圖，超限交回宿主而非截斷證據。
    if(encoded.length>24000)return {mode:'fallback',reason:'transport_budget'};
    const result=await tools.exec_command({cmd:`node ${quote(pluginRoot+'/hooks/jev-client.mjs')} --route ${quote(root)} ${quote(encoded)}`,max_output_tokens:2500});
    if(result.exit_code!==0)return {mode:'fallback',reason:'worker_unavailable'};
    try{return JSON.parse(result.output)??{mode:'fallback',reason:'worker_unavailable'};}catch{return {mode:'fallback',reason:'worker_reply'};}
  };
}

async function run({tools,definitions,accept,goal,initialState={},recipe,judge,signal,onEvent=()=>{}}) {
  if (!recipe) return runGeneric({tools,definitions,accept,goal,initialState,judge,signal,onEvent});
  if(typeof goal!=='string'||!goal.trim()||typeof recipe?.candidates!=='function'||typeof recipe?.reduce!=='function'||typeof recipe?.accept!=='function'||typeof judge!=='function')throw new Error('缺少工作目標或可重用配方');
  let state=copy(initialState);const results=[],attempted=new Set();
  const metrics={judgments:0,executed:0,completed:0,jevMs:0};
  for(;;){
    signal?.throwIfAborted();
    if(recipe.done?.(state)===true)return {reason:'complete',state,results,metrics};
    const candidates=copy(recipe.candidates(state)).filter(call=>!attempted.has(keyOf(call)));
    if(!candidates.length)return {reason:'no_new_candidate',state,results,metrics};
    if(candidates.length>253)return {reason:'candidate_budget',state,results,metrics};
    if(candidates.some(call=>typeof tools[call.name]!=='function'||typeof call.description!=='string'||!call.input||typeof call.input!=='object'||Array.isArray(call.input)))throw new Error('配方含未知原生工具或參數');
    const started=Date.now();
    const decision=await judge({state:{goal,observations:state},candidates});
    metrics.judgments++;metrics.jevMs+=Date.now()-started;
    signal?.throwIfAborted();
    if(decision?.mode!=='candidate')return {reason:decision?.reason??'judgment_unavailable',state,results,metrics};
    const selected=candidates.find(call=>keyOf(call)===keyOf(decision.call));
    if(!selected)return {reason:'candidate_mismatch',state,results,metrics};
    const accepted=await recipe.accept(decision,state);
    signal?.throwIfAborted();
    if(accepted!==true)return {reason:'uncertain',state,results,metrics};
    // 原生工具本身保留其 session、schema、授權與 hooks；Jev 不執行生成的命令。
    const call={name:selected.name,input:copy(selected.input)};
    const result=await tools[call.name](call.input);
    results.push({call,result});metrics.executed++;attempted.add(keyOf(call));
    if(signal?.aborted)return {reason:'cancelled',state,results,metrics};
    await onEvent({call,result,metrics:{...metrics}});
    const resultState=recipe.resultState?await recipe.resultState(result,call):nativeResultState(result,call);
    if(resultState!=='success')return {reason:resultState==='running'?'tool_running':resultState==='error'?'tool_error':'tool_result_unknown',state,results,metrics};
    metrics.completed++;
    const next=await recipe.reduce(state,{call,result});
    if(!next||typeof next!=='object')throw new Error('配方未產生可用的新狀態');
    state=next;
  }
}

async function runGeneric({tools,definitions,accept,goal,initialState,judge,signal,onEvent}) {
  if (!Array.isArray(definitions) || typeof accept!=='function' || typeof judge!=='function' || typeof goal!=='string' || !goal.trim()) throw new Error('缺少原生工具宣告、目標或宿主採用策略');
  const catalog=copy(definitions);
  if (catalog.some(tool=>typeof tools[tool.name]!=='function')) throw new Error('宣告沒有對應原生工具');
  const state={goal,initial:copy(initialState),observations:[]};
  const results=[],attempted=new Set(),metrics={judgments:0,executed:0,completed:0,jevMs:0};
  for (;;) {
    signal?.throwIfAborted();
    const started=Date.now(),decision=await judge({state:copy(state),definitions:catalog});
    metrics.judgments++;metrics.jevMs+=Date.now()-started;
    signal?.throwIfAborted();
    if (decision?.mode!=='candidate') return {reason:decision?.reason??'judgment_unavailable',state,results,metrics};
    const call=copy(decision.call);
    if (!catalog.some(tool=>tool.name===call.name) || !call.input || typeof call.input!=='object' || Array.isArray(call.input)) return {reason:'invalid_call',state,results,metrics};
    if (attempted.has(keyOf(call))) return {reason:'repeated_call',state,results,metrics};
    if (await accept(decision,state)!==true) return {reason:'uncertain',state,results,metrics};
    signal?.throwIfAborted();
    const result=await tools[call.name](call.input);
    results.push({call,result});metrics.executed++;attempted.add(keyOf(call));
    if(signal?.aborted)return {reason:'cancelled',state,results,metrics};
    state.observations.push({call,result:copy(result)});
    await onEvent({call,result,metrics:{...metrics}});
    const status=nativeResultState(result,call);
    if(status!=='success')return {reason:status==='running'?'tool_running':status==='error'?'tool_error':'tool_result_unknown',state,results,metrics};
    metrics.completed++;
  }
}

module.exports={run,workerJudge};
