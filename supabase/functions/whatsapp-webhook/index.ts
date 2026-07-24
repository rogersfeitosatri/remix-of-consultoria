// WhatsApp Cloud API webhook — recebe mensagens do atleta e responde via IA Lovable
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const WHATSAPP_API = "https://graph.facebook.com/v21.0";

function normalizePhone(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  while (d.startsWith("0")) d = d.slice(1);
  if (!d.startsWith("55") && d.length <= 11) d = "55" + d;
  return d;
}

async function sendWhatsAppText(phoneNumberId: string, token: string, to: string, body: string) {
  const res = await fetch(`${WHATSAPP_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000) },
    }),
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: j };
}

async function notifyAdminViaZapi(supabase: any, clientName: string, excerpt: string) {
  try {
    await supabase.functions.invoke("send-whatsapp", {
      body: {
        clientId: null,
        message: `🤖 IA WhatsApp — escalonamento\n\nAtleta: ${clientName}\nMensagem: "${excerpt}"\n\nAbra o Centro de Ações para revisar.`,
        overridePhone: "5599984817697",
      },
    }).catch(() => {});
  } catch (_) { /* noop */ }
}

async function callLovableAI(model: string, systemPrompt: string, history: Array<{ role: string; content: string }>, userMessage: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10),
    { role: "user", content: userMessage },
  ];
  // Modelo padrão do sistema: OpenAI direto → gpt-5.6-luna.
  const finalModel = model && !model.includes('/') ? model : 'gpt-5.6-luna';
  const body: any = { model: finalModel, messages, max_tokens: 600 };
  if (/gpt-5\.6/i.test(finalModel)) body.reasoning_effort = 'none';
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(j).slice(0, 400)}`);
  return {
    text: j?.choices?.[0]?.message?.content?.trim() || "Desculpe, não consegui responder agora.",
    tokensIn: j?.usage?.prompt_tokens,
    tokensOut: j?.usage?.completion_tokens,
  };
}

function detectEscalation(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const k of keywords) {
    if (k && lower.includes(k.toLowerCase())) return k;
  }
  return null;
}

async function buildAthleteContext(supabase: any, clientId: string): Promise<string> {
  const [{ data: client }, { data: anamnese }, { data: checkins }, { data: attachments }] = await Promise.all([
    supabase.from("clients").select("name,phone,plan_type,start_date,end_date,notes,admin_summary,admin_next_focus").eq("id", clientId).maybeSingle(),
    supabase.from("anamnese_responses").select("responses,submitted_at").eq("client_id", clientId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("checkin_responses").select("responses,submitted_at").eq("client_id", clientId).order("submitted_at", { ascending: false }).limit(3),
    supabase.from("athlete_attachments").select("file_name,type_tag,notes").eq("client_id", clientId).ilike("type_tag", "%plano%").order("created_at", { ascending: false }).limit(2),
  ]);
  const lines: string[] = [];
  if (client) {
    lines.push(`ATLETA: ${client.name} | Plano: ${client.plan_type || "-"} | Vigência: ${client.start_date || "-"} → ${client.end_date || "-"}`);
    if (client.admin_summary) lines.push(`Resumo do treinador: ${client.admin_summary}`);
    if (client.admin_next_focus) lines.push(`Próximo foco: ${client.admin_next_focus}`);
    if (client.notes) lines.push(`Notas: ${String(client.notes).slice(0, 500)}`);
  }
  if (anamnese?.responses) {
    lines.push(`\nANAMNESE (mais recente, ${anamnese.submitted_at?.slice(0, 10)}):`);
    lines.push(JSON.stringify(anamnese.responses).slice(0, 2500));
  }
  if (attachments?.length) {
    lines.push(`\nPLANOS ANEXADOS:`);
    for (const a of attachments) lines.push(`- ${a.file_name} (${a.type_tag})${a.notes ? ` — ${a.notes}` : ""}`);
  }
  if (checkins?.length) {
    lines.push(`\nÚLTIMOS CHECK-INS:`);
    for (const c of checkins) {
      lines.push(`- ${c.submitted_at?.slice(0, 10)}: ${JSON.stringify(c.responses).slice(0, 600)}`);
    }
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
  const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  // GET: handshake Meta
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      return new Response(challenge || "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.error("WhatsApp Cloud API secrets missing");
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return new Response("ok", { status: 200 }); }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message || message.type !== "text") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const from = normalizePhone(message.from);
    const text: string = message.text?.body || "";
    const waMsgId: string = message.id || "";

    // Achar atleta pelo phone (qualquer formato com 55 + DDD + número)
    const fromVariants = [from, `+${from}`, from.slice(2)];
    const { data: client } = await supabase
      .from("clients")
      .select("id,user_id,name,ai_whatsapp_enabled,is_active")
      .or(fromVariants.map(v => `phone.eq.${v}`).join(","))
      .limit(1)
      .maybeSingle();

    if (!client) {
      await sendWhatsAppText(PHONE_NUMBER_ID, ACCESS_TOKEN, from, "Olá! Não encontrei seu cadastro pelo número. Fale com o Rogers para liberar o atendimento.");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (!client.is_active || !client.ai_whatsapp_enabled) {
      // ignora silenciosamente — opt-in obrigatório
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Carregar settings do treinador
    const { data: settings } = await supabase
      .from("ai_chat_settings")
      .select("*")
      .eq("user_id", client.user_id)
      .maybeSingle();

    if (!settings?.enabled) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Conversa
    const { data: convExisting } = await supabase
      .from("ai_chat_conversations")
      .select("id,message_count")
      .eq("client_id", client.id)
      .maybeSingle();

    let conversationId = convExisting?.id;
    if (!conversationId) {
      const { data: created, error } = await supabase
        .from("ai_chat_conversations")
        .insert({ user_id: client.user_id, client_id: client.id, phone_e164: from })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = created.id;
    }

    // Salvar msg do atleta
    const { data: userMsg } = await supabase
      .from("ai_chat_messages")
      .insert({
        conversation_id: conversationId,
        user_id: client.user_id,
        role: "user",
        content: text,
        wa_message_id: waMsgId,
      })
      .select("id")
      .single();

    // Histórico recente
    const { data: hist } = await supabase
      .from("ai_chat_messages")
      .select("role,content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);
    const history = (hist || []).slice(0, -1).map(h => ({ role: h.role, content: h.content }));

    // Detectar escalonamento
    const trigger = detectEscalation(text, settings.escalation_keywords || []);

    // Montar prompt com contexto
    const context = await buildAthleteContext(supabase, client.id);
    const systemPrompt = `${settings.system_prompt}\n\n=== CONTEXTO DO ATLETA ===\n${context}\n=== FIM DO CONTEXTO ===`;

    let replyText: string;
    let tokensIn: number | undefined;
    let tokensOut: number | undefined;
    try {
      const ai = await callLovableAI(settings.model, systemPrompt, history, text);
      replyText = ai.text;
      tokensIn = ai.tokensIn;
      tokensOut = ai.tokensOut;
    } catch (e) {
      console.error("AI error", e);
      replyText = "Tive um problema técnico aqui. Vou avisar o Rogers para te responder.";
    }

    // Se escalou, sobrepor mensagem padrão para temas sensíveis (mantém resposta IA mas registra)
    if (trigger) {
      replyText = `${replyText}\n\nJá avisei o Rogers para olhar isso com calma com você. 💚`;
    }

    // Enviar resposta
    const send = await sendWhatsAppText(PHONE_NUMBER_ID, ACCESS_TOKEN, from, replyText);

    // Salvar resposta IA
    const { data: assistantMsg } = await supabase
      .from("ai_chat_messages")
      .insert({
        conversation_id: conversationId,
        user_id: client.user_id,
        role: "assistant",
        content: replyText,
        wa_message_id: send.data?.messages?.[0]?.id || null,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        model: settings.model,
        escalated: !!trigger,
      })
      .select("id")
      .single();

    await supabase
      .from("ai_chat_conversations")
      .update({ last_message_at: new Date().toISOString(), message_count: (convExisting?.message_count || 0) + 2 })
      .eq("id", conversationId);

    if (trigger) {
      await supabase.from("ai_chat_escalations").insert({
        user_id: client.user_id,
        client_id: client.id,
        conversation_id: conversationId,
        message_id: userMsg?.id || null,
        trigger,
        excerpt: text.slice(0, 280),
      });
      await notifyAdminViaZapi(supabase, client.name, text.slice(0, 200));
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("webhook error", e);
    return new Response("ok", { status: 200, headers: corsHeaders }); // sempre 200 para Meta
  }
});
