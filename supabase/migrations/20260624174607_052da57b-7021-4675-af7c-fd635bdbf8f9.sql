
-- 1) Settings (singleton per trainer user_id)
CREATE TABLE public.ai_chat_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  model TEXT NOT NULL DEFAULT 'openai/gpt-5-mini',
  system_prompt TEXT NOT NULL DEFAULT 'Você é a assistente virtual de nutrição do atleta, parte da equipe do nutricionista Rogers Feitosa. Responda SEMPRE com base exclusivamente nas informações do plano, anamnese e check-ins do atleta fornecidos no contexto. Nunca altere o plano alimentar. Se o atleta pedir mudanças, sintomas clínicos, dores ou dúvidas fora do escopo nutricional, responda: "Vou avisar o Rogers para olhar isso com calma, ok? Em breve ele retorna." Tom amigável, direto, motivador. Português do Brasil.',
  escalation_keywords TEXT[] NOT NULL DEFAULT ARRAY['dor','passando mal','tontura','vômito','vomito','desmaio','trocar plano','mudar plano','cancelar','tristeza','ansiedade','não consigo','desisti','medico','médico','hospital','urgência','urgencia'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_settings TO authenticated;
GRANT ALL ON public.ai_chat_settings TO service_role;
ALTER TABLE public.ai_chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages settings" ON public.ai_chat_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) Conversation per client
CREATE TABLE public.ai_chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);
CREATE INDEX ai_chat_conv_phone_idx ON public.ai_chat_conversations(phone_e164);
CREATE INDEX ai_chat_conv_user_idx ON public.ai_chat_conversations(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_conversations TO authenticated;
GRANT ALL ON public.ai_chat_conversations TO service_role;
ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads convs" ON public.ai_chat_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3) Messages
CREATE TABLE public.ai_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  wa_message_id TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  model TEXT,
  escalated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_chat_msg_conv_idx ON public.ai_chat_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_messages TO service_role;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads msgs" ON public.ai_chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4) Escalations (Centro de Ações)
CREATE TABLE public.ai_chat_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.ai_chat_messages(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_chat_esc_user_status_idx ON public.ai_chat_escalations(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_escalations TO authenticated;
GRANT ALL ON public.ai_chat_escalations TO service_role;
ALTER TABLE public.ai_chat_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads esc" ON public.ai_chat_escalations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "owner updates esc" ON public.ai_chat_escalations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5) Per-athlete toggle
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ai_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;
