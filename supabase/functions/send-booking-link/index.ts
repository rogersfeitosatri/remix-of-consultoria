import { createClient } from "npm:@supabase/supabase-js@2";

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
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
  }
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

interface RequestBody {
  consultationScheduleId?: string;
  clientId?: string;
  messageType?: 'booking_invite' | 'confirmation';
  appointmentData?: {
    date: string;
    time: string;
    meetLink?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const appUrl = Deno.env.get('APP_URL') || 'https://vhzxnatgwravidvbehwi.lovableproject.com';

    const body: RequestBody = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // NEW: Handle direct client booking invite (for automation)
    if (body.clientId && body.messageType) {
      const { clientId, messageType, appointmentData } = body;
      console.log('Processing direct booking request for client:', clientId, 'type:', messageType);

      // Get client info
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, phone, name, user_id')
        .eq('id', clientId)
        .single();

      if (clientError || !client) {
        throw new Error('Client not found');
      }

      if (!client.phone) {
        throw new Error('Client phone not registered');
      }

      let message = '';

      if (messageType === 'booking_invite') {
        // Get or create booking link
        let { data: bookingLink } = await supabase
          .from('booking_links')
          .select('*')
          .eq('client_id', clientId)
          .eq('active', true)
          .single();

        if (!bookingLink) {
          // Create new booking link
          const { data: newLink, error: createError } = await supabase
            .from('booking_links')
            .insert({
              client_id: clientId,
              active: true,
            })
            .select()
            .single();

          if (createError) {
            throw new Error('Failed to create booking link: ' + createError.message);
          }
          bookingLink = newLink;
        }

        // Get automation settings for message template
        const { data: settings } = await supabase
          .from('consult_automation_settings')
          .select('message_template_booking')
          .eq('user_id', client.user_id)
          .single();

        const bookingUrl = `${appUrl}/booking/${bookingLink.token}`;
        
        const template = settings?.message_template_booking || 
          'Olá {nome}! Hora de agendar sua consulta. Escolha seu melhor horário aqui: {booking_link}';
        
        message = template
          .replace('{nome}', client.name)
          .replace('{booking_link}', bookingUrl);

        // Update booking link usage
        await supabase
          .from('booking_links')
          .update({
            last_sent_at: new Date().toISOString(),
            usage_count: (bookingLink.usage_count || 0) + 1,
          })
          .eq('id', bookingLink.id);

      } else if (messageType === 'confirmation' && appointmentData) {
        // Get automation settings for confirmation template
        const { data: settings } = await supabase
          .from('consult_automation_settings')
          .select('message_template_confirmation')
          .eq('user_id', client.user_id)
          .single();

        const template = settings?.message_template_confirmation || 
          'Consulta confirmada para {data} às {hora}. Link da videochamada: {meet_link}';
        
        message = template
          .replace('{nome}', client.name)
          .replace('{data}', appointmentData.date)
          .replace('{hora}', appointmentData.time)
          .replace('{meet_link}', appointmentData.meetLink || 'A definir');
      } else {
        throw new Error('Invalid message type or missing appointment data');
      }

      // Send WhatsApp message
      const result = await sendWhatsAppMessage(client.phone, message);

      // Log the invite
      await supabase
        .from('consult_invite_logs')
        .insert({
          client_id: clientId,
          message_type: messageType === 'booking_invite' ? 'booking_invite' : 'confirmation',
          channel: 'whatsapp',
          status: result ? 'sent' : 'failed',
          error_message: result ? null : 'Failed to send WhatsApp message',
          metadata: {
            message_preview: message.substring(0, 100),
          },
        });

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // LEGACY: Handle consultation schedule ID based flow
    const { consultationScheduleId } = body;

    if (!consultationScheduleId) {
      return new Response(
        JSON.stringify({ error: 'consultationScheduleId or clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
