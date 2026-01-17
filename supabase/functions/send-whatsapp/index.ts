import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsAppRequest {
  clientId: string;
  message: string;
  feedbackId?: string;
  templateKey?: string;
  templateId?: string;
  templateUpdatedAt?: string;
  scheduledCheckinId?: string;
  appointmentId?: string;
}

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
      throw new Error('ZAPI credentials not configured');
    }

    const { 
      clientId, 
      message, 
      feedbackId,
      templateKey,
      templateId,
      templateUpdatedAt,
      scheduledCheckinId,
      appointmentId,
    }: SendWhatsAppRequest = await req.json();
    
    console.log('[send-whatsapp] Request received:', {
      clientId,
      templateKey,
      templateId,
      templateUpdatedAt,
      scheduledCheckinId,
      appointmentId,
      message_preview: message?.substring(0, 120) + '...',
    });

    // Get client phone and user_id
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('phone, name, user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('Client not found');
    }

    if (!client.phone) {
      throw new Error('Client phone not registered');
    }

    // Format phone number (remove non-digits and ensure country code)
    let phone = client.phone.replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = phone.substring(1);
    }
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    console.log('[send-whatsapp] Sending to phone:', phone);

    // Send message via ZAPI
    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken || '',
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    const zapiResult = await zapiResponse.json();
    console.log('[send-whatsapp] ZAPI response:', zapiResult);

    const messageStatus = zapiResponse.ok ? 'sent' : 'failed';
    const errorMessage = zapiResponse.ok ? null : JSON.stringify(zapiResult);

    // Log the message with template metadata
    try {
      await supabase
        .from('whatsapp_message_logs')
        .insert({
          user_id: client.user_id,
          client_id: clientId,
          appointment_id: appointmentId || null,
          message_type: templateKey || 'manual',
          template_key: templateKey || null,
          to_phone: phone,
          status: messageStatus,
          error_message: errorMessage,
          payload_preview: message?.substring(0, 500),
          metadata: {
            template_id: templateId,
            template_updated_at: templateUpdatedAt,
            scheduled_checkin_id: scheduledCheckinId,
            zapi_response: zapiResult,
          },
        });
      console.log('[send-whatsapp] Message logged successfully');
    } catch (logError) {
      console.error('[send-whatsapp] Error logging message:', logError);
    }

    if (!zapiResponse.ok) {
      throw new Error(`ZAPI error: ${JSON.stringify(zapiResult)}`);
    }

    // Update feedback as sent if feedbackId provided
    if (feedbackId) {
      const { error: updateError } = await supabase
        .from('checkin_feedbacks')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_via: 'whatsapp',
        })
        .eq('id', feedbackId);

      if (updateError) {
        console.error('[send-whatsapp] Error updating feedback status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, zapiResult }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[send-whatsapp] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
