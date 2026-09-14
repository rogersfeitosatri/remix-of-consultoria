-- User-approved copy update. No sends or cron activation.
INSERT INTO public.checkin_configuration_changes(reason,table_name,row_id,before_config)
SELECT 'Updated check-in WhatsApp copy; manual only','whatsapp_templates',id,to_jsonb(t)
FROM public.whatsapp_templates t WHERE user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b' AND template_key='checkin_reminder';
UPDATE public.whatsapp_templates SET title='📋 Seu check-in chegou!',body=$message$Olá, {nome}! Como você está? 😊

Vamos acompanhar como foi sua adaptação ao plano? Conte como estão sua alimentação, disposição e dificuldades para avaliarmos os próximos passos.

*👇 Responda por aqui:*
{link_checkin}

*🔑 Código de acesso:* {codigo_acesso}
*⏳ Prazo para responder:* {prazo_resposta}

Suas respostas ajudam a ajustar o acompanhamento à sua rotina. Conte comigo! 💪$message$,
variables=ARRAY['nome','link_checkin','codigo_acesso','prazo_resposta']::text[],updated_at=now()
WHERE user_id='c05878bf-0f7a-4d7f-8f96-7ca33c2d5a9b' AND template_key='checkin_reminder';

CREATE TABLE public.manual_booking_sends (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 client_id uuid NOT NULL REFERENCES public.clients(id),
 send_day date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Fortaleza')::date,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 provider_id text, error_code text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
ALTER TABLE public.manual_booking_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_booking_sends FROM anon,authenticated;
GRANT SELECT ON public.manual_booking_sends TO authenticated;
GRANT ALL ON public.manual_booking_sends TO service_role;
CREATE POLICY owner_read ON public.manual_booking_sends FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE UNIQUE INDEX manual_booking_daily ON public.manual_booking_sends(user_id,client_id,send_day) WHERE status IN ('pending','sent');
