import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const clientId: string | undefined = body?.client_id;
    const audience: 'admin' | 'athlete' = body?.audience === 'athlete' ? 'athlete' : 'admin';
    if (!clientId) {
      return new Response(JSON.stringify({ error: "client_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verifica que o cliente pertence ao admin
    const { data: client } = await admin
      .from("clients").select("id, name, user_id").eq("id", clientId).maybeSingle();
    if (!client || client.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Acesso negado ao atleta" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: race } = await admin
      .from("np_athlete_races")
      .select("id, race_name, race_date, race_distance_km, race_type, target_time_minutes, notes")
      .eq("client_id", clientId).eq("is_active", true)
      .order("race_date", { ascending: true }).limit(1).maybeSingle();

    const { data: logs = [] } = await admin
      .from("np_gut_training_logs")
      .select("checkin_date, current_cho_rate_g_h, cho_source, adherence_pct, gi_nausea, gi_bloating, gi_cramps, gi_reflux, gi_urgency, gi_diarrhea, gi_score_global, notes")
      .eq("client_id", clientId)
      .order("checkin_date", { ascending: false })
      .limit(8);

    const { data: protocol } = await admin
      .from("np_phase_protocols")
      .select("phase, cho_target_g_h, sodium_mg_h, hydration_ml_h, carboloading_checklist, custom_notes")
      .eq("client_id", clientId).maybeSingle();

    // Compute phase
    let weeksToRace: number | null = null;
    let phase: string | null = null;
    if (race?.race_date) {
      const days = Math.ceil((new Date(race.race_date).getTime() - Date.now()) / 86400000);
      weeksToRace = Math.ceil(days / 7);
      if (weeksToRace <= 0) phase = "race";
      else if (weeksToRace <= 3) phase = "taper";
      else if (weeksToRace <= 7) phase = "peak";
      else if (weeksToRace <= 11) phase = "specific";
      else if (weeksToRace <= 16) phase = "build";
      else phase = "base";
    }

    const firstName = (client.name || '').split(' ')[0] || 'atleta';

    const systemPrompt = audience === 'athlete'
      ? `Você é um nutricionista esportivo carismático escrevendo uma mensagem MOTIVACIONAL e PESSOAL para um atleta de endurance. Use português brasileiro, 2ª pessoa (você), tom acolhedor mas técnico-confiante. Estruture com emojis e linhas curtas. NÃO use markdown pesado nem títulos secos. Inclua: 1) reconhecimento honesto do que está indo bem, 2) ponto que precisa de atenção (sem dramatizar), 3) o que mudar para a próxima semana (1-3 ações claras), 4) frase final de incentivo conectada à prova alvo. Máximo 200 palavras. Trate o atleta pelo primeiro nome (${firstName}).`
      : `Você é um nutricionista esportivo especialista em endurance, periodização nutricional e treino intestinal (gut training). Gere um resumo de evolução conciso, técnico e acionável para o profissional. Use português brasileiro. Estruture em markdown com seções: 1) Visão Geral, 2) Tolerância GI e progressão CHO, 3) Aderência ao protocolo, 4) Recomendações para a próxima semana. Seja específico com números (g/h, % aderência, GI Score 0-15). Máximo 350 palavras.`;

    const userPrompt = `Atleta: ${client.name}
Prova alvo: ${race?.race_name ?? "(não definida)"} | distância: ${race?.race_distance_km ?? "?"}km | tipo: ${race?.race_type ?? "?"} | data: ${race?.race_date ?? "?"} | meta: ${race?.target_time_minutes ? race.target_time_minutes + "min" : "?"}
Semanas para a prova: ${weeksToRace ?? "?"} | Fase atual: ${phase ?? "?"}
Protocolo da fase: ${protocol ? `CHO ${protocol.cho_target_g_h ?? "?"} g/h, Na ${protocol.sodium_mg_h ?? "?"} mg/h, hidratação ${protocol.hydration_ml_h ?? "?"} ml/h` : "(usando defaults)"}

Logs de gut training (mais recentes primeiro, ${logs.length} registros):
${logs.map((l: any) => `- ${l.checkin_date}: CHO ${l.current_cho_rate_g_h ?? "?"} g/h (${l.cho_source ?? "?"}), aderência ${l.adherence_pct ?? "?"}%, GI Score ${l.gi_score_global ?? "?"}/15 (náusea ${l.gi_nausea}, distensão ${l.gi_bloating}, cólicas ${l.gi_cramps}, refluxo ${l.gi_reflux}, urgência ${l.gi_urgency}, diarreia ${l.gi_diarrhea})${l.notes ? " | " + l.notes : ""}`).join("\n") || "(sem logs)"}

Gere ${audience === 'athlete' ? 'a mensagem motivacional para o atleta' : 'o resumo de evolução técnico'} agora.`;

    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        reasoning_effort: "none",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Falha ao chamar a IA");
    }

    const aiJson = await aiResp.json();
    const summary: string = aiJson?.choices?.[0]?.message?.content ?? "";
    if (!summary) throw new Error("Resposta vazia da IA");

    const { data: saved, error: insErr } = await admin
      .from("np_evolution_summaries")
      .insert({
        client_id: clientId,
        user_id: userId,
        race_id: race?.id ?? null,
        phase,
        weeks_to_race: weeksToRace,
        logs_analyzed: logs.length,
        summary_markdown: summary,
        recommendations: [],
        model: "gpt-5.6-luna", reasoning_effort: "none",
        audience,
      })
      .select("id, created_at, summary_markdown, phase, weeks_to_race, logs_analyzed, model, audience")
      .single();

    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, summary: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("np-evolution-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
