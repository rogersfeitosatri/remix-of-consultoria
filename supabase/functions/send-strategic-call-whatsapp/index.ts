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

    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken) {
      throw new Error('ZAPI credentials not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;

    // 1) Send message to respondent (if phone and message provided)
    if (phone && message) {
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
      if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;

      console.log('[strategic-call-whatsapp] Sending to respondent:', formattedPhone);

      const zapiResponse = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiClientToken || '',
        },
        body: JSON.stringify({ phone: formattedPhone, message }),
      });

      const zapiResult = await zapiResponse.json();
      console.log('[strategic-call-whatsapp] ZAPI respondent response:', zapiResult);

      if (zapiResponse.ok && callId) {
        await supabase
          .from('strategic_call_responses')
          .update({ whatsapp_sent: true })
          .eq('call_id', callId)
          .eq('respondent_phone', phone)
          .order('submitted_at', { ascending: false })
          .limit(1);
      }
    }

    // 2) Always send admin notification when callId is provided
    if (callId) {
      try {
        const { data: callData } = await supabase
          .from('strategic_calls')
          .select('admin_notify_phone, name')
          .eq('id', callId)
          .single();

        const adminPhone = callData?.admin_notify_phone;
        if (adminPhone) {
          let formattedAdminPhone = adminPhone.replace(/\D/g, '');
          if (formattedAdminPhone.startsWith('0')) formattedAdminPhone = formattedAdminPhone.substring(1);
          if (!formattedAdminPhone.startsWith('55')) formattedAdminPhone = '55' + formattedAdminPhone;

          const callTitle = callData?.name || 'Call Estratégica';
          const adminMessage = `🔔 *Nova aplicação recebida!*\n\n📋 *Formulário:* ${callTitle}\n👤 *Nome:* ${respondentName || 'Não informado'}\n📱 *Telefone:* ${phone || 'Não informado'}\n\nAcesse o painel para ver os detalhes.`;

          console.log('[strategic-call-whatsapp] Sending admin notification to:', formattedAdminPhone);

          const adminResponse = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': zapiClientToken || '',
            },
            body: JSON.stringify({ phone: formattedAdminPhone, message: adminMessage }),
          });

          const adminResult = await adminResponse.json();
          console.log('[strategic-call-whatsapp] Admin notification result:', adminResult);
        }
      } catch (adminErr) {
        console.error('[strategic-call-whatsapp] Admin notification error:', adminErr);
      }
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
