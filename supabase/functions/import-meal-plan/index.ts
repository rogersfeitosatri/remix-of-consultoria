// Importa uma dieta que o atleta JÁ possui (texto colado do PDF/plano atual) e
// a estrutura no formato do plano da consultoria (refeições, alimentos, opções
// com porções, totais). Vira o plano base — depois pode ser ajustado pela IA
// com o check-in (update-meal-plan). NÃO inventa alimentos: estrutura o que veio.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAiStructured } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase configuration is missing");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clientId, planText, pdfBase64 } = await req.json();
    if (!clientId) throw new Error("clientId is required");
    if ((!planText || String(planText).trim().length < 20) && !pdfBase64) {
      throw new Error("Envie o PDF da dieta ou cole o texto para importar.");
    }

    const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!client) throw new Error("Cliente não encontrado");
    const { data: profile } = await supabase
      .from("athlete_profiles").select("id").eq("client_id", clientId).maybeSingle();

    const RULES = `REGRAS:
- Extraia HORÁRIO de cada refeição (campo "horario", ex: "07:00"), nome e ordem das refeições.
- Preserve alimentos, porções, medidas caseiras, substituições e OPÇÕES exatamente como no documento. Substituições (separadas por "ou") viram várias entradas em "options" do mesmo grupo.
- NÃO crie alimentos novos nem altere quantidades. Se um macro/total não existir, estime aproximadamente e diga no reasoning que é estimativa.
- Se o plano tiver DIAS DA SEMANA diferentes (refeições/quantidades que mudam por dia), preencha "day_variations" com a chave do dia (seg,ter,qua,qui,sex,sab,dom) contendo as refeições daquele dia; o restante fica no plano base (meals).
- Orientações/estratégias (pré/pós-treino, suplementos) vão em strategic_orientations.`;

    let structured: any;
    let provider = "gemini";
    let model = "gemini-2.5-flash";

    if (pdfBase64) {
      // Lê o PDF diretamente (inclui PDFs em imagem / OCR) via Gemini nativo.
      structured = await extractFromPdf(String(pdfBase64), RULES);
    } else {
      const prompt = `Abaixo está a DIETA ATUAL do atleta (texto do plano/PDF existente). Estruture-a EXATAMENTE como está, sem inventar.\n\nDIETA ATUAL (texto):\n"""\n${String(planText).slice(0, 14000)}\n"""\n\n${RULES}`;
      const r = await callAiStructured({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: prompt,
        toolName: "submit_imported_plan",
        toolDescription: "Structure the athlete's existing diet into the meal plan format",
        schema: IMPORT_SCHEMA,
        fallback: "lovable-gemini-pro",
      });
      structured = r.data; provider = r.provider; model = r.model;
    }

    if (!structured?.meal_plan?.meals) {
      throw new Error("Não foi possível extrair as refeições do documento. Tente colar o texto do plano.");
    }
    // Mantém as variações por dia dentro do meal_plan (padrão da consultoria).
    if (structured.day_variations && !structured.meal_plan.day_variations) {
      structured.meal_plan.day_variations = structured.day_variations;
    }

    const full = {
      athlete_summary: structured.athlete_summary ?? "",
      carb_estimation: structured.carb_estimation ?? { current_cho_gkg: 0, classification: "Moderada", reasoning: "Importado da dieta atual." },
      carb_progression: structured.carb_progression ?? {},
      meal_plan: structured.meal_plan,
      strategic_orientations: structured.strategic_orientations ?? { meal_routine: [], training_strategy: [], supplementation: [], race_context: "" },
      alerts: structured.alerts ?? [],
      _isNewFormat: true,
      source: pdfBase64 ? "imported_pdf" : "imported_diet",
      updated_at: new Date().toISOString(),
    };

    const record = {
      client_id: clientId,
      athlete_profile_id: profile?.id ?? null,
      diagnosis: full.athlete_summary || "",
      energy_expenditure: { carb_estimation: full.carb_estimation, carb_progression: full.carb_progression },
      caloric_deficit: { meal_plan: full.meal_plan },
      macronutrients: { strategic_orientations: full.strategic_orientations },
      alerts: full.alerts,
      raw_response: JSON.stringify(full),
      model_used: `${provider}/${model}`,
    };

    const { data: existing } = await supabase
      .from("ai_analyses").select("id").eq("client_id", clientId).maybeSingle();

    let saved;
    if (existing) {
      const { data, error } = await supabase.from("ai_analyses")
        .update({ ...record, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single();
      if (error) throw new Error(`Falha ao salvar: ${error.message}`);
      saved = data;
    } else {
      const { data, error } = await supabase.from("ai_analyses").insert(record).select().single();
      if (error) throw new Error(`Falha ao salvar: ${error.message}`);
      saved = data;
    }

    return new Response(JSON.stringify({ success: true, analysis: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("import-meal-plan error:", error);
    const status = (error as any)?.status;
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (status === 429) return json({ error: "Limite de requisições da IA excedido." }, 429);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Lê um PDF (base64, inclusive PDFs em imagem) via Gemini nativo e devolve o
// plano estruturado em JSON. Usa response_mime_type JSON e descreve o formato.
async function extractFromPdf(pdfBase64: string, rules: string): Promise<any> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY não configurada.");
  const clean = pdfBase64.includes(",") ? pdfBase64.split(",").pop()! : pdfBase64;
  const instruction = `${SYSTEM_PROMPT}

Leia o PDF do plano alimentar (mesmo que seja composto por imagens — faça OCR) e retorne SOMENTE um JSON com este formato:
{
  "athlete_summary": string,
  "meal_plan": {
    "meals": [ { "meal_name": string, "horario": string, "timing_note": string,
      "food_groups": [ { "group": string, "options": "alimento com porção ou substituição ou ..." } ],
      "meal_macros": string } ],
    "daily_totals": { "kcal": number, "cho_g": number, "protein_g": number, "fat_g": number },
    "day_variations": { "seg": { "meals": [...], "daily_totals": {...} } }  // só se o plano variar por dia
  },
  "strategic_orientations": { "meal_routine": [string], "training_strategy": [string],
    "supplementation": [ { "supplement": string, "recommendation": string } ], "race_context": string },
  "alerts": [string]
}

${rules}`;
  const body = {
    contents: [{
      parts: [
        { text: instruction },
        { inline_data: { mime_type: "application/pdf", data: clean } },
      ],
    }],
    generationConfig: { response_mime_type: "application/json", temperature: 0.2 },
  };

  // Tenta gemini-2.5-flash com retry; se 503/429/500 persistir, cai para gemini-2.5-pro.
  const models = ["gemini-2.5-flash", "gemini-2.5-pro"];
  let lastErr = "";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
        const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        try { return JSON.parse(cleaned); }
        catch {
          const m = cleaned.match(/\{[\s\S]*\}/);
          if (m) return JSON.parse(m[0]);
          throw new Error("Não consegui interpretar o PDF como plano estruturado.");
        }
      }
      lastErr = `Gemini PDF [${res.status}] (${model}): ${JSON.stringify(json).slice(0, 300)}`;
      if (![429, 500, 503, 504].includes(res.status)) throw new Error(lastErr);
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw new Error(`${lastErr} — modelo Gemini sobrecarregado. Tente novamente em instantes ou cole o texto do plano.`);
}

const SYSTEM_PROMPT = `Você organiza dietas já prontas no formato estruturado de um sistema de nutrição esportiva. Sua tarefa é APENAS estruturar fielmente a dieta recebida — não é criar, nem otimizar, nem alterar quantidades. Mantenha alimentos, porções, medidas caseiras, substituições ("ou"), refeições e horários exatamente como no texto. Só estime macros/totais quando não estiverem no texto, deixando claro que é estimativa.`;

const IMPORT_SCHEMA = {
  type: "object",
  properties: {
    athlete_summary: { type: "string" },
    carb_estimation: {
      type: "object",
      properties: {
        current_cho_gkg: { type: "number" },
        classification: { type: "string", enum: ["Baixa", "Moderada", "Adequada", "Alta"] },
        reasoning: { type: "string" },
      },
      required: ["reasoning"],
    },
    meal_plan: {
      type: "object",
      properties: {
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal_name: { type: "string" },
              horario: { type: "string", description: "Horário da refeição (ex: 07:00)" },
              timing_note: { type: "string" },
              food_groups: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    group: { type: "string" },
                    options: { type: "string", description: "Alimentos com porções, substituições separadas por 'ou'" },
                  },
                  required: ["group", "options"],
                },
              },
              meal_macros: { type: "string" },
            },
            required: ["meal_name", "food_groups"],
          },
        },
        daily_totals: {
          type: "object",
          properties: {
            kcal: { type: "number" }, cho_g: { type: "number" }, cho_gkg: { type: "number" },
            protein_g: { type: "number" }, protein_gkg: { type: "number" },
            fat_g: { type: "number" }, fat_gkg: { type: "number" }, kcal_kg: { type: "number" },
          },
        },
      },
      required: ["meals"],
    },
    strategic_orientations: {
      type: "object",
      properties: {
        meal_routine: { type: "array", items: { type: "string" } },
        training_strategy: { type: "array", items: { type: "string" } },
        supplementation: {
          type: "array",
          items: {
            type: "object",
            properties: { supplement: { type: "string" }, recommendation: { type: "string" } },
            required: ["supplement", "recommendation"],
          },
        },
        race_context: { type: "string" },
      },
    },
    alerts: { type: "array", items: { type: "string" } },
  },
  required: ["meal_plan"],
  additionalProperties: false,
};
