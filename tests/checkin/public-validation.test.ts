import { cleanAnswers, identity, operational } from '../../supabase/functions/_shared/publicCheckin.ts';
function equal(actual: unknown, expected: unknown) {
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function rejects(fn:()=>unknown){let rejected=false;try{fn();}catch{rejected=true;}equal(rejected,true);}
Deno.test('zero is a valid required scale answer',()=>{
 equal(cleanAnswers({q:{answer:0}},[{id:'q',question_type:'scale',scale_min:0,scale_max:10,is_required:true}]),{q:{answer:0,comment:null}});
});
Deno.test('unknown questions, missing required answers and out-of-range scales fail closed',()=>{
 const qs=[{id:'q',question_type:'scale',scale_min:0,scale_max:10,is_required:true}];
 rejects(()=>cleanAnswers({other:{answer:1}},qs));rejects(()=>cleanAnswers({},qs));rejects(()=>cleanAnswers({q:{answer:11}},qs));
});
Deno.test('editable and frozen question aliases cannot create duplicate answers',()=>{
 rejects(()=>cleanAnswers({source:{answer:1},frozen:{answer:2}},[{id:'frozen',source_question_id:'source'}]));
});
Deno.test('email normalization and frozen or expired eligibility',()=>{
 equal(identity(' Athlete@Example.invalid '),'athlete@example.invalid');
 const c={is_active:true,is_frozen:false,has_checkin:true,end_date:'2026-09-14'};
 equal(operational(c,'2026-09-14'),true);equal(operational(c,'2026-09-15'),false);
 equal(operational({...c,is_frozen:true},'2026-09-14'),false);
});
