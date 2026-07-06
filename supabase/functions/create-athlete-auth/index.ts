import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateAthleteRequest {
  email: string;
  name?: string;
  clientId: string;
  password?: string;
  updatePasswordOnly?: boolean;
}

async function findUserByEmail(supabaseAdmin: any, email: string) {
  const target = email.toLowerCase().trim();
  let page = 1;
  const perPage = 1000;
  // paginate through all users (listUsers default page size is small)
  // stop when returned page is smaller than perPage
  // safety cap at 20 pages
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u: any) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page++;
  }
  return null;
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

    const { email, name, clientId, password, updatePasswordOnly }: CreateAthleteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Password update flow
    if (updatePasswordOnly && password) {
      let targetUserId: string | null = null;

      // 1) Prefer athlete_user_id stored on the client record
      if (clientId) {
        const { data: clientRow, error: clientErr } = await supabaseAdmin
          .from("clients")
          .select("athlete_user_id, email")
          .eq("id", clientId)
          .maybeSingle();
        if (clientErr) {
          console.error("Error fetching client:", clientErr);
        }
        if (clientRow?.athlete_user_id) {
          targetUserId = clientRow.athlete_user_id;
        }
      }

      // 2) Fallback: search auth users by email (paginated)
      if (!targetUserId) {
        const existingUser = await findUserByEmail(supabaseAdmin, email);
        if (existingUser) {
          targetUserId = existingUser.id;

          // Backfill link on client
          if (clientId) {
            await supabaseAdmin
              .from("clients")
              .update({ athlete_user_id: existingUser.id })
              .eq("id", clientId);
          }
        }
      }

      // 3) Still no user — create one with the requested password
      if (!targetUserId) {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase().trim(),
          password,
          email_confirm: true,
          user_metadata: { full_name: name },
        });
        if (createErr) {
          console.error("Error creating user during password update:", createErr);
          return new Response(
            JSON.stringify({ error: createErr.message || "Falha ao criar usuário" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        targetUserId = created.user.id;

        if (clientId) {
          await supabaseAdmin
            .from("clients")
            .update({ athlete_user_id: targetUserId })
            .eq("id", clientId);
        }
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: targetUserId, role: "athlete" }, { onConflict: "user_id,role" });

        return new Response(
          JSON.stringify({ success: true, message: "Usuário criado com a nova senha", created: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message || "Falha ao atualizar senha" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Senha atualizada com sucesso" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create/link flow
    const existingUser = await findUserByEmail(supabaseAdmin, email);

    if (existingUser) {
      const { error: updateError } = await supabaseAdmin
        .from("clients")
        .update({ athlete_user_id: existingUser.id })
        .eq("id", clientId);
      if (updateError) throw updateError;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: existingUser.id, role: "athlete" }, { onConflict: "user_id,role" });
      if (roleError) console.error("Error ensuring athlete role:", roleError);

      return new Response(
        JSON.stringify({
          success: true,
          userId: existingUser.id,
          message: "Usuário já existe, vinculado ao atleta",
          alreadyExists: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const defaultPassword = "123456";
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (authError) throw authError;

    const { error: updateError } = await supabaseAdmin
      .from("clients")
      .update({ athlete_user_id: authData.user.id })
      .eq("id", clientId);
    if (updateError) throw updateError;

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: authData.user.id, role: "athlete" }, { onConflict: "user_id,role" });

    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        message: "Usuário criado com sucesso",
        alreadyExists: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in create-athlete-auth:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
