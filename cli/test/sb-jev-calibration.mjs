import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitOmissionPolicy,validateOmissionPolicy,mayOmit,questionFingerprint} from '../bin/jev-calibration.mjs';
import {readFileSync} from 'node:fs';
import {question} from '../../hooks/jev-work.mjs';
const context={model:'test-model',question:{criteria:{keep:'necessary',routine:'optional'}}};
const row=(confidence,expected)=>({expected,answer:{type:'choice',choice:'routine',confidence,probabilities:{keep:0,routine:1}},origin:{model:context.model,questionFingerprint:questionFingerprint(context.question)}});
test('omission boundary comes from observed correct/incorrect outcomes, never a universal preset',()=>{
 const p=fitOmissionPolicy([row(.35,'keep'),row(.64,'routine'),row(.89,'routine')],context);
 assert.equal(p.minRoutineConfidence,.64); assert.equal(p.enabled,undefined);
 assert.equal(mayOmit(row(.9,'routine').answer,p,context),false);
 const validated=validateOmissionPolicy(p,[row(.7,'routine'),row(.5,'keep')]);
 assert.equal(mayOmit(row(.7,'routine').answer,validated,context),true);
 assert.equal(mayOmit(row(.5,'keep').answer,validated,context),false);
 assert.equal(mayOmit(row(.9,'routine').answer,validated,{...context,model:'another'}),false);
 assert.equal(mayOmit(row(.9,'routine').answer,validated,{...context,question:{criteria:{routine:'different'}}}),false);
});
test('validation failure or no supported omissions disables the policy',()=>{
 const p=fitOmissionPolicy([row(.4,'keep'),row(.8,'routine')],context);
 assert.equal(validateOmissionPolicy(p,[row(.9,'keep')]).enabled,false);
 assert.equal(validateOmissionPolicy(p,[]).enabled,false);
 const unsupported=fitOmissionPolicy([row(.9,'keep')],context);
 assert.equal(unsupported.minRoutineConfidence,null);
 assert.equal(validateOmissionPolicy(unsupported,[row(1,'routine')]).enabled,false);
});
test('shipped policy reproduces observed training and untouched holdout evaluation',()=>{
 const data=JSON.parse(readFileSync(new URL('./fixtures/jev-filter-observations.json',import.meta.url),'utf8'));
 const shipped=JSON.parse(readFileSync(new URL('../../hooks/jev-filter-policy.json',import.meta.url),'utf8'));
 const fitted=fitOmissionPolicy(data.training,{model:shipped.model,question});
 assert.deepEqual(validateOmissionPolicy(fitted,data.holdout),shipped);
 assert.equal(data.productionEvidence,false);
 assert.equal(data.training.find(row=>row.id==='f10').expected,'keep');
 assert.equal(mayOmit(data.training.find(row=>row.id==='f10').answer,shipped,{model:shipped.model,question}),false);
});
test('invalid or foreign observations cannot enable omission',()=>{
 assert.throws(()=>fitOmissionPolicy([row(NaN,'routine')],context));
 assert.throws(()=>fitOmissionPolicy([{...row(.9,'routine'),origin:{model:'foreign',questionFingerprint:'foreign'}}],context));
 const p=fitOmissionPolicy([row(.9,'routine')],context);
 assert.throws(()=>validateOmissionPolicy(p,[row(.9,'unknown')]));
 const validated=validateOmissionPolicy(p,[row(.9,'routine')]);
 assert.equal(mayOmit({...row(.9,'routine').answer,confidence:'0.99'},validated,context),false);
});
