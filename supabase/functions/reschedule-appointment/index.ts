import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

interface RescheduleRequest {
  appointmentId: string;
  newDate: string; // YYYY-MM-DD
  newTime: string; // HH:mm
  notifyClient?: boolean;
}

Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'reschedule-appointment' });
    return denied(guard, corsHeaders);
  });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { appointmentId, newDate, newTime, notifyClient = true }: RescheduleRequest = await req.json();
    console.log('Rescheduling appointment:', appointmentId, 'to', newDate, newTime);

    // Get current appointment details
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

    // Validate that the new date/time is in the future
    const now = new Date();
    const newDateTime = new Date(`${newDate}T${newTime}:00`);
    
    if (newDateTime <= now) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'O novo horário deve ser no futuro',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserId = appointment.client.user_id;
    const { data: calendarConnection } = await supabase
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', adminUserId)
      .single();

    let newMeetLink = appointment.google_meet_link;
    let newEventId = null;

    // If Google Calendar is connected, update the event
    if (calendarConnection?.is_connected) {
      try {
        const serviceAccountKey = JSON.parse(calendarConnection.service_account_key_encrypted || '{}');
        
        if (serviceAccountKey.client_email && serviceAccountKey.private_key) {
          // Create JWT for Google API
          const header = { alg: 'RS256', typ: 'JWT' };
          const jwtNow = Math.floor(Date.now() / 1000);
          const payload = {
            iss: serviceAccountKey.client_email,
            scope: 'https://www.googleapis.com/auth/calendar',
            aud: 'https://oauth2.googleapis.com/token',
            iat: jwtNow,
            exp: jwtNow + 3600,
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
            const timezone = appointment.timezone || 'America/Fortaleza';

            // Delete old event if exists
            if (appointment.google_calendar_event_id) {
              await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appointment.google_calendar_event_id}?sendUpdates=all`,
                {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
                }
              );
            }

            // Create new event with updated time
            const startDate = new Date(`${newDate}T${newTime}:00`);
            const endDate = new Date(startDate.getTime() + appointment.duration_minutes * 60000);

            const eventData = {
              summary: `Consulta - ${appointment.client.name}`,
              description: `Consulta nutricional com ${appointment.client.name} (remarcada)${appointment.notes ? `\n\nObservações: ${appointment.notes}` : ''}`,
              start: {
                dateTime: startDate.toISOString(),
                timeZone: timezone,
              },
              end: {
                dateTime: endDate.toISOString(),
                timeZone: timezone,
              },
              attendees: appointment.client.email ? [{ email: appointment.client.email }] : [],
              conferenceData: {
                createRequest: {
                  requestId: `${appointmentId}-reschedule-${Date.now()}`,
                  conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
              },
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'email', minutes: 1440 },
                  { method: 'popup', minutes: 60 },
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
            
            if (createEventResponse.ok) {
              newEventId = createdEvent.id;
              newMeetLink = createdEvent.conferenceData?.entryPoints?.find(
                (ep: any) => ep.entryPointType === 'video'
              )?.uri || createdEvent.hangoutLink || appointment.google_meet_link;
              
              console.log('New calendar event created:', newEventId);
            }
          }
        }
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError);
      }
    }

    // Update appointment in database
    const oldDate = appointment.appointment_date;
    const oldTime = appointment.appointment_time.substring(0, 5);
    
    // Ensure newTime is in HH:mm format and add seconds for database
    const formattedNewTime = newTime.substring(0, 5);
    const newTimeWithSeconds = formattedNewTime + ':00';

    // Reset reminder fields so the new reminders can be sent for the rescheduled appointment
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        appointment_date: newDate,
        appointment_time: newTimeWithSeconds,
        google_calendar_event_id: newEventId || appointment.google_calendar_event_id,
        google_meet_link: newMeetLink,
        notes_admin: `Remarcado de ${oldDate} ${oldTime} para ${newDate} ${formattedNewTime}`,
        reminder_sent_at: null, // Reset 24h reminder
        reminder_15m_sent_at: null, // Reset 15min reminder
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);
    
    if (updateError) {
      console.error('Error updating appointment:', updateError);
      throw new Error('Erro ao atualizar consulta: ' + updateError.message);
    }

    // Send WhatsApp notification
    if (notifyClient && appointment.client.phone) {
      try {
        const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
        const zapiToken = Deno.env.get('ZAPI_TOKEN');
        const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

        if (zapiInstanceId && zapiToken) {
          const formattedPhone = appointment.client.phone.replace(/\D/g, '');
          const phone = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

          const formattedNewDate = new Date(newDate).toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

          let message = `📅 Consulta Remarcada\n\nOlá ${appointment.client.name},\n\nSua consulta foi remarcada para:\n📆 ${formattedNewDate}\n⏰ ${newTime}`;
          
          if (newMeetLink) {
            message += `\n\n🎥 Link da videochamada:\n${newMeetLink}`;
          }
          
          message += '\n\nAté lá!';

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

    // Log the reschedule
    await supabase.from('consult_invite_logs').insert({
      client_id: appointment.client_id,
      channel: 'system',
      status: 'rescheduled',
      message_type: 'appointment_reschedule',
      metadata: { 
        appointment_id: appointmentId,
        old_date: oldDate,
        old_time: oldTime,
        new_date: newDate,
        new_time: newTime,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Consulta remarcada com sucesso',
        google_meet_link: newMeetLink,
        event_id: newEventId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error rescheduling appointment:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
