import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { requireInternal, denied, restrictedCors } from "../_shared/authGuard.ts";
import { occurrence } from "../_shared/checkinCadence.ts";
import { identity, localDay, operational } from "../_shared/publicCheckin.ts";

// User-directed exclusions/holds, kept outside the athlete's own record.
// Deployment pause is intentional: changing secrets alone cannot resume outbound sends.
const OUTBOUND_PAUSED = true;
const EMAIL_CLIENTS = new Set(['6f8b9c07-4607-4ec1-8844-ed02996c39e9']);
const EXCLUDED = new Set(['24fb6e32-b1e1-4101-9943-d3fcff32e5c9']);
const HOLD = new Set<string>(); // Flavia confirmed the 14/09 cycle. Individual pauses use inactive schedules.
Deno.serve(async(req)=>{
 const cors=restrictedCors(req);
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS'}});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 const guard=await requireInternal(req);if(!guard.ok)return denied(guard,cors);
 try {
  const body=await req.json().catch(()=>({}));
  if(!body || typeof body!=='object' || Array.isArray(body))return reply({error:'invalid_payload'},400);
  const s=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:cfg,error:cfgError}=await s.from('zapi_connection_settings').select('owner_user_id').eq('id',1).single();
  if(cfgError||!cfg)return reply({error:'owner_not_configured'},503);
  if(guard.caller?.kind==='admin'&&guard.caller.userId!==cfg.owner_user_id)return reply({error:'forbidden'},403);
  const now=new Date(),today=localDay(now),day=new Date(today+'T12:00:00Z').getUTCDay();
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Fortaleza',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  const {data:schedules,error}=await s.from('athlete_checkin_schedules').select('*,clients:client_id(*)').eq('user_id',cfg.owner_user_id).eq('is_active',true);
  if(error)return reply({error:'database_unavailable'},503);
  const planned:any[]=[];const skipped:any[]=[];
  for(const sch of schedules||[]){
   const c=sch.clients;if(!c||EXCLUDED.has(c.id))continue;
   if(!operational(c,today)){skipped.push({client:c.name,reason:'not_eligible'});continue;}
   if(HOLD.has(c.id)){skipped.push({client:c.name,reason:'first_occurrence_to_confirm'});continue;}
   const frequency=c.checkin_frequency,anchor=c.checkin_start_date||sch.start_date;
   const due=occurrence(anchor,frequency,today);if(!due)continue;
   // Query each candidate, including pending rows with NULL sent_at, without a global row cap.
   const {data:history,error:he}=await s.from('checkin_dispatches').select('id,status')
     .eq('user_id',cfg.owner_user_id).eq('client_id',c.id)
     .gte('occurrence_date',due).limit(1);
   const {data:calendar,error:ce}=await s.from('scheduled_checkins').select('status')
     .eq('user_id',cfg.owner_user_id).eq('client_id',c.id).eq('scheduled_send_date',due);
   if(he||ce)return reply({error:'database_unavailable'},503);
   if(history?.length || calendar?.some(x=>x.status!=='pending'))continue;
   const {data:unconfirmed,error:ue}=await s.from('checkin_dispatches').select('id')
     .eq('user_id',cfg.owner_user_id).eq('client_id',c.id).eq('status','pending').limit(1);
   if(ue)return reply({error:'database_unavailable'},503);
   if(unconfirmed?.length){skipped.push({client:c.name,reason:'previous_send_unconfirmed'});continue;}
   const {data:resolved,error:re}=await s.rpc('resolve_checkin_form_for_client',{p_client_id:c.id});
   const form=resolved?.[0];if(re||!form?.form_id||!form.form_version_id||form.error_code){skipped.push({client:c.name,reason:form?.error_code||'form_not_configured'});continue;}
   const {data:f}=await s.from('checkin_forms').select('user_id,is_active,archived_at').eq('id',form.form_id).maybeSingle();
   if(!f?.is_active||f.archived_at||f.user_id!==c.user_id){skipped.push({client:c.name,reason:'form_not_active'});continue;}
   const phone=identity(c.phone),email=identity(c.email);const channel=EMAIL_CLIENTS.has(c.id)?'email':phone?.startsWith('55')?'whatsapp':'email';
   if((channel==='whatsapp'&&!phone)||(channel==='email'&&!email)){skipped.push({client:c.name,reason:'contact_not_configured'});continue;}
   planned.push({clientId:c.id,name:c.name,channel,frequency,anchor,occurrence:due,catchUp:due<today,formId:form.form_id,versionId:form.form_version_id,scheduleId:sch.id,windowHours:c.checkin_response_window_hours??sch.due_in_hours??36,phone:c.phone,email:c.email,readyTime:time>=(sch.send_time||'07:00').slice(0,5)});
  }
  // Explicit request AND both environment gates required. Defaults never send.
  const enabled=!OUTBOUND_PAUSED&&Deno.env.get('CONSULTORIA_CHECKIN_SEND_ENABLED')==='true';
  const dryRun=body.dryRun!==false||!enabled;
  const safe=planned.map(({phone,email,versionId,...p})=>p);
  if(dryRun)return reply({success:true,dryRun:true,paused:OUTBOUND_PAUSED,sendsEnabled:enabled,dispatched:0,totalEligible:planned.length,planned:safe,skipped});
  if(day!==1&&body.source==='cron')return reply({success:true,dispatched:0,reason:'not_monday'});
  // A manual send must name the reviewed clients; never bulk-send by accident.
  if(body.source!=='cron'&&(!Array.isArray(body.clientIds)||!body.clientIds.length))return reply({error:'client_selection_required'},400);
  const results:any[]=[];
  for(const p of planned){
   if(!p.readyTime||(body.source!=='cron'&&!body.clientIds.includes(p.clientId)))continue;
   if(p.channel==='whatsapp'&&Deno.env.get('CONSULTORIA_ZAPI_SEND_ENABLED')!=='true'){results.push({name:p.name,status:'blocked',reason:'whatsapp_paused'});continue;}
   if(p.channel==='email'&&Deno.env.get('CONSULTORIA_EMAIL_SEND_ENABLED')!=='true'){results.push({name:p.name,status:'blocked',reason:'email_pending_setup'});continue;}
   const {data:c}=await s.from('clients').select('*').eq('id',p.clientId).single();if(!operational(c,today)||c.user_id!==cfg.owner_user_id)continue;
   if(c.checkin_frequency!==p.frequency||(c.checkin_start_date||p.anchor)!==p.anchor||c.phone!==p.phone||c.email!==p.email)continue;
   const {data:activeSchedule}=await s.from('athlete_checkin_schedules').select('id').eq('id',p.scheduleId).eq('user_id',cfg.owner_user_id).eq('is_active',true).maybeSingle();
   const {data:activeForm}=await s.from('checkin_forms').select('id').eq('id',p.formId).eq('user_id',cfg.owner_user_id).eq('is_active',true).is('archived_at',null).maybeSingle();
   if(!activeSchedule||!activeForm)continue;
   const sentAt=new Date().toISOString(),deadline=new Date(Date.now()+p.windowHours*36e5).toISOString();
   const {data:d,error:de}=await s.from('checkin_dispatches').insert({user_id:cfg.owner_user_id,client_id:p.clientId,schedule_id:p.scheduleId,checkin_form_id:p.formId,form_version_id:p.versionId,status:'pending',sent_at:null,scheduled_for:p.occurrence+'T10:00:00Z',due_at:deadline,response_deadline:deadline,channel:p.channel,source:body.source==='cron'?'cron':'manual',metadata:{managed_checkin_flow:true,frequency_type:p.frequency,cycle_anchor:p.anchor}}).select('id,dispatch_token').single();
   if(de){results.push({name:p.name,status:'blocked',reason:de.code==='23505'?'duplicate_occurrence':'database_unavailable'});continue;}
   const link='https://rogersfeitosa.com.br/form/'+p.formId+'?client='+p.clientId+'&t='+d.dispatch_token;
   const {error:le}=await s.from('checkin_dispatches').update({link_checkin:link}).eq('id',d.id);if(le){results.push({name:p.name,status:'pending',reason:'link_save_failed'});continue;}
   const email=p.channel==='email';
   const {data:sent,error:se}=await s.functions.invoke(email?'send-transactional-email':'send-whatsapp',{headers:{Authorization:'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')},body:email?{clientId:p.clientId,dispatchId:d.id,templateName:'checkin-link',recipientEmail:p.email,idempotencyKey:'checkin-'+d.id,templateData:{name:p.name.split(' ')[0],link,accessCode:p.email,dueHours:p.windowHours+'h'}}:{clientId:p.clientId,templateKey:'checkin_reminder',context:{nome:p.name.split(' ')[0],link_checkin:link,checkin_link:link,codigo_acesso:p.phone,prazo_resposta:p.windowHours+'h'}}});
   if(se||sent?.success!==true||sent?.queued===true){
    // Unknown provider outcomes stay pending to prevent accidental retries.
    await s.from('checkin_dispatches').update({error_message:'send_not_confirmed'}).eq('id',d.id);
    results.push({name:p.name,status:'pending',reason:'send_not_confirmed'});continue;
   }
   const {error:ue}=await s.from('checkin_dispatches').update({status:'sent',sent_at:new Date().toISOString(),provider_response:{accepted:true,delivered:false,read:false}}).eq('id',d.id);
   if(!ue)await s.from('athlete_checkin_schedules').update({last_dispatched_at:new Date().toISOString()}).eq('id',p.scheduleId);
   results.push({name:p.name,status:ue?'pending':'sent',reason:ue?'delivery_log_pending':undefined});
  }
  return reply({success:true,dryRun:false,dispatched:results.filter(r=>r.status==='sent').length,results,skipped});
 }catch{return reply({error:'internal_error'},503);}
});
