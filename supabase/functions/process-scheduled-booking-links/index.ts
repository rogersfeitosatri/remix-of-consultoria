import { createClient } from "npm:@supabase/supabase-js@2";
import { requireInternal, denied, logSecurityEvent, restrictedCors } from "../_shared/authGuard.ts";

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
  zapiClientToken: string
): Promise<WhatsAppSendResult> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    const response = await fetch(
      `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiClientToken || '',
        },
        body: JSON.stringify({
          phone: formattedPhone,
          message: message,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: JSON.stringify(result), zapiResponse: result };
    }

    return { success: true, zapiResponse: result };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// Render template with variables - logs warnings for missing variables
function renderTemplate(
  template: { title?: string | null; body: string },
  variables: Record<string, string | undefined>
): { title: string; body: string } {
  let title = template.title || '';
  let body = template.body;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    const safeValue = value || '';
    title = title.replace(regex, safeValue);
    body = body.replace(regex, safeValue);
  }

  // Log warning for any remaining unsubstituted variables
  const remainingVars = [...(title.match(/\{[^}]+\}/g) || []), ...(body.match(/\{[^}]+\}/g) || [])];
  if (remainingVars.length > 0) {
    console.warn('Template has unsubstituted variables:', remainingVars);
  }

  return { title, body };
}

Deno.serve(async (req) => {
  const corsHeaders = restrictedCors(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }

  // ETAPA 6A — C. INTERNAL/CRON: nenhuma chamada anônima executa este processador.
  const guard = await requireInternal(req);
  if (!guard.ok) {
    await logSecurityEvent({ eventType: 'processor_invocation_denied', fn: 'process-scheduled-booking-links' });
    return denied(guard, corsHeaders);
  });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const zapiToken = Deno.env.get('ZAPI_TOKEN');
  const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';

  if (!zapiInstanceId || !zapiToken) {
    console.error('ZAPI credentials not configured');
    return new Response(
      JSON.stringify({ error: 'ZAPI credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Processing scheduled booking links...');

    // Get pending booking invites using the RPC function
    const { data: pendingInvites, error: fetchError } = await supabase
      .rpc('get_pending_booking_invites');

    if (fetchError) {
      console.error('Error fetching pending invites:', fetchError);
      throw new Error('Failed to fetch pending booking invites');
    }

    if (!pendingInvites || pendingInvites.length === 0) {
      console.log('No pending booking invites to process');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending invites',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingInvites.length} pending invites to process`);

    const results: { clientId: string; status: string; error?: string }[] = [];
    const baseUrl = 'https://rogersfeitosa.com.br';

    for (const invite of pendingInvites) {
      try {
        // Check athlete WhatsApp settings
        const { data: athleteSettings } = await supabase
          .from('athlete_whatsapp_settings')
          .select('disabled_all, disabled_template_keys')
          .eq('client_id', invite.client_id)
          .maybeSingle();

        if (athleteSettings?.disabled_all) {
          console.log('WhatsApp disabled for athlete:', invite.client_id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: invite.admin_user_id,
            client_id: invite.client_id,
            message_type: 'weekly_booking_link',
            template_key: 'weekly_booking_link',
            to_phone: invite.client_phone || 'N/A',
            status: 'skipped',
            error_message: 'WhatsApp disabled for athlete',
            metadata: { reason: 'athlete_disabled' }
          });
          results.push({ clientId: invite.client_id, status: 'skipped', error: 'WhatsApp disabled' });
          continue;
        }

        if (athleteSettings?.disabled_template_keys?.includes('weekly_booking_link')) {
          console.log('weekly_booking_link disabled for athlete:', invite.client_id);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: invite.admin_user_id,
            client_id: invite.client_id,
            message_type: 'weekly_booking_link',
            template_key: 'weekly_booking_link',
            to_phone: invite.client_phone || 'N/A',
            status: 'skipped',
            error_message: 'Template disabled for athlete',
            metadata: { reason: 'template_disabled' }
          });
          results.push({ clientId: invite.client_id, status: 'skipped', error: 'Template disabled' });
          continue;
        }

        // Get or create booking link
        let { data: bookingLink } = await supabase
          .from('booking_links')
          .select('token')
          .eq('client_id', invite.client_id)
          .eq('active', true)
          .maybeSingle();

        if (!bookingLink) {
          const { data: newLink, error: linkError } = await supabase
            .from('booking_links')
            .insert({ client_id: invite.client_id })
            .select('token')
            .single();

          if (linkError) {
            console.error('Error creating booking link:', linkError);
            results.push({ clientId: invite.client_id, status: 'failed', error: 'Failed to create booking link' });
            continue;
          }
          bookingLink = newLink;
        }

        // ALWAYS fetch template from database - NO HARDCODE FALLBACK
        const { data: template } = await supabase
          .from('whatsapp_templates')
          .select('id, title, body, is_active, updated_at')
          .eq('user_id', invite.admin_user_id)
          .eq('template_key', 'weekly_booking_link')
          .maybeSingle() as { data: WhatsAppTemplate | null };

        // If no template or template is inactive, skip
        if (!template || !template.is_active) {
          console.log('Template weekly_booking_link not found or inactive');
          await supabase.from('whatsapp_message_logs').insert({
            user_id: invite.admin_user_id,
            client_id: invite.client_id,
            message_type: 'weekly_booking_link',
            template_key: 'weekly_booking_link',
            to_phone: invite.client_phone || 'N/A',
            status: 'skipped',
            error_message: template ? 'Template is inactive' : 'No template configured',
            metadata: { reason: template ? 'template_inactive' : 'no_template' }
          });
          results.push({ clientId: invite.client_id, status: 'skipped', error: template ? 'Template inactive' : 'No template' });
          continue;
        }

        // Resolve unified public link /agendar/{slug}?bt={token}
        const { data: adminSettings } = await supabase
          .from('scheduling_settings')
          .select('booking_link_slug')
          .eq('user_id', invite.admin_user_id)
          .maybeSingle();
        const bookingSlug: string | null = adminSettings?.booking_link_slug ?? null;
        const bookingUrl = bookingSlug
          ? `${baseUrl}/agendar/${bookingSlug}?bt=${bookingLink.token}`
          : `${baseUrl}/booking/${bookingLink.token}`;
        
        // Render the template with variables
        const rendered = renderTemplate(
          { title: template.title, body: template.body },
          {
            nome: invite.client_name.split(' ')[0],
            booking_link: bookingUrl,
            link: bookingUrl,
          }
        );

        // Build final message with title if available
        const finalMessage = rendered.title 
          ? `*${rendered.title}*\n\n${rendered.body}`
          : rendered.body;

        if (!invite.client_phone) {
          console.log(`No phone number for client ${invite.client_name}`);
          await supabase.from('whatsapp_message_logs').insert({
            user_id: invite.admin_user_id,
            client_id: invite.client_id,
            message_type: 'weekly_booking_link',
            template_key: 'weekly_booking_link',
            to_phone: 'N/A',
            status: 'skipped',
            error_message: 'No phone number',
            metadata: { reason: 'no_phone' }
          });
          results.push({ clientId: invite.client_id, status: 'skipped', error: 'No phone' });
          continue;
        }

        console.log(`Sending booking link to ${invite.client_name}`);
        console.log('Using template updated_at:', template.updated_at);

        const sendResult = await sendWhatsAppMessage(
          invite.client_phone,
          finalMessage,
          zapiInstanceId,
          zapiToken,
          zapiClientToken
        );

        await supabase.from('whatsapp_message_logs').insert({
          user_id: invite.admin_user_id,
          client_id: invite.client_id,
          message_type: 'weekly_booking_link',
          template_key: 'weekly_booking_link',
          to_phone: invite.client_phone,
          payload_preview: finalMessage.substring(0, 500),
          status: sendResult.success ? 'success' : 'failed',
          error_message: sendResult.error,
          metadata: { 
            zapi_response: sendResult.zapiResponse,
            template_id: template.id,
            template_updated_at: template.updated_at
          }
        });

        if (sendResult.success) {
          await supabase
            .from('consultation_schedule_rules')
            .update({ 
              last_link_sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('client_id', invite.client_id);

          await supabase
            .from('booking_links')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('token', bookingLink.token);

          results.push({ clientId: invite.client_id, status: 'success' });
          console.log(`Successfully sent booking invite to ${invite.client_name}`);
        } else {
          results.push({ clientId: invite.client_id, status: 'failed', error: sendResult.error });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing invite for ${invite.client_name}:`, error);
        results.push({ clientId: invite.client_id, status: 'failed', error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'failed').length;
    
    console.log(`Processing complete. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: pendingInvites.length,
      successCount,
      errorCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-scheduled-booking-links:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});