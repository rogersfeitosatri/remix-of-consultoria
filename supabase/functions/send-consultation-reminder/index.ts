import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!zapiInstanceId || !zapiToken) {
      throw new Error('ZAPI credentials not configured');
    }

    // Calculate time window: appointments between 23h and 25h from now
    const now = new Date();
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    console.log('Checking for appointments between:', in23Hours.toISOString(), 'and', in25Hours.toISOString());

    // Get confirmed appointments that:
    // 1. Are scheduled within the next 23-25 hours
    // 2. Haven't had a reminder sent yet
    // 3. Have status 'confirmed'
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        appointment_time,
        google_meet_link,
        client_id,
        clients!inner(name, phone)
      `)
      .eq('status', 'confirmed')
      .is('reminder_sent_at', null)
      .gte('appointment_date', in23Hours.toISOString().split('T')[0])
      .lte('appointment_date', in25Hours.toISOString().split('T')[0]);

    if (appointmentsError) {
      console.error('Error fetching appointments:', appointmentsError);
      throw appointmentsError;
    }

    console.log('Found appointments:', appointments?.length || 0);

    const results: { appointmentId: string; success: boolean; error?: string }[] = [];

    for (const appointment of appointments || []) {
      try {
        // Check if appointment time is within the 24h window
        const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        
        if (appointmentDateTime < in23Hours || appointmentDateTime > in25Hours) {
          console.log('Skipping appointment outside time window:', appointment.id);
          continue;
        }

        const client = appointment.clients as unknown as { name: string; phone: string };
        
        if (!client?.phone) {
          console.log('Skipping appointment without phone:', appointment.id);
          results.push({ appointmentId: appointment.id, success: false, error: 'No phone number' });
          continue;
        }

        // Format phone number
        let phone = client.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
          phone = phone.substring(1);
        }
        if (!phone.startsWith('55')) {
          phone = '55' + phone;
        }

        // Format date and time for message
        const dateObj = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        const formattedDate = dateObj.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          day: '2-digit', 
          month: '2-digit',
          year: 'numeric'
        });
        const formattedTime = appointment.appointment_time.substring(0, 5);

        // Build reminder message
        let message = `🔔 *Lembrete de Consulta*\n\n`;
        message += `Olá ${client.name}!\n\n`;
        message += `Sua consulta está agendada para *amanhã*:\n`;
        message += `📅 ${formattedDate}\n`;
        message += `⏰ ${formattedTime}\n\n`;

        if (appointment.google_meet_link) {
          message += `💻 Link da reunião:\n${appointment.google_meet_link}\n\n`;
        }

        message += `Por favor, esteja pronto(a) no horário. Caso precise reagendar, entre em contato o mais breve possível.\n\n`;
        message += `Até amanhã! 🙂`;

        console.log('Sending reminder to:', phone, 'for appointment:', appointment.id);

        // Send WhatsApp message via ZAPI
        const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
        
        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiClientToken || '',
          },
          body: JSON.stringify({
            phone: phone,
            message: message,
          }),
        });

        const zapiResult = await zapiResponse.json();
        console.log('ZAPI response for appointment', appointment.id, ':', zapiResult);

        if (!zapiResponse.ok) {
          throw new Error(`ZAPI error: ${JSON.stringify(zapiResult)}`);
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', appointment.id);

        if (updateError) {
          console.error('Error updating reminder_sent_at:', updateError);
        }

        results.push({ appointmentId: appointment.id, success: true });

      } catch (error: any) {
        console.error('Error processing appointment:', appointment.id, error);
        results.push({ appointmentId: appointment.id, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in send-consultation-reminder:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
