import { callAiText } from "../_shared/aiClient.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Playground da "Central de IA": roda um prompt de teste e devolve o texto gerado.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context_key, prompt_text, test_input } = await req.json();

    if (!prompt_text || !String(prompt_text).trim()) {
      throw new Error('Informe um prompt para testar.');
    }

    const systemPrompt = String(prompt_text);
    const userPrompt = (test_input && String(test_input).trim())
      ? String(test_input)
      : `Gere um exemplo de saída para este prompt${context_key ? ` (contexto: ${context_key})` : ''}. `
        + `Use dados fictícios plausíveis de um atleta quando necessário.`;

    const { data, provider, model } = await callAiText({
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
      fallback: 'lovable-gemini-pro',
    });

    return new Response(JSON.stringify({ result: data, provider, model }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in test-ai-prompt:', error);
    const status = (error as any)?.status;
    if (status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições da IA excedido. Tente novamente em alguns minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: error.message || 'Erro ao gerar teste.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
