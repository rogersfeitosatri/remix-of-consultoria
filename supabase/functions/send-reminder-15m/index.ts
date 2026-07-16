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
  title: string | null;
  body: string;
  is_active: boolean;
  updated_at: string;
}

interface AthleteWhatsAppSettings {
  disabled_all: boolean;
  disabled_template_keys: string[];
}

async function sendWhatsAppMessage(
  phone: string, 
  message: string,
  zapiInstanceId: string,
  zapiToken: string,
  zapiClientToken: string
): Promise<{ success: boolean; error?: string; zapiResponse?: unknown }> {
  try {
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

// Render template with variables - logs warnings for missing variables
function renderTemplate(
  template: { title?: string | null; body: string },
  variables: Record<string, string | undefined>
): { title: string; body: string } {
  let title = template.title || '';
  let body = template.body;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    const safeValue = value || '';
    title = title.replace(regex, safeValue);
    body = body.replace(regex, safeValue);
  }

  // Log warning for any remaining unsubstituted variables
  const remainingVarsTitle = title.match(/\{[^}]+\}/g);
  const remainingVarsBody = body.match(/\{[^}]+\}/g);
  if (remainingVarsTitle || remainingVarsBody) {
    console.warn('Template has unsubstituted variables:', [...(remainingVarsTitle || []), ...(remainingVarsBody || [])]);
  }

  return { title, body };
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
    const saoPauloOffset = -3 * 60;
    const saoPauloNow = new Date(now.getTime() + (now.getTimezoneOffset() + saoPauloOffset) * 60 * 1000);
    saoPauloNow.setSeconds(0, 0);
    
    const in4Min = new Date(saoPauloNow.getTime() + 4 * 60 * 1000);
    const in20Min = new Date(saoPauloNow.getTime() + 20 * 60 * 1000);
    
    const todayStr = saoPauloNow.toISOString().split('T')[0];
    const tomorrowStr = new Date(saoPauloNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log('Current São Paulo time (truncated):', saoPauloNow.toISOString());
    console.log('Looking for appointments between:', in4Min.toISOString(), 'and', in20Min.toISOString());

    // Buscar TODOS os appointments confirmados dentro da janela, com ou sem Meet.
    // A ausência do link do Meet NÃO pode bloquear o envio do lembrete de 15 min.
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
      .in('appointment_date', [todayStr, tomorrowStr]) as { data: AppointmentWithClient[] | null, error: unknown };

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    console.log('Found appointments to check:', appointments?.length || 0);

    const results: { appointmentId: string; status: string; error?: string }[] = [];

    for (const appointment of appointments || []) {
      try {
        const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        
        if (appointmentDateTime < in4Min || appointmentDateTime > in20Min) {
          console.log('Skipping appointment outside window:', appointment.id, appointmentDateTime.toISOString());
          continue;
        }

        const client = appointment.clients;
        
        if (!client?.phone) {
          console.log('Skipping appointment without phone:', appointment.id);
          
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

        // ALWAYS fetch template from database - NO HARDCODE FALLBACK
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('id, title, body, is_active, updated_at')
          .eq('user_id', appointment.user_id)
          .eq('template_key', 'reminder_15m')
          .single() as { data: WhatsAppTemplate | null };

        // If no template or template is inactive, skip
        if (!template || !template.is_active) {
          console.log('Template reminder_15m not found or inactive for user:', appointment.user_id);
          
          await supabase.from('whatsapp_message_logs').insert({
            user_id: appointment.user_id,
            client_id: appointment.client_id,
            appointment_id: appointment.id,
            message_type: 'reminder_15m',
            template_key: 'reminder_15m',
            to_phone: client.phone,
            status: 'skipped',
            error_message: template ? 'Template is inactive' : 'No template configured',
            metadata: { reason: template ? 'template_inactive' : 'no_template' }
          });
          
          results.push({ appointmentId: appointment.id, status: 'skipped', error: template ? 'Template inactive' : 'No template' });
          continue;
        }

        // Render the template with variables.
        // Se não houver link do Meet, {link} vira aviso curto — a mensagem SEMPRE sai.
        const linkValue = appointment.google_meet_link
          || '(o link da reunião será enviado em separado)';
        const rendered = renderTemplate(
          { title: template.title, body: template.body },
          {
            nome: client.name.split(' ')[0],
            data: formatDateBR(appointment.appointment_date),
            hora: formatTime(appointment.appointment_time),
            link: linkValue,
          }
        );

        // Build final message with title if available
        const finalMessage = rendered.title 
          ? `*${rendered.title}*\n\n${rendered.body}`
          : rendered.body;

        // Re-verify appointment hasn't been rescheduled since initial query
        const { data: freshAppointment } = await supabase
          .from('appointments')
          .select('appointment_date, appointment_time, status, reminder_15m_sent_at')
          .eq('id', appointment.id)
          .single();

        if (!freshAppointment 
            || freshAppointment.status !== 'confirmed'
            || freshAppointment.reminder_15m_sent_at !== null
            || freshAppointment.appointment_date !== appointment.appointment_date
            || freshAppointment.appointment_time !== appointment.appointment_time) {
          console.log('Appointment changed since query, skipping:', appointment.id);
          results.push({ appointmentId: appointment.id, status: 'skipped', error: 'Appointment changed (rescheduled or updated)' });
          continue;
        }

        console.log('Sending reminder to:', client.phone, 'for appointment:', appointment.id);
        console.log('Using template updated_at:', template.updated_at);

        const sendResult = await sendWhatsAppMessage(
          client.phone,
          finalMessage,
          zapiInstanceId,
          zapiToken,
          zapiClientToken
        );

        await supabase.from('whatsapp_message_logs').insert({
          user_id: appointment.user_id,
          client_id: appointment.client_id,
          appointment_id: appointment.id,
          message_type: 'reminder_15m',
          template_key: 'reminder_15m',
          to_phone: client.phone,
          payload_preview: finalMessage.substring(0, 500),
          status: sendResult.success ? 'success' : 'failed',
          error_message: sendResult.error,
          metadata: { 
            zapi_response: sendResult.zapiResponse,
            template_id: template.id,
            template_updated_at: template.updated_at 
          }
        });

        if (sendResult.success) {
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
      if (aptDateTime >= in4Min && aptDateTime <= in20Min) {
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