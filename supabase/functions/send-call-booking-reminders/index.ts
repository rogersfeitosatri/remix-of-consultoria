import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'reminders'; // 'confirmation' | 'reminders'

    const results: { id: string; type: string; success: boolean; error?: string }[] = [];

    if (mode === 'confirmation') {
      // Send confirmation message for a specific booking
      const { bookingId } = body;
      if (!bookingId) throw new Error('bookingId is required for confirmation mode');

      const { data: booking, error: bErr } = await supabase
        .from('call_bookings')
        .select('*, call_scheduling_links(title, confirmation_template, meeting_link, user_id)')
        .eq('id', bookingId)
        .single();

      if (bErr || !booking) throw new Error('Booking not found');

      const link = (booking as any).call_scheduling_links;
      if (!booking.lead_phone) {
        return new Response(JSON.stringify({ success: false, error: 'No phone' }), {
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
        link_call: booking.meeting_link || link?.meeting_link || '',
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

      // Define reminder windows
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
