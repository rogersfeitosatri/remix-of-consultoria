import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppointmentWithClient {
  id: string;
  appointment_date: string;
  appointment_time: string;
  google_meet_link: string | null;
  client_id: string;
  user_id: string;
  clients: {
    name: string;
    phone: string;
  };
}

interface WhatsAppTemplate {
  id: string;
  body: string;
  is_active: boolean;
}

interface AthleteWhatsAppSettings {
  disabled_all: boolean;
  disabled_template_keys: string[];
}

// Default template if none exists
const DEFAULT_REMINDER_TEMPLATE = `⏰ *Lembrete de Consulta*

Olá {nome}!

Sua consulta é em 15 minutos:
📅 Data: {data}
🕒 Horário: {hora}

🎥 Link da reunião:
{link}

Até já! 🙂`;

async function sendWhatsAppMessage(
  phone: string, 
  message: string,
  zapiInstanceId: string,
  zapiToken: string,
  zapiClientToken: string
): Promise<{ success: boolean; error?: string; zapiResponse?: unknown }> {
  try {
    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    
    const response = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken || '',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    });

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

function formatTime(timeStr: string): string {
  return timeStr.substring(0, 5);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const zapiToken = Deno.env.get('ZAPI_TOKEN');
  const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';

  if (!zapiInstanceId || !zapiToken) {
    console.error('ZAPI credentials not configured');
    return new Response(
      JSON.stringify({ error: 'ZAPI credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get current time in São Paulo timezone
    const now = new Date();
    const saoPauloOffset = -3 * 60; // São Paulo is UTC-3
    const saoPauloNow = new Date(now.getTime() + (now.getTimezoneOffset() + saoPauloOffset) * 60 * 1000);
    
    // Calculate the target window: 14-16 minutes from now
    const in14Min = new Date(saoPauloNow.getTime() + 14 * 60 * 1000);
    const in16Min = new Date(saoPauloNow.getTime() + 16 * 60 * 1000);
    
    const todayStr = saoPauloNow.toISOString().split('T')[0];
    const tomorrowStr = new Date(saoPauloNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log('Current São Paulo time:', saoPauloNow.toISOString());
    console.log('Looking for appointments between:', in14Min.toISOString(), 'and', in16Min.toISOString());

    // Fetch appointments that:
    // 1. Are confirmed
    // 2. Have google_meet_link
    // 3. Haven't had 15m reminder sent
    // 4. Are scheduled within today or tomorrow
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        appointment_time,
        google_meet_link,
        client_id,
        user_id,
        clients!inner(name, phone)
      `)
      .eq('status', 'confirmed')
      .is('reminder_15m_sent_at', null)
      .not('google_meet_link', 'is', null)
      .in('appointment_date', [todayStr, tomorrowStr]) as { data: AppointmentWithClient[] | null, error: unknown };

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    console.log('Found appointments to check:', appointments?.length || 0);

    const results: { appointmentId: string; status: string; error?: string }[] = [];

    for (const appointment of appointments || []) {
      try {
        // Parse appointment datetime
        const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        
        // Check if appointment is within the 14-16 minute window
        if (appointmentDateTime < in14Min || appointmentDateTime > in16Min) {
          console.log('Skipping appointment outside window:', appointment.id, appointmentDateTime.toISOString());
          continue;
        }

        const client = appointment.clients;
        
        if (!client?.phone) {
          console.log('Skipping appointment without phone:', appointment.id);
          
          // Log as skipped
          await supabase.from('whatsapp_message_logs').insert({
            user_id: appointment.user_id,
            client_id: appointment.client_id,
            appointment_id: appointment.id,
            message_type: 'reminder_15m',
            template_key: 'reminder_15m',
            to_phone: 'N/A',
            status: 'skipped',
            error_message: 'No phone number',
            metadata: { reason: 'no_phone' }
          });
          
          results.push({ appointmentId: appointment.id, status: 'skipped', error: 'No phone number' });
          continue;
        }

        // Check for athlete-specific WhatsApp settings
        const { data: athleteSettings } = await supabase
          .from('athlete_whatsapp_settings')
          .select('disabled_all, disabled_template_keys')
          .eq('client_id', appointment.client_id)
          .single() as { data: AthleteWhatsAppSettings | null };

        if (athleteSettings?.disabled_all) {
          console.log('WhatsApp disabled for athlete:', appointment.client_id);
          
          await supabase.from('whatsapp_message_logs').insert({
            user_id: appointment.user_id,
            client_id: appointment.client_id,
            appointment_id: appointment.id,
            message_type: 'reminder_15m',
            template_key: 'reminder_15m',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'WhatsApp disabled for athlete',
            metadata: { reason: 'athlete_disabled' }
          });
          
          results.push({ appointmentId: appointment.id, status: 'skipped', error: 'WhatsApp disabled for athlete' });
          continue;
        }

        if (athleteSettings?.disabled_template_keys?.includes('reminder_15m')) {
          console.log('reminder_15m disabled for athlete:', appointment.client_id);
          
          await supabase.from('whatsapp_message_logs').insert({
            user_id: appointment.user_id,
            client_id: appointment.client_id,
            appointment_id: appointment.id,
            message_type: 'reminder_15m',
            template_key: 'reminder_15m',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'Template reminder_15m disabled for athlete',
            metadata: { reason: 'template_disabled' }
          });
          
          results.push({ appointmentId: appointment.id, status: 'skipped', error: 'Template disabled for athlete' });
          continue;
        }

        // Fetch template for this user
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('id, body, is_active')
          .eq('user_id', appointment.user_id)
          .eq('template_key', 'reminder_15m')
          .single() as { data: WhatsAppTemplate | null };

        // Check if template is active (or use default)
        if (template && !template.is_active) {
          console.log('Template reminder_15m is inactive for user:', appointment.user_id);
          
          await supabase.from('whatsapp_message_logs').insert({
            user_id: appointment.user_id,
            client_id: appointment.client_id,
            appointment_id: appointment.id,
            message_type: 'reminder_15m',
            template_key: 'reminder_15m',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'Template is inactive',
            metadata: { reason: 'template_inactive' }
          });
          
          results.push({ appointmentId: appointment.id, status: 'skipped', error: 'Template inactive' });
          continue;
        }

        const templateBody = template?.body || DEFAULT_REMINDER_TEMPLATE;

        // Format the message
        const message = formatMessage(templateBody, {
          nome: client.name,
          data: formatDateBR(appointment.appointment_date),
          hora: formatTime(appointment.appointment_time),
          link: appointment.google_meet_link!,
        });

        console.log('Sending reminder to:', client.phone, 'for appointment:', appointment.id);

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
          user_id: appointment.user_id,
          client_id: appointment.client_id,
          appointment_id: appointment.id,
          message_type: 'reminder_15m',
          template_key: 'reminder_15m',
          to_phone: client.phone,
          payload_preview: message.substring(0, 500),
          status: sendResult.success ? 'success' : 'failed',
          error_message: sendResult.error,
          metadata: { zapi_response: sendResult.zapiResponse }
        });

        if (sendResult.success) {
          // Mark reminder as sent
          await supabase
            .from('appointments')
            .update({ reminder_15m_sent_at: new Date().toISOString() })
            .eq('id', appointment.id);

          results.push({ appointmentId: appointment.id, status: 'success' });
        } else {
          results.push({ appointmentId: appointment.id, status: 'failed', error: sendResult.error });
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error processing appointment:', appointment.id, error);
        
        // Log the error
        await supabase.from('whatsapp_message_logs').insert({
          user_id: appointment.user_id,
          client_id: appointment.client_id,
          appointment_id: appointment.id,
          message_type: 'reminder_15m',
          template_key: 'reminder_15m',
          to_phone: appointment.clients?.phone || 'unknown',
          status: 'failed',
          error_message: errorMessage,
          metadata: { exception: true }
        });
        
        results.push({ appointmentId: appointment.id, status: 'failed', error: errorMessage });
      }
    }

    // Also check for appointments without Meet link and log them
    const { data: pendingMeetAppointments } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, client_id, user_id, clients(name, phone)')
      .eq('status', 'confirmed')
      .is('reminder_15m_sent_at', null)
      .is('google_meet_link', null)
      .in('appointment_date', [todayStr, tomorrowStr]);

    for (const apt of pendingMeetAppointments || []) {
      const aptDateTime = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
      if (aptDateTime >= in14Min && aptDateTime <= in16Min) {
        const clientData = apt.clients as unknown as { name: string; phone: string } | null;
        console.log('Appointment without Meet link:', apt.id);
        
        await supabase.from('whatsapp_message_logs').insert({
          user_id: apt.user_id,
          client_id: apt.client_id,
          appointment_id: apt.id,
          message_type: 'reminder_15m',
          template_key: 'reminder_15m',
          to_phone: clientData?.phone || 'N/A',
          status: 'failed',
          error_message: 'No Google Meet link',
          metadata: { reason: 'pending_meet' }
        });
        
        results.push({ appointmentId: apt.id, status: 'failed', error: 'No Google Meet link' });
      }
    }

    console.log('Processing complete. Results:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-reminder-15m:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
