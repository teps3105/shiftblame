import {writeFileSync} from 'node:fs';
import {isAbsolute,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {delegate} from '../bin/jev.mjs';
import {question} from '../../hooks/jev-work.mjs';
import {cases} from './jev-filter-cases.mjs';
import {questionFingerprint} from '../bin/jev-calibration.mjs';
if(process.argv[2]!=='--live'||!isAbsolute(process.argv[3]??''))throw new Error('需明確 --live 與輸出絕對路徑');
const started=performance.now();
const selected=process.argv[4]==='--holdout'?(await import('./jev-filter-holdout.mjs')).cases:cases;
const result=await delegate(resolve(dirname(fileURLToPath(import.meta.url)),'../..'),{
 scope:'filter-independent',model:'jev-1.13.0',items:selected.map(([id,excerpt,preceding,following])=>({id,state:{excerpt,preceding,following},question}))
});
const rows=result.items.map(item=>({id:item.id,expected:selected.find(row=>row[0]===item.id)[4],answer:item.answer,
 origin:{model:item.model,questionFingerprint:questionFingerprint(question)}}));
const summary={datasetType:'synthetic_controlled',productionEvidence:false,elapsedMs:Math.round(performance.now()-started),count:rows.length,
 exact:rows.filter(row=>row.expected===row.answer?.choice).length,
 unsafeOmissions:rows.filter(row=>row.expected!=='routine'&&row.answer?.choice==='routine').length,
 routineSelected:rows.filter(row=>row.answer?.choice==='routine').length,
 originalGateOmissions:rows.filter(row=>row.answer?.choice==='routine'&&row.answer.confidence>=.98&&row.answer.probabilities.routine>=.99).length};
writeFileSync(process.argv[3],JSON.stringify({summary,rows},null,2));console.log(JSON.stringify(summary));
