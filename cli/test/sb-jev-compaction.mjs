import assert from 'node:assert/strict';
import { compactWorkingMemory } from '../bin/jev-compact.mjs';
const messages=[{role:'user',text:'Find the current failure. 保留工作限制。',toolUses:[]}];
for(const id of ['old-read','write','old-error','dependency']) {
 messages.push({role:'assistant',text:'',toolUses:[{tool_use_id:id,tool:'inspect',input:{path:id}}]});
 messages.push({role:'user',text:'',toolUses:[],toolResults:[{tool_use_id:id,text:('Original '+id+' 原文。\n').repeat(60),isError:id==='old-error'}]});
}
for(let i=0;i<6;i++) messages.push({role:'assistant',text:`Recent ${i}`,toolUses:[]});
const payload={messages,goal:'Inspect the current failure',replaySafeToolUseIds:['old-read','old-error','dependency'],pinnedToolUseIds:['dependency']};
const original=JSON.stringify(messages);
let calls=0;
function transport(noul) {return {getKey:()=> 'test',fetch:async(_,opts)=>{
 calls++;const req=JSON.parse(opts.body);
 assert.ok(Object.keys(req.questions).every(id=>['call_t1','result_t1'].includes(id)),'只詢問可裁剪的舊讀取');
 return {ok:true,json:async()=>({answers:Object.fromEntries(Object.keys(req.questions).map(id=>[id,{type:'noul',noul}]))})};
}};}
const result=await compactWorkingMemory(payload,transport(0.01));
assert.ok(result);assert.equal(calls,1);assert.ok(result.stats.after<result.stats.before);
assert.equal(JSON.stringify(messages),original,'原始RAM逐字保全');
assert.ok(!result.messages.some(m=>m.toolUses.some(t=>t.tool_use_id==='old-read')));
assert.ok(!result.messages.some(m=>m.toolResults?.some(t=>t.tool_use_id==='old-read')),'call/result成對裁剪');
for(const id of ['write','old-error','dependency']) assert.ok(result.messages.some(m=>m.toolUses.some(t=>t.tool_use_id===id)),'副作用、錯誤、相依固定保留');
assert.equal(result.messages[0],messages[0],'首則原文物件保留');
assert.deepEqual(result.messages.slice(-6),messages.slice(-6),'近期內容固定保留');
const ambiguous=await compactWorkingMemory(payload,transport(0.5));
assert.equal(ambiguous.stats.before,ambiguous.stats.after,'不確定保留原文，不增加覆判');
assert.equal(await compactWorkingMemory(payload,transport(1.1)),null,'越界概率不裁剪');
assert.equal(await compactWorkingMemory({...payload,messages:[...messages,messages[1]]},transport(0)),null,'重複call ID拒絕');
assert.equal(await compactWorkingMemory({...payload,messages:[...messages,{role:'user',text:'',toolUses:[],toolResults:[{tool_use_id:'orphan',text:'unknown'}]}]},transport(0)),null,'孤立result拒絕');
assert.equal(await compactWorkingMemory(payload,{getKey:()=> 'test',fetch:async()=>{throw new Error('offline');}}),null,'傳輸故障保留原視圖');
assert.equal(await compactWorkingMemory({...payload,goal:'Authorization: Bearer private'},transport(0)),null,'疑似秘密不送出');
console.log('PASS 原文工作記憶壓縮：雙Noul、配對、近期與依賴pin、原始RAM、未知直通');
