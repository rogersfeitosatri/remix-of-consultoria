// Helper compartilhado de envio de push via Firebase Cloud Messaging (HTTP v1).
// Usa a service account em FCM_SERVICE_ACCOUNT (secret das edge functions).
// Também respeita as preferências do usuário (tabela notification_preferences).

function b64url(data: ArrayBuffer | string): string {
  let str: string;
  if (typeof data === 'string') {
    str = btoa(unescape(encodeURIComponent(data)));
  } else {
    const bytes = new Uint8Array(data);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    str = btoa(bin);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export async function getFcmAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`OAuth token error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

export async function sendFcmMessage(
  accessToken: string, projectId: string, token: string,
  title: string, body: string, url: string,
): Promise<{ ok: boolean; status: number; body: string | null }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { url },
        webpush: { fcm_options: { link: url } },
      },
    }),
  });
  return { ok: res.ok, status: res.status, body: res.ok ? null : await res.text() };
}

/**
 * Envia um push para todos os dispositivos de um usuário, respeitando a preferência.
 * @param prefKey chave em notification_preferences (ex: 'anamnese_submitted'). Ausência = ativado.
 * Retorna resumo; nunca lança (loga erros).
 */
export async function notifyUser(
  supabase: any,
  userId: string,
  opts: { prefKey: string; title: string; body: string; url?: string },
): Promise<{ sent: number; failed: number; skipped: boolean }> {
  try {
    // 1) Preferência do usuário
    const { data: pref } = await supabase
      .from('notification_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();
    const prefs = (pref?.preferences || {}) as Record<string, boolean>;
    if (prefs[opts.prefKey] === false) {
      console.warn(`[fcm] preferência '${opts.prefKey}' desativada para user ${userId} — push não enviado.`);
      return { sent: 0, failed: 0, skipped: true };
    }

    // 2) Service account
    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!saRaw) {
      console.warn('[fcm] FCM_SERVICE_ACCOUNT não configurado — push não enviado.');
      return { sent: 0, failed: 0, skipped: true };
    }
    const sa = JSON.parse(saRaw);

    // 3) Tokens do usuário
    const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
    if (!tokens || tokens.length === 0) {
      console.warn(`[fcm] nenhum dispositivo registrado (push_tokens) para user ${userId} — push não enviado.`);
      return { sent: 0, failed: 0, skipped: true };
    }
    console.log(`[fcm] enviando push para ${tokens.length} dispositivo(s) do user ${userId}.`);

    const accessToken = await getFcmAccessToken(sa);
    const url = opts.url || '/';
    let sent = 0, failed = 0;
    const staleTokens: string[] = [];
    for (const t of tokens) {
      const r = await sendFcmMessage(accessToken, sa.project_id, t.token, opts.title, opts.body, url);
      if (r.ok) {
        sent++;
      } else {
        failed++;
        console.error('[fcm] falha:', r.status, r.body);
        // Token não registrado/inválido → remove para auto-limpeza (self-heal).
        const isStale = r.status === 404 ||
          (r.status === 400 && /UNREGISTERED|registration-token-not-registered|invalid|not a valid FCM/i.test(r.body || ''));
        if (isStale) staleTokens.push(t.token);
      }
    }
    if (staleTokens.length > 0) {
      await supabase.from('push_tokens').delete().in('token', staleTokens);
      console.warn(`[fcm] ${staleTokens.length} token(s) obsoleto(s) removido(s).`);
    }
    return { sent, failed, skipped: false };
  } catch (e) {
    console.error('[fcm] notifyUser erro:', e instanceof Error ? e.message : e);
    return { sent: 0, failed: 0, skipped: true };
  }
}
