import { requireInternal, restrictedCors, serviceClient } from '../_shared/authGuard.ts';
import { localDay, uuid } from '../_shared/publicCheckin.ts';
import { phoneNumber, render } from '../send-manual-checkin/handler.ts';

export async function handleManualBooking(req: Request, deps = { guard: requireInternal, db: serviceClient, fetch, env: (key:string) => Deno.env.get(key) }): Promise<Response> {
  const cors=restrictedCors(req);
  const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  const fail=(message:string,status=400)=>reply({success:false,message},status);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS'}});
  if(req.method!=='POST')return fail('Método inválido.',405);
  let reservation:string|undefined;
  try {
    const guard=await deps.guard(req);
    if(!guard.ok||guard.caller?.kind!=='admin')return fail('Somente o administrador pode enviar este convite manualmente.',403);
    const body=await req.json();
    if(body.dryRun!==true && body.send!==true)return fail('Envios automáticos pausados. Use o botão de envio manual.',409);
    const s=deps.db(),owner=guard.caller.userId,today=localDay(new Date());
    let clientId=body.clientId,scheduleId:string|undefined;
    if(body.consultationScheduleId){
      if(!uuid(body.consultationScheduleId))return fail('Agendamento inválido.');
      const {data:sch,error}=await s.from('consultation_schedules').select('id,client_id').eq('id',body.consultationScheduleId).eq('user_id',owner).maybeSingle();
      if(error||!sch)return fail('Agendamento não encontrado para este administrador.',403);
      clientId=sch.client_id;scheduleId=sch.id;
    }
    if(!uuid(clientId))return fail('Selecione o atleta.');
    const {data:c,error:ce}=await s.from('clients').select('id,user_id,name,phone,is_active,is_frozen,archived_at,ended_at,end_date').eq('id',clientId).eq('user_id',owner).maybeSingle();
    if(ce||!c)return fail('Atleta não encontrado para este administrador.',403);
    if(!c.is_active||c.is_frozen||c.archived_at||c.ended_at||(c.end_date&&c.end_date<today))return fail('Atleta inativo, congelado ou com plano encerrado.');
    const {data:elig,error:ee}=await s.rpc('is_client_eligible_for_booking',{_client_id:c.id});
    const eligible=Array.isArray(elig)?elig[0]:elig;
    if(ee||eligible?.eligible!==true)return fail(eligible?.reason==='already_scheduled'?'Este atleta já tem uma consulta agendada. Confira a agenda.':'O atleta não tem consulta disponível no plano. Confira o cadastro.');
    const phone=phoneNumber(c.phone);if(!phone)return fail('Corrija o telefone do atleta, incluindo o DDD.');
    const {data:settings,error:ste}=await s.from('scheduling_settings').select('booking_link_slug').eq('user_id',owner).maybeSingle();
    if(ste||!settings?.booking_link_slug)return fail('Configure o endereço de agendamento nas configurações.');
    const {data:cfg,error:cfgError}=await s.from('zapi_connection_settings').select('owner_user_id').eq('id',1).maybeSingle();
    if(cfgError||cfg?.owner_user_id!==owner)return fail('A conexão do WhatsApp não pertence a este administrador.',403);
    const {data:preferences,error:pe}=await s.from('athlete_whatsapp_settings').select('disabled_all,disabled_template_keys').eq('client_id',c.id).maybeSingle();
    if(pe)return fail('Não foi possível conferir as preferências do atleta.',503);
    if(preferences?.disabled_all||preferences?.disabled_template_keys?.includes('weekly_booking_link'))return fail('Este atleta está com os convites por WhatsApp desativados.');
    const {data:template,error:te}=await s.from('whatsapp_templates').select('id,title,body').eq('user_id',owner).eq('template_key','weekly_booking_link').eq('is_active',true).maybeSingle();
    if(te||!template?.body)return fail('Ative o modelo de convite para consulta nas configurações.');
    const rendered=render((template.title?'*'+template.title+'*\n\n':'')+template.body,{nome:c.name.split(' ')[0],client_name:c.name.split(' ')[0],booking_link:'__LINK__',link:'__LINK__'});
    if(!rendered.includes('__LINK__')||/\{\{?\s*[a-zA-Z_]+\s*\}?\}/.test(rendered))return fail('Revise as variáveis do modelo: o convite deve incluir {booking_link}.');
    let {data:link,error:ble}=await s.from('booking_links').select('id,token,expires_at').eq('client_id',c.id).eq('active',true).maybeSingle();
    if(ble)return fail('Não foi possível conferir o link de consulta. Nenhuma mensagem enviada.',503);
    if(link?.expires_at&&Date.parse(link.expires_at)<Date.now())return fail('O link de consulta expirou. Renove o link antes de enviar.',409);
    const {data:prior,error:pre}=await s.from('manual_booking_sends').select('id').eq('user_id',owner).eq('client_id',c.id).in('status',['pending','sent']).gte('send_day',today).limit(1);
    if(pre)return fail('Não foi possível conferir os envios anteriores.',503);
    if(prior?.length)return fail('O convite já foi enviado ou está em processamento hoje. Confira o histórico.',409);
    const instance=deps.env('ZAPI_INSTANCE_ID'),token=deps.env('ZAPI_TOKEN'),clientToken=deps.env('ZAPI_CLIENT_TOKEN');
    if(!instance||!token||!clientToken)return fail('Configure a instância e os tokens da Z-API.',503);
    const base=`https://api.z-api.io/instances/${instance}/token/${token}`;
    const connection=await deps.fetch(base+'/status',{headers:{'Client-Token':clientToken},signal:AbortSignal.timeout(10000)});
    const state=await connection.json().catch(()=>({}));
    if(!connection.ok||state.connected!==true)return fail('O WhatsApp está desconectado ou a Z-API recusou as credenciais.',503);
    if(body.dryRun===true)return reply({success:true,dryRun:true,message:'Consulta disponível, modelo válido e WhatsApp conectado. Nenhum convite enviado.'});
    const {data:r,error:re}=await s.from('manual_booking_sends').insert({user_id:owner,client_id:c.id,send_day:today}).select('id').single();
    if(re||!r)return fail('O convite já está em processamento. Confira o histórico.',409);
    reservation=r.id;
    if(!link){const {data:newLink,error:nle}=await s.from('booking_links').insert({client_id:c.id,active:true}).select('id,token,expires_at').single();if(nle||!newLink)return fail('Não foi possível criar o link de consulta.',503);link=newLink;}
    const url='https://rogersfeitosa.com.br/agendar/'+encodeURIComponent(settings.booking_link_slug)+'?bt='+encodeURIComponent(link.token);
    const response=await deps.fetch(base+'/send-text',{method:'POST',headers:{'Client-Token':clientToken,'Content-Type':'application/json'},body:JSON.stringify({phone,message:rendered.replaceAll('__LINK__',url)}),signal:AbortSignal.timeout(20000)});
    const payload=await response.json().catch(()=>({}));const providerId=payload.messageId||payload.zaapId||payload.id;
    if(!response.ok||!providerId||payload.error){const rejected=response.status>=400&&response.status<500;await s.from('manual_booking_sends').update({status:rejected?'failed':'pending',error_code:'provider_unconfirmed'}).eq('id',r.id);return fail('A Z-API não confirmou o envio. Confira o histórico antes de repetir.',502);}
    const sentAt=new Date().toISOString();
    const {error:ue}=await s.from('manual_booking_sends').update({status:'sent',sent_at:sentAt,provider_id:providerId}).eq('id',r.id);
    if(ue)return fail('A Z-API aceitou o convite, mas o registro ficou pendente. Não repita o envio.',503);
    await s.from('booking_links').update({last_sent_at:sentAt}).eq('id',link.id);
    if(scheduleId)await s.from('consultation_schedules').update({status:'sent',updated_at:sentAt}).eq('id',scheduleId).eq('user_id',owner);
    await s.from('whatsapp_message_logs').insert({user_id:owner,client_id:c.id,consultation_schedule_id:scheduleId??null,message_type:'booking_invite',template_key:'weekly_booking_link',to_phone:phone,status:'sent',triggered_by:'manual_admin',metadata:{manual_booking_id:r.id,zapi_response:{messageId:providerId},template_id:template.id}});
    return reply({success:true,accepted:true,message:'Convite de consulta enviado ao WhatsApp. A entrega será confirmada pelo provedor.'});
  } catch {return fail(reservation?'O envio ficou sem confirmação. Confira o histórico antes de repetir.':'Não foi possível verificar o convite agora. Tente novamente.',503);}
}
