import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateAthleteRequest {
  email: string;
  name: string;
  clientId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, name, clientId }: CreateAthleteRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    const existingUser = existingUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // User already exists, link the client
      const { error: updateError } = await supabaseAdmin
        .from("clients")
        .update({ athlete_user_id: existingUser.id })
        .eq("id", clientId);

      if (updateError) throw updateError;

      // Ensure athlete role exists (upsert style - ignore if already exists)
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .upsert({
          user_id: existingUser.id,
          role: "athlete",
        }, { onConflict: 'user_id,role' });

      if (roleError) {
        console.error("Error ensuring athlete role for existing user:", roleError);
      } else {
        console.log("Athlete role ensured for existing user:", existingUser.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: existingUser.id,
          message: "Usuário já existe, vinculado ao atleta",
          alreadyExists: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new user with default password
    const defaultPassword = "123456";
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: defaultPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: name,
      },
    });

    if (authError) {
      console.error("Error creating user:", authError);
      throw authError;
    }

    // Link the client to this user
    const { error: updateError } = await supabaseAdmin
      .from("clients")
      .update({ athlete_user_id: authData.user.id })
      .eq("id", clientId);

    if (updateError) throw updateError;

    // Add athlete role (NEVER admin)
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: authData.user.id,
        role: "athlete",
      });

    if (roleError) {
      console.error("Error adding athlete role:", roleError);
      // Continue anyway, role can be added manually
    } else {
      console.log("Athlete role assigned to user:", authData.user.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id,
        message: "Usuário criado com sucesso",
        alreadyExists: false
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
