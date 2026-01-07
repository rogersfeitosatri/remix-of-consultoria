import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to send WhatsApp message via Z-API
async function sendWhatsAppMessage(phone: string, message: string) {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!instanceId || !token) {
    console.log('Z-API credentials not configured, skipping WhatsApp message');
    return null;
  }

  // Format phone number (remove non-digits and ensure country code)
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken || '',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    });

    const result = await response.json();
    console.log('Z-API response:', result);
    return result;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appUrl = Deno.env.get('APP_URL') || 'https://vhzxnatgwravidvbehwi.lovableproject.com';

    const { consultationScheduleId } = await req.json();

    if (!consultationScheduleId) {
      return new Response(
        JSON.stringify({ error: 'consultationScheduleId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get consultation schedule with client info
    const { data: schedule, error: scheduleError } = await supabase
      .from('consultation_schedules')
      .select(`
        *,
        clients (id, name, email, phone, user_id)
      `)
      .eq('id', consultationScheduleId)
      .single();

    if (scheduleError || !schedule) {
      console.error('Error fetching schedule:', scheduleError);
      return new Response(
        JSON.stringify({ error: 'Schedule not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get scheduling settings for the admin
    const { data: settings, error: settingsError } = await supabase
      .from('scheduling_settings')
      .select('booking_link_slug')
      .eq('user_id', schedule.user_id)
      .maybeSingle();

    if (settingsError || !settings?.booking_link_slug) {
      console.error('Scheduling settings not found:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Scheduling settings not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate booking token if not exists
    let bookingToken = schedule.booking_token;
    if (!bookingToken) {
      bookingToken = crypto.randomUUID();
      await supabase
        .from('consultation_schedules')
        .update({ 
          booking_token: bookingToken,
          booking_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
        .eq('id', consultationScheduleId);
    }

    // Build booking URL
    const bookingUrl = `${appUrl}/agendar/${settings.booking_link_slug}?token=${bookingToken}`;

    // Get client phone
    const clientPhone = schedule.clients?.phone;
    const clientName = schedule.clients?.name || 'Atleta';

    if (!clientPhone) {
      return new Response(
        JSON.stringify({ error: 'Client phone not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send WhatsApp message
    const message = `📅 *Agende sua Consulta*

Olá, ${clientName}!

Está na hora de agendar sua próxima consulta! 🎯

Clique no link abaixo para escolher o melhor dia e horário para você:

🔗 ${bookingUrl}

⏰ *Este link é válido por 7 dias.*

Qualquer dúvida, estou à disposição! 💪

_Equipe RF Assessoria Esportiva_`;

    const result = await sendWhatsAppMessage(clientPhone, message);

    // Update schedule status to 'sent'
    await supabase
      .from('consultation_schedules')
      .update({ status: 'sent' })
      .eq('id', consultationScheduleId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        bookingUrl,
        whatsappResult: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
