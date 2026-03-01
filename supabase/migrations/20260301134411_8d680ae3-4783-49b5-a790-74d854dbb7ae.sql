
-- Strategic Calls (forms)
CREATE TABLE public.strategic_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  closing_date TIMESTAMPTZ,
  page_title TEXT DEFAULT 'Aplicação – Call Estratégica para Maratonistas',
  page_text TEXT DEFAULT E'Se você está aqui é porque quer fazer essa maratona direito.\n\nE quando eu falo direito, eu falo de estratégia.\nNão é só treinar. É saber como usar o treino a seu favor.\n\nEssa call é para a gente sentar, olhar seu momento no ciclo e ajustar sua suplementação para os próximos longos.\n\nVer se você está usando gel na hora certa.\nSe está consumindo carbo suficiente.\nSe sua estratégia conversa com o volume que está rodando.\n\nEu vou ler pessoalmente cada aplicação.\n\nNão é uma call aberta para todo mundo.\nEu quero conversar com corredores que estão realmente comprometidos com a própria evolução.\n\nSe seu perfil estiver alinhado com essa proposta, minha equipe entra em contato pelo WhatsApp informado para agendarmos nas próximas 48 horas.\n\nNa call eu vou te orientar de forma prática.\nE, se fizer sentido para você, explico como funciona meu acompanhamento até a prova.\n\nPreencha com calma e sinceridade.\n\nA maratona cobra preparo.\nA estratégia começa aqui.',
  button_text TEXT DEFAULT 'Quero aplicar',
  button_color TEXT DEFAULT '#10b981',
  page_image_url TEXT,
  whatsapp_message TEXT DEFAULT E'Sua aplicação foi recebida.\n\nEu vou analisar pessoalmente suas respostas.\n\nSe o seu perfil estiver alinhado com o momento dessa seleção, minha equipe entrará em contato pelo WhatsApp informado para agendar a call nas próximas 48 horas.\n\nNos falamos em breve.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.strategic_calls ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_strategic_calls_slug ON public.strategic_calls(slug);

CREATE POLICY "Admin can manage own calls" ON public.strategic_calls
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can read active calls" ON public.strategic_calls
  FOR SELECT USING (status = 'active');

-- Questions
CREATE TABLE public.strategic_call_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.strategic_calls(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'short_text',
  field_name TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  options JSONB,
  score_map JSONB,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.strategic_call_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage questions" ON public.strategic_call_questions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.strategic_calls sc WHERE sc.id = call_id AND public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Public can read questions of active calls" ON public.strategic_call_questions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.strategic_calls sc WHERE sc.id = call_id AND sc.status = 'active'));

-- Responses (applications)
CREATE TABLE public.strategic_call_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.strategic_calls(id) ON DELETE CASCADE,
  respondent_name TEXT,
  respondent_email TEXT,
  respondent_phone TEXT,
  answers JSONB NOT NULL DEFAULT '{}',
  total_score INTEGER DEFAULT 0,
  classification TEXT DEFAULT 'medium',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  whatsapp_sent BOOLEAN DEFAULT false
);

ALTER TABLE public.strategic_call_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read responses" ON public.strategic_call_responses
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can submit responses" ON public.strategic_call_responses
  FOR INSERT WITH CHECK (true);

CREATE TRIGGER update_strategic_calls_updated_at
  BEFORE UPDATE ON public.strategic_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
