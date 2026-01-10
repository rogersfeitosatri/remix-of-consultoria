import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to send WhatsApp message via Z-API
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const zapiToken = Deno.env.get('ZAPI_TOKEN');
  const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!zapiInstanceId || !zapiToken) {
    console.error('Z-API credentials not configured');
    return false;
  }

  // Format phone number
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
  }
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  try {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Z-API error:', response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration is missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing scheduled booking links...');

    // Get pending booking invites using the RPC function
    const { data: pendingInvites, error: fetchError } = await supabase
      .rpc('get_pending_booking_invites');

    if (fetchError) {
      console.error('Error fetching pending invites:', fetchError);
      throw new Error('Failed to fetch pending booking invites');
    }

    if (!pendingInvites || pendingInvites.length === 0) {
      console.log('No pending booking invites to process');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending invites',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingInvites.length} pending invites to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const invite of pendingInvites) {
      try {
        // Get or create booking link
        let { data: bookingLink } = await supabase
          .from('booking_links')
          .select('token')
          .eq('client_id', invite.client_id)
          .eq('active', true)
          .maybeSingle();

        if (!bookingLink) {
          // Create new booking link
          const { data: newLink, error: linkError } = await supabase
            .from('booking_links')
            .insert({ client_id: invite.client_id })
            .select('token')
            .single();

          if (linkError) {
            console.error('Error creating booking link:', linkError);
            errorCount++;
            continue;
          }
          bookingLink = newLink;
        }

        // Get message template
        const { data: automationSettings } = await supabase
          .from('consult_automation_settings')
          .select('message_template_booking')
          .eq('user_id', invite.admin_user_id)
          .maybeSingle();

        const baseUrl = 'https://preview--rogersnutri.lovable.app';
        const bookingUrl = `${baseUrl}/booking/${bookingLink.token}`;

        let message = automationSettings?.message_template_booking || 
          'Olá {nome}! Hora de agendar sua próxima consulta. Escolha seu melhor horário aqui: {booking_link}';
        
        message = message
          .replace('{nome}', invite.client_name.split(' ')[0])
          .replace('{booking_link}', bookingUrl);

        // Send WhatsApp
        if (invite.client_phone) {
          const sent = await sendWhatsAppMessage(invite.client_phone, message);
          
          // Log the attempt
          await supabase.from('consult_invite_logs').insert({
            client_id: invite.client_id,
            channel: 'whatsapp',
            status: sent ? 'sent' : 'failed',
            message_type: 'scheduled_booking_invite',
            error_message: sent ? null : 'Failed to send WhatsApp message',
          });

          if (sent) {
            // Update the consultation schedule rule
            await supabase
              .from('consultation_schedule_rules')
              .update({ 
                last_link_sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('client_id', invite.client_id);

            // Update booking link last_sent_at
            await supabase
              .from('booking_links')
              .update({ last_sent_at: new Date().toISOString() })
              .eq('token', bookingLink.token);

            successCount++;
            console.log(`Successfully sent booking invite to ${invite.client_name}`);
          } else {
            errorCount++;
          }
        } else {
          console.log(`No phone number for client ${invite.client_name}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing invite for ${invite.client_name}:`, error);
        errorCount++;
      }
    }

    console.log(`Processing complete. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: pendingInvites.length,
      successCount,
      errorCount,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-scheduled-booking-links:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
