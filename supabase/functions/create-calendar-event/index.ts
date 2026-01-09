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

    // Get admin's Google Calendar connection
    const adminUserId = appointment.client.user_id;
    const { data: calendarConnection, error: connectionError } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    if (connectionError || !calendarConnection || !calendarConnection.is_connected) {
      console.log('Google Calendar not connected for admin:', adminUserId);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Google Calendar not connected',
          google_meet_link: null,
          event_id: null 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse service account key
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(calendarConnection.service_account_key_encrypted || '{}');
    } catch {
      throw new Error('Invalid service account key');
    }

    if (!serviceAccountKey.client_email || !serviceAccountKey.private_key) {
      throw new Error('Incomplete service account key');
    }

    // Create JWT for Google API
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccountKey.client_email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Base64url encode
    const base64UrlEncode = (data: Uint8Array): string => {
      const base64 = btoa(String.fromCharCode(...data));
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    const textEncoder = new TextEncoder();
    const headerB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
    const signatureInput = `${headerB64}.${payloadB64}`;

    // Import private key and sign
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
      console.error('Failed to get access token:', tokenData);
      throw new Error('Failed to authenticate with Google');
    }

    // Create calendar event with Meet
    const startDateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + appointment.duration_minutes * 60000);

    const calendarId = calendarConnection.calendar_id || 'primary';
    
    const eventData = {
      summary: `Consulta - ${appointment.client.name}`,
      description: `Consulta nutricional com ${appointment.client.name}${appointment.notes ? `\n\nObservações: ${appointment.notes}` : ''}`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: appointment.timezone || 'America/Fortaleza',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: appointment.timezone || 'America/Fortaleza',
      },
      attendees: appointment.client.email ? [{ email: appointment.client.email }] : [],
      conferenceData: {
        createRequest: {
          requestId: appointmentId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 }, // 24 hours
          { method: 'popup', minutes: 60 },   // 1 hour
        ],
      },
    };

    const createEventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
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
    console.log('Created event:', createdEvent.id);

    if (!createEventResponse.ok) {
      console.error('Failed to create event:', createdEvent);
      throw new Error(`Failed to create calendar event: ${createdEvent.error?.message || 'Unknown error'}`);
    }

    const meetLink = createdEvent.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video'
    )?.uri || createdEvent.hangoutLink;

    // Update appointment with Google data
    await supabase
      .from('appointments')
      .update({
        google_calendar_event_id: createdEvent.id,
        google_meet_link: meetLink,
      })
      .eq('id', appointmentId);

    // Update last sync
    await supabase
      .from('google_calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('user_id', adminUserId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: createdEvent.id,
        google_meet_link: meetLink,
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
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
