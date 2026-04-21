import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatPhoneAsAccessCode(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const withDDI = digits.startsWith('55') ? digits : `55${digits}`;
  if (withDDI.length === 13) {
    return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 9)}-${withDDI.slice(9)}`;
  } else if (withDDI.length === 12) {
    return `+${withDDI.slice(0, 2)} (${withDDI.slice(2, 4)}) ${withDDI.slice(4, 8)}-${withDDI.slice(8)}`;
  }
  return `+55 ${phone}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Authenticate the admin caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { dispatchId } = await req.json();
    if (!dispatchId) {
      return new Response(JSON.stringify({ error: 'dispatchId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch dispatch + relations
    const { data: dispatch, error: dErr } = await supabase
      .from('checkin_dispatches')
      .select(`
        *,
        clients:client_id (id, name, phone, user_id, is_active, is_frozen, end_date),
        checkin_forms:checkin_form_id (id, title, is_active),
        athlete_checkin_schedules:schedule_id (due_in_hours)
      `)
      .eq('id', dispatchId)
      .single();

    if (dErr || !dispatch) {
      return new Response(JSON.stringify({ error: 'Dispatch not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ownership check
    if (dispatch.user_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = (dispatch as any).clients;
    const form = (dispatch as any).checkin_forms;
    const sched = (dispatch as any).athlete_checkin_schedules;

    if (!client?.phone) {
      return new Response(JSON.stringify({ error: 'Atleta sem telefone cadastrado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!form?.is_active) {
      return new Response(JSON.stringify({ error: 'Formulário inativo' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (client.is_frozen || !client.is_active) {
      return new Response(JSON.stringify({ error: 'Atleta inativo ou congelado' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dueInHours = sched?.due_in_hours || 48;
    const now = new Date();
    const checkinLink = dispatch.link_checkin || `https://rogersfeitosa.com.br/form/${form.id}?client=${client.id}`;
    const codigoAcesso = formatPhoneAsAccessCode(client.phone);

    const { error: whatsappError } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        clientId: client.id,
        templateKey: 'checkin_reminder',
        context: {
          nome: client.name.split(' ')[0],
          link_checkin: checkinLink,
          checkin_link: checkinLink,
          codigo_acesso: codigoAcesso,
          prazo_resposta: `${dueInHours}h`,
        },
      },
    });

    if (whatsappError) {
      await supabase.from('checkin_dispatches').update({
        status: 'failed',
        error_message: `Reenvio falhou: ${whatsappError.message}`,
      }).eq('id', dispatchId);

      return new Response(JSON.stringify({ error: whatsappError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as sent and update timestamp
    await supabase.from('checkin_dispatches').update({
      status: 'sent',
      sent_at: now.toISOString(),
      error_message: null,
      link_checkin: checkinLink,
    }).eq('id', dispatchId);

    if (dispatch.schedule_id) {
      await supabase.from('athlete_checkin_schedules').update({
        last_dispatched_at: now.toISOString(),
      }).eq('id', dispatch.schedule_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[resend-checkin-dispatch] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
