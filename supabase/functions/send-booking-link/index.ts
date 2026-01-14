import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppSendResult {
  success: boolean;
  error?: string;
  zapiResponse?: unknown;
}

async function sendWhatsAppMessage(
  phone: string, 
  message: string,
  zapiInstanceId: string,
  zapiToken: string,
  zapiClientToken: string
): Promise<WhatsAppSendResult> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const response = await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiClientToken || '',
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: message,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: JSON.stringify(result), zapiResponse: result };
    }

    return { success: true, zapiResponse: result };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

function formatMessage(template: string, variables: Record<string, string>): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return message;
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const zapiToken = Deno.env.get('ZAPI_TOKEN');
  const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
  const appUrl = 'https://rogersfeitosa.lovable.app';

  if (!zapiInstanceId || !zapiToken) {
    console.error('ZAPI credentials not configured');
    return new Response(
      JSON.stringify({ error: 'ZAPI credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: RequestBody = await req.json();

    // Handle direct client booking invite or confirmation
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
        // Log the skip
        await supabase.from('whatsapp_message_logs').insert({
          user_id: client.user_id,
          client_id: clientId,
          message_type: messageType,
          template_key: messageType === 'booking_invite' ? 'booking_invite' : 'booking_confirmed',
          to_phone: 'N/A',
          status: 'skipped',
          error_message: 'No phone number',
          metadata: { reason: 'no_phone' }
        });
        throw new Error('Client phone not registered');
      }

      // Check athlete WhatsApp settings
      const { data: athleteSettings } = await supabase
        .from('athlete_whatsapp_settings')
        .select('disabled_all, disabled_template_keys')
        .eq('client_id', clientId)
        .maybeSingle();

      const templateKey = messageType === 'booking_invite' ? 'booking_invite' : 'booking_confirmed';

      if (athleteSettings?.disabled_all || athleteSettings?.disabled_template_keys?.includes(templateKey)) {
        await supabase.from('whatsapp_message_logs').insert({
          user_id: client.user_id,
          client_id: clientId,
          message_type: messageType,
          template_key: templateKey,
          to_phone: client.phone,
          status: 'skipped',
          error_message: 'WhatsApp disabled for athlete or template',
          metadata: { reason: athleteSettings?.disabled_all ? 'athlete_disabled' : 'template_disabled' }
        });
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get template from database
      const { data: template } = await supabase
        .from('whatsapp_templates')
        .select('body, is_active')
        .eq('user_id', client.user_id)
        .eq('template_key', templateKey)
        .maybeSingle();

      if (template && !template.is_active) {
        await supabase.from('whatsapp_message_logs').insert({
          user_id: client.user_id,
          client_id: clientId,
          message_type: messageType,
          template_key: templateKey,
          to_phone: client.phone,
          status: 'skipped',
          error_message: 'Template is inactive',
          metadata: { reason: 'template_inactive' }
        });
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'template_inactive' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
          const { data: newLink, error: createError } = await supabase
            .from('booking_links')
            .insert({ client_id: clientId, active: true })
            .select()
            .single();

          if (createError) {
            throw new Error('Failed to create booking link: ' + createError.message);
          }
          bookingLink = newLink;
        }

        const bookingUrl = `${appUrl}/booking/${bookingLink.token}`;
        const templateBody = template?.body || 
          'Olá {nome}! Chegou a hora de agendar sua próxima consulta. Escolha seu horário: {link}';
        
        message = formatMessage(templateBody, {
          nome: client.name.split(' ')[0],
          link: bookingUrl,
        });

        // Update booking link usage
        await supabase
          .from('booking_links')
          .update({
            last_sent_at: new Date().toISOString(),
            usage_count: (bookingLink.usage_count || 0) + 1,
          })
          .eq('id', bookingLink.id);

      } else if (messageType === 'confirmation' && appointmentData) {
        const templateBody = template?.body || 
          '✅ Consulta confirmada para {data} às {hora}. Link: {meet_link}';
        
        message = formatMessage(templateBody, {
          nome: client.name.split(' ')[0],
          data: formatDateBR(appointmentData.date),
          hora: appointmentData.time.substring(0, 5),
          meet_link: appointmentData.meetLink || 'A definir',
        });
      } else {
        throw new Error('Invalid message type or missing appointment data');
      }

      // Send WhatsApp message
      const sendResult = await sendWhatsAppMessage(
        client.phone,
        message,
        zapiInstanceId,
        zapiToken,
        zapiClientToken
      );

      // Log the attempt
      await supabase.from('whatsapp_message_logs').insert({
        user_id: client.user_id,
        client_id: clientId,
        message_type: messageType,
        template_key: templateKey,
        to_phone: client.phone,
        payload_preview: message.substring(0, 500),
        status: sendResult.success ? 'success' : 'failed',
        error_message: sendResult.error,
        metadata: { zapi_response: sendResult.zapiResponse }
      });

      return new Response(
        JSON.stringify({ success: sendResult.success, result: sendResult }),
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
      .select(`*, clients (id, name, email, phone, user_id)`)
      .eq('id', consultationScheduleId)
      .single();

    if (scheduleError || !schedule) {
      console.error('Error fetching schedule:', scheduleError);
      return new Response(
        JSON.stringify({ error: 'Schedule not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get booking link token
    let bookingToken = schedule.booking_token;
    if (!bookingToken) {
      bookingToken = crypto.randomUUID();
      await supabase
        .from('consultation_schedules')
        .update({ 
          booking_token: bookingToken,
          booking_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', consultationScheduleId);
    }

    const clientData = schedule.clients as { id: string; name: string; email: string; phone: string; user_id: string };
    const clientPhone = clientData?.phone;
    const clientName = clientData?.name || 'Atleta';

    if (!clientPhone) {
      return new Response(
        JSON.stringify({ error: 'Client phone not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get template from database
    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('body, is_active')
      .eq('user_id', schedule.user_id)
      .eq('template_key', 'booking_invite')
      .maybeSingle();

    const { data: settings } = await supabase
      .from('scheduling_settings')
      .select('booking_link_slug')
      .eq('user_id', schedule.user_id)
      .maybeSingle();

    const bookingUrl = settings?.booking_link_slug 
      ? `${appUrl}/agendar/${settings.booking_link_slug}?token=${bookingToken}`
      : `${appUrl}/booking/${bookingToken}`;

    const templateBody = template?.body || 
      '📅 Olá {nome}! Está na hora de agendar sua próxima consulta. Clique aqui: {link}';
    
    const message = formatMessage(templateBody, {
      nome: clientName.split(' ')[0],
      link: bookingUrl,
    });

    const sendResult = await sendWhatsAppMessage(
      clientPhone,
      message,
      zapiInstanceId,
      zapiToken,
      zapiClientToken
    );

    // Log the attempt
    await supabase.from('whatsapp_message_logs').insert({
      user_id: schedule.user_id,
      client_id: clientData?.id,
      message_type: 'booking_invite',
      template_key: 'booking_invite',
      to_phone: clientPhone,
      payload_preview: message.substring(0, 500),
      status: sendResult.success ? 'success' : 'failed',
      error_message: sendResult.error,
      metadata: { consultation_schedule_id: consultationScheduleId, zapi_response: sendResult.zapiResponse }
    });

    // Update schedule status
    await supabase
      .from('consultation_schedules')
      .update({ status: 'sent' })
      .eq('id', consultationScheduleId);

    return new Response(
      JSON.stringify({ 
        success: sendResult.success, 
        bookingUrl,
        whatsappResult: sendResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
