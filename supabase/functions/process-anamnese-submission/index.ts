import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyUser } from "../_shared/fcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SubmissionRequest {
  form_id: string;
  respondent_name: string;
  respondent_email: string;
  responses: Record<string, any>;
  source?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { form_id, respondent_name, respondent_email, responses, source }: SubmissionRequest = await req.json();

    if (!form_id || !respondent_name || !respondent_email) {
      return new Response(
        JSON.stringify({ error: "form_id, respondent_name e respondent_email são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = respondent_email.toLowerCase().trim();
    const name = respondent_name.trim();

    // Extract phone from anamnese responses (search for phone/telefone/whatsapp/celular fields)
    const parsedResponses = typeof responses === 'string' ? JSON.parse(responses) : (responses || {});
    let extractedPhone: string | null = null;
    try {
      for (const [_key, val] of Object.entries(parsedResponses)) {
        const answer = typeof val === 'object' && val !== null && 'answer' in (val as any)
          ? String((val as any).answer || '')
          : String(val || '');
        const digits = answer.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 13 && /^\d+$/.test(digits)) {
          extractedPhone = digits;
          break;
        }
      }
      if (!extractedPhone) {
        // Try matching question IDs by fetching question texts
        const { data: questions } = await supabaseAdmin
          .from("anamnese_questions")
          .select("id, question_text")
          .eq("form_id", form_id);
        if (questions) {
          const phoneQuestion = questions.find(q =>
            /telefone|whatsapp|celular|phone/i.test(q.question_text)
          );
          if (phoneQuestion) {
            const val = parsedResponses[phoneQuestion.id];
            const answer = typeof val === 'object' && val !== null && 'answer' in (val as any)
              ? String((val as any).answer || '')
              : String(val || '');
            const digits = answer.replace(/\D/g, '');
            if (digits.length >= 10) extractedPhone = digits;
          }
        }
      }
    } catch (e) {
      console.warn("Could not extract phone from anamnese:", e);
    }

    // 1. Get form to find admin user_id
    const { data: form, error: formError } = await supabaseAdmin
      .from("anamnese_forms")
      .select("id, user_id")
      .eq("id", form_id)
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: "Formulário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminUserId = form.user_id;

    // 2. Search for existing client by email under this admin
    const { data: existingClients } = await supabaseAdmin
      .from("clients")
      .select("id, name, athlete_status")
      .eq("user_id", adminUserId)
      .ilike("email", email)
      .limit(1);

    let clientId: string | null = null;
    let clientCreated = false;

    if (existingClients && existingClients.length > 0) {
      // Client already exists — auto-link
      clientId = existingClients[0].id;
      console.log(`Auto-linked anamnese to existing client: ${clientId} (${existingClients[0].name})`);
      // Update phone if client has none and we extracted one
      if (extractedPhone) {
        await supabaseAdmin
          .from("clients")
          .update({ phone: extractedPhone })
          .eq("id", clientId)
          .is("phone", null);
      }
    } else {
      // Client doesn't exist — create automatically
      const today = new Date().toISOString().split("T")[0];
      // Default end_date: 3 months from now
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);
      const endDateStr = endDate.toISOString().split("T")[0];

      const { data: newClient, error: createError } = await supabaseAdmin
        .from("clients")
        .insert({
          user_id: adminUserId,
          name: name,
          email: email,
          phone: extractedPhone,
          service_type: "nutrition",
          plan_type: "consultoria",
          start_date: today,
          end_date: endDateStr,
          monthly_value: 0,
          is_active: true,
          has_checkin: false,
          athlete_status: "pending_plan",
          registration_source: "anamnese_auto",
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating client:", createError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar cadastro do atleta" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      clientId = newClient.id;
      clientCreated = true;
      console.log(`Auto-created client: ${clientId} (${name})`);

      // Create athlete_profile for the new client
      const { error: profileError } = await supabaseAdmin
        .from("athlete_profiles")
        .insert({
          client_id: clientId,
          full_name: name,
        });

      if (profileError) {
        console.warn("Could not create athlete profile:", profileError);
      }
    }

    // 3. Check for duplicate submission (same client + form)
    const { data: existingResponse } = await supabaseAdmin
      .from("anamnese_responses")
      .select("id")
      .eq("client_id", clientId)
      .eq("form_id", form_id)
      .limit(1);

    if (existingResponse && existingResponse.length > 0) {
      // Update existing response instead of creating duplicate
      const { error: updateError } = await supabaseAdmin
        .from("anamnese_responses")
        .update({
          responses,
          respondent_name: name,
          respondent_email: email,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", existingResponse[0].id);

      if (updateError) {
        console.error("Error updating anamnese response:", updateError);
        throw updateError;
      }

      console.log(`Updated existing anamnese response: ${existingResponse[0].id}`);
    } else {
      // 4. Insert anamnese response WITH client_id
      const { error: insertError } = await supabaseAdmin
        .from("anamnese_responses")
        .insert({
          form_id,
          client_id: clientId,
          respondent_name: name,
          respondent_email: email,
          responses,
        });

      if (insertError) {
        console.error("Error inserting anamnese response:", insertError);
        throw insertError;
      }
    }

    // 5. Update athlete_profile to mark anamnese as completed
    const { error: profileUpdateError } = await supabaseAdmin
      .from("athlete_profiles")
      .update({
        anamnese_completed: true,
        anamnese_submitted_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (profileUpdateError) {
      console.warn("Could not update athlete profile anamnese status:", profileUpdateError);
    }

    // 5.1 If athlete came from public onboarding (has selected_plan + awaiting_anamnese),
    // send the payment link now via WhatsApp.
    // Bloqueio: fluxo ZN Assessoria gerencia pagamento via Asaas — não disparar link MP.
    let paymentLinkSent = false;
    let paymentLinkError: string | null = null;
    if (source !== "zn") try {
      const { data: clientRow } = await supabaseAdmin
        .from("clients")
        .select("id, name, selected_plan_id, onboarding_status")
        .eq("id", clientId)
        .maybeSingle();

      if (
        clientRow?.selected_plan_id &&
        (clientRow.onboarding_status === "awaiting_anamnese" ||
          clientRow.onboarding_status === "pending" ||
          clientRow.onboarding_status === null)
      ) {
        const { data: plan } = await supabaseAdmin
          .from("onboarding_plans")
          .select("id, name, payment_link")
          .eq("id", clientRow.selected_plan_id)
          .maybeSingle();

        if (plan?.payment_link) {
          const firstName = (clientRow.name || name).split(" ")[0] || clientRow.name || name;
          const { data: waResult, error: waError } = await supabaseAdmin.functions.invoke(
            "send-whatsapp",
            {
              body: {
                clientId,
                templateKey: "onboarding_payment_link",
                context: {
                  nome_atleta: firstName,
                  plano_nome: plan.name,
                  link_pagamento: plan.payment_link,
                },
              },
            }
          );
          if (waError) {
            paymentLinkError = String(waError.message || waError);
          } else if ((waResult as any)?.success === false) {
            paymentLinkError = (waResult as any)?.reason || "WhatsApp não enviado";
          } else {
            paymentLinkSent = true;
            await supabaseAdmin
              .from("clients")
              .update({
                onboarding_status: "payment_sent",
                plan_sent_at: new Date().toISOString(),
              })
              .eq("id", clientId);
          }
        } else {
          paymentLinkError = "Plano sem link de pagamento configurado";
        }
      }
    } catch (e: any) {
      paymentLinkError = e?.message || "Falha ao enviar link de pagamento";
      console.error("Payment link dispatch failed:", e);
    }

    // 6. Notify admin via WhatsApp (Z-API) — non-blocking
    try {
      const adminPhone = "+5599984817697";
      const zapiInstance = Deno.env.get("ZAPI_INSTANCE_ID");
      const zapiToken = Deno.env.get("ZAPI_TOKEN");
      const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

      if (zapiInstance && zapiToken && zapiClientToken) {
        const paymentNote = paymentLinkSent
          ? `\n💳 Link de pagamento enviado para o atleta.`
          : paymentLinkError
          ? `\n⚠️ Link de pagamento NÃO enviado (${paymentLinkError}).`
          : "";
        const message = clientCreated
          ? `📋 Nova anamnese recebida\n\n👤 ${name}\n📧 ${email}\n\n⚠️ Atleta criado automaticamente — aguardando configuração de plano.${paymentNote}`
          : `📋 Anamnese recebida\n\n👤 ${name}\n📧 ${email}\n\nVinculada ao atleta existente.${paymentNote}`;

        const zapiUrl = `https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`;
        const phoneDigits = adminPhone.replace(/\D/g, "");

        await fetch(zapiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": zapiClientToken,
          },
          body: JSON.stringify({ phone: phoneDigits, message }),
        });
        console.log("Admin notified via WhatsApp");
      }
    } catch (notifyError) {
      console.warn("Could not notify admin via WhatsApp:", notifyError);
    }

    // Push (respeitando preferência 'anamnese_submitted')
    try {
      await notifyUser(supabaseAdmin, adminUserId, {
        prefKey: 'anamnese_submitted',
        title: '📋 Anamnese recebida',
        body: `${name} enviou a anamnese.`,
        url: `/clients/${clientId}`,
      });
    } catch (e) {
      console.warn("Push anamnese falhou:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        client_id: clientId,
        client_created: clientCreated,
        message: clientCreated
          ? "Anamnese enviada e atleta criado automaticamente"
          : "Anamnese enviada e vinculada ao atleta existente",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in process-anamnese-submission:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
