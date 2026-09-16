import { handleAsaasWebhook } from '../../supabase/functions/asaas-webhook/handler.ts';
import { corpoDoLinkMetanoia, criarLinkDePagamentoMetanoia } from '../../supabase/functions/_shared/asaasPaymentLink.ts';
import { camposDoPlanoMetanoia, vigenciaMetanoia } from '../../supabase/functions/_shared/metanoia.ts';

const ATLETA = '11111111-1111-4111-8111-111111111111';
function assert(v: unknown, msg = 'Assertion failed'): asserts v { if (!v) throw new Error(msg); }

/** Banco falso: cada tabela devolve leituras na ordem em que são pedidas e guarda as escritas. */
function bancoFalso(leituras: Record<string, any[]>) {
  const writes: Array<{ table: string; op: string; payload: any; filtros: any[] }> = [];
  const filas: Record<string, any[]> = Object.fromEntries(Object.entries(leituras).map(([k, v]) => [k, [...v]]));
  function from(table: string) {
    let op = 'read', payload: any; const filtros: any[] = [];
    const chain: any = new Proxy({}, {
      get(_, prop) {
        if (prop === 'then') return (resolve: any) => {
          if (op === 'read') { const fila = filas[table] ?? []; const data = fila.length ? fila.shift() : null; return resolve({ data, error: null }); }
          writes.push({ table, op, payload, filtros }); return resolve({ data: op === 'insert' ? { id: 'novo-' + table, token: 'tok-novo', expires_at: null, ...payload } : payload, error: null });
        };
        if (prop === 'insert' || prop === 'update' || prop === 'upsert') return (p: any) => { op = prop as string; payload = p; return chain; };
        return (...args: any[]) => { if (prop === 'eq' || prop === 'neq' || prop === 'gte' || prop === 'is') filtros.push([prop, ...args]); return chain; };
      },
    });
    return chain;
  }
  return { writes, db: { from, functions: { invoke: async () => ({ error: null }) } } };
}

function deps(banco: ReturnType<typeof bancoFalso>, zapi: { ok?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      db: () => banco.db,
      fetch: (async (url: string) => {
        calls.push(url);
        if (url.endsWith('/send-text')) return new Response(JSON.stringify(zapi.ok === false ? { error: 'blocked' } : { zaapId: 'z-1', messageId: 'm-1' }), { status: zapi.ok === false ? 400 : 200 });
        return new Response('{}', { status: 200 });
      }) as unknown as typeof fetch,
      env: (k: string) => ({ ZAPI_INSTANCE_ID: 'i', ZAPI_TOKEN: 't', ZAPI_CLIENT_TOKEN: 'c', ASAAS_WEBHOOK_TOKEN: 'segredo' }[k]),
      agora: () => new Date('2026-09-21T15:00:00Z'),
    },
  };
}

const atletaMetanoia = { id: ATLETA, user_id: 'owner', name: 'Ana Souza', phone: '5599988887777', start_date: '2026-09-16', end_date: '2026-12-08', registration_source: 'metanoia', onboarding_status: 'awaiting_payment', is_active: false };

function evento(extra: Record<string, unknown> = {}, event = 'PAYMENT_CONFIRMED') {
  return new Request('https://x.test/asaas-webhook', {
    method: 'POST', headers: { 'asaas-access-token': 'segredo' },
    body: JSON.stringify({ event, payment: { id: 'pay_1', value: 1297, billingType: 'CREDIT_CARD', dueDate: '2026-09-21', paymentDate: '2026-09-21', invoiceUrl: 'https://asaas/i/1', externalReference: ATLETA, paymentLink: 'link_1', ...extra } }),
  });
}

Deno.test('webhook recusa token errado antes de tocar o banco', async () => {
  const banco = bancoFalso({});
  const d = deps(banco);
  const req = new Request('https://x.test', { method: 'POST', headers: { 'asaas-access-token': 'outro' }, body: '{}' });
  const res = await handleAsaasWebhook(req, d.deps);
  assert(res.status === 401);
  assert(banco.writes.length === 0);
});

Deno.test('pagamento confirmado do Metanóia ativa o atleta por 12 semanas e envia o convite', async () => {
  const banco = bancoFalso({
    zn_athletes: [null],
    clients: [atletaMetanoia],
    scheduling_settings: [{ booking_link_slug: 'rogers' }],
    athlete_whatsapp_settings: [null],
    whatsapp_templates: [{ id: 't', title: null, body: 'Oi {nome}, agende aqui: {booking_link}' }],
    whatsapp_message_logs: [[]],
    booking_links: [{ id: 'bl-1', token: 'tok-1', expires_at: null }],
    consultation_schedules: [[]],
  });
  const d = deps(banco);
  const res = await handleAsaasWebhook(evento(), d.deps);
  const corpo = await res.json();
  assert(res.ok, 'resposta ok');
  assert(corpo.metanoia?.activated === true, 'ativou');
  assert(corpo.metanoia?.invite === 'sent', 'convite enviado: ' + JSON.stringify(corpo));
  const pagamento = banco.writes.find((w) => w.table === 'payments');
  assert(pagamento?.payload.status === 'paid' && pagamento.payload.asaas_payment_id === 'pay_1');
  const ativacao = banco.writes.find((w) => w.table === 'clients' && w.op === 'update');
  assert(ativacao, 'atualizou o atleta');
  assert(ativacao!.payload.is_active === true && ativacao!.payload.onboarding_status === 'paid');
  assert(ativacao!.payload.start_date === '2026-09-21' && ativacao!.payload.end_date === '2026-12-13', 'vigência de 12 semanas');
  assert(ativacao!.filtros.some((f) => f[0] === 'neq' && f[1] === 'onboarding_status'), 'só ativa quem ainda não pagou');
  const envio = d.calls.find((u) => u.endsWith('/send-text'));
  assert(envio, 'chamou a Z-API');
  const log = banco.writes.find((w) => w.table === 'whatsapp_message_logs');
  assert(log?.payload.status === 'sent' && log.payload.triggered_by === 'metanoia_payment' && log.payload.message_type === 'booking_invite');
  assert(String(log!.payload.payload_preview).includes('/agendar/rogers?bt=tok-1'), 'mensagem com o link de agendamento');
});

Deno.test('segunda parcela de quem já pagou registra o pagamento e não reativa nem reenvia', async () => {
  const banco = bancoFalso({ zn_athletes: [null], clients: [{ ...atletaMetanoia, onboarding_status: 'paid', is_active: true }] });
  const d = deps(banco);
  const res = await handleAsaasWebhook(evento({ id: 'pay_2' }), d.deps);
  const corpo = await res.json();
  assert(res.ok && corpo.metanoia === null, 'sem ativação');
  assert(banco.writes.filter((w) => w.table === 'payments').length === 1);
  assert(!banco.writes.some((w) => w.table === 'clients'), 'não mexe no atleta');
  assert(d.calls.length === 0, 'não envia WhatsApp');
});

Deno.test('atleta fora do Metanóia só tem o pagamento registrado', async () => {
  const banco = bancoFalso({ zn_athletes: [null], clients: [{ ...atletaMetanoia, registration_source: 'manual', onboarding_status: null }] });
  const d = deps(banco);
  const res = await handleAsaasWebhook(evento({ subscription: 'sub_1' }), d.deps);
  const corpo = await res.json();
  assert(res.ok && corpo.metanoia === null);
  assert(banco.writes.some((w) => w.table === 'payments'));
  assert(!banco.writes.some((w) => w.table === 'whatsapp_message_logs'));
});

Deno.test('atleta localizado pelo link de pagamento quando a referência externa não vem', async () => {
  const banco = bancoFalso({ zn_athletes: [null], clients: [atletaMetanoia], scheduling_settings: [null] });
  const d = deps(banco);
  const res = await handleAsaasWebhook(evento({ externalReference: undefined }), d.deps);
  const corpo = await res.json();
  assert(corpo.matched !== false, 'achou o atleta pelo paymentLink');
  assert(corpo.metanoia?.activated === true);
  assert(corpo.metanoia?.invite === 'booking_slug_missing', 'sem endereço de agendamento o convite não sai, e a ativação fica: ' + JSON.stringify(corpo));
});

Deno.test('Z-API recusando: atleta ativado, convite registrado como falho, sem repetir', async () => {
  const banco = bancoFalso({
    zn_athletes: [null], clients: [atletaMetanoia],
    scheduling_settings: [{ booking_link_slug: 'rogers' }], athlete_whatsapp_settings: [null],
    whatsapp_templates: [{ id: 't', title: null, body: '{booking_link}' }], whatsapp_message_logs: [[]],
    booking_links: [{ id: 'bl-1', token: 'tok-1', expires_at: null }], consultation_schedules: [[]],
  });
  const d = deps(banco, { ok: false });
  const corpo = await (await handleAsaasWebhook(evento(), d.deps)).json();
  assert(corpo.metanoia?.invite === 'provider_rejected');
  const log = banco.writes.find((w) => w.table === 'whatsapp_message_logs');
  assert(log?.payload.status === 'failed');
  assert(!banco.writes.some((w) => w.table === 'booking_links' && w.op === 'update'), 'não marca last_sent_at');
});

Deno.test('pagamento não confirmado não ativa', async () => {
  const banco = bancoFalso({ zn_athletes: [null], clients: [atletaMetanoia] });
  const d = deps(banco);
  const corpo = await (await handleAsaasWebhook(evento({}, 'PAYMENT_CREATED'), d.deps)).json();
  assert(corpo.metanoia === null);
  const pagamento = banco.writes.find((w) => w.table === 'payments');
  assert(pagamento?.payload.status === 'pending');
});

Deno.test('link de pagamento: um por atleta, até 3 parcelas, com o id do cadastro amarrado', async () => {
  const corpo = corpoDoLinkMetanoia({ clientId: ATLETA, nome: 'Ana Souza Lima', valor: 1297, parcelas: 3 });
  assert(corpo.name === 'Metanóia · Ana' && corpo.chargeType === 'INSTALLMENT' && corpo.maxInstallmentCount === 3);
  assert(corpo.externalReference === ATLETA && corpo.value === 1297 && corpo.billingType === 'UNDEFINED');
  const aVista = corpoDoLinkMetanoia({ clientId: ATLETA, nome: 'Ana', valor: 1297, parcelas: 1 });
  assert(aVista.chargeType === 'DETACHED' && !('maxInstallmentCount' in aVista));
  let chamada: any = null;
  const link = await criarLinkDePagamentoMetanoia({ clientId: ATLETA, nome: 'Ana', valor: 1297, parcelas: 3 }, {
    fetch: (async (url: string, init: any) => { chamada = { url, init }; return new Response(JSON.stringify({ id: 'pl_1', url: 'https://www.asaas.com/c/abc' }), { status: 200 }); }) as unknown as typeof fetch,
    env: (k: string) => ({ ASAAS_API_KEY: 'k', ASAAS_ENV: 'production' }[k]),
  });
  assert(link.id === 'pl_1' && link.url === 'https://www.asaas.com/c/abc');
  assert(chamada.url === 'https://api.asaas.com/v3/paymentLinks' && chamada.init.headers.access_token === 'k');
  let erro = '';
  try { await criarLinkDePagamentoMetanoia({ clientId: ATLETA, nome: 'Ana', valor: 1, parcelas: 1 }, { fetch, env: () => undefined }); } catch (e) { erro = (e as Error).message; }
  assert(erro === 'asaas_nao_configurado');
});

Deno.test('desenho do plano e vigência', () => {
  const c = camposDoPlanoMetanoia();
  assert(c.consultation_frequency === '4_weeks' && c.consultation_count === 3 && c.checkin_frequency === 'weekly' && c.onboarding_status === 'awaiting_payment');
  assert(vigenciaMetanoia('2026-01-05').end_date === '2026-03-29');
});

Deno.test('sem link de agendamento ativo, o convite cria um novo e usa o token dele', async () => {
  const banco = bancoFalso({
    zn_athletes: [null], clients: [atletaMetanoia],
    scheduling_settings: [{ booking_link_slug: 'rogers' }], athlete_whatsapp_settings: [null],
    whatsapp_templates: [{ id: 't', title: 'Consulta', body: 'Agende: {booking_link}' }], whatsapp_message_logs: [[]],
    booking_links: [null], consultation_schedules: [[{ id: 'cs-1' }]],
  });
  const d = deps(banco);
  const corpo = await (await handleAsaasWebhook(evento(), d.deps)).json();
  assert(corpo.metanoia?.invite === 'sent', JSON.stringify(corpo));
  const criado = banco.writes.find((w) => w.table === 'booking_links' && w.op === 'insert');
  assert(criado?.payload.client_id === ATLETA && criado.payload.active === true);
  const log = banco.writes.find((w) => w.table === 'whatsapp_message_logs');
  assert(String(log!.payload.payload_preview).includes('?bt=tok-novo'));
  assert(log!.payload.consultation_schedule_id === 'cs-1', 'amarra o ciclo aberto');
  const agenda = banco.writes.find((w) => w.table === 'consultation_schedules' && w.op === 'update');
  assert(agenda?.payload.status === 'sent' && agenda.payload.link_sent_source === 'metanoia_payment');
});
