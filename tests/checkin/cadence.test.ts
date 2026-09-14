import { occurrence } from '../../supabase/functions/_shared/checkinCadence.ts';
const equal=(a:unknown,b:unknown)=>{if(a!==b)throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)};
Deno.test('Thais starts counting 31/08, first monthly review 28/09',()=>{
 equal(occurrence('2026-08-31','monthly','2026-09-14'),null);
 equal(occurrence('2026-08-31','monthly','2026-09-28'),'2026-09-28');
});
Deno.test('Miguel weekly and Monday preserved after a missed send',()=>{
 equal(occurrence('2026-06-15','weekly','2026-09-14'),'2026-09-14');
 equal(occurrence('2026-06-15','weekly','2026-09-16'),'2026-09-14');
 equal(occurrence('2026-06-15','weekly','2026-09-21'),'2026-09-21');
});
Deno.test('Louany monthly begins a complete interval after 14/09',()=>{
 equal(occurrence('2026-09-14','monthly','2026-09-14'),null);
 equal(occurrence('2026-09-14','monthly','2026-10-12'),'2026-10-12');
});
Deno.test('Non-Monday anchor rounds forward without drift',()=>{
 equal(occurrence('2026-07-22','monthly','2026-08-19'),null);
 equal(occurrence('2026-07-22','monthly','2026-08-24'),'2026-08-24');
 equal(occurrence('2026-07-22','monthly','2026-09-14'),'2026-08-24');
 equal(occurrence('2026-07-22','monthly','2026-09-21'),'2026-09-21');
});
Deno.test('Unsupported cadence and future start never dispatch',()=>{
 equal(occurrence('2026-10-01','weekly','2026-09-14'),null);
 equal(occurrence('2026-01-01','unexpected','2026-09-14'),null);
});
