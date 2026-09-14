import { requireInternal, denied, restrictedCors, serviceClient } from '../_shared/authGuard.ts';
import { uuid } from '../_shared/publicCheckin.ts';
Deno.serve(async req => {
 const cors=restrictedCors(req);
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 const guard=await requireInternal(req); if(!guard.ok)return denied(guard,cors);
 const body=await req.json().catch(()=>null);
 if(!body||!uuid(body.clientId))return reply({error:'client_required'},400);
 const {data:c,error}=await serviceClient().from('clients').select('user_id,email').eq('id',body.clientId).maybeSingle();
 if(error)return reply({error:'database_unavailable'},503);
 if(!c||(guard.caller?.kind==='admin'&&guard.caller.userId!==c.user_id))return reply({error:'forbidden'},403);
 if(body.recipientEmail&&body.recipientEmail.trim().toLowerCase()!==c.email?.trim().toLowerCase())return reply({error:'recipient_mismatch'},400);
 // Do not enqueue into the legacy provider. Its domain/integration has not been migrated.
 return reply({success:false,paused:true,error:'email_setup_pending',recipientConfigured:!!c.email,
   providerCredentialPresent:!!Deno.env.get('LOVABLE_API_KEY')},body.dryRun===true?200:503);
});
