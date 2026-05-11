import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADMIN_PHONE = '5599984817697';

function buildAdminCheckinMessage(
  athleteName: string,
  athletePhone: string | null,
  checkinResponseId: string | null,
  questions: Array<{ id: string; question_text: string; question_type: string; scale_min?: number | null; scale_max?: number | null }>,
  responses: Record<string, any>,
  appUrl: string,
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
  const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' });

  let msg = `📋 *Check-in Respondido*\n\n`;
  msg += `👤 *${athleteName}*\n`;
  msg += `🗓️ ${dateStr} às ${timeStr}\n\n`;
  msg += `*Respostas:*\n`;

  for (const q of questions) {
    const resp = responses?.[q.id];
    if (resp === undefined || resp === null) continue;
    const answer = (typeof resp === 'object' && 'answer' in resp) ? resp.answer : resp;
    const comment = (typeof resp === 'object' && resp?.comment) ? String(resp.comment) : '';
    if (answer === undefined || answer === null || answer === '') {
      if (!comment) continue;
    }

    if (q.question_type === 'scale') {
      const max = q.scale_max ?? 10;
      const score = Number(answer);
      if (Number.isFinite(score)) {
        const filled = Math.max(0, Math.min(5, Math.round((score / max) * 5)));
        const bar = '█'.repeat(filled) + '░'.repeat(5 - filled);
        msg += `• ${q.question_text}\n  ${bar} ${score}/${max}\n`;
      } else {
        msg += `• ${q.question_text}: ${answer}\n`;
      }
    } else if (q.question_type === 'multiple_choice') {
      msg += `• ${q.question_text}: ${answer}\n`;
    } else if (q.question_type === 'checkbox') {
      const list = Array.isArray(answer) ? answer.join(', ') : String(answer);
      msg += `• ${q.question_text}: ${list}\n`;
    } else {
      // short_text / long_text
      msg += `• ${q.question_text}:\n  "${answer}"\n`;
    }
    if (comment) {
      msg += `  💬 ${comment}\n`;
    }
  }

  if (checkinResponseId) {
    msg += `\n🔗 *Ver resposta completa:*\n${appUrl}/checkin-hub?response=${checkinResponseId}\n`;
  } else {
    msg += `\n🔗 *Conferir no sistema:*\n${appUrl}/checkin-hub\n`;
  }

  if (athletePhone) {
    const digits = String(athletePhone).replace(/\D/g, '');
    const waNumber = digits.startsWith('55') ? digits : `55${digits}`;
    msg += `\n📱 *Responder atleta:*\nhttps://wa.me/${waNumber}\n`;
  }

  return msg;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, formId, responses, checkinResponseId: providedResponseId } = await req.json();

    if (!clientId || !formId) {
      throw new Error('clientId and formId are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken) {
      throw new Error('ZAPI credentials not configured');
    }

    const { data: client } = await supabase
      .from('clients')
      .select('name, phone')
      .eq('id', clientId)
      .single();

    const athleteName = client?.name || 'Atleta';
    const athletePhone = client?.phone ?? null;

    const { data: questions } = await supabase
      .from('checkin_questions')
      .select('id, question_text, question_type, scale_min, scale_max, order_index')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    let checkinResponseId: string | null = providedResponseId ?? null;
    if (!checkinResponseId) {
      const { data: latest } = await supabase
        .from('checkin_responses')
        .select('id')
        .eq('client_id', clientId)
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      checkinResponseId = latest?.id ?? null;
    }

    const parsedResponses = typeof responses === 'string' ? JSON.parse(responses) : (responses || {});
    const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'https://rogersfeitosa.com.br';

    const message = buildAdminCheckinMessage(
      athleteName,
      athletePhone,
      checkinResponseId,
      (questions || []) as any,
      parsedResponses,
      appUrl,
    );

    console.log('[notify-checkin-response] Sending admin notification for', athleteName);

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken || '',
      },
      body: JSON.stringify({ phone: ADMIN_PHONE, message }),
    });

    const zapiResult = await zapiResponse.json();
    console.log('[notify-checkin-response] ZAPI response:', zapiResult);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[notify-checkin-response] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
