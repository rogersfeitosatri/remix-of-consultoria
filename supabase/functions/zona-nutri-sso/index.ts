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
    let zonaNutriUrl = Deno.env.get('ZONA_NUTRI_SUPABASE_URL') || '';
    const zonaNutriApiKey = Deno.env.get('ZONA_NUTRI_API_KEY') || '';
    const zonaNutriServiceRoleKey = Deno.env.get('ZONA_NUTRI_SERVICE_ROLE_KEY') || '';
    // Clean up secrets in case they were saved with key name prefix
    if (zonaNutriUrl.includes('=')) {
      zonaNutriUrl = zonaNutriUrl.split('=').pop()?.trim() || '';
    }

    // Validate env vars exist
    if (!zonaNutriUrl || zonaNutriUrl.trim() === '') {
      console.error('ZONA_NUTRI_SUPABASE_URL is missing or empty');
      return new Response(
        JSON.stringify({ error: 'Configuração ZONA_NUTRI_SUPABASE_URL ausente', step: 'env' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!zonaNutriApiKey || zonaNutriApiKey.trim() === '') {
      console.error('ZONA_NUTRI_API_KEY is missing or empty');
      return new Response(
        JSON.stringify({ error: 'Configuração ZONA_NUTRI_API_KEY ausente', step: 'env' }),
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

    // Extract project ref from URL for debug
    const zonaNutriProjectRef = zonaNutriUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';
    console.log('Zona Nutri URL configured:', zonaNutriUrl);
    console.log('Zona Nutri Project Ref:', zonaNutriProjectRef);

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

    // Check if user has Zona Nutri access in Consultoria
    const { data: clientData, error: clientError } = await consultoriaClient
      .from('clients')
      .select('id, has_zona_nutri_access, plan_type')
      .eq('athlete_user_id', user.id)
      .single();

    if (clientError || !clientData) {
      console.error('Client not found or error:', clientError);
      return new Response(
        JSON.stringify({ error: 'Cliente não encontrado na plataforma', step: 'clientLookup' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if client has Zona Nutri access (has_zona_nutri_access or Premium plan)
    const isPremium = clientData.plan_type?.toLowerCase()?.includes('premium');
    const hasAccess = clientData.has_zona_nutri_access === true || isPremium;

    if (!hasAccess) {
      console.log(`User ${userEmail} does not have Zona Nutri access`);
      return new Response(
        JSON.stringify({ error: 'Você não tem acesso ao Zona Nutri. Entre em contato com seu nutricionista.', step: 'accessDenied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userEmail} has Zona Nutri access (premium: ${isPremium}, flag: ${clientData.has_zona_nutri_access})`);

    // Get athlete name for registration if needed
    const athleteName =
      (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim())
        ? user.user_metadata.full_name.trim()
        : (userEmail.split('@')[0] || 'Atleta');

    // 1) Preferir SSO real via magic link (Supabase Auth do Zona Nutri) para NÃO cair na tela de login.
    // Isso gera um link /auth/v1/verify que, após validar, redireciona para /app já autenticado.
    const magicLinkRedirectTo = 'https://zonanutri.com/app';

    if (zonaNutriServiceRoleKey && zonaNutriServiceRoleKey.trim() !== '') {
      try {
        console.log('Trying magic link SSO via Zona Nutri auth...');

        const zonaNutriAdmin = createClient(zonaNutriUrl, zonaNutriServiceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Garante que o usuário exista no auth do Zona Nutri (se já existir, apenas ignora o erro).
        const { error: createUserErr } = await zonaNutriAdmin.auth.admin.createUser({
          email: userEmail,
          email_confirm: true,
          user_metadata: {
            full_name: athleteName,
          },
        });

        if (createUserErr) {
          console.log('Zona Nutri createUser skipped:', createUserErr.message);
        }

        const { data: linkData, error: linkError } = await zonaNutriAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: userEmail,
          options: {
            redirectTo: magicLinkRedirectTo,
          },
        });

        const actionLink = linkData?.properties?.action_link;

        if (!linkError && actionLink) {
          console.log('Magic link generated. Redirecting via verify link.');
          return new Response(
            JSON.stringify({
              url: actionLink,
              debug: {
                method: 'magiclink',
                redirectToUsed: magicLinkRedirectTo,
              },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.error('Magic link generation failed:', linkError);
      } catch (e) {
        console.error('Magic link SSO failed (fallback to token link):', e);
      }
    }

    // 2) Fallback: Call the Zona Nutri API to generate access token
    const generateUrl = new URL('functions/v1/generate-access-token', zonaNutriUrl).toString();
    console.log(`Calling Zona Nutri API generate-access-token for: ${userEmail} (${athleteName})`);

    const apiResp = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': zonaNutriApiKey,
      },
      body: JSON.stringify({
        email: userEmail,
        name: athleteName,
        expires_in_days: 30,
      }),
    });

    const apiText = await apiResp.text();
    console.log('Zona Nutri API Response status:', apiResp.status);
    console.log('Zona Nutri API Response body:', apiText);

    if (!apiResp.ok) {
      console.error('Zona Nutri API error:', apiText);
      return new Response(
        JSON.stringify({
          error: 'Falha ao gerar link de acesso no Zona Nutri',
          step: 'zonaNutriApi',
          details: apiText,
          status: apiResp.status,
        }),
        { status: apiResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let apiData: any;
    try {
      apiData = JSON.parse(apiText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do Zona Nutri', step: 'zonaNutriApi', raw: apiText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // A API pode retornar { token, access_url } ou { access_token, access_url }
    const accessToken = apiData?.access_token || apiData?.token;
    const accessUrl = apiData?.access_url || apiData?.url || (accessToken ? `https://zonanutri.com/app?token=${accessToken}` : undefined);

    console.log('Zona Nutri API returned:', { 
      hasAccessToken: !!accessToken, 
      accessUrl,
      allKeys: Object.keys(apiData || {})
    });

    if (!accessToken && !accessUrl) {
      return new Response(
        JSON.stringify({ error: 'Token de acesso não retornado pelo Zona Nutri', step: 'zonaNutriApi', raw: apiData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the final URL (fallback)
    // Observação: este link pode depender de como o Zona Nutri implementa o SSO via token.
    const finalUrl = accessUrl;

    console.log('Final redirect URL:', finalUrl);

    return new Response(
      JSON.stringify({
        url: finalUrl,
        debug: {
          zonaNutriSupabaseUrlUsed: zonaNutriUrl,
          zonaNutriProjectRefUsed: zonaNutriProjectRef,
          generateUrlUsed: generateUrl,
          hasAccessToken: !!accessToken,
          accessUrlFromApi: accessUrl,
        },
      }),
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
