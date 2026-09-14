import {requireInternal,restrictedCors,serviceClient} from '../_shared/authGuard.ts';
Deno.serve(async req=>{
 const cors=restrictedCors(req),reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'POST, OPTIONS'}});
 if(req.method!=='POST')return reply({success:false},405);
 const auth=await requireInternal(req);if(!auth.ok||auth.caller?.kind!=='admin')return reply({success:false},403);
 const s=serviceClient(),owner=auth.caller.userId;
 const {data:connection,error}=await s.from('google_oauth_connections').select('token_expires_at,refresh_token').eq('user_id',owner).maybeSingle();
 const {data:admin,error:ae}=await s.from('admin_settings').select('admin_whatsapp_number').eq('user_id',owner).maybeSingle();
 if(error||ae)return reply({success:false,message:'Não foi possível consultar as integrações.'},503);
 const missing=['GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_STATE_SECRET'].filter(key=>!Deno.env.get(key));
 // Presence/expiry is not a live Google connection test. Never return tokens.
 return reply({success:true,automaticPaused:true,google:{savedAuthorization:!!connection,hasRefresh:!!connection?.refresh_token,expired:!connection?.token_expires_at||Date.parse(connection.token_expires_at)<Date.now(),missingConfiguration:missing,meetEnabled:false,message:missing.length?'O Google precisa das credenciais OAuth deste sistema e de uma nova autorização.':'Autorização antiga encontrada. A renovação OAuth e a criação do Meet ainda precisam ser publicadas e verificadas.'},adminNotifications:{enabled:false,phoneSuffix:(admin?.admin_whatsapp_number||'').replace(/\D/g,'').slice(-4),message:'Avisos de check-in, consulta e anamnese não estão ativos neste projeto. O código antigo usa um telefone fixo diferente do cadastro administrativo.'}});
});
