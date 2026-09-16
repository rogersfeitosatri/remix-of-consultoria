// Convite de agendamento disparado por automação (pagamento confirmado).
//
// Espelha o que o botão manual faz (send-manual-booking/handler.ts): mesmo
// modelo, mesmo link, mesma trilha em whatsapp_message_logs. Fica separado
// porque o botão manual exige JWT de administrador e reserva o envio do dia
// em manual_booking_sends; aqui o chamador é o webhook, e a proteção contra
// repetição é o registro do próprio envio no log do dia.
import { phoneNumber, render } from './whatsappText.ts';

export interface DepsConvite {
  fetch: typeof fetch;
  env: (key: string) => string | undefined;
  agora?: () => Date;
}

export interface AtletaDoConvite {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
}

export type ResultadoDoConvite =
  | { ok: true; providerId: string; link: string }
  | { ok: false; reason: string };

const DIA = 'America/Fortaleza';
function diaLocal(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// deno-lint-ignore no-explicit-any
export async function enviarConviteDeAgendamento(s: any, atleta: AtletaDoConvite, deps: DepsConvite, origem: string): Promise<ResultadoDoConvite> {
  const owner = atleta.user_id;
  const agora = deps.agora ? deps.agora() : new Date();
  const hoje = diaLocal(agora);
  const phone = phoneNumber(atleta.phone ?? '');
  if (!phone) return { ok: false, reason: 'invalid_phone' };

  const { data: settings } = await s.from('scheduling_settings').select('booking_link_slug').eq('user_id', owner).maybeSingle();
  if (!settings?.booking_link_slug) return { ok: false, reason: 'booking_slug_missing' };

  const { data: preferences } = await s.from('athlete_whatsapp_settings').select('disabled_all,disabled_template_keys').eq('client_id', atleta.id).maybeSingle();
  if (preferences?.disabled_all || preferences?.disabled_template_keys?.includes('weekly_booking_link')) return { ok: false, reason: 'athlete_opted_out' };

  const { data: template } = await s.from('whatsapp_templates').select('id,title,body').eq('user_id', owner).eq('template_key', 'weekly_booking_link').eq('is_active', true).maybeSingle();
  if (!template?.body) return { ok: false, reason: 'template_missing' };
  const primeiroNome = atleta.name.split(' ')[0];
  const rendered = render((template.title ? '*' + template.title + '*\n\n' : '') + template.body, { nome: primeiroNome, client_name: primeiroNome, booking_link: '__LINK__', link: '__LINK__' });
  if (!rendered.includes('__LINK__') || /\{\{?\s*[a-zA-Z_]+\s*\}?\}/.test(rendered)) return { ok: false, reason: 'template_invalid' };

  // Um convite por dia por atleta, contando também os manuais.
  const { data: jaEnviado } = await s.from('whatsapp_message_logs').select('id').eq('client_id', atleta.id).eq('message_type', 'booking_invite').eq('status', 'sent').gte('created_at', hoje + 'T00:00:00-03:00').limit(1);
  if (jaEnviado?.length) return { ok: false, reason: 'already_sent_today' };

  let { data: link } = await s.from('booking_links').select('id,token,expires_at').eq('client_id', atleta.id).eq('active', true).maybeSingle();
  if (link?.expires_at && Date.parse(link.expires_at) < agora.getTime()) {
    await s.from('booking_links').update({ active: false }).eq('id', link.id);
    link = null;
  }
  if (!link) {
    const { data: novo, error } = await s.from('booking_links').insert({ client_id: atleta.id, active: true }).select('id,token,expires_at').single();
    if (error || !novo) return { ok: false, reason: 'booking_link_failed' };
    link = novo;
  }
  const url = 'https://rogersfeitosa.com.br/agendar/' + encodeURIComponent(settings.booking_link_slug) + '?bt=' + encodeURIComponent(link.token);
  const mensagem = rendered.replaceAll('__LINK__', url);

  const instance = deps.env('ZAPI_INSTANCE_ID'), token = deps.env('ZAPI_TOKEN'), clientToken = deps.env('ZAPI_CLIENT_TOKEN');
  if (!instance || !token || !clientToken) return { ok: false, reason: 'zapi_not_configured' };
  const base = `https://api.z-api.io/instances/${instance}/token/${token}`;

  const resposta = await deps.fetch(base + '/send-text', {
    method: 'POST',
    headers: { 'Client-Token': clientToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message: mensagem }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  const payload = resposta ? await resposta.json().catch(() => ({})) : {};
  const providerId = payload.messageId || payload.zaapId || payload.id;
  const aceito = !!resposta && resposta.ok && !!providerId && !payload.error;
  const sentAt = agora.toISOString();

  const { data: aberto } = await s.from('consultation_schedules').select('id').eq('client_id', atleta.id).eq('user_id', owner).eq('status', 'pending').is('appointment_id', null).order('send_link_date', { ascending: true }).order('scheduled_date', { ascending: true }).limit(1);
  const scheduleId = aberto?.[0]?.id ?? null;

  await s.from('whatsapp_message_logs').insert({
    user_id: owner, client_id: atleta.id, consultation_schedule_id: scheduleId,
    message_type: 'booking_invite', template_key: 'weekly_booking_link', to_phone: phone,
    status: aceito ? 'sent' : 'failed', channel: 'whatsapp', triggered_by: origem,
    payload_preview: mensagem.slice(0, 500),
    error_message: aceito ? null : (payload.error ? JSON.stringify(payload.error).slice(0, 500) : 'provider_unconfirmed'),
    metadata: { provider_id: providerId ?? null, booking_link_id: link.id, source: origem },
  });
  if (!aceito) return { ok: false, reason: 'provider_rejected' };

  await s.from('booking_links').update({ last_sent_at: sentAt }).eq('id', link.id);
  if (scheduleId) {
    await s.from('consultation_schedules').update({ status: 'sent', link_sent_at: sentAt, link_sent_source: origem, link_sent_channel: 'whatsapp', link_sent_by: owner, updated_at: sentAt }).eq('id', scheduleId);
  }
  return { ok: true, providerId: String(providerId), link: url };
}
