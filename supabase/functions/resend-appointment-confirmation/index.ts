import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken) {
      return new Response(JSON.stringify({ error: 'ZAPI credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const appointmentId: string | undefined = body?.appointmentId;

    if (!appointmentId || typeof appointmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'appointmentId obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: appointment, error: aptErr } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, google_meet_link, status, client_id, user_id, clients!inner(name, phone, is_frozen)')
      .eq('id', appointmentId)
      .maybeSingle();

    if (aptErr || !appointment) {
      return new Response(JSON.stringify({ error: 'Consulta não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = appointment.clients as unknown as { name: string; phone: string; is_frozen: boolean };

    if (!client?.phone) {
      return new Response(JSON.stringify({ error: 'Atleta sem telefone cadastrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize phone
    let phone = client.phone.replace(/\D/g, '');
    if (phone.length === 11 || phone.length === 10) phone = '55' + phone;
    if (!phone.startsWith('55')) phone = '55' + phone;

    const dateObj = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const formattedTime = appointment.appointment_time.substring(0, 5);

    let message = `✅ *Confirmação de Consulta*\n\n`;
    message += `Olá ${client.name}!\n\n`;
    message += `Sua consulta está confirmada para:\n`;
    message += `📅 ${formattedDate}\n`;
    message += `⏰ ${formattedTime}\n\n`;

    if (appointment.google_meet_link) {
      message += `💻 Link da reunião:\n${appointment.google_meet_link}\n\n`;
    }

    message += `Caso precise reagendar, entre em contato o quanto antes.\n\n`;
    message += `Até breve! 🙂`;

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken || '',
      },
      body: JSON.stringify({ phone, message }),
    });

    const zapiResult = await zapiResponse.json();

    if (!zapiResponse.ok) {
      return new Response(JSON.stringify({ error: 'Falha no envio', details: zapiResult }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await supabase.from('whatsapp_message_logs').insert({
      user_id: appointment.user_id ?? null,
      client_id: appointment.client_id,
      appointment_id: appointment.id,
      template_key: 'appointment_confirmation_resend',
      phone,
      message,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('resend-appointment-confirmation error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
