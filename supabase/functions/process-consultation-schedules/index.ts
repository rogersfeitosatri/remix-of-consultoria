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

  const remainingVars = [...(title.match(/\{[^}]+\}/g) || []), ...(body.match(/\{[^}]+\}/g) || [])];
  if (remainingVars.length > 0) {
    console.warn('Template has unsubstituted variables:', remainingVars);
  }

  return { title, body };
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
  const baseUrl = 'https://rogersfeitosa.com.br';

  if (!zapiInstanceId || !zapiToken) {
    console.error('ZAPI credentials not configured');
    return new Response(
      JSON.stringify({ error: 'ZAPI credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get current time in BRT (America/Sao_Paulo)
    const nowBRT = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const currentDate = new Date(nowBRT);
    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes();
    const todayStr = currentDate.toISOString().split('T')[0];

    console.log(`Processing consultation_schedules at ${currentHour}:${currentMinute} BRT on ${todayStr}`);

    // Query pending schedules for today that haven't been sent yet
    // These are entries in consultation_schedules with send_link_date = today and status = 'pending'
    const { data: pendingSchedules, error: fetchError } = await supabase
      .from('consultation_schedules')
      .select(`
        id,
        client_id,
        user_id,
        send_link_date,
        status
      `)
      .eq('send_link_date', todayStr)
      .in('status', ['pending', 'link_sent'])
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending schedules:', fetchError);
      throw new Error('Failed to fetch pending consultation schedules');
    }

    // Filter only 'pending' status - 'link_sent' means already processed
    const schedulesToProcess = (pendingSchedules || []).filter(s => s.status === 'pending');

    if (schedulesToProcess.length === 0) {
      console.log('No pending consultation schedules to process for today');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending schedules',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${schedulesToProcess.length} pending consultation schedules to process`);

    const results: { scheduleId: string; clientName: string; status: string; error?: string }[] = [];

    for (const schedule of schedulesToProcess) {
      // Fetch client data separately
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name, phone, email, user_id')
        .eq('id', schedule.client_id)
        .maybeSingle();
      
      if (clientError || !clientData) {
        console.log(`No client data for schedule ${schedule.id}:`, clientError);
        results.push({ scheduleId: schedule.id, clientName: 'Unknown', status: 'failed', error: 'No client data' });
        continue;
      }

      try {
        // Check athlete WhatsApp settings
        const { data: athleteSettings } = await supabase
          .from('athlete_whatsapp_settings')
          .select('disabled_all, disabled_template_keys')
          .eq('client_id', clientData.id)
          .maybeSingle();

        if (athleteSettings?.disabled_all) {
          console.log('WhatsApp disabled for athlete:', clientData.id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: schedule.user_id,
            client_id: clientData.id,
            message_type: 'consultation_schedule_booking',
            template_key: 'weekly_booking_link',
            to_phone: clientData.phone || 'N/A',
            status: 'skipped',
            error_message: 'WhatsApp disabled for athlete',
            metadata: { reason: 'athlete_disabled', schedule_id: schedule.id }
          });
          results.push({ scheduleId: schedule.id, clientName: clientData.name, status: 'skipped', error: 'WhatsApp disabled' });
          continue;
        }

        if (athleteSettings?.disabled_template_keys?.includes('weekly_booking_link')) {
          console.log('weekly_booking_link disabled for athlete:', clientData.id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: schedule.user_id,
            client_id: clientData.id,
            message_type: 'consultation_schedule_booking',
            template_key: 'weekly_booking_link',
            to_phone: clientData.phone || 'N/A',
            status: 'skipped',
            error_message: 'Template disabled for athlete',
            metadata: { reason: 'template_disabled', schedule_id: schedule.id }
          });
          results.push({ scheduleId: schedule.id, clientName: clientData.name, status: 'skipped', error: 'Template disabled' });
          continue;
        }

        // Get or create booking link
        let { data: bookingLink } = await supabase
          .from('booking_links')
          .select('token, usage_count')
          .eq('client_id', clientData.id)
          .eq('active', true)
          .maybeSingle();

        if (!bookingLink) {
          const { data: newLink, error: linkError } = await supabase
            .from('booking_links')
            .insert({ client_id: clientData.id })
            .select('token, usage_count')
            .single();

          if (linkError) {
            console.error('Error creating booking link:', linkError);
            results.push({ scheduleId: schedule.id, clientName: clientData.name, status: 'failed', error: 'Failed to create booking link' });
            continue;
          }
          bookingLink = newLink;
        }

        // Fetch template from database
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('id, title, body, is_active, updated_at')
          .eq('user_id', schedule.user_id)
          .eq('template_key', 'weekly_booking_link')
          .maybeSingle() as { data: WhatsAppTemplate | null };

        if (!template || !template.is_active) {
          console.log('Template weekly_booking_link not found or inactive for user:', schedule.user_id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: schedule.user_id,
            client_id: clientData.id,
            message_type: 'consultation_schedule_booking',
            template_key: 'weekly_booking_link',
            to_phone: clientData.phone || 'N/A',
            status: 'skipped',
            error_message: template ? 'Template is inactive' : 'No template configured',
            metadata: { reason: template ? 'template_inactive' : 'no_template', schedule_id: schedule.id }
          });
          results.push({ scheduleId: schedule.id, clientName: clientData.name, status: 'skipped', error: template ? 'Template inactive' : 'No template' });
          continue;
        }

        const bookingUrl = `${baseUrl}/booking/${bookingLink.token}`;
        
        const rendered = renderTemplate(
          { title: template.title, body: template.body },
          {
            nome: clientData.name.split(' ')[0],
            booking_link: bookingUrl,
            link: bookingUrl,
          }
        );

        const finalMessage = rendered.title 
          ? `*${rendered.title}*\n\n${rendered.body}`
          : rendered.body;

        if (!clientData.phone) {
          console.log(`No phone number for client ${clientData.name}`);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: schedule.user_id,
            client_id: clientData.id,
            message_type: 'consultation_schedule_booking',
            template_key: 'weekly_booking_link',
            to_phone: 'N/A',
            status: 'skipped',
            error_message: 'No phone number',
            metadata: { reason: 'no_phone', schedule_id: schedule.id }
          });
          results.push({ scheduleId: schedule.id, clientName: clientData.name, status: 'skipped', error: 'No phone' });
          continue;
        }

        console.log(`Sending booking link to ${clientData.name} (schedule: ${schedule.id})`);

        const sendResult = await sendWhatsAppMessage(
          clientData.phone,
          finalMessage,
          zapiInstanceId,
          zapiToken,
          zapiClientToken
        );

        await supabase.from('whatsapp_message_logs').insert({
          user_id: schedule.user_id,
          client_id: clientData.id,
          message_type: 'consultation_schedule_booking',
          template_key: 'weekly_booking_link',
          to_phone: clientData.phone,
          payload_preview: finalMessage.substring(0, 500),
          status: sendResult.success ? 'success' : 'failed',
          error_message: sendResult.error,
          metadata: { 
            zapi_response: sendResult.zapiResponse,
            template_id: template.id,
            schedule_id: schedule.id
          }
        });

        if (sendResult.success) {
          // Update consultation_schedule status to 'sent' (or 'link_sent')
          await supabase
            .from('consultation_schedules')
            .update({ 
              status: 'sent',
              updated_at: new Date().toISOString(),
            })
            .eq('id', schedule.id);

          // Update booking link last_sent_at
          await supabase
            .from('booking_links')
            .update({ 
              last_sent_at: new Date().toISOString(),
              usage_count: (bookingLink.usage_count || 0) + 1,
            })
            .eq('token', bookingLink.token);

          results.push({ scheduleId: schedule.id, clientName: clientData.name, status: 'success' });
          console.log(`Successfully sent booking link to ${clientData.name}`);
        } else {
          results.push({ scheduleId: schedule.id, clientName: clientData.name, status: 'failed', error: sendResult.error });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing schedule ${schedule.id}:`, error);
        results.push({ scheduleId: schedule.id, clientName: clientData?.name || 'Unknown', status: 'failed', error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    
    console.log(`Processing complete. Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: schedulesToProcess.length,
      successCount,
      errorCount,
      skippedCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-consultation-schedules:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
