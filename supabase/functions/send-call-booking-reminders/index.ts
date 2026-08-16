import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

async function sendZapi(phone: string, message: string) {
  const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID')!;
  const zapiToken = Deno.env.get('ZAPI_TOKEN')!;
  const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';

  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('0')) formatted = formatted.substring(1);
  if (!formatted.startsWith('55')) formatted = '55' + formatted;

  const url = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': zapiClientToken },
    body: JSON.stringify({ phone: formatted, message }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(`ZAPI error: ${JSON.stringify(result)}`);
  return result;
}

// ─── Google Calendar + Meet ─────────────────────────────────────────────────
async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  supabase: any,
  userId: string
): Promise<{ success: boolean; access_token?: string; error?: string }> {
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      if (tokenData.error === 'invalid_grant') {
        await supabase.from('google_oauth_connections').update({
          access_token: null, token_expires_at: null, updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
      }
      return { success: false, error: tokenData.error_description || 'Token refresh failed' };
    }
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    await supabase.from('google_oauth_connections').update({
      access_token: tokenData.access_token,
      token_expires_at: expiresAt.toISOString(),
      ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
    return { success: true, access_token: tokenData.access_token };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getGoogleAccessToken(supabase: any, userId: string): Promise<string | null> {
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;

  const { data: conn } = await supabase
    .from('google_oauth_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!conn?.access_token || !conn?.refresh_token) return null;

  const TOKEN_BUFFER = 5 * 60 * 1000;
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  if (expiresAt < Date.now() + TOKEN_BUFFER) {
    const res = await refreshGoogleToken(conn.refresh_token, clientId, clientSecret, supabase, userId);
    return res.success ? res.access_token! : null;
  }
  return conn.access_token;
}

async function createCalendarEventForBooking(
  supabase: any,
  booking: any,
  linkTitle: string,
  accessToken: string
): Promise<{ eventId?: string; meetLink?: string }> {
  const timezone = 'America/Sao_Paulo';
  const bookingTime = booking.booking_time.length === 5 ? `${booking.booking_time}:00` : booking.booking_time;
  const [h, m] = bookingTime.split(':').map(Number);
  const endMin = h * 60 + m + (booking.duration_minutes || 30);
  const endH = Math.floor(endMin / 60) % 24;
  const endM = endMin % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

  const startDT = `${booking.booking_date}T${bookingTime}`;
  const endDT = `${booking.booking_date}T${endTime}`;

  const eventData = {
    summary: `Call - ${booking.lead_name || 'Lead'}`,
    description: `Call "${linkTitle}"\nNome: ${booking.lead_name || 'N/A'}\nEmail: ${booking.lead_email || 'N/A'}\nTelefone: ${booking.lead_phone || 'N/A'}`,
    start: { dateTime: startDT, timeZone: timezone },
    end: { dateTime: endDT, timeZone: timezone },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
    attendees: booking.lead_email ? [{ email: booking.lead_email, displayName: booking.lead_name || '' }] : undefined,
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    }
  );
  const created = await res.json();
  if (!res.ok) {
    console.error('[call-reminders] Google Calendar error:', created);
    return {};
  }

  const meetLink = created.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri || created.hangoutLink || null;

  // Persist on booking
  await supabase.from('call_bookings').update({
    google_calendar_event_id: created.id,
    meeting_link: meetLink,
  }).eq('id', booking.id);

  console.log('[call-reminders] Calendar event created:', created.id, 'Meet:', meetLink);
  return { eventId: created.id, meetLink: meetLink || undefined };
}

// ─── Main Handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'send-call-booking-reminders' });
    return denied(guard, corsHeaders);
  });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'reminders';

    const results: { id: string; type: string; success: boolean; error?: string }[] = [];

    if (mode === 'confirmation') {
      const { bookingId } = body;
      if (!bookingId) throw new Error('bookingId is required for confirmation mode');

      const { data: booking, error: bErr } = await supabase
        .from('call_bookings')
        .select('*, call_scheduling_links(title, confirmation_template, meeting_link, user_id)')
        .eq('id', bookingId)
        .single();

      if (bErr || !booking) throw new Error('Booking not found');

      const link = (booking as any).call_scheduling_links;

      // ── Step 1: Create Google Calendar event with Meet ──
      let meetLink = booking.meeting_link || link?.meeting_link || '';
      const accessToken = await getGoogleAccessToken(supabase, link.user_id);
      if (accessToken) {
        const calResult = await createCalendarEventForBooking(supabase, booking, link?.title || '', accessToken);
        if (calResult.meetLink) {
          meetLink = calResult.meetLink;
        }
      } else {
        console.log('[call-reminders] Google OAuth not available, skipping calendar event');
      }

      // ── Step 2: Send WhatsApp confirmation ──
      if (!booking.lead_phone) {
        return new Response(JSON.stringify({ success: true, meetLink, note: 'No phone, skipped WhatsApp' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dateObj = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const formattedDate = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      const formattedTime = booking.booking_time.substring(0, 5);

      const vars: Record<string, string> = {
        nome: booking.lead_name || 'Participante',
        data_horario: `${formattedDate} às ${formattedTime}`,
        data: formattedDate,
        horario: formattedTime,
        link_call: meetLink,
        responsavel: 'Rogers Feitosa',
        titulo: link?.title || '',
      };

      let message: string;
      if (link?.confirmation_template) {
        message = renderTemplate(link.confirmation_template, vars);
      } else {
        message = `✅ *Agendamento Confirmado*\n\nOlá ${vars.nome}!\n\nSua call "${vars.titulo}" foi agendada com sucesso:\n📅 ${vars.data}\n⏰ ${vars.horario}`;
        if (vars.link_call) message += `\n\n💻 Link da videochamada:\n${vars.link_call}`;
        message += `\n\nAté lá! 🙂`;
      }

      await sendZapi(booking.lead_phone, message);

      await supabase
        .from('call_bookings')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', bookingId);

      results.push({ id: bookingId, type: 'confirmation', success: true });

    } else {
      // CRON MODE: send reminders for upcoming bookings
      const now = new Date();

      const windows = [
        { type: 'reminder_24h', hoursAhead: [23, 25], sentCol: 'reminder_24h_sent_at', enableCol: 'send_reminder_24h', templateCol: 'reminder_24h_template' },
        { type: 'reminder_2h', hoursAhead: [1.75, 2.25], sentCol: 'reminder_2h_sent_at', enableCol: 'send_reminder_2h', templateCol: 'reminder_2h_template' },
        { type: 'reminder_15m', hoursAhead: [0.2, 0.3], sentCol: 'reminder_15m_sent_at', enableCol: 'send_reminder_15m', templateCol: 'reminder_15m_template' },
      ];

      for (const w of windows) {
        const minTime = new Date(now.getTime() + w.hoursAhead[0] * 60 * 60 * 1000);
        const maxTime = new Date(now.getTime() + w.hoursAhead[1] * 60 * 60 * 1000);
        const minDate = minTime.toISOString().split('T')[0];
        const maxDate = maxTime.toISOString().split('T')[0];

        const { data: bookings } = await supabase
          .from('call_bookings')
          .select('*, call_scheduling_links(title, meeting_link, user_id, send_reminder_24h, send_reminder_2h, send_reminder_15m, reminder_24h_template, reminder_2h_template, reminder_15m_template)')
          .in('status', ['confirmed', 'pending'])
          .is(w.sentCol as any, null)
          .gte('booking_date', minDate)
          .lte('booking_date', maxDate);

        for (const booking of bookings || []) {
          try {
            const bDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
            if (bDateTime < minTime || bDateTime > maxTime) continue;

            const link = (booking as any).call_scheduling_links;
            if (!link || !(link as any)[w.enableCol]) continue;
            if (!booking.lead_phone) continue;

            const formattedDate = bDateTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = booking.booking_time.substring(0, 5);

            const vars: Record<string, string> = {
              nome: booking.lead_name || 'Participante',
              data_horario: `${formattedDate} às ${formattedTime}`,
              data: formattedDate,
              horario: formattedTime,
              link_call: booking.meeting_link || link?.meeting_link || '',
              responsavel: 'Rogers Feitosa',
              titulo: link?.title || '',
            };

            const customTemplate = (link as any)[w.templateCol];
            let message: string;

            if (customTemplate) {
              message = renderTemplate(customTemplate, vars);
            } else {
              const labelMap: Record<string, string> = {
                reminder_24h: 'amanhã',
                reminder_2h: 'em 2 horas',
                reminder_15m: 'em 15 minutos',
              };
              message = `🔔 *Lembrete de Call*\n\nOlá ${vars.nome}!\n\nSua call "${vars.titulo}" será ${labelMap[w.type]}:\n📅 ${vars.data}\n⏰ ${vars.horario}`;
              if (vars.link_call) message += `\n\n💻 Link:\n${vars.link_call}`;
            }

            await sendZapi(booking.lead_phone, message);

            await supabase
              .from('call_bookings')
              .update({ [w.sentCol]: new Date().toISOString() } as any)
              .eq('id', booking.id);

            results.push({ id: booking.id, type: w.type, success: true });
          } catch (err: any) {
            console.error(`[call-reminders] Error ${w.type} for ${booking.id}:`, err);
            results.push({ id: booking.id, type: w.type, success: false, error: err.message });
          }
        }
      }
    }

    console.log('[call-reminders] Results:', results);
    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[call-reminders] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
