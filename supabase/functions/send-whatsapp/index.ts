import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsAppRequest {
  clientId: string;
  message: string;
  feedbackId?: string;
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

    const { clientId, message, feedbackId }: SendWhatsAppRequest = await req.json();
    console.log('Sending WhatsApp to client:', clientId);

    // Get client phone
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('phone, name')
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

    console.log('Sending to phone:', phone);

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
    console.log('ZAPI response:', zapiResult);

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
        console.error('Error updating feedback status:', updateError);
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
    console.error('Error sending WhatsApp:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
