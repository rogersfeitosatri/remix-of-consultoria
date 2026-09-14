import { handleManualCheckin, phoneNumber, render } from '../../supabase/functions/send-manual-checkin/handler.ts';

const clientId = '11111111-1111-4111-8111-111111111111';
function assert(value: unknown, label = 'assertion failed'): asserts value { if (!value) throw new Error(label); }
function fixture(options: { dry?: boolean; internal?: boolean; disconnected?: boolean; duplicate?: boolean; providerStatus?: number; timeout?: boolean; failedSave?: boolean } = {}) {
  const writes: any[] = [], calls: string[] = [];
  const reads: any[] = [
    { id: clientId, user_id: 'owner', name: 'Teste', phone: '55999999999', is_active: true, is_frozen: false, has_checkin: true, end_date: '2099-01-01' },
    { owner_user_id: 'owner' }, [{ form_id: 'form', form_version_id: 'version' }], { id: 'form' },
    { id: 'template', body: 'Olá {{nome}}: {link_checkin}. Código: {codigo_acesso}' }, [{ id: 'schedule', due_in_hours: 36 }],
    options.duplicate ? [{ id: 'old', status: 'sent' }] : [],
  ];
  let sentUpdate = false;
  const db = {
    from(table: string) { return builder(table); }, rpc() { return Promise.resolve({ data: reads.shift(), error: null }); },
  };
  function builder(table: string) {
    let op = 'read', payload: any;
    const chain: any = new Proxy({}, { get(_, prop) {
      if (prop === 'then') return (resolve: any) => {
        if (op === 'read') return Promise.resolve({ data: reads.shift(), error: null }).then(resolve);
        writes.push({ table, op, payload });
        if (payload?.status === 'sent') sentUpdate = true;
        return Promise.resolve({ data: op === 'insert' ? { id: 'dispatch', dispatch_token: 'token' } : null,
          error: options.failedSave && sentUpdate && table === 'checkin_dispatches' ? { message: 'failed' } : null }).then(resolve);
      };
      return (arg: any) => { if (prop === 'insert' || prop === 'update') { op = String(prop); payload = arg; } return chain; };
    }}); return chain;
  }
  const deps: any = { db: () => db, env: () => 'configured',
    guard: async () => ({ ok: true, caller: options.internal ? { kind: 'internal' } : { kind: 'admin', userId: 'owner' } }),
    fetch: async (url: string, init: any) => {
      calls.push(url.endsWith('/status') ? 'status' : 'send');
      if (url.endsWith('/status')) return new Response(JSON.stringify({ connected: !options.disconnected }));
      if (options.timeout) throw new Error('timeout');
      const message = JSON.parse(init.body).message;
      assert(message.includes('&t=token') && !message.includes('{'), 'rendered token link missing');
      return new Response(JSON.stringify(options.providerStatus ? { error: 'rejected' } : { messageId: 'accepted-id' }), { status: options.providerStatus || 200 });
    },
  };
  return { writes, calls, run: () => handleManualCheckin(new Request('https://app.test', { method: 'POST', body: JSON.stringify({ clientId, dryRun: !!options.dry, send: !options.dry }) }), deps) };
}
Deno.test('manual preflight performs no writes or sends', async () => { const f=fixture({dry:true}); const r=await f.run(); assert(r.ok); assert(f.calls.join()==='status'); assert(f.writes.length===0); });
Deno.test('manual rejects cron/service caller before DB or provider', async () => { const f=fixture({internal:true}); assert((await f.run()).status===403); assert(!f.calls.length&&!f.writes.length); });
Deno.test('manual disconnected provider does not reserve or send', async () => { const f=fixture({disconnected:true}); assert((await f.run()).status===503); assert(!f.writes.length&&f.calls.join()==='status'); });
Deno.test('manual duplicate blocks before provider', async () => { const f=fixture({duplicate:true}); assert((await f.run()).status===409); assert(!f.calls.length&&!f.writes.length); });
Deno.test('manual accepted: reservation then token link then sent', async () => { const f=fixture(); assert((await f.run()).ok); assert(f.writes[0].payload.sent_at===null); assert(f.writes[0].payload.form_version_id==='version'); assert(f.writes[1].payload.link_checkin.includes('&t=token')); assert(f.writes[2].payload.status==='sent'); assert(f.calls.join()==='status,send'); });
Deno.test('manual timeout never marks sent or retries', async () => { const f=fixture({timeout:true}); assert((await f.run()).status===503); assert(f.calls.join()==='status,send'); assert(!f.writes.some(w=>w.payload.status==='sent')); });
Deno.test('manual provider rejection releases known failure', async () => { const f=fixture({providerStatus:400}); assert((await f.run()).status===502); const last=f.writes.at(-1); assert(last.payload.status==='failed'&&!last.payload.metadata.managed_checkin_flow); });
Deno.test('manual ambiguous provider error retains reservation', async () => { const f=fixture({providerStatus:500}); assert((await f.run()).status===502); const last=f.writes.at(-1); assert(last.payload.status==='pending'&&last.payload.metadata.managed_checkin_flow); });
Deno.test('manual failed persistence does not report success', async () => { const f=fixture({failedSave:true}); assert((await f.run()).status===503); });
Deno.test('phone DDD55 and both template brace styles work', () => { assert(phoneNumber('55999999999')==='5555999999999'); assert(render('{{nome}} {nome}',{nome:'Teste'})==='Teste Teste'); });
