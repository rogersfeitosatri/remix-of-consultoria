import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ADMIN_PHONE = '5599984817697';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, formId, responses } = await req.json();

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

    // Get client name
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single();

    const athleteName = client?.name || 'Atleta';

    // Get form questions to find diet adjustment and feeling questions
    const { data: questions } = await supabase
      .from('checkin_questions')
      .select('id, question_text')
      .eq('form_id', formId)
      .order('order_index', { ascending: true });

    // Patterns to identify the two key questions
    const dietPatterns = [
      /ajust(e|ar|o).*dieta/i,
      /alter(ar|ação).*plano.*alimentar/i,
      /mudanç.*dieta/i,
      /precisa.*ajust/i,
      /necessidade.*ajust/i,
    ];

    const feelingPatterns = [
      /como.*sent(e|ido|indo).*plano.*alimentar/i,
      /satisf(eito|ação).*plano/i,
      /avali(e|ação).*plano.*alimentar/i,
      /como.*está.*plano/i,
      /relação.*plano.*alimentar/i,
    ];

    let dietAnswer = '';
    let feelingAnswer = '';

    if (questions && responses) {
      for (const q of questions) {
        const responseObj = responses[q.id];
        const answer = responseObj?.answer ?? responseObj ?? '';
        const answerStr = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
        const comment = responseObj?.comment ? ` — ${responseObj.comment}` : '';

        const isDiet = dietPatterns.some(p => p.test(q.question_text));
        const isFeeling = feelingPatterns.some(p => p.test(q.question_text));

        if (isDiet && !dietAnswer) {
          dietAnswer = `${answerStr}${comment}`;
        }
        if (isFeeling && !feelingAnswer) {
          feelingAnswer = `${answerStr}${comment}`;
        }
      }

      // Fallback: if patterns didn't match, use the last two questions
      if (!dietAnswer && !feelingAnswer && questions.length >= 2) {
        const secondToLast = questions[questions.length - 2];
        const last = questions[questions.length - 1];
        
        const r1 = responses[secondToLast.id];
        const r2 = responses[last.id];
        
        dietAnswer = `${secondToLast.question_text}: ${r1?.answer ?? r1 ?? 'N/I'}`;
        feelingAnswer = `${last.question_text}: ${r2?.answer ?? r2 ?? 'N/I'}`;
      }
    }

    // Build message
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
    const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' });

    let message = `📋 *Check-in Respondido*\n\n`;
    message += `👤 *Atleta:* ${athleteName}\n`;
    message += `📅 ${dateStr} às ${timeStr}\n\n`;

    if (dietAnswer) {
      message += `🔄 *Ajuste na dieta:* ${dietAnswer}\n\n`;
    }
    if (feelingAnswer) {
      message += `💬 *Como se sente com o plano:* ${feelingAnswer}\n`;
    }

    if (!dietAnswer && !feelingAnswer) {
      message += `✅ Check-in registrado. Acesse o sistema para conferir as respostas.`;
    }

    console.log('[notify-checkin-response] Sending admin notification for', athleteName);

    // Send via Z-API
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
