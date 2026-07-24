import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { financialData } = await req.json();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": OPENAI_API_KEY, "X-Lovable-AIG-SDK": "edge-function",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-luna", reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content: `Você é um consultor financeiro pessoal para um nutricionista esportivo autônomo no Brasil.

Analise os dados financeiros fornecidos e retorne insights usando a tool analyze_finances.

Regras:
- Seja direto e prático
- Dê no máximo 4 insights
- Foque em ações concretas
- Considere que é um profissional autônomo da área de saúde/esporte
- Use linguagem simples e acessível
- Valores em R$`
          },
          {
            role: "user",
            content: `Analise meus dados financeiros do mês:

Saldo atual em caixa: R$ ${financialData.saldoTotal}
Entradas do mês: R$ ${financialData.totalIncome}
Saídas do mês: R$ ${financialData.totalExpense}
Resultado do mês: R$ ${financialData.resultado}
Dívidas ativas: R$ ${financialData.totalDebts}

Gastos por categoria: ${JSON.stringify(financialData.expensesByCategory || {})}

Transações recentes: ${JSON.stringify(financialData.recentTransactions || [])}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_finances",
              description: "Return financial insights and suggestions",
              parameters: {
                type: "object",
                properties: {
                  health_score: { type: "number", description: "Score de 0-100 da saúde financeira" },
                  summary: { type: "string", description: "Resumo de 1 frase da situação financeira" },
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["positive", "warning", "tip", "alert"] },
                        title: { type: "string", description: "Título curto do insight" },
                        description: { type: "string", description: "Explicação em 1-2 frases" }
                      },
                      required: ["type", "title", "description"]
                    }
                  }
                },
                required: ["health_score", "summary", "insights"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_finances" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite excedido, tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured data returned");

    const insights = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-finances error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
