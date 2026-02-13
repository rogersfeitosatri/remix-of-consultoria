
-- Nutritional Periodization Module

-- Core consultation data per client
CREATE TABLE public.np_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  consultation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight NUMERIC,
  height NUMERIC,
  sport_modality TEXT,
  sport_goal TEXT,
  has_training_plan BOOLEAN DEFAULT false,
  skinfold_sum NUMERIC,
  fat_percentage NUMERIC,
  fat_kg NUMERIC,
  lean_mass_percentage NUMERIC,
  lean_mass_kg NUMERIC,
  tmb_formula TEXT DEFAULT 'harris_benedict_male',
  calorimetry_value NUMERIC,
  activity_factor NUMERIC DEFAULT 1.25,
  activity_factor_type TEXT DEFAULT 'manual',
  training_type TEXT DEFAULT 'running',
  vct_monday NUMERIC DEFAULT 0,
  vct_tuesday NUMERIC DEFAULT 0,
  vct_wednesday NUMERIC DEFAULT 0,
  vct_thursday NUMERIC DEFAULT 0,
  vct_friday NUMERIC DEFAULT 0,
  vct_saturday NUMERIC DEFAULT 0,
  vct_sunday NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_consultations" ON public.np_consultations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Body composition assessments
CREATE TABLE public.np_body_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.np_consultations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight NUMERIC,
  height NUMERIC,
  chest NUMERIC, waist NUMERIC, abdomen NUMERIC, hip NUMERIC,
  right_arm NUMERIC, left_arm NUMERIC, right_arm_contracted NUMERIC, forearm NUMERIC,
  right_thigh_max NUMERIC, left_thigh_max NUMERIC, right_calf NUMERIC, left_calf NUMERIC,
  triceps NUMERIC, subscapular NUMERIC, biceps NUMERIC, suprailiac NUMERIC,
  abdominal NUMERIC, thigh NUMERIC, calf NUMERIC,
  us_fat_percentage NUMERIC, us_lean_mass_percentage NUMERIC,
  us_fat_kg NUMERIC, us_lean_mass_kg NUMERIC,
  us_chest NUMERIC, us_subscapular NUMERIC, us_triceps NUMERIC, us_biceps NUMERIC,
  us_axillary NUMERIC, us_suprailiac NUMERIC, us_abdominal NUMERIC, us_thigh NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_body_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_body_assessments" ON public.np_body_assessments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Daily activities for FA calculation
CREATE TABLE public.np_daily_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.np_consultations(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  met_value NUMERIC NOT NULL DEFAULT 1,
  duration_hours NUMERIC NOT NULL DEFAULT 0,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_daily_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_daily_activities" ON public.np_daily_activities FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Running training zones per consultation
CREATE TABLE public.np_running_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.np_consultations(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  hr_zone TEXT,
  pace TEXT,
  speed_kmh TEXT,
  met_value NUMERIC NOT NULL DEFAULT 10,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_running_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_running_zones" ON public.np_running_zones FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Running training schedule
CREATE TABLE public.np_running_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.np_consultations(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.np_running_zones(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  duration_minutes NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_running_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_running_schedule" ON public.np_running_schedule FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Triathlon training schedule
CREATE TABLE public.np_triathlon_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.np_consultations(id) ON DELETE CASCADE,
  modality TEXT NOT NULL,
  intensity TEXT DEFAULT 'moderado',
  day_of_week INT NOT NULL,
  duration_minutes NUMERIC DEFAULT 0,
  met_value NUMERIC DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_triathlon_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_triathlon_schedule" ON public.np_triathlon_schedule FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Nutritional periodization weeks
CREATE TABLE public.np_periodization_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  cycle_start_date DATE,
  week_number INT NOT NULL,
  month_name TEXT,
  start_date DATE,
  end_date DATE,
  has_competition BOOLEAN DEFAULT false,
  competition_name TEXT,
  nutritional_plan TEXT,
  cho_percentage NUMERIC,
  protein_percentage NUMERIC,
  lipid_percentage NUMERIC,
  sup_creatine BOOLEAN DEFAULT false,
  sup_beta_alanine BOOLEAN DEFAULT false,
  sup_caffeine BOOLEAN DEFAULT false,
  sup_nitrate BOOLEAN DEFAULT false,
  sup_recovery BOOLEAN DEFAULT false,
  sup_omega3 BOOLEAN DEFAULT false,
  sup_cherry_pure BOOLEAN DEFAULT false,
  sup_curcumin BOOLEAN DEFAULT false,
  sup_bromelain BOOLEAN DEFAULT false,
  sup_ganoderma BOOLEAN DEFAULT false,
  sup_vitc_time_release BOOLEAN DEFAULT false,
  sup_vitd BOOLEAN DEFAULT false,
  sup_broncovaxon BOOLEAN DEFAULT false,
  sup_nac BOOLEAN DEFAULT false,
  supplement_notes TEXT,
  functional_supplements TEXT,
  lab_exam_request TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_periodization_weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_periodization_weeks" ON public.np_periodization_weeks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Lab exam results
CREATE TABLE public.np_lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  panel_name TEXT NOT NULL,
  collection_date DATE,
  exam_name TEXT NOT NULL,
  exam_category TEXT,
  result_value NUMERIC,
  result_text TEXT,
  unit TEXT,
  ref_min NUMERIC,
  ref_max NUMERIC,
  rcv_95 NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.np_lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages np_lab_results" ON public.np_lab_results FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_np_consultations_updated_at BEFORE UPDATE ON public.np_consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_np_periodization_weeks_updated_at BEFORE UPDATE ON public.np_periodization_weeks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
