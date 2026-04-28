import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendWhatsAppRequest {
  clientId: string;
  // Legacy mode: pre-rendered message
  message?: string;
  // Template mode: template_key + context (preferred)
  templateKey?: string;
  context?: Record<string, string>;
  // Metadata for logging
  templateId?: string;
  templateUpdatedAt?: string;
  scheduledCheckinId?: string;
  appointmentId?: string;
  feedbackId?: string;
}

interface WhatsAppTemplate {
  id: string;
  title: string | null;
  body: string;
  is_active: boolean;
  updated_at: string;
}

/**
 * Sanitize and validate a Brazilian phone number to E.164 (digits only, country code 55).
 * Handles common cadastro corruption: extra spaces, parentheses, hyphens, duplicated DDI,
 * leading zeros, missing 9th digit, etc.
 *
 * Returns { ok:true, phone } when normalized to 12 or 13 digits starting with 55.
 * Returns { ok:false, reason } with a precise human-readable cause otherwise.
 */
function sanitizeBrazilianPhone(rawPhone: string | null | undefined): { ok: true; phone: string } | { ok: false; reason: string } {
  if (!rawPhone) return { ok: false, reason: 'Telefone não cadastrado' };
  // Strip everything except digits
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 0) return { ok: false, reason: 'Telefone vazio após sanitização' };

  // Strip leading zeros (international trunk prefix)
  while (digits.startsWith('0')) digits = digits.substring(1);

  // Collapse duplicated DDI: "5555..." where second "55" is a real DDD is rare; treat
  // any 14+ digit number that starts with "5555" as duplicated DDI.
  if (digits.length >= 14 && digits.startsWith('5555')) {
    digits = digits.substring(2);
  }

  // Add DDI if missing
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }

  // Final validation: BR = 55 + 2-digit DDD + 8 or 9 digit subscriber = 12 or 13 digits
  if (digits.length === 12 || digits.length === 13) {
    // Sanity check: DDD must be 11..99 (no Brazilian DDD starts with 0 or 1 alone)
    const ddd = parseInt(digits.substring(2, 4), 10);
    if (ddd < 11 || ddd > 99) {
      return { ok: false, reason: `DDD inválido (${digits.substring(2, 4)}) no telefone "${rawPhone}"` };
    }
    return { ok: true, phone: digits };
  }

  return {
    ok: false,
    reason: `Telefone com formato inválido: "${rawPhone}" → ${digits.length} dígitos (esperado 12 ou 13). Corrija o cadastro.`,
  };
}

// Render template with variables - supports both {var} and {{var}} syntax
function renderTemplateVars(
  template: { title?: string | null; body: string },
  variables: Record<string, string | undefined>
): { title: string; body: string } {
  let title = template.title || '';
  let body = template.body;

  // Normalize variable names for compatibility
  const normalizedVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    normalizedVars[key] = value || '';
    // Also map link_checkin -> checkin_link for compatibility
    if (key === 'checkin_link') {
      normalizedVars['link_checkin'] = value || '';
    }
    if (key === 'link_checkin') {
      normalizedVars['checkin_link'] = value || '';
    }
  }

  for (const [key, value] of Object.entries(normalizedVars)) {
    // Support both {var} and {{var}} syntax
    const singleBrace = new RegExp(`\\{${key}\\}`, 'g');
    const doubleBrace = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    title = title.replace(singleBrace, value).replace(doubleBrace, value);
    body = body.replace(singleBrace, value).replace(doubleBrace, value);
  }

  // Log warning for any remaining unsubstituted variables
  const remainingVars = [...(title.match(/\{+[^}]+\}+/g) || []), ...(body.match(/\{+[^}]+\}+/g) || [])];
  if (remainingVars.length > 0) {
    console.warn('[send-whatsapp] Template has unsubstituted variables:', remainingVars);
  }

  return { title, body };
}

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

    const requestBody: SendWhatsAppRequest = await req.json();
    const { 
      clientId, 
      message: legacyMessage,
      templateKey,
      context,
      templateId: providedTemplateId,
      templateUpdatedAt: providedTemplateUpdatedAt,
      scheduledCheckinId,
      appointmentId,
      feedbackId,
    } = requestBody;

    console.log('[send-whatsapp] Request received:', {
      clientId,
      templateKey,
      hasContext: !!context,
      hasLegacyMessage: !!legacyMessage,
      scheduledCheckinId,
      appointmentId,
    });

    // Get client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('phone, name, user_id, is_frozen')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('Client not found');
    }

    // Block all automated messages for frozen clients
    if ((client as any).is_frozen) {
      console.log('[send-whatsapp] Skipping: client is frozen', clientId);
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'client_frozen' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client.phone) {
      throw new Error('Client phone not registered');
    }

    // Determine message to send
    let finalMessage: string;
    let usedTemplateId: string | null = providedTemplateId || null;
    let usedTemplateUpdatedAt: string | null = providedTemplateUpdatedAt || null;
    let renderedPreview: string = '';

    // TEMPLATE MODE: When templateKey + context are provided, fetch and render from DB
    if (templateKey && context) {
      console.log('[send-whatsapp] Using TEMPLATE MODE with key:', templateKey);

      // Fetch the active template from database
      const { data: template, error: templateError } = await supabase
        .from('whatsapp_templates')
        .select('id, title, body, is_active, updated_at')
        .eq('user_id', client.user_id)
        .eq('template_key', templateKey)
        .maybeSingle() as { data: WhatsAppTemplate | null, error: unknown };

      if (templateError) {
        console.error('[send-whatsapp] Error fetching template:', templateError);
        throw new Error(`Failed to fetch template: ${templateKey}`);
      }

      if (!template) {
        console.error('[send-whatsapp] Template not found:', templateKey);
        throw new Error(`Template not found: ${templateKey}`);
      }

      if (!template.is_active) {
        console.error('[send-whatsapp] Template is inactive:', templateKey);
        throw new Error(`Template is inactive: ${templateKey}`);
      }

      usedTemplateId = template.id;
      usedTemplateUpdatedAt = template.updated_at;

      // Render the template with provided context
      const rendered = renderTemplateVars(
        { title: template.title, body: template.body },
        context
      );

      // Build final message with title in bold if available
      if (rendered.title && rendered.title.trim()) {
        finalMessage = `*${rendered.title}*\n\n${rendered.body}`;
      } else {
        finalMessage = rendered.body;
      }

      renderedPreview = finalMessage.substring(0, 200);

      console.log('[send-whatsapp] Template rendered:', {
        template_id: usedTemplateId,
        template_updated_at: usedTemplateUpdatedAt,
        has_title: !!rendered.title,
        message_preview: renderedPreview,
      });

    } else if (legacyMessage) {
      // LEGACY MODE: Use pre-rendered message
      console.log('[send-whatsapp] Using LEGACY MODE with pre-rendered message');
      finalMessage = legacyMessage;
      renderedPreview = legacyMessage.substring(0, 200);
    } else {
      throw new Error('Either message or templateKey+context must be provided');
    }

    // Sanitize and validate phone (E.164 BR). Fail-fast with a precise reason
    // and log the rejection in whatsapp_message_logs so admins can audit/correct.
    const phoneCheck = sanitizeBrazilianPhone(client.phone);
    if (!phoneCheck.ok) {
      console.error('[send-whatsapp] Invalid phone for client', clientId, '-', phoneCheck.reason);
      try {
        await supabase.from('whatsapp_message_logs').insert({
          user_id: client.user_id,
          client_id: clientId,
          appointment_id: appointmentId || null,
          message_type: templateKey || 'manual',
          template_key: templateKey || null,
          to_phone: String(client.phone || 'N/A').slice(0, 50),
          status: 'failed',
          blocked_reason: 'invalid_phone_format',
          error_message: phoneCheck.reason,
          payload_preview: finalMessage.substring(0, 500),
          metadata: {
            raw_phone: client.phone,
            scheduled_checkin_id: scheduledCheckinId,
            context: context || null,
          },
        });
      } catch (logErr) {
        console.error('[send-whatsapp] Failed to log invalid_phone:', logErr);
      }
      return new Response(
        JSON.stringify({ error: phoneCheck.reason, blocked_reason: 'invalid_phone_format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const phone = phoneCheck.phone;

    console.log('[send-whatsapp] Sending to phone:', phone);

    // Send message via ZAPI
    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    
    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken || '',
      },
      body: JSON.stringify({
        phone: phone,
        message: finalMessage,
      }),
    });

    const zapiResult = await zapiResponse.json();
    console.log('[send-whatsapp] ZAPI response:', zapiResult);

    const messageStatus = zapiResponse.ok ? 'sent' : 'failed';
    const errorMessage = zapiResponse.ok ? null : JSON.stringify(zapiResult);

    // Log the message with full audit trail
    try {
      await supabase
        .from('whatsapp_message_logs')
        .insert({
          user_id: client.user_id,
          client_id: clientId,
          appointment_id: appointmentId || null,
          message_type: templateKey || 'manual',
          template_key: templateKey || null,
          to_phone: phone,
          status: messageStatus,
          error_message: errorMessage,
          payload_preview: finalMessage.substring(0, 500),
          metadata: {
            template_id: usedTemplateId,
            template_updated_at: usedTemplateUpdatedAt,
            scheduled_checkin_id: scheduledCheckinId,
            context: context || null,
            rendered_message_preview: renderedPreview,
            zapi_response: zapiResult,
          },
        });
      console.log('[send-whatsapp] Message logged successfully');
    } catch (logError) {
      console.error('[send-whatsapp] Error logging message:', logError);
    }

    if (!zapiResponse.ok) {
      throw new Error(`ZAPI error: ${JSON.stringify(zapiResult)}`);
    }

    // Update feedback as sent if feedbackId provided
    if (feedbackId) {
      const { error: updateError } = await supabase
        .from('checkin_feedbacks')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_via: 'whatsapp',
        })
        .eq('id', feedbackId);

      if (updateError) {
        console.error('[send-whatsapp] Error updating feedback status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        zapiResult,
        templateUsed: {
          id: usedTemplateId,
          updated_at: usedTemplateUpdatedAt,
        },
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[send-whatsapp] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
