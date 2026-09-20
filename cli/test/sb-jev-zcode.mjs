import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observe, noteProviderRequest, routeModelRequest } from '../bin/jev-zcode.mjs';
const tools = ['ListWorkflowRuns','GetWorkflowRun','TodoRead'].map(name=>({name,readOnly:true,sideEffectScope:'none',
  inputSchema:{type:'object',properties:name==='GetWorkflowRun'?{run_id:{type:'string'}}:{},additionalProperties:false}}));
const list = '<workflow_runs count="2">\n<run id="r_1" status="completed" label="A &amp; B &quot;quoted&quot; &lt;tag&gt;" />\n<run id="r_2" status="stopped" stop_reason="provider" label="字幕" />\n</workflow_runs>';
const request = () => ({tools,latestRealUserMessageIndex:1,messages:[
  {role:'user',content:'Previous unrelated goal'}, {role:'user',content:'查看字幕執行詳情'},
  {role:'assistant',content:'先查看執行清單。',toolCalls:[{id:'p1',name:'ListWorkflowRuns',input:{}}]},
  {role:'tool',toolName:'ListWorkflowRuns',toolCallId:'p1',content:list}
]});
test('raw observations preserve unfamiliar formats and all source context without tool parsers',()=>{
  const input=request(), view=observe(input);
  assert.equal(view.state.goal,'查看字幕執行詳情');
  assert.equal(view.state.context.length,input.messages.length);
  assert.equal(view.observations[0].content,list);
  assert.equal(view.completed.size,1);
});
test('successful writes invalidate earlier reads, failed reads do not become completed',()=>{
  const input=request(); input.tools=[...tools,{name:'Update',readOnly:false}];
  input.messages.push({role:'assistant',content:'',toolCalls:[{id:'w',name:'Update',input:{}}]}, {role:'tool',content:'done',toolName:'Update',toolCallId:'w'});
  assert.equal(observe(input).completed.size,0);
  input.messages[3].isError=true;
  assert.equal(observe(input).completed.size,0);
});
test('unknown media, missing task boundary and oversized context fall through without truncation',()=>{
  const input=request(); delete input.latestRealUserMessageIndex; assert.equal(observe(input),null);
  input.latestRealUserMessageIndex=1; input.messages[0].content=[{type:'image',url:'local'}]; assert.equal(observe(input),null);
  input.messages[0].content='x'.repeat(61000); assert.equal(observe(input),null);
});
test('missing host profile does not send a doomed Jev request',async()=>{
  const runtime={sessionId:'test',getActiveTurnInfo:()=>({turnId:'turn'})};
  noteProviderRequest(runtime);
  let calls=0;
  assert.equal(await routeModelRequest(runtime,request(),{fetch:async()=>{calls++;}}),null);
  assert.equal(calls,0);
});
test('native reasoning remains reasoning and source tool text is serialized only once',()=>{
  const input=request();
  input.messages[2].content=[{type:'reasoning',text:'Inspect observed execution IDs.'},{type:'text',text:'查看清單。'}];
  input.messages.push({role:'tool',content:'x'.repeat(30000),toolName:'Other',toolCallId:'extra'});
  const view=observe(input);
  assert.equal(view.state.context[2].content[0].type,'reasoning');
  assert.equal(view.state.context.length,5);
  assert.equal(JSON.stringify(view.state).match(/x{30000}/g).length,1);
});
test('credential rules alone do not disable routing but actual credential values do',()=>{
  const input=request();input.messages[0]={role:'system',content:'Never disclose passwords, secrets, API keys or 憑證。'};
  assert.ok(observe(input));
  input.messages[0].content='password = "exampleSensitive123456789"';assert.equal(observe(input),null);
});
test('cancellation during an asynchronous rejection cannot become a provider fallback',async()=>{
  const runtime={sessionId:'test',getActiveTurnInfo:()=>({turnId:'turn'})}; noteProviderRequest(runtime);
  const controller=new AbortController(), input={...request(),abortSignal:controller.signal};
  await assert.rejects(routeModelRequest(runtime,input,{model:'jev-1.13.0',getKey:()=> 'test',
    fetch:async(_url,init)=>{const body=JSON.parse(init.body);return {ok:true,json:async()=>({model:body.model,answers:{operation:{type:'choice',choice:'t2',confidence:.9,probabilities:Object.fromEntries(Object.keys(body.questions.operation.criteria).map(key=>[key,key==='t2'?1:0]))}}})};},
    accept:async()=>{controller.abort();return false;}
  }),{name:'AbortError'});
});
