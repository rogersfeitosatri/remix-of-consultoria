import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const nowUtc = new Date();
  // America/Fortaleza = UTC-3, no DST
  const fortNow = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
  const today = fortNow.toISOString().slice(0, 10);
  const nowMinutes = fortNow.getUTCHours() * 60 + fortNow.getUTCMinutes();

  // Window: ±2 minutes around expected reminder
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, user_id, title, description, due_date, due_time, reminder_minutes_before, reminder_method, reminder_sent_at, status')
    .eq('reminder_enabled', true)
    .eq('due_date', today)
    .neq('status', 'done')
    .is('reminder_sent_at', null)
    .not('due_time', 'is', null);

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let processed = 0;
  for (const t of tasks || []) {
    const [hh, mm] = (t.due_time as string).split(':').map(Number);
    const dueMinutes = hh * 60 + mm;
    const triggerMinutes = dueMinutes - (t.reminder_minutes_before || 0);
    if (Math.abs(nowMinutes - triggerMinutes) > 2) continue;

    const minsLeft = Math.max(0, dueMinutes - nowMinutes);
    const body = `⏰ Lembrete: "${t.title}"${t.due_time ? ` às ${(t.due_time as string).slice(0, 5)}` : ''}${minsLeft > 0 ? ` (em ${minsLeft} min)` : ''}`;

    // App notification
    if (t.reminder_method === 'app' || t.reminder_method === 'both') {
      await supabase.from('task_notifications').insert({
        user_id: t.user_id,
        task_id: t.id,
        title: 'Lembrete de tarefa',
        body,
      });
    }

    // WhatsApp
    if (t.reminder_method === 'whatsapp' || t.reminder_method === 'both') {
      const { data: prof } = await supabase
        .from('admin_settings')
        .select('admin_whatsapp_number')
        .eq('user_id', t.user_id)
        .maybeSingle();
      const phone = (prof as any)?.admin_whatsapp_number;
      if (phone) {
        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: { phone, message: body },
          });
        } catch (e) {
          console.error('whatsapp error', e);
        }
      }
    }

    await supabase.from('tasks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', t.id);
    processed++;
  }

  return new Response(JSON.stringify({ processed, checked: tasks?.length ?? 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
