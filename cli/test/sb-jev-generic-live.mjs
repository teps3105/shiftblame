// 受控通用調度實測；實際 Jev 請求，工具名稱與領域資料不進路由器。
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {judgeRoute} from '../bin/jev-route.mjs';
import {hostProfile} from '../bin/jev-zcode.mjs';
const {run}=createRequire(import.meta.url)('../bin/jev-code-mode.cjs');
if(process.argv[2]!=='--live'||!isAbsolute(process.argv[3]??''))throw new Error('需 --live 與輸出絕對路徑');
const catalog={
  'catalog-root':{entries:[{id:'record-甲',label:'插圖授權',status:'缺少證明'},{id:'record-乙',label:'文字校對',status:'通過'}]},
  'record-甲':{cause:'插圖使用紀錄未附授權證明。'},
  'record-乙':{cause:'沒有錯字。'}
};
const definitions=[{name:'fetch_current_entry',description:'Read a record by its observed id. A catalog record contains entry ids; an entry record contains its final cause.',
  inputSchema:{type:'object',properties:{id:{type:'string',description:'Exact observed record id to read.'}},required:['id'],additionalProperties:false}}];
const started=performance.now();
const result=await run({tools:{fetch_current_entry:async({id})=>catalog[id]?{content:[{type:'text',text:JSON.stringify(catalog[id])}]}:{isError:true,content:[{type:'text',text:'Unknown record'}]}},
  definitions,goal:'查明插圖授權缺少證明的原因；先讀已知目錄 catalog-root，再讀相關項目的詳情。取得原因後回覆。',
  initialState:{catalogId:'catalog-root'},accept:hostProfile.accept,
  judge:({state,definitions:tools})=>judgeRoute({model:hostProfile.model,state,tools})});
const actual=result.results.map(row=>row.call.input.id);
const report={datasetType:'synthetic_controlled',productionEvidence:false,elapsedMs:Math.round(performance.now()-started),
  expected:['catalog-root','record-甲'],actual,correct:JSON.stringify(actual)===JSON.stringify(['catalog-root','record-甲'])&&result.reason==='generate',result};
writeFileSync(process.argv[3],JSON.stringify(report,null,2));
console.log(JSON.stringify({correct:report.correct,actual,reason:result.reason,elapsedMs:report.elapsedMs,metrics:result.metrics}));
