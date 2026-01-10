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

    // Validate env vars exist
    if (!zonaNutriUrl || zonaNutriUrl.trim() === '') {
      console.error('ZONA_NUTRI_SUPABASE_URL is missing or empty');
      return new Response(
        JSON.stringify({ error: 'Configuração ZONA_NUTRI_SUPABASE_URL ausente', step: 'env' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!zonaNutriServiceKey || zonaNutriServiceKey.trim() === '') {
      console.error('ZONA_NUTRI_SERVICE_ROLE_KEY is missing or empty');
      return new Response(
        JSON.stringify({ error: 'Configuração ZONA_NUTRI_SERVICE_ROLE_KEY ausente', step: 'env' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    try {
      new URL(zonaNutriUrl);
    } catch {
      console.error('ZONA_NUTRI_SUPABASE_URL is not a valid URL:', zonaNutriUrl);
      return new Response(
        JSON.stringify({ error: 'ZONA_NUTRI_SUPABASE_URL não é uma URL válida', step: 'env' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Zona Nutri URL configured:', zonaNutriUrl);

    // Get the authorization header from the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente', step: 'auth' }),
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
        JSON.stringify({ error: 'Sessão inválida ou expirada', step: 'auth' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userEmail = user.email;
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'Email do usuário não encontrado', step: 'auth' }),
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
    console.log('Listing users in Zona Nutri...');
    const { data: existingUsers, error: listError } = await zonaNutriAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing Zona Nutri users:', listError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar usuário no Zona Nutri: ' + listError.message, step: 'listUsers' }),
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
          JSON.stringify({ error: 'Erro ao criar usuário: ' + createError.message, step: 'createUser' }),
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
    const redirectUrl = 'https://zonanutri.lovable.app/app';
    console.log(`Generating magic link with redirect to: ${redirectUrl}`);
    
    const { data: linkData, error: linkError } = await zonaNutriAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo: redirectUrl
      }
    });

    if (linkError) {
      console.error('Error generating magic link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar link: ' + linkError.message, step: 'generateLink' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!linkData?.properties?.action_link) {
      console.error('Magic link data missing action_link');
      return new Response(
        JSON.stringify({ error: 'Link de acesso não gerado', step: 'generateLink' }),
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
      JSON.stringify({ error: 'Erro interno: ' + (error instanceof Error ? error.message : 'desconhecido'), step: 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
