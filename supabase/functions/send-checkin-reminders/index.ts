import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledCheckin {
  id: string;
  client_id: string;
  form_id: string | null;
  user_id: string;
  scheduled_send_date: string;
  scheduled_send_time: string | null;
  status: string;
  clients: {
    name: string;
    phone: string;
    athlete_user_id: string | null;
    is_frozen: boolean;
    is_active: boolean;
    end_date: string | null;
    athlete_status: string | null;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const appUrl = 'https://rogersfeitosa.com.br';

  try {
    // Get current time in São Paulo
    const now = new Date();
    const saoPauloOffset = -3 * 60;
    const saoPauloNow = new Date(now.getTime() + (now.getTimezoneOffset() + saoPauloOffset) * 60 * 1000);
    const todayStr = saoPauloNow.toISOString().split('T')[0];
    const currentHour = saoPauloNow.getHours();
    const currentMinute = saoPauloNow.getMinutes();
    const currentDow = saoPauloNow.getUTCDay(); // 0=Sun, 1=Mon, ...

    console.log('[send-checkin-reminders] Processing for:', todayStr, 'current time:', `${currentHour}:${currentMinute}`, 'dow:', currentDow);

    // HARD GUARD: only Mondays. Check-in links must never be sent on any other day.
    if (currentDow !== 1) {
      console.log('[send-checkin-reminders] Skipping run: today is not Monday (dow=' + currentDow + ')');
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'not_monday',
        dow: currentDow,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch scheduled checkins for today that haven't been sent
    const { data: scheduledCheckins, error: fetchError } = await supabase
      .from('scheduled_checkins')
      .select(`
        id,
        client_id,
        form_id,
        user_id,
        scheduled_send_date,
        scheduled_send_time,
        status,
        clients!inner(name, phone, athlete_user_id, is_frozen)
      `)
      .eq('scheduled_send_date', todayStr)
      .eq('status', 'pending')
      .is('sent_at', null) as { data: ScheduledCheckin[] | null, error: unknown };

    if (fetchError) {
      console.error('[send-checkin-reminders] Error fetching scheduled checkins:', fetchError);
      throw new Error('Failed to fetch scheduled checkins');
    }

    if (!scheduledCheckins || scheduledCheckins.length === 0) {
      console.log('[send-checkin-reminders] No pending checkin reminders for today');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending checkins',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-checkin-reminders] Found ${scheduledCheckins.length} pending checkins to process`);

    const results: { checkinId: string; status: string; error?: string }[] = [];

    for (const checkin of scheduledCheckins) {
      try {
        // Check if it's time to send (within 5 minute window)
        if (checkin.scheduled_send_time) {
          const [schedHour, schedMin] = checkin.scheduled_send_time.split(':').map(Number);
          const schedMinutes = schedHour * 60 + schedMin;
          const currentMinutes = currentHour * 60 + currentMinute;
          
          if (currentMinutes < schedMinutes || currentMinutes >= schedMinutes + 5) {
            console.log('[send-checkin-reminders] Skipping checkin outside time window:', checkin.id);
            continue;
          }
        }

        const client = checkin.clients as any;

        // Skip frozen clients
        if (client?.is_frozen) {
          console.log('[send-checkin-reminders] Skipping frozen client:', checkin.client_id);
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'Client frozen' });
          continue;
        }

        if (!client?.phone) {
          console.log('[send-checkin-reminders] Skipping checkin without phone:', checkin.id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: 'N/A',
            status: 'skipped',
            error_message: 'No phone number',
            metadata: { scheduled_checkin_id: checkin.id, reason: 'no_phone' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'No phone' });
          continue;
        }

        // Check athlete WhatsApp settings
        const { data: athleteSettings } = await supabase
          .from('athlete_whatsapp_settings')
          .select('disabled_all, disabled_template_keys')
          .eq('client_id', checkin.client_id)
          .maybeSingle();

        if (athleteSettings?.disabled_all) {
          console.log('[send-checkin-reminders] WhatsApp disabled for athlete:', checkin.client_id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'WhatsApp disabled for athlete',
            metadata: { scheduled_checkin_id: checkin.id, reason: 'athlete_disabled' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'WhatsApp disabled' });
          continue;
        }

        if (athleteSettings?.disabled_template_keys?.includes('checkin_reminder')) {
          console.log('[send-checkin-reminders] checkin_reminder disabled for athlete:', checkin.client_id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'Template disabled for athlete',
            metadata: { scheduled_checkin_id: checkin.id, reason: 'template_disabled' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'Template disabled' });
          continue;
        }

        // Build checkin link - use form_id from scheduled checkin or find active form
        let checkinLink: string | null = null;
        
        if (checkin.form_id) {
          checkinLink = `${appUrl}/form/${checkin.form_id}?client=${checkin.client_id}`;
        } else {
          // Fallback: find active checkin form for this user
          const { data: activeForm } = await supabase
            .from('checkin_forms')
            .select('id')
            .eq('user_id', checkin.user_id)
            .eq('is_active', true)
            .maybeSingle();
          
          if (activeForm) {
            checkinLink = `${appUrl}/form/${activeForm.id}?client=${checkin.client_id}`;
          }
        }

        if (!checkinLink) {
          console.log('[send-checkin-reminders] No checkin link available:', checkin.id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: checkin.user_id,
            client_id: checkin.client_id,
            message_type: 'checkin_reminder',
            template_key: 'checkin_reminder',
            to_phone: client.phone,
            status: 'skipped',
            error_message: 'No checkin link available',
            metadata: { scheduled_checkin_id: checkin.id, reason: 'no_checkin_link' }
          });
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'No checkin link' });
          continue;
        }

        // Format date for context
        const today = new Date();
        const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

        // Format phone as access code (human readable format)
        const formatPhoneAsAccessCode = (phone: string): string => {
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 13 && digits.startsWith('55')) {
            return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
          } else if (digits.length === 12 && digits.startsWith('55')) {
            return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
          } else if (digits.length === 11) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
          } else if (digits.length === 10) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
          }
          return phone;
        };

        const codigoAcesso = formatPhoneAsAccessCode(client.phone);

        // Build context for template rendering
        const context: Record<string, string> = {
          nome: client.name.split(' ')[0],
          link_checkin: checkinLink,
          checkin_link: checkinLink, // Both for compatibility
          data: formattedDate,
          codigo_acesso: codigoAcesso,
        };

        console.log('[send-checkin-reminders] Calling send-whatsapp in template mode:', {
          scheduled_checkin_id: checkin.id,
          client_id: checkin.client_id,
          checkin_link: checkinLink,
        });

        // DEDUP GUARD: skip if this client already has a sent check-in dispatch today.
        // Prevents duplicate WhatsApp messages when the new pipeline
        // (process-checkin-dispatches) already dispatched today.
        const { data: alreadySent } = await supabase
          .from('checkin_dispatches')
          .select('id')
          .eq('client_id', checkin.client_id)
          .eq('status', 'sent')
          .gte('sent_at', `${todayStr}T00:00:00`)
          .lte('sent_at', `${todayStr}T23:59:59`)
          .limit(1)
          .maybeSingle();

        if (alreadySent) {
          console.log('[send-checkin-reminders] Dedup: client already received check-in today, skipping:', checkin.client_id);
          await supabase
            .from('scheduled_checkins')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', checkin.id);
          results.push({ checkinId: checkin.id, status: 'skipped', error: 'already_sent_today' });
          continue;
        }

        // REGRA OBRIGATÓRIA: criar dispatch ANTES de enviar via Z-API
        let dispatchId: string | null = null;
        try {
          const { data: dId, error: dErr } = await supabase.rpc('create_checkin_dispatch_for_send', {
            p_client_id: checkin.client_id,
            p_user_id: checkin.user_id,
            p_link_checkin: checkinLink,
            p_source: 'legacy_scheduled_checkins',
          });
          if (dErr) throw dErr;
          dispatchId = dId as string;
        } catch (e) {
          console.error('[send-checkin-reminders] Failed to create dispatch, aborting send:', e);
          results.push({ checkinId: checkin.id, status: 'failed', error: 'dispatch_create_failed' });
          continue;
        }

        // Call send-whatsapp edge function in TEMPLATE MODE
        // This delegates all template fetching/rendering to the unified service
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            clientId: checkin.client_id,
            templateKey: 'checkin_reminder',
            context: context,
            scheduledCheckinId: checkin.id,
          }),
        });

        const sendResult = await sendResponse.json().catch(() => ({}));

        if (!sendResponse.ok || sendResult.error) {
          // Surface the precise failure reason (telephone format, ZAPI rejection, etc.)
          const errorMsg = sendResult.error
            || sendResult.message
            || `HTTP ${sendResponse.status} ${sendResponse.statusText}`;
          const blockedReason = sendResult.blocked_reason || null;
          console.error('[send-checkin-reminders] Send failed for client', checkin.client_id, '-', errorMsg);
          if (dispatchId) {
            await supabase.from('checkin_dispatches').update({
              status: 'failed',
              error_message: String(errorMsg).slice(0, 500),
              provider_response: { blocked_reason: blockedReason, raw: sendResult },
            }).eq('id', dispatchId);
          }
          results.push({ checkinId: checkin.id, status: 'failed', error: errorMsg });
          continue;
        }

        // Atualiza dispatch como enviado
        if (dispatchId) {
          await supabase.from('checkin_dispatches').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_response: sendResult ?? null,
          }).eq('id', dispatchId);

          // Atualiza last_dispatched_at do schedule
          const { data: disp } = await supabase
            .from('checkin_dispatches')
            .select('schedule_id')
            .eq('id', dispatchId)
            .maybeSingle();
          if (disp?.schedule_id) {
            await supabase
              .from('athlete_checkin_schedules')
              .update({ last_dispatched_at: new Date().toISOString() })
              .eq('id', disp.schedule_id);
          }
        }

        // Update checkin status to sent
        await supabase
          .from('scheduled_checkins')
          .update({ 
            sent_at: new Date().toISOString(),
            status: 'sent'
          })
          .eq('id', checkin.id);

        results.push({ checkinId: checkin.id, status: 'success' });
        console.log(`[send-checkin-reminders] Successfully sent to ${client.name}`);

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[send-checkin-reminders] Error processing checkin:', checkin.id, error);
        results.push({ checkinId: checkin.id, status: 'failed', error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`[send-checkin-reminders] Processing complete. Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: results.length,
      successCount,
      errorCount,
      skippedCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[send-checkin-reminders] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
