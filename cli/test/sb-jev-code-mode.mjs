import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const {run,workerJudge}=createRequire(import.meta.url)('../bin/jev-code-mode.cjs');
const candidates=state=>state.ids.map(id=>({name:'read',input:{id},description:`Read observed resource ${id}`}));
const recipe={candidates,accept:()=>true,resultState:result=>result.isError?'error':Array.isArray(result.children)?'success':'unknown',done:state=>state.ids.length===0,reduce:(state,{call,result})=>({ids:[...state.ids.filter(id=>id!==call.input.id),...(result.children??[])]})};

test('generic loop uses new raw results with no candidate factory, reducer or tool-specific recipe',async()=>{
 const seen=[];
 const output=await run({tools:{unfamiliar_reader:async({id})=>({content:[{type:'text',text:JSON.stringify({id,child:'observed-next'})}]})},
  definitions:[{name:'unfamiliar_reader',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}}],
  goal:'Inspect the linked record.',initialState:{id:'root'},accept:()=>true,
  judge:async request=>{seen.push(request);return seen.length<=2?{mode:'candidate',call:{name:'unfamiliar_reader',input:{id:seen.length===1?'root':'observed-next'}}}:{mode:'fallback',reason:'generate'};}});
 assert.equal(output.metrics.completed,2);assert.equal(output.reason,'generate');
 assert.equal(seen[1].state.observations[0].result.content[0].text,'{"id":"root","child":"observed-next"}');
});
test('one host call consumes new observed candidates without returning to a generator',async()=>{
 let permissions=0;const seen=[];
 const output=await run({tools:{read:async({id})=>{permissions++;return {children:id==='root'?['child']:[]};}},goal:'Inspect the observed resources.',initialState:{ids:['root']},recipe,
  judge:async request=>{seen.push(request.state);return {mode:'candidate',call:{name:'read',input:request.candidates[0].input}};}});
 assert.equal(output.reason,'complete');assert.equal(output.metrics.executed,2);assert.equal(permissions,2);assert.deepEqual(seen[1].observations.ids,['child']);
});
test('unknown returned candidate, asynchronous rejection and cancellation cannot dispatch',async()=>{
 let executions=0;const tools={read:async()=>{executions++;return {};}};
 const args={tools,goal:'Inspect.',initialState:{ids:['a']},recipe};
 assert.equal((await run({...args,judge:async()=>({mode:'candidate',call:{name:'read',input:{id:'outside'}}})})).reason,'candidate_mismatch');
 assert.equal((await run({...args,recipe:{...recipe,accept:async()=>false},judge:async()=>({mode:'candidate',call:{name:'read',input:{id:'a'}}})})).reason,'uncertain');
 const abort=new AbortController();
 await assert.rejects(run({...args,signal:abort.signal,judge:async()=>{abort.abort();return null;}}),{name:'AbortError'});
 assert.equal(executions,0);
});
test('unchanged operations are not repeated and original errors stop the loop',async()=>{
 const result=await run({tools:{read:async()=>({isError:true,content:'failure'})},goal:'Inspect.',initialState:{ids:['a']},recipe,judge:async()=>({mode:'candidate',call:{name:'read',input:{id:'a'}}})});
 assert.equal(result.reason,'tool_error');assert.equal(result.results[0].result.content,'failure');
});
test('CJK worker payload is UTF-8 base64 and shell metacharacters never become commands',async()=>{
 let captured;
 const judge=workerJudge({root:"D:/work's",pluginRoot:'D:/plugin',model:'test',tools:{exec_command:async input=>{captured=input.cmd;return {exit_code:0,output:'{"mode":"fallback","reason":"generate"}'};}}});
 const result=await judge({state:{goal:'中文與日本語 ` $(irrelevant)'},candidates:[{name:'read',input:{id:'一'},description:'觀察'}]});
 assert.equal(result.reason,'generate');assert.ok(captured.includes("'D:/work''s'"));assert.ok(!captured.includes('$(irrelevant)'));
 const encoded=captured.match(/'([A-Za-z0-9+/=]+)'$/)[1];assert.equal(JSON.parse(Buffer.from(encoded,'base64').toString('utf8')).state.goal,'中文與日本語 ` $(irrelevant)');
});
test('a native process still running is handed back, never reduced into completion',async()=>{
 let reduced=false;
 const result=await run({tools:{exec_command:async()=>({session_id:42,output:'started'})},goal:'Inspect.',recipe:{
  candidates:()=>[{name:'exec_command',input:{cmd:'read-only program'},description:'Read state.'}],accept:()=>true,
  reduce:()=>{reduced=true;return {complete:true};},done:state=>state.complete===true
 },judge:async()=>({mode:'candidate',call:{name:'exec_command',input:{cmd:'read-only program'}}})});
 assert.equal(result.reason,'tool_running');assert.equal(reduced,false);assert.equal(result.results[0].result.session_id,42);
});
test('negative, missing and nonnumeric native exit states do not become completed work',async()=>{
 for(const response of [{exit_code:-1},{exit_code:null},{exit_code:'0'},{}]){
  const result=await run({tools:{exec_command:async()=>response},goal:'Inspect.',recipe:{candidates:()=>[{name:'exec_command',input:{cmd:'inspect'},description:'Inspect.'}],accept:()=>true,reduce:()=>({complete:true}),done:state=>state.complete===true},judge:async()=>({mode:'candidate',call:{name:'exec_command',input:{cmd:'inspect'}}})});
  assert.notEqual(result.reason,'complete');assert.equal(result.metrics.completed,0);
 }
});
test('tool completion concurrent with cancellation retains the original call and result',async()=>{
 const abort=new AbortController();
 const result=await run({tools:{read:async()=>{abort.abort();return {children:[],evidence:'observed'};}},goal:'Inspect.',initialState:{ids:['a']},recipe,signal:abort.signal,judge:async()=>({mode:'candidate',call:{name:'read',input:{id:'a'}}})});
 assert.equal(result.reason,'cancelled');assert.equal(result.results[0].result.evidence,'observed');assert.equal(result.metrics.executed,1);
});
