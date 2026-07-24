import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna", reasoning_effort: "none",
        messages: [
          {
            role: "system",
            content: `Você é um assistente financeiro especializado em extrair dados de comprovantes de compra, notas fiscais e recibos.

Analise a imagem do comprovante e extraia os dados. Responda SEMPRE usando a tool extract_receipt_data.

Regras:
- Extraia TODOS os itens individuais se visíveis no comprovante
- Se não conseguir identificar itens individuais, crie UM item com o total
- O valor total deve ser a soma dos itens ou o total do comprovante
- A data deve estar no formato YYYY-MM-DD
- Categorias válidas: Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Vestuário, Software/Assinaturas, Marketing, Equipamentos, Impostos, Serviços, Salários, Outros
- Tente identificar a forma de pagamento: pix, debito, credito, dinheiro, transferencia, boleto
- Se não conseguir identificar algo, use valor razoável ou "Outros"`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados deste comprovante de compra/nota fiscal." },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt_data",
              description: "Extract structured data from a receipt or invoice image",
              parameters: {
                type: "object",
                properties: {
                  store_name: { type: "string", description: "Nome do estabelecimento" },
                  date: { type: "string", description: "Data da compra no formato YYYY-MM-DD" },
                  total: { type: "number", description: "Valor total do comprovante" },
                  payment_method: { type: "string", enum: ["pix", "debito", "credito", "dinheiro", "transferencia", "boleto", ""], description: "Forma de pagamento identificada" },
                  category: { type: "string", description: "Categoria principal do gasto" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        amount: { type: "number" },
                        category: { type: "string" }
                      },
                      required: ["description", "amount"]
                    }
                  }
                },
                required: ["store_name", "date", "total", "category", "items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("AI did not return structured data");
    }

    const receiptData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(receiptData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-receipt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro ao processar comprovante" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
