-- Table for Kiwify purchases (webhook data)
CREATE TABLE public.kiwify_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  product_id TEXT,
  product_name TEXT,
  order_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'approved',
  purchase_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  webhook_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kiwify_purchases ENABLE ROW LEVEL SECURITY;

-- Only admins can view purchases
CREATE POLICY "Admins can view all purchases"
ON public.kiwify_purchases
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow public insert for webhook (will be secured by webhook secret)
CREATE POLICY "Allow webhook inserts"
ON public.kiwify_purchases
FOR INSERT
WITH CHECK (true);

-- Create index on email for faster lookups
CREATE INDEX idx_kiwify_purchases_email ON public.kiwify_purchases(email);

-- Anamnese forms table
CREATE TABLE public.anamnese_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnese_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own anamnese forms"
ON public.anamnese_forms
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own anamnese forms"
ON public.anamnese_forms
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own anamnese forms"
ON public.anamnese_forms
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own anamnese forms"
ON public.anamnese_forms
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active anamnese forms"
ON public.anamnese_forms
FOR SELECT
USING (is_active = true);

-- Anamnese questions table
CREATE TABLE public.anamnese_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.anamnese_forms(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'Geral',
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options JSONB,
  scale_min INTEGER DEFAULT 1,
  scale_max INTEGER DEFAULT 10,
  is_required BOOLEAN NOT NULL DEFAULT false,
  has_comment_field BOOLEAN NOT NULL DEFAULT false,
  comment_field_label TEXT DEFAULT 'Comentário adicional',
  comment_field_required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnese_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questions of their forms"
ON public.anamnese_questions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_questions.form_id
  AND anamnese_forms.user_id = auth.uid()
));

CREATE POLICY "Users can insert questions to their forms"
ON public.anamnese_questions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_questions.form_id
  AND anamnese_forms.user_id = auth.uid()
));

CREATE POLICY "Users can update questions of their forms"
ON public.anamnese_questions
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_questions.form_id
  AND anamnese_forms.user_id = auth.uid()
));

CREATE POLICY "Users can delete questions of their forms"
ON public.anamnese_questions
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_questions.form_id
  AND anamnese_forms.user_id = auth.uid()
));

CREATE POLICY "Anyone can view questions of active forms"
ON public.anamnese_questions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_questions.form_id
  AND anamnese_forms.is_active = true
));

-- Anamnese responses table
CREATE TABLE public.anamnese_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.anamnese_forms(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  responses JSONB NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ai_analysis JSONB,
  ai_analyzed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.anamnese_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Form owners can view responses"
ON public.anamnese_responses
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_responses.form_id
  AND anamnese_forms.user_id = auth.uid()
));

CREATE POLICY "Athletes can view their own responses"
ON public.anamnese_responses
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clients
  WHERE clients.id = anamnese_responses.client_id
  AND clients.athlete_user_id = auth.uid()
));

CREATE POLICY "Anyone can submit anamnese responses"
ON public.anamnese_responses
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_responses.form_id
  AND anamnese_forms.is_active = true
));

-- Form owners can update responses (for AI analysis)
CREATE POLICY "Form owners can update responses"
ON public.anamnese_responses
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.anamnese_forms
  WHERE anamnese_forms.id = anamnese_responses.form_id
  AND anamnese_forms.user_id = auth.uid()
));

-- Add athlete status column to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS athlete_status TEXT DEFAULT 'pending_anamnese';

-- Add trigger for updated_at on anamnese_forms
CREATE TRIGGER update_anamnese_forms_updated_at
BEFORE UPDATE ON public.anamnese_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();