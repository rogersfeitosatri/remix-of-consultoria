import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, respondentName, callId } = await req.json();

    if (!phone || !message) {
      throw new Error('phone and message are required');
    }

    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken) {
      throw new Error('ZAPI credentials not configured');
    }

    // Format phone
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
    if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;

    console.log('[strategic-call-whatsapp] Sending to:', formattedPhone, 'for call:', callId);

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken || '',
      },
      body: JSON.stringify({ phone: formattedPhone, message }),
    });

    const zapiResult = await zapiResponse.json();
    console.log('[strategic-call-whatsapp] ZAPI response:', zapiResult);

    // Update response as whatsapp_sent
    if (zapiResponse.ok && callId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Mark latest response from this phone as sent
      await supabase
        .from('strategic_call_responses')
        .update({ whatsapp_sent: true })
        .eq('call_id', callId)
        .eq('respondent_phone', phone)
        .order('submitted_at', { ascending: false })
        .limit(1);
    }

    if (!zapiResponse.ok) {
      throw new Error(`ZAPI error: ${JSON.stringify(zapiResult)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[strategic-call-whatsapp] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
