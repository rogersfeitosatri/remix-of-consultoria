
-- Tabela para atividades do Desafio 42 (configurável pelo admin)
CREATE TABLE public.challenge_activities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para marcações semanais do atleta no Desafio 42
CREATE TABLE public.challenge_weekly_marks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.challenge_activities(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, activity_id, week_number)
);

-- Tabela para ciclos de controle diário do atleta
CREATE TABLE public.daily_control_cycles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para registros de peso/cintura do controle diário
CREATE TABLE public.daily_control_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cycle_id UUID NOT NULL REFERENCES public.daily_control_cycles(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    weight NUMERIC(5,2),
    waist_circumference NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(cycle_id, entry_date)
);

-- Enable RLS
ALTER TABLE public.challenge_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_weekly_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_control_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_control_entries ENABLE ROW LEVEL SECURITY;

-- Policies para challenge_activities (admin gerencia)
CREATE POLICY "Admin can manage challenge activities"
ON public.challenge_activities
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Athletes can view active challenge activities"
ON public.challenge_activities
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policies para challenge_weekly_marks (atleta marca suas atividades)
CREATE POLICY "Athletes can manage their own weekly marks"
ON public.challenge_weekly_marks
FOR ALL
TO authenticated
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE athlete_user_id = auth.uid()
    )
)
WITH CHECK (
    client_id IN (
        SELECT id FROM public.clients WHERE athlete_user_id = auth.uid()
    )
);

CREATE POLICY "Admin can view all weekly marks"
ON public.challenge_weekly_marks
FOR SELECT
TO authenticated
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);

-- Policies para daily_control_cycles
CREATE POLICY "Athletes can manage their own cycles"
ON public.daily_control_cycles
FOR ALL
TO authenticated
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE athlete_user_id = auth.uid()
    )
)
WITH CHECK (
    client_id IN (
        SELECT id FROM public.clients WHERE athlete_user_id = auth.uid()
    )
);

CREATE POLICY "Admin can view all cycles"
ON public.daily_control_cycles
FOR SELECT
TO authenticated
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);

-- Policies para daily_control_entries
CREATE POLICY "Athletes can manage their own entries"
ON public.daily_control_entries
FOR ALL
TO authenticated
USING (
    cycle_id IN (
        SELECT dc.id FROM public.daily_control_cycles dc
        JOIN public.clients c ON dc.client_id = c.id
        WHERE c.athlete_user_id = auth.uid()
    )
)
WITH CHECK (
    cycle_id IN (
        SELECT dc.id FROM public.daily_control_cycles dc
        JOIN public.clients c ON dc.client_id = c.id
        WHERE c.athlete_user_id = auth.uid()
    )
);

CREATE POLICY "Admin can view all entries"
ON public.daily_control_entries
FOR SELECT
TO authenticated
USING (
    cycle_id IN (
        SELECT dc.id FROM public.daily_control_cycles dc
        JOIN public.clients c ON dc.client_id = c.id
        WHERE c.user_id = auth.uid()
    )
);
