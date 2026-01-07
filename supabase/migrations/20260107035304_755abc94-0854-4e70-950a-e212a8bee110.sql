-- Banco de Perguntas Reutilizáveis
CREATE TABLE public.question_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  section TEXT NOT NULL DEFAULT 'Geral',
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  options JSONB,
  scale_min INTEGER DEFAULT 1,
  scale_max INTEGER DEFAULT 10,
  is_required BOOLEAN NOT NULL DEFAULT false,
  has_comment_field BOOLEAN NOT NULL DEFAULT false,
  comment_field_label TEXT DEFAULT 'Comentário adicional',
  comment_field_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own question templates"
  ON public.question_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own question templates"
  ON public.question_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own question templates"
  ON public.question_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own question templates"
  ON public.question_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_question_templates_updated_at
  BEFORE UPDATE ON public.question_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Perfil Completo do Atleta (dados estruturados)
CREATE TABLE public.athlete_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  
  -- Dados Pessoais
  full_name TEXT,
  birth_date DATE,
  gender TEXT,
  phone TEXT,
  city_state TEXT,
  
  -- Rotina e Trabalho
  profession TEXT,
  work_schedule TEXT,
  sedentary_work TEXT,
  hours_sitting TEXT,
  
  -- Histórico de Corrida
  practices_running TEXT,
  running_time TEXT,
  weekly_frequency TEXT,
  weekly_volume_km NUMERIC,
  races_participated TEXT,
  injury_history TEXT,
  
  -- Objetivos
  main_goal TEXT,
  secondary_goal TEXT,
  specific_target TEXT,
  target_deadline TEXT,
  
  -- Medidas
  current_weight NUMERIC,
  height NUMERIC,
  ideal_weight NUMERIC,
  max_weight NUMERIC,
  min_adult_weight NUMERIC,
  waist_circumference NUMERIC,
  hip_circumference NUMERIC,
  
  -- Sono e Estresse
  sleep_hours TEXT,
  sleep_quality TEXT,
  bedtime TEXT,
  wake_time TEXT,
  stress_level TEXT,
  stress_cause TEXT,
  
  -- Histórico de Dietas
  previous_diets TEXT,
  diet_types TEXT,
  diet_stop_reason TEXT,
  nutritional_followup TEXT,
  
  -- Suplementação
  uses_supplements TEXT,
  current_supplements TEXT,
  used_supplements_before TEXT,
  past_supplements TEXT,
  
  -- Intestinal
  intestinal_function TEXT,
  evacuation_frequency TEXT,
  intestinal_problems JSONB,
  intestinal_problems_other TEXT,
  
  -- Restrições
  food_allergies TEXT,
  lactose_intolerance TEXT,
  gluten_intolerance TEXT,
  religious_restrictions TEXT,
  disliked_foods TEXT,
  favorite_foods TEXT,
  
  -- Rotina Alimentar Estruturada
  meal_breakfast JSONB,
  meal_morning_snack JSONB,
  meal_morning_snack_enabled BOOLEAN DEFAULT false,
  meal_lunch JSONB,
  meal_afternoon_snack JSONB,
  meal_afternoon_snack_enabled BOOLEAN DEFAULT false,
  meal_dinner JSONB,
  meal_supper JSONB,
  meal_supper_enabled BOOLEAN DEFAULT false,
  weekend_changes TEXT,
  weekend_description TEXT,
  
  -- Metadados
  anamnese_submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin pode ver/editar perfis de seus clientes
CREATE POLICY "Admins can view athlete profiles of their clients"
  ON public.athlete_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = athlete_profiles.client_id 
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Admins can update athlete profiles of their clients"
  ON public.athlete_profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = athlete_profiles.client_id 
    AND clients.user_id = auth.uid()
  ));

-- Athletes can view their own profile
CREATE POLICY "Athletes can view their own profile"
  ON public.athlete_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = athlete_profiles.client_id 
    AND clients.athlete_user_id = auth.uid()
  ));

-- Service role can insert/update (for anamnese submission)
CREATE POLICY "Service role can insert athlete profiles"
  ON public.athlete_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Athletes can update their own profile"
  ON public.athlete_profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = athlete_profiles.client_id 
    AND clients.athlete_user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add new status value for clients
COMMENT ON COLUMN public.clients.athlete_status IS 'Status: pending_anamnese, anamnese_completed, ready_for_ai_analysis, active, inactive';