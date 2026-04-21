INSERT INTO public.whatsapp_templates (user_id, template_key, template_name, title, body, is_active, variables)
SELECT 
  ur.user_id,
  'booking_first_consultation',
  'Convite — Primeira Consulta',
  '🎯 Sua primeira consulta está chegando!',
  'Olá, {nome}! 👋

Que alegria ter você com a gente! Chegou a hora de marcarmos a sua *primeira consulta*.

📅 Acesse o link abaixo e escolha o melhor dia e horário:
{booking_link}

Se tiver qualquer dúvida, é só me chamar por aqui. Estou à disposição! 💪',
  true,
  ARRAY['nome','booking_link']::text[]
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_templates wt
    WHERE wt.user_id = ur.user_id AND wt.template_key = 'booking_first_consultation'
  );

INSERT INTO public.whatsapp_templates (user_id, template_key, template_name, title, body, is_active, variables)
SELECT 
  ur.user_id,
  'booking_followup_consultation',
  'Convite — Consulta de Acompanhamento',
  '📅 Hora de agendar sua próxima consulta',
  'Oi, {nome}! 👋

Chegou o momento da sua *próxima consulta de acompanhamento*.

📅 Escolha o melhor dia e horário no link abaixo:
{booking_link}

Vamos continuar evoluindo juntos! 🚀',
  true,
  ARRAY['nome','booking_link']::text[]
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.whatsapp_templates wt
    WHERE wt.user_id = ur.user_id AND wt.template_key = 'booking_followup_consultation'
  );