// ETAPA 5B — Análise de check-in canônica.
// A IA APENAS analisa: nunca fecha a resposta, nunca publica feedback, nunca
// conclui revisão nutricional e nunca altera o plano publicado.
// Cada execução grava um ai_run e cada análise guarda prompt_version_id/provider/model.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, assertClientOwnership } from "../_shared/adminAuth.ts";
import { runCheckinAnalysis } from "../_shared/checkinAnalysis.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Supabase configuration is missing');

    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { checkinResponseId } = await req.json();
    if (!checkinResponseId || typeof checkinResponseId !== 'string') {
      throw new Error('checkinResponseId is required');
    }

    // Ownership: nunca confiar apenas no id vindo do body.
    const { data: owner } = await supabase
      .from('checkin_responses').select('client_id').eq('id', checkinResponseId).maybeSingle();
    if (!owner) throw new Error('Check-in não encontrado');
    const owns = await assertClientOwnership(auth, owner.client_id);
    if (!owns.ok) {
      return new Response(JSON.stringify({ error: owns.error }), {
        status: owns.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { analysis, provider, model, skill, runId, context } = await runCheckinAnalysis(supabase, {
      checkinResponseId,
      environment: 'production',
    });

    // Reanálise: a análise anterior NUNCA é sobrescrita — vira histórico.
    await supabase.from('checkin_ai_analyses')
      .update({ is_current: false })
      .eq('checkin_response_id', checkinResponseId)
      .eq('is_current', true);

    const feedbackText = String(analysis.feedback_suggestion ?? '');
    const { data: inserted, error: insertError } = await supabase
      .from('checkin_ai_analyses')
      .insert({
        checkin_response_id: checkinResponseId,
        client_id: context.clientId,
        weekly_summary: analysis.summary,
        evolution_trend: analysis.evolution_trend,
        alerts: analysis.alerts || [],
        suggested_feedback: feedbackText,
        raw_response: JSON.stringify(analysis),
        structured_output: analysis,
        model_used: `${provider}/${model}`,
        provider,
        model,
        prompt_version_id: skill.versionId,
        prompt_version_number: skill.versionNumber,
        ai_run_id: runId,
        environment: 'production',
        is_current: true,
      })
      .select()
      .single();
    if (insertError) throw new Error(`Falha ao salvar análise: ${insertError.message}`);

    // Sugestão de feedback fica PENDENTE de aprovação humana (nunca é enviada aqui).
    const { data: existingFeedback } = await supabase
      .from('checkin_feedbacks')
      .select('id, status')
      .eq('checkin_response_id', checkinResponseId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingFeedback) {
      await supabase.from('checkin_feedbacks')
        .update({ ai_analysis_id: inserted.id, suggested_feedback: feedbackText })
        .eq('id', existingFeedback.id);
    } else {
      await supabase.from('checkin_feedbacks').insert({
        checkin_response_id: checkinResponseId,
        client_id: context.clientId,
        ai_analysis_id: inserted.id,
        suggested_feedback: feedbackText,
        status: 'pending',
      });
    }

    return new Response(JSON.stringify({
      success: true,
      analysis: inserted,
      ai_run_id: runId,
      prompt_version_number: skill.versionNumber,
      provider, model,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    // Falha de IA é FALHA — jamais interpretada como "sem alteração necessária".
    console.error('Error in analyze-checkin function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage, failed: true }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
