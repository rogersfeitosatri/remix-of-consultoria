INSERT INTO public.whatsapp_templates (user_id, template_key, template_name, title, body, is_active, variables)
SELECT 
  ur.user_id,
  'booking_followup_v1',
  'Reenvio — Lembrete de Agendamento',
  '⏰ Você ainda não agendou sua consulta',
  'Oi, {nome}! 👋

Notei que o link da sua consulta foi enviado há alguns dias e ainda não consegui ver seu agendamento.

📅 Para garantir o melhor horário, escolha agora mesmo:
{booking_link}

Se precisar de ajuda ou tiver qualquer dúvida, é só me chamar! 🙌',
  true,
  ARRAY['nome','booking_link']::text[]
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_templates wt
    WHERE wt.user_id = ur.user_id AND wt.template_key = 'booking_followup_v1'
  );