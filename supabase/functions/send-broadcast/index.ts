import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BroadcastRequest {
  broadcastId: string;
}

function formatPhone(phone: string): string {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = p.substring(1);
  if (!p.startsWith('55')) p = '55' + p;
  return p;
}

async function sendZapiText(phone: string, message: string, instanceId: string, token: string, clientToken: string) {
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify({ phone, message }),
  });
  return resp.json();
}

async function sendZapiMedia(phone: string, mediaUrl: string, mediaType: string, caption: string, instanceId: string, token: string, clientToken: string) {
  // Determine endpoint based on media type
  let endpoint = 'send-image';
  const body: Record<string, unknown> = { phone };

  if (mediaType === 'image') {
    endpoint = 'send-image';
    body.image = mediaUrl;
    body.caption = caption;
  } else if (mediaType === 'document') {
    endpoint = 'send-document';
    body.document = mediaUrl;
    body.fileName = 'document';
    body.caption = caption;
  } else if (mediaType === 'video') {
    endpoint = 'send-video';
    body.video = mediaUrl;
    body.caption = caption;
  } else if (mediaType === 'audio') {
    endpoint = 'send-audio';
    body.audio = mediaUrl;
  } else {
    // Fallback: send text + link
    return sendZapiText(phone, `${caption}\n\n${mediaUrl}`, instanceId, token, clientToken);
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify(body),
  });
  return resp.json();
}

function renderVariables(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
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
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';

    if (!zapiInstanceId || !zapiToken) {
      throw new Error('ZAPI credentials not configured');
    }

    const { broadcastId }: BroadcastRequest = await req.json();

    // Fetch broadcast
    const { data: broadcast, error: bErr } = await supabase
      .from('whatsapp_broadcasts')
      .select('*')
      .eq('id', broadcastId)
      .single();

    if (bErr || !broadcast) throw new Error('Broadcast not found');

    // Update status to sending
    await supabase
      .from('whatsapp_broadcasts')
      .update({ status: 'sending' })
      .eq('id', broadcastId);

    // Fetch recipients
    const { data: recipients, error: rErr } = await supabase
      .from('whatsapp_broadcast_recipients')
      .select('*')
      .eq('broadcast_id', broadcastId)
      .eq('status', 'queued');

    if (rErr) throw new Error('Failed to fetch recipients');

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients || []) {
      try {
        const phone = formatPhone(recipient.phone);
        const firstName = (recipient.recipient_name || '').split(' ')[0];
        const vars: Record<string, string> = {
          nome: recipient.recipient_name || '',
          primeiro_nome: firstName,
          data: new Date().toLocaleDateString('pt-BR'),
        };

        const renderedBody = renderVariables(broadcast.body, vars);

        let result;
        if (broadcast.media_url && broadcast.media_type) {
          result = await sendZapiMedia(
            phone, broadcast.media_url, broadcast.media_type,
            renderedBody, zapiInstanceId, zapiToken, zapiClientToken
          );
        } else {
          result = await sendZapiText(phone, renderedBody, zapiInstanceId, zapiToken, zapiClientToken);
        }

        await supabase
          .from('whatsapp_broadcast_recipients')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_response: result,
          })
          .eq('id', recipient.id);

        sentCount++;

        // Log in whatsapp_message_logs
        await supabase.from('whatsapp_message_logs').insert({
          user_id: broadcast.user_id,
          client_id: recipient.client_id,
          message_type: 'broadcast',
          to_phone: phone,
          status: 'success',
          payload_preview: renderedBody.substring(0, 500),
          metadata: { broadcast_id: broadcastId, recipient_id: recipient.id },
        });

        // Small delay between messages to avoid rate limiting
        await new Promise(r => setTimeout(r, 1500));
      } catch (error: any) {
        failedCount++;
        await supabase
          .from('whatsapp_broadcast_recipients')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', recipient.id);
      }
    }

    // Update broadcast final status
    const finalStatus = failedCount === 0 ? 'sent' :
      sentCount === 0 ? 'failed' : 'partial_failed';

    await supabase
      .from('whatsapp_broadcasts')
      .update({
        status: finalStatus,
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq('id', broadcastId);

    return new Response(
      JSON.stringify({ success: true, sentCount, failedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-broadcast] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
