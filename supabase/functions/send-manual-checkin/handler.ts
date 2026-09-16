import { requireInternal, restrictedCors, serviceClient } from '../_shared/authGuard.ts';
import { localDay, operational, uuid } from '../_shared/publicCheckin.ts';

import { phoneNumber, render } from '../_shared/whatsappText.ts';
export { phoneNumber, render };
type Dependencies = { guard: typeof requireInternal; db: typeof serviceClient; fetch: typeof fetch; env: (key: string) => string | undefined };
const defaults: Dependencies = { guard: requireInternal, db: serviceClient, fetch, env: key => Deno.env.get(key) };

// Dedicated manual route. Cron/service credentials are explicitly rejected.
// The legacy sender and automatic processor retain their independent pauses.
export async function handleManualCheckin(req: Request, deps: Dependencies = defaults): Promise<Response> {
  const cors = restrictedCors(req);
  const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  const fail = (error: string, message: string, status = 400) => reply({ success: false, error, message }, status);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (req.method !== 'POST') return fail('method_not_allowed', 'Método inválido.', 405);
  let dispatchId: string | undefined;
  try {
    const auth = await deps.guard(req);
    if (!auth.ok || auth.caller?.kind !== 'admin') return fail('unauthorized', 'Entre como administrador para enviar check-ins.', 403);
    const body = await req.json();
    if (!uuid(body?.clientId) || (body.dryRun !== true && body.send !== true)) return fail('invalid_request', 'Selecione o atleta e a ação de envio.');
    const s = deps.db(), owner = auth.caller.userId, today = localDay(new Date());
    const { data: c, error: ce } = await s.from('clients').select('*').eq('id', body.clientId).eq('user_id', owner).maybeSingle();
    if (ce) return fail('database_unavailable', 'Não foi possível consultar o cadastro.', 503);
    if (!c) return fail('forbidden', 'Atleta não encontrado para este administrador.', 403);
    if (!operational(c, today)) return fail('not_eligible', 'O atleta está inativo, congelado ou sem check-in vigente.');
    if (c.id === '6f8b9c07-4607-4ec1-8844-ed02996c39e9') return fail('email_pending_setup', 'Este atleta recebe por e-mail. O provedor de e-mail ainda precisa ser configurado.');
    const phone = phoneNumber(c.phone);
    if (!phone) return fail('invalid_phone', 'Corrija o telefone do atleta, incluindo o DDD.');
    const { data: cfg, error: cfgError } = await s.from('zapi_connection_settings').select('owner_user_id').eq('id', 1).maybeSingle();
    if (cfgError || cfg?.owner_user_id !== owner) return fail('provider_owner', 'A conexão do WhatsApp não pertence a este administrador.', 403);
    const instance = deps.env('ZAPI_INSTANCE_ID'), token = deps.env('ZAPI_TOKEN'), clientToken = deps.env('ZAPI_CLIENT_TOKEN');
    if (!instance || !token || !clientToken) return fail('zapi_not_configured', 'Configure a instância e os tokens do WhatsApp nas configurações.', 503);
    const { data: forms, error: fe } = await s.rpc('resolve_checkin_form_for_client', { p_client_id: c.id });
    const form = forms?.[0];
    if (fe || !form?.form_id || !form.form_version_id || form.error_code) return fail('form_not_configured', 'Configure um formulário ativo com perguntas para este atleta.');
    const { data: activeForm, error: afe } = await s.from('checkin_forms').select('id').eq('id', form.form_id).eq('user_id', owner).eq('is_active', true).is('archived_at', null).maybeSingle();
    if (afe || !activeForm) return fail('form_not_active', 'O formulário do atleta não está ativo.');
    const { data: template, error: te } = await s.from('whatsapp_templates').select('id,title,body,updated_at').eq('user_id', owner).eq('template_key', 'checkin_reminder').eq('is_active', true).maybeSingle();
    if (te || !template?.body) return fail('template_not_configured', 'Ative o modelo de mensagem de check-in nas configurações.');
    const { data: schedules, error: se } = await s.from('athlete_checkin_schedules').select('id,due_in_hours').eq('user_id', owner).eq('client_id', c.id).eq('is_active', true).order('created_at').limit(1);
    if (se) return fail('database_unavailable', 'Não foi possível consultar a agenda.', 503);
    const { data: existing, error: ee } = await s.from('checkin_dispatches').select('id,status,occurrence_date').eq('user_id', owner).eq('client_id', c.id).in('status', ['pending', 'sent', 'responded']).gte('occurrence_date', today).limit(1);
    if (ee) return fail('database_unavailable', 'Não foi possível conferir os envios anteriores.', 503);
    if (existing?.length) return fail('already_dispatched', 'Já existe um check-in enviado ou em processamento para este atleta hoje. Confira o histórico.', 409);
    const base = `https://api.z-api.io/instances/${instance}/token/${token}`;
    const connection = await deps.fetch(base + '/status', { headers: { 'Client-Token': clientToken }, signal: AbortSignal.timeout(10000) });
    const status = await connection.json().catch(() => ({}));
    if (!connection.ok) return fail('provider_credentials', 'A Z-API recusou a conexão. Confira a instância, os tokens e a assinatura.', 503);
    if (status.connected !== true) return fail('whatsapp_disconnected', 'O WhatsApp está desconectado. Reconecte a instância na Z-API.', 503);
    const hours = c.checkin_response_window_hours ?? schedules?.[0]?.due_in_hours ?? 36;
    if (!Number.isFinite(hours) || hours <= 0 || hours > 720) return fail('invalid_window', 'Confira o prazo de resposta configurado para este atleta.');
    const vars = { nome: c.name.split(' ')[0], link_checkin: '__INVITATION__', checkin_link: '__INVITATION__', codigo_acesso: '+' + phone,
      data: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza' }).format(new Date()), prazo_resposta: hours + 'h' };
    const rendered = render((template.title ? '*' + template.title + '*\n\n' : '') + template.body, vars);
    if (/\{\{?\s*[a-zA-Z_]+\s*\}?\}/.test(rendered)) return fail('invalid_template', 'O modelo de check-in contém variáveis sem valor. Revise o modelo nas configurações.');
    if (!rendered.includes('__INVITATION__')) return fail('missing_link', 'Inclua {link_checkin} no modelo de mensagem de check-in.');
    if (body.dryRun === true) return reply({ success: true, dryRun: true, connected: true, automaticPaused: true, message: 'WhatsApp conectado, formulário e mensagem válidos. Envio manual disponível. Nenhuma mensagem enviada.' });
    const deadline = new Date(Date.now() + hours * 3600000).toISOString();
    const metadata = { managed_checkin_flow: true, manual_admin_send: true };
    const { data: d, error: de } = await s.from('checkin_dispatches').insert({ user_id: owner, client_id: c.id, checkin_form_id: form.form_id,
      form_version_id: form.form_version_id, schedule_id: schedules?.[0]?.id ?? null, status: 'pending', sent_at: null, scheduled_for: new Date().toISOString(),
      occurrence_date: today, due_at: deadline, response_deadline: deadline, channel: 'whatsapp', source: 'manual', metadata }).select('id,dispatch_token').single();
    if (de || !d) return fail('reservation_failed', de?.code === '23505' ? 'Este check-in já está em processamento. Confira o histórico.' : 'Não foi possível registrar o convite. Nenhuma mensagem enviada.', 409);
    dispatchId = d.id;
    const link = `https://rogersfeitosa.com.br/form/${form.form_id}?client=${c.id}&t=${d.dispatch_token}`;
    const { error: le } = await s.from('checkin_dispatches').update({ link_checkin: link }).eq('id', d.id);
    if (le) return fail('link_save_failed', 'Não foi possível salvar o convite. Nenhuma mensagem enviada.', 503);
    const result = await deps.fetch(base + '/send-text', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
      body: JSON.stringify({ phone, message: rendered.replaceAll('__INVITATION__', link) }), signal: AbortSignal.timeout(20000) });
    const payload = await result.json().catch(() => ({}));
    const providerId = payload.messageId || payload.zaapId || payload.id;
    if (!result.ok || !providerId || payload.error) {
      // Explicit 4xx rejection is safe to retry. Ambiguous results retain their reservation.
      const rejected = result.status >= 400 && result.status < 500;
      await s.from('checkin_dispatches').update({ status: rejected ? 'failed' : 'pending', error_message: rejected ? 'provider_rejected' : 'provider_unconfirmed',
        metadata: { ...metadata, managed_checkin_flow: !rejected }, provider_response: { httpStatus: result.status, accepted: false } }).eq('id', d.id);
      return fail('provider_unconfirmed', rejected ? 'A Z-API recusou a mensagem. Verifique a conexão e tente novamente.' : 'A Z-API não confirmou o envio. Confira o histórico antes de repetir.', 502);
    }
    const sentAt = new Date().toISOString();
    const { error: ue } = await s.from('checkin_dispatches').update({ status: 'sent', sent_at: sentAt, provider_response: { accepted: true, delivered: false, read: false, messageId: providerId } }).eq('id', d.id);
    if (ue) return fail('persistence_unconfirmed', 'A Z-API aceitou a mensagem, mas o registro não foi confirmado. Não repita o envio; confira o histórico.', 503);
    // Delivery/read remain the provider webhook's responsibility.
    await s.from('whatsapp_message_logs').insert({ user_id: owner, client_id: c.id, message_type: 'checkin_reminder', template_key: 'checkin_reminder',
      to_phone: phone, status: 'sent', metadata: { dispatch_id: d.id, template_id: template.id, zapi_response: { messageId: providerId }, manual_admin_send: true } });
    if (schedules?.[0]?.id) await s.from('athlete_checkin_schedules').update({ last_dispatched_at: sentAt }).eq('id', schedules[0].id);
    return reply({ success: true, dispatchId: d.id, accepted: true, message: 'Check-in enviado ao WhatsApp. A entrega será confirmada pelo provedor.' });
  } catch {
    return fail('request_failed', dispatchId ? 'O envio ficou sem confirmação. Confira o histórico antes de repetir para evitar duplicidade.' : 'Não foi possível verificar o envio agora. Tente novamente em instantes.', 503);
  }
}
