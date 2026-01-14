
-- 1. Remover cron antigo de booking links que não funciona (usa SQL function em vez de HTTP)
SELECT cron.unschedule('send-weekly-booking-links');

-- 2. Criar cron usando extensions.http() para booking links (segunda 10h São Paulo = 13h UTC)
SELECT cron.schedule(
  'send-weekly-booking-links',
  '0 13 * * 1',
  $$
  SELECT extensions.http(
    (
      'POST',
      'https://vhzxnatgwravidvbehwi.supabase.co/functions/v1/process-scheduled-booking-links',
      ARRAY[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoenhuYXRnd3JhdmlkdmJlaHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTQ3NjMsImV4cCI6MjA4MzI5MDc2M30.yfr0oLbb7IRYPmt-x0rcwh5AfMWeaLjmwwj0EMRzS-8')
      ],
      'application/json',
      '{}'
    )::extensions.http_request
  );
  $$
);

-- 3. Adicionar novos templates de WhatsApp para checkin
INSERT INTO whatsapp_templates (user_id, template_key, template_name, body, variables, is_active, default_timing)
SELECT 
  id,
  'checkin_reminder',
  'Lembrete de Check-in',
  'Olá {nome}! 📋

É hora do seu check-in semanal! 

Responda o formulário para acompanharmos sua evolução:
{link_checkin}

Qualquer dúvida, estou por aqui! 💪',
  ARRAY['nome', 'link_checkin'],
  true,
  'Segunda 08:00'
FROM auth.users
WHERE id IN (SELECT DISTINCT user_id FROM clients WHERE is_active = true)
ON CONFLICT (user_id, template_key) DO NOTHING;

-- 4. Adicionar template de link semanal de agendamento
INSERT INTO whatsapp_templates (user_id, template_key, template_name, body, variables, is_active, default_timing)
SELECT 
  id,
  'weekly_booking_link',
  'Link Semanal de Agendamento',
  '📅 *Agende sua Consulta*

Olá {nome}!

Está na hora de agendar sua próxima consulta! 🎯

Escolha o melhor dia e horário:
🔗 {booking_link}

⏰ Este link é válido por 7 dias.

Qualquer dúvida, estou à disposição! 💪',
  ARRAY['nome', 'booking_link'],
  true,
  'Segunda 10:00'
FROM auth.users
WHERE id IN (SELECT DISTINCT user_id FROM clients WHERE is_active = true)
ON CONFLICT (user_id, template_key) DO NOTHING;

-- 5. Adicionar template de confirmação de consulta
INSERT INTO whatsapp_templates (user_id, template_key, template_name, body, variables, is_active, default_timing)
SELECT 
  id,
  'booking_confirmed',
  'Confirmação de Agendamento',
  '✅ *Consulta Confirmada!*

Olá {nome}!

Sua consulta foi agendada:
📅 Data: {data}
🕒 Horário: {hora}
🎥 Link: {meet_link}

Te aguardo! 🙂',
  ARRAY['nome', 'data', 'hora', 'meet_link'],
  true,
  'Imediato'
FROM auth.users
WHERE id IN (SELECT DISTINCT user_id FROM clients WHERE is_active = true)
ON CONFLICT (user_id, template_key) DO NOTHING;
