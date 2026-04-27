import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TriggeredBy =
  | 'cron_daily'
  | 'cron_weekly_legacy'
  | 'manual_admin'
  | 'followup_cron'
  | 'reminder_24h'
  | 'reminder_15m'
  | 'system';

interface WhatsAppSendResult {
  success: boolean;
  error?: string;
  zapiResponse?: unknown;
}

interface WhatsAppTemplate {
  id: string;
  title: string | null;
  body: string;
  is_active: boolean;
  updated_at: string;
}

async function sendWhatsAppMessage(
  phone: string,
  message: string,
  zapiInstanceId: string,
  zapiToken: string,
  zapiClientToken: string,
): Promise<WhatsAppSendResult> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = formattedPhone.substring(1);
    if (!formattedPhone.startsWith('55')) formattedPhone = '55' + formattedPhone;

    const response = await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiClientToken || '',
        },
        body: JSON.stringify({ phone: formattedPhone, message }),
      },
    );

    const result = await response.json();
    if (!response.ok) return { success: false, error: JSON.stringify(result), zapiResponse: result };
    return { success: true, zapiResponse: result };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function renderTemplate(
  template: { title?: string | null; body: string },
  variables: Record<string, string | undefined>,
): { title: string; body: string } {
  let title = template.title || '';
  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    const safe = value || '';
    title = title.replace(regex, safe);
    body = body.replace(regex, safe);
  }
  return { title, body };
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

interface RequestBody {
  consultationScheduleId?: string;
  clientId?: string;
  messageType?: 'booking_invite' | 'confirmation' | 'followup';
  appointmentData?: { date: string; time: string; meetLink?: string };
  triggeredBy?: TriggeredBy;
  /** When true, skips eligibility checks (for confirmations triggered after booking) */
  skipEligibility?: boolean;
  /** Explicit template_key override (e.g. booking_first_consultation, booking_followup_consultation) */
  templateKey?: string;
}

const VALID_TRIGGERED_BY: TriggeredBy[] = [
  'cron_daily', 'cron_weekly_legacy', 'manual_admin', 'followup_cron',
  'reminder_24h', 'reminder_15m', 'system',
];

function normalizeTriggeredBy(value?: string): TriggeredBy {
  if (value && (VALID_TRIGGERED_BY as string[]).includes(value)) return value as TriggeredBy;
  return 'manual_admin';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const zapiToken = Deno.env.get('ZAPI_TOKEN');
  const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
  const appUrl = 'https://rogersfeitosa.com.br';

  if (!zapiInstanceId || !zapiToken) {
    return new Response(JSON.stringify({ error: 'ZAPI credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: RequestBody = await req.json();
    const triggeredBy = normalizeTriggeredBy(body.triggeredBy);

    // Resolve client_id and consultation_schedule_id (if provided)
    let resolvedClientId: string | null = body.clientId ?? null;
    let resolvedScheduleId: string | null = body.consultationScheduleId ?? null;
    let scheduleRow: { id: string; client_id: string; user_id: string } | null = null;

    if (resolvedScheduleId) {
      const { data: sch, error: schErr } = await supabase
        .from('consultation_schedules')
        .select('id, client_id, user_id')
        .eq('id', resolvedScheduleId)
        .single();
      if (schErr || !sch) {
        return new Response(JSON.stringify({ error: 'Schedule not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      scheduleRow = sch;
      resolvedClientId = sch.client_id;
    }

    if (!resolvedClientId) {
      return new Response(JSON.stringify({ error: 'consultationScheduleId or clientId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, phone, name, user_id')
      .eq('id', resolvedClientId)
      .single();

    if (clientError || !client) throw new Error('Client not found');

    const messageType = body.messageType ?? 'booking_invite';
    const templateKey =
      body.templateKey ??
      (messageType === 'confirmation' ? 'booking_confirmed'
        : messageType === 'followup' ? 'booking_followup_v1'
        : 'weekly_booking_link');

    // ===== ELIGIBILITY CHECK (skip for confirmations) =====
    if (!body.skipEligibility && messageType !== 'confirmation') {
      const { data: eligData } = await supabase.rpc('is_client_eligible_for_booking', {
        _client_id: resolvedClientId,
      });
      const elig = Array.isArray(eligData) ? eligData[0] : eligData;
      if (elig && elig.eligible === false) {
        await supabase.from('whatsapp_message_logs').insert({
          user_id: client.user_id,
          client_id: resolvedClientId,
          consultation_schedule_id: resolvedScheduleId,
          message_type: messageType,
          template_key: templateKey,
          to_phone: client.phone || 'N/A',
          status: 'blocked',
          blocked_reason: `ineligible:${elig.reason}`,
          triggered_by: triggeredBy,
          error_message: `Athlete not eligible: ${elig.reason}`,
          metadata: { eligibility_reason: elig.reason },
        });
        return new Response(JSON.stringify({
          success: false, blocked: true, reason: elig.reason,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ===== DUPLICATE GUARD (skip for confirmations) =====
    if (messageType !== 'confirmation') {
      const { data: dupData } = await supabase.rpc('check_booking_send_duplicate', {
        _client_id: resolvedClientId,
        _template_key: templateKey,
        _consultation_schedule_id: resolvedScheduleId,
      });
      const dup = Array.isArray(dupData) ? dupData[0] : dupData;
      if (dup && dup.is_duplicate === true) {
        await supabase.from('whatsapp_message_logs').insert({
          user_id: client.user_id,
          client_id: resolvedClientId,
          consultation_schedule_id: resolvedScheduleId,
          message_type: messageType,
          template_key: templateKey,
          to_phone: client.phone || 'N/A',
          status: 'blocked',
          blocked_reason: `duplicate_guard:${dup.reason}`,
          triggered_by: triggeredBy,
          error_message: `Duplicate send blocked (${dup.reason})`,
          metadata: { existing_log_id: dup.existing_log_id, duplicate_reason: dup.reason },
        });
        return new Response(JSON.stringify({
          success: false, blocked: true, reason: 'duplicate_guard', existing_log_id: dup.existing_log_id,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ===== EMAIL CHANNEL: foreign athletes (non-+55) =====
    const phoneDigits = (client.phone || '').replace(/\D/g, '');
    const isForeign = client.phone && !phoneDigits.startsWith('55');

    if (isForeign) {
      // Load full client (need email + onboarding fields)
      const { data: fullClient } = await supabase
        .from('clients')
        .select('email, name, onboarding_type')
        .eq('id', resolvedClientId)
        .single();

      if (!fullClient?.email) {
        await supabase.from('whatsapp_message_logs').insert({
          user_id: client.user_id, client_id: resolvedClientId,
          consultation_schedule_id: resolvedScheduleId,
          message_type: messageType, template_key: templateKey,
          to_phone: client.phone, status: 'skipped',
          blocked_reason: 'foreign_no_email', triggered_by: triggeredBy,
          error_message: 'Foreign athlete without email',
        });
        return new Response(JSON.stringify({ success: false, skipped: true, reason: 'foreign_no_email' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Resolve link / data per messageType
      let emailTemplate = '';
      let templateData: Record<string, any> = { name: client.name.split(' ')[0] };

      if (messageType === 'booking_invite' || messageType === 'followup') {
        let { data: bookingLink } = await supabase
          .from('booking_links').select('*')
          .eq('client_id', resolvedClientId).eq('active', true).maybeSingle();
        if (!bookingLink) {
          const { data: newLink } = await supabase
            .from('booking_links').insert({ client_id: resolvedClientId, active: true })
            .select().single();
          bookingLink = newLink;
        }
        const bookingUrl = `${appUrl}/booking/${bookingLink.token}`;
        emailTemplate = 'booking-link';
        templateData.link = bookingUrl;
        templateData.isFollowup = messageType === 'followup' || (fullClient.onboarding_type === 'continuation');

        await supabase
          .from('booking_links')
          .update({ last_sent_at: new Date().toISOString(), usage_count: (bookingLink.usage_count || 0) + 1 })
          .eq('id', bookingLink.id);
      } else if (messageType === 'confirmation' && body.appointmentData) {
        emailTemplate = 'consultation-confirmation';
        templateData.date = formatDateBR(body.appointmentData.date);
        templateData.time = body.appointmentData.time.substring(0, 5);
        templateData.meetLink = body.appointmentData.meetLink;
      } else {
        throw new Error('Invalid message type for email channel');
      }

      const idempotencyKey = `booking-${messageType}-${resolvedScheduleId || resolvedClientId}-${new Date().toISOString().split('T')[0]}`;

      const { error: emailError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: emailTemplate,
          recipientEmail: fullClient.email,
          idempotencyKey,
          templateData,
        },
      });

      await supabase.from('whatsapp_message_logs').insert({
        user_id: client.user_id, client_id: resolvedClientId,
        consultation_schedule_id: resolvedScheduleId,
        message_type: messageType, template_key: templateKey,
        to_phone: client.phone, payload_preview: `[EMAIL] ${emailTemplate} → ${fullClient.email}`,
        status: emailError ? 'failed' : 'sent',
        triggered_by: triggeredBy,
        error_message: emailError?.message,
        metadata: { channel: 'email', email: fullClient.email, template: emailTemplate },
      });

      if (!emailError && (messageType === 'booking_invite' || messageType === 'followup')) {
        if (resolvedScheduleId) {
          await supabase.from('consultation_schedules')
            .update({ status: 'sent', updated_at: new Date().toISOString() })
            .eq('id', resolvedScheduleId);
        }
      }

      return new Response(JSON.stringify({ success: !emailError, channel: 'email' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== Phone validation =====
    if (!client.phone) {
      await supabase.from('whatsapp_message_logs').insert({
        user_id: client.user_id, client_id: resolvedClientId,
        consultation_schedule_id: resolvedScheduleId,
        message_type: messageType, template_key: templateKey,
        to_phone: 'N/A', status: 'skipped',
        blocked_reason: 'no_phone', triggered_by: triggeredBy,
        error_message: 'No phone number',
      });
      throw new Error('Client phone not registered');
    }

    // ===== Athlete WhatsApp settings =====
    const { data: athleteSettings } = await supabase
      .from('athlete_whatsapp_settings')
      .select('disabled_all, disabled_template_keys')
      .eq('client_id', resolvedClientId)
      .maybeSingle();

    if (athleteSettings?.disabled_all || athleteSettings?.disabled_template_keys?.includes(templateKey)) {
      await supabase.from('whatsapp_message_logs').insert({
        user_id: client.user_id, client_id: resolvedClientId,
        consultation_schedule_id: resolvedScheduleId,
        message_type: messageType, template_key: templateKey,
        to_phone: client.phone, status: 'skipped',
        blocked_reason: athleteSettings?.disabled_all ? 'athlete_disabled' : 'template_disabled',
        triggered_by: triggeredBy,
        error_message: 'WhatsApp disabled for athlete or template',
      });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ===== Template =====
    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('id, title, body, is_active, updated_at')
      .eq('user_id', client.user_id)
      .eq('template_key', templateKey)
      .maybeSingle() as { data: WhatsAppTemplate | null };

    if (!template || !template.is_active) {
      await supabase.from('whatsapp_message_logs').insert({
        user_id: client.user_id, client_id: resolvedClientId,
        consultation_schedule_id: resolvedScheduleId,
        message_type: messageType, template_key: templateKey,
        to_phone: client.phone, status: 'skipped',
        blocked_reason: template ? 'template_inactive' : 'no_template',
        triggered_by: triggeredBy,
        error_message: template ? 'Template is inactive' : 'No template configured',
      });
      return new Response(JSON.stringify({
        success: true, skipped: true, reason: template ? 'template_inactive' : 'no_template',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== Build message =====
    let rendered: { title: string; body: string };

    if (messageType === 'booking_invite' || messageType === 'followup') {
      let { data: bookingLink } = await supabase
        .from('booking_links').select('*')
        .eq('client_id', resolvedClientId).eq('active', true).maybeSingle();

      if (!bookingLink) {
        const { data: newLink, error: createError } = await supabase
          .from('booking_links').insert({ client_id: resolvedClientId, active: true })
          .select().single();
        if (createError) throw new Error('Failed to create booking link: ' + createError.message);
        bookingLink = newLink;
      }

      const bookingUrl = `${appUrl}/booking/${bookingLink.token}`;

      rendered = renderTemplate(
        { title: template.title, body: template.body },
        {
          nome: client.name.split(' ')[0],
          client_name: client.name.split(' ')[0],
          booking_link: bookingUrl,
          link: bookingUrl,
        },
      );

      await supabase
        .from('booking_links')
        .update({ last_sent_at: new Date().toISOString(), usage_count: (bookingLink.usage_count || 0) + 1 })
        .eq('id', bookingLink.id);
    } else if (messageType === 'confirmation' && body.appointmentData) {
      rendered = renderTemplate(
        { title: template.title, body: template.body },
        {
          nome: client.name.split(' ')[0],
          client_name: client.name.split(' ')[0],
          data: formatDateBR(body.appointmentData.date),
          hora: body.appointmentData.time.substring(0, 5),
          meet_link: body.appointmentData.meetLink || 'A definir',
        },
      );
    } else {
      throw new Error('Invalid message type or missing appointment data');
    }

    const finalMessage = rendered.title ? `*${rendered.title}*\n\n${rendered.body}` : rendered.body;

    const sendResult = await sendWhatsAppMessage(
      client.phone, finalMessage, zapiInstanceId, zapiToken, zapiClientToken,
    );

    await supabase.from('whatsapp_message_logs').insert({
      user_id: client.user_id, client_id: resolvedClientId,
      consultation_schedule_id: resolvedScheduleId,
      message_type: messageType, template_key: templateKey,
      to_phone: client.phone, payload_preview: finalMessage.substring(0, 500),
      status: sendResult.success ? 'sent' : 'failed',
      triggered_by: triggeredBy,
      error_message: sendResult.error,
      metadata: {
        zapi_response: sendResult.zapiResponse,
        template_id: template.id, template_updated_at: template.updated_at,
      },
    });

    // Update consultation_schedules status when invite sent successfully
    if (sendResult.success && (messageType === 'booking_invite' || messageType === 'followup')) {
      if (resolvedScheduleId) {
        await supabase.from('consultation_schedules')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', resolvedScheduleId);
      } else {
        const todayStr = new Date().toISOString().split('T')[0];
        await supabase.from('consultation_schedules')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('client_id', resolvedClientId).eq('status', 'pending')
          .lte('send_link_date', todayStr);
      }
    }

    return new Response(JSON.stringify({ success: sendResult.success, result: sendResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[send-booking-link] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
