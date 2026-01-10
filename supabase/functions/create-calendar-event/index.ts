import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCalendarEventRequest {
  appointmentId: string;
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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { appointmentId }: CreateCalendarEventRequest = await req.json();
    console.log('Creating calendar event for appointment:', appointmentId);

    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        client:clients(name, email, phone, user_id)
      `)
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      throw new Error('Appointment not found');
    }

    const adminUserId = appointment.client.user_id;

    // First, try OAuth connection (for Meet auto-generation)
    const { data: oauthConnection } = await supabase
      .from('google_oauth_connections')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    let accessToken: string | null = null;
    let useOAuth = false;

    // Check if OAuth connection exists and is valid
    if (oauthConnection?.access_token && oauthConnection?.refresh_token) {
      const tokenExpired = oauthConnection.token_expires_at &&
        new Date(oauthConnection.token_expires_at) < new Date();

      if (tokenExpired) {
        // Refresh the token
        console.log('Token expired, refreshing...');
        const refreshResult = await refreshGoogleToken(
          oauthConnection.refresh_token,
          clientId!,
          clientSecret!,
          supabase,
          adminUserId
        );
        if (refreshResult.success && refreshResult.access_token) {
          accessToken = refreshResult.access_token;
          useOAuth = true;
          console.log('Token refreshed successfully');
        } else {
          console.error('Failed to refresh token:', refreshResult.error);
        }
      } else {
        accessToken = oauthConnection.access_token;
        useOAuth = true;
        console.log('Using existing OAuth token');
      }
    }

    // If OAuth not available, fall back to Service Account (without Meet)
    if (!useOAuth) {
      console.log('OAuth not available, falling back to Service Account');
      const result = await createEventWithServiceAccount(supabase, appointment, adminUserId, appointmentId);
      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create event with OAuth (Meet auto-generation enabled)
    console.log('Creating event with OAuth for Meet auto-generation');
    
    const startDateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + appointment.duration_minutes * 60000);
    const timezone = 'America/Sao_Paulo';
    const conferenceRequestId = crypto.randomUUID();

    const eventData = {
      summary: `Consulta - ${appointment.client.name}`,
      description: `Consulta nutricional com ${appointment.client.name}\nE-mail: ${appointment.client.email || 'N/A'}\nTelefone: ${appointment.client.phone || 'N/A'}${appointment.notes ? `\n\nObservações: ${appointment.notes}` : ''}`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timezone,
      },
      conferenceData: {
        createRequest: {
          requestId: conferenceRequestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 1440 },
          { method: 'popup', minutes: 60 },
        ],
      },
      attendees: appointment.client.email ? [
        { email: appointment.client.email, displayName: appointment.client.name }
      ] : undefined,
    };

    // Create event with conferenceDataVersion=1 for Meet
    const createEventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }
    );

    const createdEvent = await createEventResponse.json();

    if (!createEventResponse.ok) {
      console.error('Failed to create event with OAuth:', createdEvent);
      
      // If OAuth fails, mark as pending_meet and don't send WhatsApp
      await supabase
        .from('appointments')
        .update({ meet_status: 'failed' })
        .eq('id', appointmentId);

      throw new Error(`Falha ao criar evento: ${createdEvent.error?.message || 'Erro desconhecido'}`);
    }

    // Extract Meet link
    const meetLink = createdEvent.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri || createdEvent.hangoutLink;

    console.log('Created event:', createdEvent.id, 'Meet link:', meetLink || 'N/A');

    if (!meetLink) {
      console.error('Event created but Meet link not generated');
      
      // Update appointment with event but mark meet as failed
      await supabase
        .from('appointments')
        .update({
          google_calendar_event_id: createdEvent.id,
          google_meet_link: null,
          meet_status: 'failed',
        })
        .eq('id', appointmentId);

      return new Response(
        JSON.stringify({
          success: false,
          event_id: createdEvent.id,
          google_meet_link: null,
          meet_status: 'failed',
          error: 'Evento criado mas Meet não foi gerado. Tente reprocessar.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update appointment with Google data
    await supabase
      .from('appointments')
      .update({
        google_calendar_event_id: createdEvent.id,
        google_meet_link: meetLink,
        meet_status: 'created',
      })
      .eq('id', appointmentId);

    // Update last sync on calendar connection
    await supabase
      .from('google_calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', adminUserId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: createdEvent.id,
        google_meet_link: meetLink,
        meet_status: 'created',
        message: 'Evento e Meet criados com sucesso!',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        google_meet_link: null,
        event_id: null,
        meet_status: 'failed',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to refresh Google OAuth token
async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  supabase: any,
  userId: string
): Promise<{ success: boolean; access_token?: string; error?: string }> {
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return { success: false, error: tokenData.error_description || 'Failed to refresh token' };
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    await supabase
      .from('google_oauth_connections')
      .update({
        access_token: tokenData.access_token,
        token_expires_at: expiresAt.toISOString(),
        ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return { success: true, access_token: tokenData.access_token };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Fallback to Service Account (without Meet)
async function createEventWithServiceAccount(
  supabase: any,
  appointment: any,
  adminUserId: string,
  appointmentId: string
): Promise<any> {
  // Get admin's Google Calendar connection (Service Account)
  const { data: calendarConnection } = await supabase
    .from('google_calendar_connections')
    .select('*')
    .eq('user_id', adminUserId)
    .single();

  if (!calendarConnection?.is_connected) {
    await supabase
      .from('appointments')
      .update({ meet_status: 'failed' })
      .eq('id', appointmentId);

    return {
      success: false,
      error: 'Google Calendar não conectado e OAuth não disponível',
      google_meet_link: null,
      event_id: null,
      meet_status: 'failed',
    };
  }

  // Parse service account key
  let serviceAccountKey;
  try {
    serviceAccountKey = JSON.parse(calendarConnection.service_account_key_encrypted || '{}');
  } catch {
    return {
      success: false,
      error: 'Chave de serviço inválida',
      google_meet_link: null,
      event_id: null,
      meet_status: 'failed',
    };
  }

  if (!serviceAccountKey.client_email || !serviceAccountKey.private_key) {
    return {
      success: false,
      error: 'Chave de serviço incompleta',
      google_meet_link: null,
      event_id: null,
      meet_status: 'failed',
    };
  }

  // Create JWT for Google API
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const base64UrlEncode = (data: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const textEncoder = new TextEncoder();
  const headerB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccountKey.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    textEncoder.encode(signatureInput)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signatureInput}.${signatureB64}`;

  // Get access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return {
      success: false,
      error: 'Falha na autenticação com Google',
      google_meet_link: null,
      event_id: null,
      meet_status: 'failed',
    };
  }

  // Create event WITHOUT Meet (Service Account limitation)
  const startDateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
  const startDate = new Date(startDateTime);
  const endDate = new Date(startDate.getTime() + appointment.duration_minutes * 60000);
  const calendarId = calendarConnection.calendar_id || 'primary';
  const timezone = 'America/Sao_Paulo';

  const eventData = {
    summary: `Consulta - ${appointment.client.name}`,
    description: `Consulta nutricional com ${appointment.client.name}\nE-mail: ${appointment.client.email || 'N/A'}\nTelefone: ${appointment.client.phone || 'N/A'}${appointment.notes ? `\n\nObservações: ${appointment.notes}` : ''}\n\n⚠️ Meet não gerado automaticamente - configure OAuth para Meet automático.`,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: timezone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: timezone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 1440 },
        { method: 'popup', minutes: 60 },
      ],
    },
  };

  const createEventResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    }
  );

  const createdEvent = await createEventResponse.json();

  if (!createEventResponse.ok) {
    return {
      success: false,
      error: createdEvent.error?.message || 'Falha ao criar evento',
      google_meet_link: null,
      event_id: null,
      meet_status: 'failed',
    };
  }

  // Update appointment - meet_status = 'failed' because Service Account can't create Meet
  await supabase
    .from('appointments')
    .update({
      google_calendar_event_id: createdEvent.id,
      google_meet_link: null,
      meet_status: 'failed',
    })
    .eq('id', appointmentId);

  await supabase
    .from('google_calendar_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', adminUserId);

  return {
    success: false,
    event_id: createdEvent.id,
    google_meet_link: null,
    meet_status: 'failed',
    error: 'Evento criado via Service Account, mas Meet não pode ser gerado. Configure OAuth para Meet automático.',
  };
}
