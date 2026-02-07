import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RefreshTokenRequest {
  userId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }

    const { userId }: RefreshTokenRequest = await req.json();
    
    if (!userId) {
      throw new Error('User ID required');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current OAuth connection
    const { data: connection, error: connectionError } = await supabase
      .from('google_oauth_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (connectionError || !connection) {
      throw new Error('OAuth connection not found');
    }

    if (!connection.refresh_token) {
      throw new Error('No refresh token available - user needs to re-authorize');
    }

    // Refresh the token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Failed to refresh token:', tokenData);
      throw new Error('Failed to refresh Google token');
    }

    // Calculate new expiration
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    // Update tokens in database
    const { error: updateError } = await supabase
      .from('google_oauth_connections')
      .update({
        access_token: tokenData.access_token,
        token_expires_at: expiresAt.toISOString(),
        // Note: Google doesn't always return a new refresh token
        ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error('Failed to update tokens');
    }

    console.log('Successfully refreshed token for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        access_token: tokenData.access_token,
        expires_at: expiresAt.toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error refreshing token:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
