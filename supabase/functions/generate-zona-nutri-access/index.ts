import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateAccessRequest {
  email: string;
  name: string;
  expires_in_days?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ZONA_NUTRI_API_KEY');
    if (!apiKey) {
      console.error('ZONA_NUTRI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: GenerateAccessRequest = await req.json();
    const { email, name, expires_in_days = 30 } = body;

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Email and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating access token for: ${email} (${name})`);

    // Call external API
    const response = await fetch('https://hckwomxcqfvdzvsshqed.supabase.co/functions/v1/generate-access-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        email,
        name,
        expires_in_days,
      }),
    });

    const responseText = await response.text();
    console.log('API Response status:', response.status);
    console.log('API Response:', responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate access token',
          details: responseText,
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid response from API', raw: responseText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Access token generated successfully');

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating access token:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
