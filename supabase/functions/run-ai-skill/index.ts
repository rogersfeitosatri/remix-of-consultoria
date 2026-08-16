// ETAPA 5B — Playground canônico da Central de IA.
// Roda a MESMA pipeline de produção (mesmo provider, modelo, regras e schema),
// mudando apenas o environment ('playground') e o fato de NADA ser persistido
// no prontuário do atleta. Toda execução gera um ai_run auditável.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin, assertClientOwnership } from "../_shared/adminAuth.ts";
import { runCheckinAnalysis } from "../_shared/checkinAnalysis.ts";
import { loadSkillVersion, startAiRun, finishAiRun } from "../_shared/aiSkills.ts";
import { loadMealPlanSkill } from "../_shared/skillPrompt.ts";
import { callAiText } from "../_shared/aiClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const skillKey = body?.skill_key;
    const promptVersionId: string | null = body?.prompt_version_id ?? null;

    if (skillKey !== 'checkin_analysis' && skillKey !== 'meal_plan_generation') {
      return json({ error: 'skill_key inválida' }, 400);
    }

    // ---- Análise de check-in: usa um check-in REAL, sem gravar nada nele. ----
    if (skillKey === 'checkin_analysis') {
      const checkinResponseId = body?.checkin_response_id;
      if (!checkinResponseId) return json({ error: 'Selecione um check-in real para o teste.' }, 400);

      const { data: owner } = await supabase
        .from('checkin_responses').select('client_id').eq('id', checkinResponseId).maybeSingle();
      if (!owner) return json({ error: 'Check-in não encontrado' }, 404);
      const owns = await assertClientOwnership(auth, owner.client_id);
      if (!owns.ok) return json({ error: owns.error }, owns.status);

      const result = await runCheckinAnalysis(supabase, {
        checkinResponseId,
        environment: 'playground',
        promptVersionId,
      });

      return json({
        success: true,
        environment: 'playground',
        persisted: false,
        ai_run_id: result.runId,
        prompt_version_id: result.skill.versionId,
        prompt_version_number: result.skill.versionNumber,
        prompt_version_status: result.skill.versionStatus,
        provider: result.provider,
        model: result.model,
        effective_prompt: result.skill.effectivePrompt,
        effective_prompt_hash: result.skill.effectiveHash,
        user_prompt: result.context.userPrompt,
        output: result.analysis,
      });
    }

    // ---- Plano alimentar: prompt-base + módulos obrigatórios ativos. ----
    const ownerUserId = auth.userId ?? body?.owner_user_id;
    if (!ownerUserId) return json({ error: 'owner_user_id ausente' }, 400);

    const base = await loadSkillVersion(supabase, ownerUserId, 'meal_plan_generation', '', promptVersionId);
    const modules = await loadMealPlanSkill(supabase, ownerUserId, base.promptText);
    const effectivePrompt = `${modules.effectivePrompt}\n\n===== REGRAS DO SISTEMA (não negociáveis) =====\n`
      + `- A geração nunca publica: o resultado entra como versão draft.\n`
      + `- A versão publicada é imutável — alterações criam nova versão.`;

    const skill = { ...base, effectivePrompt, effectiveHash: modules.effectiveHash };
    const run = await startAiRun(supabase, {
      ownerUserId, clientId: null, skill, environment: 'playground',
      inputSnapshot: { modules: modules.includedModuleKeys, has_test_input: !!body?.test_input },
    });

    try {
      const { data, provider, model } = await callAiText({
        systemPrompt: effectivePrompt,
        userPrompt: String(body?.test_input || 'Gere um exemplo de plano com dados fictícios plausíveis de um corredor de endurance.'),
        maxTokens: base.maxTokens,
        primary: 'openai',
        openaiModel: base.model,
        fallback: 'openai-gpt4o',
      });
      await finishAiRun(supabase, run, { status: 'succeeded', output: data, provider, model });
      return json({
        success: true,
        environment: 'playground',
        persisted: false,
        ai_run_id: run.id,
        prompt_version_id: base.versionId,
        prompt_version_number: base.versionNumber,
        prompt_version_status: base.versionStatus,
        provider, model,
        included_modules: modules.includedModuleKeys,
        effective_prompt: effectivePrompt,
        effective_prompt_hash: modules.effectiveHash,
        output: data,
      });
    } catch (e) {
      await finishAiRun(supabase, run, { status: 'failed', error: (e as Error).message });
      throw e;
    }
  } catch (error) {
    console.error('run-ai-skill error:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return json({ error: msg, failed: true }, 500);
  }
});
