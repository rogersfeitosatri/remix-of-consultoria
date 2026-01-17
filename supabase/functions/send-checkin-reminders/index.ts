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

interface WhatsAppTemplate {
  id: string;
  title: string | null;
  body: string;
  is_active: boolean;
  updated_at: string;
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
  const remainingVars = [...(title.match(/\{[^}]+\}/g) || []), ...(body.match(/\{[^}]+\}/g) || [])];
  if (remainingVars.length > 0) {
    console.warn('Template has unsubstituted variables:', remainingVars);
  }

  return { title, body };
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

interface ScheduledCheckin {
  id: string;
  client_id: string;
  form_id: string | null;
  user_id: string;
  scheduled_send_date: string;
  scheduled_send_time: string | null;
  status: string;
  clients: {
    name: string;
    phone: string;
    athlete_user_id: string | null;
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
    // Get current time in São Paulo
    const now = new Date();
    const saoPauloOffset = -3 * 60;
    const saoPauloNow = new Date(now.getTime() + (now.getTimezoneOffset() + saoPauloOffset) * 60 * 1000);
    const todayStr = saoPauloNow.toISOString().split('T')[0];
    const currentHour = saoPauloNow.getHours();
    const currentMinute = saoPauloNow.getMinutes();

    console.log('Processing checkin reminders for:', todayStr, 'current time:', `${currentHour}:${currentMinute}`);

    // Fetch scheduled checkins for today that haven't been sent
    const { data: scheduledCheckins, error: fetchError } = await supabase
      .from('scheduled_checkins')
      .select(`
        id,
        client_id,
        form_id,
        user_id,
        scheduled_send_date,
        scheduled_send_time,
        status,
        clients!inner(name, phone, athlete_user_id)
      `)
      .eq('scheduled_send_date', todayStr)
      .eq('status', 'pending')
      .is('sent_at', null) as { data: ScheduledCheckin[] | null, error: unknown };

    if (fetchError) {
      console.error('Error fetching scheduled checkins:', fetchError);
      throw new Error('Failed to fetch scheduled checkins');
    }

    if (!scheduledCheckins || scheduledCheckins.length === 0) {
      console.log('No pending checkin reminders for today');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending checkins',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${scheduledCheckins.length} pending checkins to process`);

    const results: { checkinId: string; status: string; error?: string }[] = [];

    for (const checkin of scheduledCheckins) {
      try {
        // Check if it's time to send (within 5 minute window)
        if (checkin.scheduled_send_time) {
          const [schedHour, schedMin] = checkin.scheduled_send_time.split(':').map(Number);
          const schedMinutes = schedHour * 60 + schedMin;
          const currentMinutes = currentHour * 60 + currentMinute;
          
          if (currentMinutes < schedMinutes || currentMinutes >= schedMinutes + 5) {
            console.log('Skipping checkin outside time window:', checkin.id);
            continue;
          }
        }

        const client = checkin.clients;

        if (!client?.phone) {
          console.log('Skipping checkin without phone:', checkin.id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: 'N/A',
            status: 'skipped',
            error_message: 'No phone number',
            metadata: { scheduled_checkin_id: checkin.id, reason: 'no_phone' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'No phone' });
          continue;
        }

        // Check athlete WhatsApp settings
        const { data: athleteSettings } = await supabase
          .from('athlete_whatsapp_settings')
          .select('disabled_all, disabled_template_keys')
          .eq('client_id', checkin.client_id)
          .maybeSingle();

        if (athleteSettings?.disabled_all) {
          console.log('WhatsApp disabled for athlete:', checkin.client_id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'WhatsApp disabled for athlete',
            metadata: { scheduled_checkin_id: checkin.id, reason: 'athlete_disabled' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'WhatsApp disabled' });
          continue;
        }

        if (athleteSettings?.disabled_template_keys?.includes('checkin_reminder')) {
          console.log('checkin_reminder disabled for athlete:', checkin.client_id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'Template disabled for athlete',
            metadata: { scheduled_checkin_id: checkin.id, reason: 'template_disabled' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'Template disabled' });
          continue;
        }

        // ALWAYS fetch template from database - NO HARDCODE FALLBACK
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('id, title, body, is_active, updated_at')
          .eq('user_id', checkin.user_id)
          .eq('template_key', 'checkin_reminder')
          .maybeSingle() as { data: WhatsAppTemplate | null };

        // If no template or template is inactive, skip
        if (!template || !template.is_active) {
          console.log('Template checkin_reminder not found or inactive');
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: client.phone,
            status: 'skipped',
            error_message: template ? 'Template is inactive' : 'No template configured',
            metadata: { scheduled_checkin_id: checkin.id, reason: template ? 'template_inactive' : 'no_template' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: template ? 'Template inactive' : 'No template' });
          continue;
        }

        // Build checkin link
        let checkinLink = `${appUrl}/atleta`;
        if (checkin.form_id && !client.athlete_user_id) {
          checkinLink = `${appUrl}/checkin/${checkin.form_id}?client=${checkin.client_id}`;
        }

        // Render the template with variables
        const rendered = renderTemplate(
          { title: template.title, body: template.body },
          {
            nome: client.name.split(' ')[0],
            link_checkin: checkinLink,
          }
        );

        // Build final message with title if available
        const finalMessage = rendered.title 
          ? `*${rendered.title}*\n\n${rendered.body}`
          : rendered.body;

        console.log('Sending checkin reminder to:', client.phone);
        console.log('Using template updated_at:', template.updated_at);

        const sendResult = await sendWhatsAppMessage(
          client.phone,
          finalMessage,
          zapiInstanceId,
          zapiToken,
          zapiClientToken
        );

        await supabase.from('whatsapp_message_logs').insert({
          user_id: checkin.user_id,
          client_id: checkin.client_id,
          message_type: 'checkin_reminder',
          template_key: 'checkin_reminder',
          to_phone: client.phone,
          payload_preview: finalMessage.substring(0, 500),
          status: sendResult.success ? 'success' : 'failed',
          error_message: sendResult.error,
          metadata: { 
            scheduled_checkin_id: checkin.id, 
            zapi_response: sendResult.zapiResponse,
            template_id: template.id,
            template_updated_at: template.updated_at
          }
        });

        if (sendResult.success) {
          await supabase
            .from('scheduled_checkins')
            .update({ 
              sent_at: new Date().toISOString(),
              status: 'sent'
            })
            .eq('id', checkin.id);

          results.push({ checkinId: checkin.id, status: 'success' });
          console.log(`Successfully sent checkin reminder to ${client.name}`);
        } else {
          results.push({ checkinId: checkin.id, status: 'failed', error: sendResult.error });
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error processing checkin:', checkin.id, error);
        results.push({ checkinId: checkin.id, status: 'failed', error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;

    console.log(`Processing complete. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      successCount,
      errorCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-checkin-reminders:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});