import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancelEventRequest {
  appointmentId: string;
  notifyClient?: boolean;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { appointmentId, notifyClient = true, reason }: CancelEventRequest = await req.json();
    console.log('Cancelling appointment:', appointmentId);

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

    // Check 24h rule
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilAppointment < 24) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não é possível cancelar com menos de 24 horas de antecedência',
          hoursRemaining: Math.round(hoursUntilAppointment),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin's Google Calendar connection
    const adminUserId = appointment.client.user_id;
    const { data: calendarConnection } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    // Delete Google Calendar event if exists
    if (appointment.google_calendar_event_id && calendarConnection?.is_connected) {
      try {
        const serviceAccountKey = JSON.parse(calendarConnection.service_account_key_encrypted || '{}');
        
        if (serviceAccountKey.client_email && serviceAccountKey.private_key) {
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
          
          if (tokenData.access_token) {
            const calendarId = calendarConnection.calendar_id || 'primary';
            
            // Delete the event
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appointment.google_calendar_event_id}?sendUpdates=all`,
              {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
              }
            );
            console.log('Google Calendar event deleted:', appointment.google_calendar_event_id);
          }
        }
      } catch (calendarError) {
        console.error('Failed to delete calendar event:', calendarError);
        // Continue with cancellation even if calendar deletion fails
      }
    }

    // Update appointment status
    await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        notes_admin: reason ? `Cancelado: ${reason}` : 'Cancelado pelo paciente',
      })
      .eq('id', appointmentId);

    // Send WhatsApp notification
    if (notifyClient && appointment.client.phone) {
      try {
        const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
        const zapiToken = Deno.env.get('ZAPI_TOKEN');
        const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

        if (zapiInstanceId && zapiToken) {
          const formattedPhone = appointment.client.phone.replace(/\D/g, '');
          const phone = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

          const message = `❌ Consulta Cancelada\n\nOlá ${appointment.client.name},\n\nSua consulta do dia ${new Date(appointment.appointment_date).toLocaleDateString('pt-BR')} às ${appointment.appointment_time.substring(0, 5)} foi cancelada.\n\n${reason ? `Motivo: ${reason}\n\n` : ''}Se precisar, agende uma nova consulta.`;

          await fetch(
            `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': zapiClientToken || '',
              },
              body: JSON.stringify({
                phone,
                message,
              }),
            }
          );
        }
      } catch (whatsappError) {
        console.error('Failed to send WhatsApp notification:', whatsappError);
      }
    }

    // Log the cancellation
    await supabase.from('consult_invite_logs').insert({
      client_id: appointment.client_id,
      channel: 'system',
      status: 'cancelled',
      message_type: 'appointment_cancellation',
      metadata: { reason, appointment_id: appointmentId },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Consulta cancelada com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error cancelling appointment:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
