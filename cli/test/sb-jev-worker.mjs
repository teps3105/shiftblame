import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, requestJudgment } from '../../hooks/jev-client.mjs';

const root=mkdtempSync(join(tmpdir(),'sb-jev-worker-'));
mkdirSync(join(root,'.shiftblame'));
let calls=0, active=0, peak=0, bodies=0, peakBodies=0;
const server=serve(root,{getKey:()=> 'test',idleMs:1000,fetch:async(_,opts)=>{
 calls++; active++; peak=Math.max(peak,active);
 const req=JSON.parse(opts.body);
 if(req.questions.operation) {
  active--;
  return {ok:true,json:async()=>({model:req.model,usage:{input_tokens:1,output_tokens:1},answers:{operation:{type:'choice',choice:'c0',confidence:1,probabilities:{generate:0,insufficient:0,c0:1}}}})};
 }
 if(Object.values(req.questions)[0].type==='noul') {
  active--; bodies++; peakBodies=Math.max(peakBodies,bodies);
  return {ok:true,json:async()=>{await new Promise(r=>setTimeout(r,80));bodies--;return {answers:Object.fromEntries(Object.keys(req.questions).map(id=>[id,{type:'noul',noul:0.01}]))};}};
 }
 await new Promise(r=>setTimeout(r,req.questions.q0.instructions.item.text.includes('slow')?60:10));
 active--;
 return {ok:true,json:async()=>({model:req.model,usage:{input_tokens:1,output_tokens:1},answers:Object.fromEntries(Object.entries(req.questions).map(([id,q])=>[id,{type:'choice',choice:q.instructions.item.text.includes('slow')?'a':'b',confidence:1,probabilities:{a:q.instructions.item.text.includes('slow')?1:0,b:q.instructions.item.text.includes('slow')?0:1,no_match:0,insufficient:0}}]))})};
}});
await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const input=text=>({scope:'shared-worker-test',model:'jev-1.13.0',items:[{id:text,state:{text},question:{type:'choice',instructions:'Select a for slow; b otherwise.',criteria:{a:'slow',b:'fast',no_match:'none',insufficient:'unknown'}}}]});
try {
 const [slow,fast]=await Promise.all(['slow 中文','fast 中文'].map(text=>requestJudgment(root,'delegate',input(text))));
 assert.equal(slow.items[0].id,'slow 中文'); assert.equal(slow.items[0].answer.choice,'a');
 assert.equal(fast.items[0].id,'fast 中文'); assert.equal(fast.items[0].answer.choice,'b');
 assert.equal(peak,2,'獨立事件真正並行'); assert.equal(calls,2);
 const reused=await Promise.all(['slow 中文','fast 中文'].map(text=>requestJudgment(root,'delegate',input(text))));
 assert.ok(reused.every(r=>r.metrics.cacheHits===1),'並行答案均保留於共用快取'); assert.equal(calls,2);
 const routed=await requestJudgment(root,'route',{model:'jev-1.13.0',state:{goal:'Inspect observed item'},tools:[{name:'inspect'}],candidates:[{name:'inspect',input:{id:'實際候選'},description:'Inspect the observed item.'}]});
 assert.equal(routed.mode,'candidate');assert.deepEqual(routed.call,{name:'inspect',input:{id:'實際候選'}});
 assert.equal(await requestJudgment(root,'delegate',{}),null,'無效輸入直通');
 assert.equal(await requestJudgment(root,'unknown',{}),null,'未知工作不執行');
 const messages=[{role:'user',text:'Find remaining work.',toolUses:[]}],ids=[];
 for(let i=0;i<300;i++) {const id='read-'+i;ids.push(id);messages.push({role:'assistant',text:'',toolUses:[{tool_use_id:id,tool:'Read',input:{path:'src/item-'+i+'.ts'}}]},{role:'user',text:'',toolUses:[],toolResults:[{tool_use_id:id,text:'Old source data '.repeat(5)}]});}
 for(let i=0;i<6;i++)messages.push({role:'assistant',text:'Current constraint '+i,toolUses:[]});
 const compactPayload={messages,replaySafeToolUseIds:ids};
 const results=await Promise.all([1,2].map(()=>requestJudgment(root,'compact',compactPayload)));
 assert.ok(results.some(result=>result?.stats.requests>1),'真實多批路徑');
 assert.ok(peakBodies<=8,`完整body仍占名額：觀察到 ${peakBodies}`);
 assert.ok(results.some(result=>result===null),'額滿工作保留原視圖');
 while(bodies) await new Promise(r=>setTimeout(r,10));
 console.log('PASS 常駐worker：並行、來源隔離、中文IPC、快取合併、故障直通');
} finally {
 await requestJudgment(root,'shutdown',{});
 assert.ok(root.startsWith(join(tmpdir(),'sb-jev-worker-')));rmSync(root,{recursive:true,force:true});
}
