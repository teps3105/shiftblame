import {createHash} from 'node:crypto';
import {validChoice} from './jev-route.mjs';
export const questionFingerprint = question => createHash('sha256').update(JSON.stringify(question)).digest('hex');
function validateRows(rows,context) {
  const criteria=Object.fromEntries(context.choiceKeys.map(key=>[key,key]));
  if(!Array.isArray(rows)||rows.some(row=>!Object.hasOwn(criteria,row.expected)||!validChoice(row.answer,criteria)||
    row.origin?.model!==context.model||row.origin?.questionFingerprint!==context.questionFingerprint))throw new Error('觀測標籤、答案或模型題型來源不合法');
}

// 在觀察到的候選分數上選最大覆蓋；沒有零誤省略的候選就停用省略。
// 此規則只描述樣本內政策選擇，泛化品質另由未參與選擇的案例驗證。
export function fitOmissionPolicy(rows,{model,question}) {
  if(!Array.isArray(rows)||!rows.length||typeof model!=='string')throw new Error('需要已標記的同題型實測資料');
  const context={model,questionFingerprint:questionFingerprint(question),choiceKeys:Object.keys(question.criteria)};
  validateRows(rows,context);
  const candidates=rows.filter(row=>row.answer?.choice==='routine');
  const thresholds=[...new Set(candidates.map(row=>row.answer.confidence))].sort((a,b)=>a-b);
  const minRoutineConfidence=thresholds.find(threshold=>{
    const selected=candidates.filter(row=>row.answer.confidence>=threshold);
    return selected.length>0&&selected.every(row=>row.expected==='routine');
  })??null;
  return {...context,minRoutineConfidence,
    training:{cases:rows.length,omitted:candidates.filter(row=>minRoutineConfidence!==null&&row.answer.confidence>=minRoutineConfidence).length,
      unsafeOmissions:0},validation:null};
}

export function validateOmissionPolicy(policy,rows) {
  validateRows(rows,policy);
  const omitted=rows.filter(row=>row.answer?.choice==='routine'&&policy.minRoutineConfidence!==null&&row.answer.confidence>=policy.minRoutineConfidence);
  const unsafeOmissions=omitted.filter(row=>row.expected!=='routine').length;
  return {...policy,validation:{cases:rows.length,omitted:omitted.length,unsafeOmissions},
    enabled:rows.length>0&&omitted.length>0&&unsafeOmissions===0};
}

export function mayOmit(answer,policy,{model,question}) {
  return policy?.enabled===true&&policy.model===model&&policy.questionFingerprint===questionFingerprint(question)&&
    policy.validation?.unsafeOmissions===0&&Number.isFinite(policy.minRoutineConfidence)&&validChoice(answer,question.criteria)&&
    answer?.choice==='routine'&&answer.confidence>=policy.minRoutineConfidence;
}
