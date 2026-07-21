// Interpreta linhas de alimentos de um plano (texto livre / importado) e retorna,
// para cada item, os GRAMAS efetivos e os macros (kcal/proteína/carbo/gordura).
// É a IA OFICIAL da interpretação do plano no editor: usa OpenAI (gpt-4o) para
// ler o alimento EXATAMENTE como escrito — ex.: "café sem açúcar" = café coado
// preto (~0 kcal), não café em pó torrado; "leite" = leite bebida, não leite
// condensado — evitando os erros de correspondência que inflavam as calorias.
//
// NÃO grava nada. Recebe itens e devolve números. Trata o conteúdo como DADO.
import { callAiStructured } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const SCHEMA = {
  type: "object",
  required: ["items"],
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "grams", "kcal", "protein_g", "carbs_g", "fat_g"],
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          grams: { type: "number", description: "Gramas/ml efetivos do alimento nesta porção" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) return json({ items: [] });

    // Limita por chamada; o cliente pode fatiar se precisar.
    const list = items.slice(0, 80).map((it: any) => ({
      id: String(it?.id ?? ""),
      text: String(it?.text ?? "").slice(0, 200),
      grams: it?.grams != null && isFinite(Number(it.grams)) ? Number(it.grams) : null,
    })).filter((it) => it.id && it.text);

    const lines = list.map((it) =>
      `- id=${it.id} | "${it.text}"${it.grams != null ? ` | gramas_informados=${it.grams}` : ""}`
    ).join("\n");

    const userPrompt = `Para CADA item abaixo, calcule os gramas efetivos e os macronutrientes da porção descrita.

REGRAS:
- Interprete o alimento EXATAMENTE como escrito. Exemplos importantes:
  • "café sem açúcar", "café coado", "chá sem açúcar" = bebida coada/infusão SEM açúcar ≈ 0–4 kcal (NÃO é café em pó torrado).
  • "leite" (sem qualificação) = leite integral bebida (~60 kcal/100 ml), NÃO leite condensado nem leite em pó.
  • marcas/suplementos: "Whey DUX" ≈ whey concentrado (~380 kcal/100 g), "Creatina" ≈ 0 kcal.
  • "salada e legumes"/"legumes cozidos" = vegetais ≈ 20–40 kcal/100 g.
- Se vier "gramas_informados", USE exatamente esse valor como a quantidade (em g ou ml) e calcule os macros para ele.
- Se NÃO vier gramas, infira a quantidade a partir da medida caseira descrita (ex.: "1 copo (200 ml)", "2 unidades", "7 colheres de sopa"). Para líquidos, trate ml ≈ g.
- Devolva números realistas por porção; não invente precisão excessiva. Arredonde kcal ao inteiro e macros a 1 casa.
- Responda TODOS os itens, com o mesmo id recebido.

ITENS:
${lines}`;

    const { data, provider, model } = await callAiStructured({
      systemPrompt: "Você é um nutricionista especialista em composição de alimentos brasileiros. Lê descrições de alimentos e retorna gramas efetivos e macros por porção, interpretando cada alimento exatamente como escrito. Responda apenas com os dados estruturados.",
      userPrompt,
      toolName: "submit_resolved_foods",
      toolDescription: "Retorna gramas e macros por item",
      schema: SCHEMA,
      primary: "openai",
      openaiModel: "gpt-4o",
      fallback: "openai-gpt4o-mini",
    });

    const round = (n: any, d = 0) => {
      const v = Number(n);
      if (!isFinite(v)) return 0;
      const f = Math.pow(10, d);
      return Math.round(v * f) / f;
    };
    const out = (Array.isArray(data?.items) ? data.items : []).map((it: any) => ({
      id: String(it?.id ?? ""),
      grams: round(it?.grams, 1),
      kcal: round(it?.kcal),
      protein_g: round(it?.protein_g, 1),
      carbs_g: round(it?.carbs_g, 1),
      fat_g: round(it?.fat_g, 1),
    })).filter((it: any) => it.id);

    return json({ items: out, _ai: { provider, model } });
  } catch (error) {
    console.error("resolve-plan-foods:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
