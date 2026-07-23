-- Registro dos contatos manuais ("dar um oi" quinzenal no WhatsApp) com cada
-- atleta ativo. Cada "Falei ✓" no dashboard grava uma linha aqui. A lista de
-- pendentes é derivada: quem não foi contatado nos últimos 14 dias reaparece.
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own client contacts"
  ON public.client_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert own client contacts"
  ON public.client_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own client contacts"
  ON public.client_contacts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_client_contacts_user_client_date
  ON public.client_contacts (user_id, client_id, contacted_at DESC);
