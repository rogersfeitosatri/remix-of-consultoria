// Extrai o TEXTO de um PDF (base64), inclusive PDFs em imagem (OCR), via Gemini
// nativo. Usado para importar arquivos na Central de IA. Transcrição fiel.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY não configurada.");

    const { pdfBase64 } = await req.json();
    if (!pdfBase64) throw new Error("Envie o PDF (pdfBase64).");
    const clean = String(pdfBase64).includes(",") ? String(pdfBase64).split(",").pop()! : String(pdfBase64);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const instruction =
      "Transcreva FIELMENTE todo o texto deste documento (PDF), mantendo a ordem, títulos, listas e a estrutura em Markdown quando fizer sentido. Não resuma, não comente, não adicione nada. Se houver imagens com texto, faça OCR. Responda apenas com o texto transcrito.";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: instruction },
            { inline_data: { mime_type: "application/pdf", data: clean } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Gemini [${res.status}]: ${JSON.stringify(body).slice(0, 400)}`);
    const text = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
    return json({ text });
  } catch (error) {
    console.error("extract-pdf-text error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
