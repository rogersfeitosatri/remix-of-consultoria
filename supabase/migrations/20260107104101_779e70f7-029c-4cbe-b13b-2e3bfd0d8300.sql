-- Table to store AI analysis of check-in responses
CREATE TABLE public.checkin_ai_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_response_id UUID NOT NULL REFERENCES public.checkin_responses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  weekly_summary TEXT NOT NULL,
  evolution_trend TEXT NOT NULL,
  alerts TEXT[] DEFAULT '{}',
  suggested_feedback TEXT NOT NULL,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  raw_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store admin feedback (with approval workflow)
CREATE TABLE public.checkin_feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkin_response_id UUID NOT NULL REFERENCES public.checkin_responses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ai_analysis_id UUID REFERENCES public.checkin_ai_analyses(id) ON DELETE SET NULL,
  suggested_feedback TEXT,
  final_feedback TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent')),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_via TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checkin_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_feedbacks ENABLE ROW LEVEL SECURITY;

-- RLS policies for checkin_ai_analyses - admins can manage
CREATE POLICY "Admins can view all checkin analyses" 
ON public.checkin_ai_analyses 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can insert checkin analyses" 
ON public.checkin_ai_analyses 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update checkin analyses" 
ON public.checkin_ai_analyses 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS policies for checkin_feedbacks - admins can manage
CREATE POLICY "Admins can view all feedbacks" 
ON public.checkin_feedbacks 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can insert feedbacks" 
ON public.checkin_feedbacks 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update feedbacks" 
ON public.checkin_feedbacks 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Triggers for updated_at
CREATE TRIGGER update_checkin_ai_analyses_updated_at
BEFORE UPDATE ON public.checkin_ai_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checkin_feedbacks_updated_at
BEFORE UPDATE ON public.checkin_feedbacks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_checkin_ai_analyses_client_id ON public.checkin_ai_analyses(client_id);
CREATE INDEX idx_checkin_ai_analyses_checkin_response_id ON public.checkin_ai_analyses(checkin_response_id);
CREATE INDEX idx_checkin_feedbacks_client_id ON public.checkin_feedbacks(client_id);
CREATE INDEX idx_checkin_feedbacks_status ON public.checkin_feedbacks(status);