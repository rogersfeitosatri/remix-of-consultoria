import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SubmissionRequest {
  form_id: string;
  respondent_name: string;
  respondent_email: string;
  responses: Record<string, any>;
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

    const { form_id, respondent_name, respondent_email, responses }: SubmissionRequest = await req.json();

    if (!form_id || !respondent_name || !respondent_email) {
      return new Response(
        JSON.stringify({ error: "form_id, respondent_name e respondent_email são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = respondent_email.toLowerCase().trim();
    const name = respondent_name.trim();

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
          phone: null,
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
