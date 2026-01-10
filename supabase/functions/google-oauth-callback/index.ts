import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

    if (error) {
      console.error('OAuth error from Google:', error);
      return createRedirectResponse(supabaseUrl, false, `Erro do Google: ${error}`);
    }

    if (!code || !state) {
      return createRedirectResponse(supabaseUrl, false, 'Parâmetros inválidos');
    }

    if (!clientId || !clientSecret) {
      return createRedirectResponse(supabaseUrl, false, 'Credenciais OAuth não configuradas');
    }

    // Parse state to get user ID
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return createRedirectResponse(supabaseUrl, false, 'Estado inválido');
    }

    const userId = stateData.userId;
    if (!userId) {
      return createRedirectResponse(supabaseUrl, false, 'Usuário não identificado');
    }

    // Check state timestamp (max 10 minutes)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      return createRedirectResponse(supabaseUrl, false, 'Link expirado, tente novamente');
    }

    // Exchange code for tokens
    const redirectUri = `${supabaseUrl}/functions/v1/google-oauth-callback`;
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Failed to exchange code for tokens:', tokenData);
      return createRedirectResponse(supabaseUrl, false, 'Falha ao obter tokens do Google');
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    // Save tokens to database
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error: upsertError } = await supabase
      .from('google_oauth_connections')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        scope: tokenData.scope,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Failed to save tokens:', upsertError);
      return createRedirectResponse(supabaseUrl, false, 'Erro ao salvar conexão');
    }

    console.log('Successfully saved OAuth tokens for user:', userId);
    
    return createRedirectResponse(supabaseUrl, true, 'Conexão com Google Calendar estabelecida com sucesso!');

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    return createRedirectResponse(supabaseUrl, false, error.message);
  }
});

function createRedirectResponse(supabaseUrl: string, success: boolean, message: string): Response {
  // Extract the app origin from Supabase URL (e.g., vhzxnatgwravidvbehwi -> app URL)
  // We'll redirect to the scheduling settings page with a status parameter
  const appOrigin = supabaseUrl.replace('.supabase.co', '').replace('https://', '');
  
  // Build redirect URL to the app's scheduling settings
  const redirectUrl = new URL('/scheduling-settings', 'https://lovable.dev');
  redirectUrl.searchParams.set('oauth_status', success ? 'success' : 'error');
  redirectUrl.searchParams.set('oauth_message', message);
  
  // For now, return an HTML page that shows status and can close itself
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${success ? 'Conexão Estabelecida' : 'Erro na Conexão'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f0f0f;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 40px;
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 16px;
    }
    p {
      color: #888;
      margin-bottom: 24px;
    }
    .btn {
      background: ${success ? '#22c55e' : '#ef4444'};
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    }
    .btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'Conexão Estabelecida!' : 'Erro na Conexão'}</h1>
    <p>${message}</p>
    <button class="btn" onclick="window.close(); if(!window.closed) window.location.href='/';">
      ${success ? 'Fechar e Continuar' : 'Tentar Novamente'}
    </button>
  </div>
  <script>
    // Try to communicate with opener window
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'google-oauth-callback', 
        success: ${success},
        message: '${message.replace(/'/g, "\\'")}'
      }, '*');
    }
    // Auto-close after 3 seconds if success
    ${success ? 'setTimeout(() => { window.close(); }, 3000);' : ''}
  </script>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
