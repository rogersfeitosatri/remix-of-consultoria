import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Consultoria Supabase credentials from environment
    const consultoriaUrl = Deno.env.get('SUPABASE_URL');
    const consultoriaAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    // Get Zona Nutri Supabase credentials from environment
    const zonaNutriUrl = Deno.env.get('ZONA_NUTRI_SUPABASE_URL');
    const zonaNutriServiceKey = Deno.env.get('ZONA_NUTRI_SERVICE_ROLE_KEY');

    if (!zonaNutriUrl || !zonaNutriServiceKey) {
      console.error('Missing Zona Nutri credentials');
      return new Response(
        JSON.stringify({ error: 'Configuração do Zona Nutri não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the authorization header from the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Consultoria client to validate the user session
    const consultoriaClient = createClient(consultoriaUrl!, consultoriaAnonKey!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the authenticated user from Consultoria
    const { data: { user }, error: userError } = await consultoriaClient.auth.getUser();
    
    if (userError || !user) {
      console.error('User validation error:', userError);
      return new Response(
        JSON.stringify({ error: 'Sessão inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userEmail = user.email;
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'Email do usuário não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing SSO for user: ${userEmail}`);

    // Create Zona Nutri admin client with service role key
    const zonaNutriAdmin = createClient(zonaNutriUrl, zonaNutriServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if user exists in Zona Nutri
    const { data: existingUsers, error: listError } = await zonaNutriAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing Zona Nutri users:', listError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar usuário no Zona Nutri' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
    
    let zonaNutriUserId: string;

    if (!existingUser) {
      // Create user in Zona Nutri
      console.log(`Creating new user in Zona Nutri: ${userEmail}`);
      const { data: newUser, error: createError } = await zonaNutriAdmin.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: {
          created_via: 'consultoria_sso',
          source_user_id: user.id
        }
      });

      if (createError) {
        console.error('Error creating Zona Nutri user:', createError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar usuário no Zona Nutri' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      zonaNutriUserId = newUser.user.id;
      console.log(`Created new user with ID: ${zonaNutriUserId}`);
    } else {
      zonaNutriUserId = existingUser.id;
      console.log(`Found existing user with ID: ${zonaNutriUserId}`);
    }

    // Generate magic link for Zona Nutri
    const { data: linkData, error: linkError } = await zonaNutriAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo: 'https://zonanutri.lovable.app/app'
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Error generating magic link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar link de acesso' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Magic link generated successfully for: ${userEmail}`);

    return new Response(
      JSON.stringify({ url: linkData.properties.action_link }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
