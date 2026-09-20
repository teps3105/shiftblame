import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filterToolResult } from '../../hooks/jev-work.mjs';
import { requestJudgment } from '../../hooks/jev-client.mjs';
const root=mkdtempSync(join(tmpdir(),'sb-hook-filter-'));
try {
 mkdirSync(join(root,'.shiftblame'));
 const text=['Warning: selected scene has a missing texture. Inspect the resource path before rendering. '+ 'No replacement was installed. '.repeat(3),
 'Progress: processing is continuing normally. '.repeat(5),
 'Progress: ordinary preparation is proceeding. '.repeat(5),
 'Output saved to exports/preview.png. '+ 'Editable source remains in the active document. '.repeat(3)].join('\n');
 const event={hook_event_name:'PostToolUse',tool_name:'mcp__scene__render',tool_response:{content:[{type:'text',text}]}};
 let calls=0;
 const options={getKey:()=> 'test',fetch:async(_,opts)=>{
 calls++; const req=JSON.parse(opts.body); assert.ok(!opts.body.includes('private-input'));
 return {ok:true,json:async()=>({model:req.model,usage:{input_tokens:10,output_tokens:10},answers:Object.fromEntries(Object.entries(req.questions).map(([id,q])=>{
 const choice=/Warning:|Output saved/.test(q.instructions.item.excerpt)?'keep':'routine';
 return [id,{type:'choice',choice,confidence:1,probabilities:Object.fromEntries(Object.keys(q.criteria).map(k=>[k,k===choice?1:0]))}];
 }))})}; }};
 const result=await filterToolResult(root,{...event,tool_input:{secret:'private-input'}},options);
 assert.ok(result.includes('missing texture')); assert.ok(!result.includes('ordinary preparation')); assert.equal(calls,1);
 await filterToolResult(root,event,options); assert.equal(calls,1);
 for (const tool_response of [
  {content:[{type:'text',text},{type:'image',data:'image'}]},
  {content:[{type:'text',text}],structuredContent:{important:'preserve'}},
  {output:text,unknown:{important:'preserve'}},
  {content:[{type:'text',text,annotations:{priority:1}}]}
 ]) assert.equal(await filterToolResult(root,{...event,tool_response},options),null,'未識別欄位與混合媒體完整直通');
 const repeated='  Warning: repeated event with indentation. '+ 'Keep each occurrence. '.repeat(4);
 const raw=[repeated,repeated,...Array(8).fill('Progress: '+ 'routine progress. '.repeat(10))].join('\r\n');
 const preserved=await filterToolResult(root,{...event,tool_response:{output:raw,exit_code:1,wall_time_seconds:2,session_id:null}},options);
 const packet=JSON.parse(preserved.slice(preserved.indexOf('\n')+1));
 assert.equal(packet.facts.length,2,'重複事實逐次保留');
 assert.equal(packet.facts[0].text,repeated+'\r\n','縮排及換行不變');
 assert.equal(readFileSync(packet.sourcePath,'utf8'),raw,'快照保全完整文字');
 assert.deepEqual(packet.metadata,{exit_code:1,session_id:null,wall_time_seconds:2});
 const uncertainText=['Ambiguous: operation may not have run. '+ 'Context is incomplete. '.repeat(5),...Array(8).fill('Progress: '+ 'normal work continues. '.repeat(10))].join('\n');
 const uncertainOptions={getKey:()=> 'test',fetch:async(_,opts)=>{
  const req=JSON.parse(opts.body);
  return {ok:true,json:async()=>({model:req.model,usage:{input_tokens:10,output_tokens:10},answers:Object.fromEntries(Object.entries(req.questions).map(([id,q])=>{
   const uncertain=q.instructions.item.excerpt.startsWith('Ambiguous:');
   return [id,{type:'choice',choice:'routine',confidence:uncertain?0.6:1,probabilities:{keep:uncertain?0.3:0,routine:uncertain?0.7:1,no_match:0,insufficient:0}}];
  }))})};
 }};
 const uncertainResult=await filterToolResult(root,{...event,tool_response:uncertainText},uncertainOptions);
 const uncertainPacket=JSON.parse(uncertainResult.slice(uncertainResult.indexOf('\n')+1));
 assert.equal(uncertainPacket.needsReview[0].text,uncertainText.split('\n')[0]+'\n','低信心routine仍完整交主代理');
 const beforeSkips=calls;
 for(const tool_response of ['OK',text+'\nAuthorization: Bearer private',{content:[{type:'image',data:'private'}]}]) assert.equal(await filterToolResult(root,{...event,tool_response},options),null);
 assert.equal(calls,beforeSkips);
 assert.equal(await filterToolResult(root,{...event,is_interrupt:true},options),null);
 assert.equal(await filterToolResult(root,{...event,tool_name:'jev'},options),null);
 assert.equal(await filterToolResult(root,{...event,tool_name:'exec_command',tool_input:{cmd:'sb delegate request.json'}},options),null);
 assert.equal(await filterToolResult(root,{...event,tool_response:text+'\nghp_'+ 'x'.repeat(36)},options),null);
 assert.equal(await filterToolResult(root,{...event,hook_event_name:'PostToolUseFailure',error:text},options),null);
 const guard=fileURLToPath(new URL('../../hooks/shiftblame-guard.mjs',import.meta.url));
 writeFileSync(join(root,'.shiftblame/flow-state.json'),JSON.stringify({hooksHeartbeat:{at:new Date().toISOString(),event:'SessionStart'}}));
 const before=readFileSync(join(root,'.shiftblame/flow-state.json'),'utf8');
 const run=spawnSync(process.execPath,[guard],{cwd:root,input:JSON.stringify({...event,cwd:root}),encoding:'utf8'});
 assert.equal(run.status,0,run.stderr); const injected=JSON.parse(run.stdout);
 assert.equal(injected.continue,false); assert.ok(injected.stopReason.includes('missing texture'));
 assert.equal(readFileSync(join(root,'.shiftblame/flow-state.json'),'utf8'),before,'背景資訊事件不寫前景狀態');
 const config=JSON.parse(readFileSync(new URL('../../hooks/hooks.json',import.meta.url),'utf8'));
 assert.notEqual(config.hooks.PostToolUse[0].hooks[0].async,true,'初判在強模型讀原文前完成');
 console.log('PASS 自動過濾、真實hook注入、重用、秘密排除');
} finally { await requestJudgment(root,'shutdown',{}); assert.ok(root.startsWith(join(tmpdir(),'sb-hook-filter-'))); rmSync(root,{recursive:true,force:true}); }
