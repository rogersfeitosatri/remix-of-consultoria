
-- 1) Desativar triggers automáticos
DROP TRIGGER IF EXISTS trg_auto_task_on_anamnese ON public.anamnese_responses;
DROP TRIGGER IF EXISTS trg_auto_task_on_checkin ON public.checkin_responses;

-- 2) Arquivar tarefas automáticas existentes (preserva histórico, limpa board)
UPDATE public.tasks
SET is_archived = true
WHERE source <> 'manual' AND is_archived = false;

-- 3) Campos de recorrência e XP
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_days int[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_interval int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS xp_reward int NOT NULL DEFAULT 10;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_recurrence_type_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_recurrence_type_check
  CHECK (recurrence_type IN ('none','daily','weekly','monthly'));

-- 4) Gamificação
CREATE TABLE IF NOT EXISTS public.task_gamification (
  user_id uuid PRIMARY KEY,
  total_xp int NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_completed_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_gamification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own gamification" ON public.task_gamification;
CREATE POLICY "Users view own gamification" ON public.task_gamification
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own gamification" ON public.task_gamification;
CREATE POLICY "Users insert own gamification" ON public.task_gamification
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own gamification" ON public.task_gamification;
CREATE POLICY "Users update own gamification" ON public.task_gamification
  FOR UPDATE USING (auth.uid() = user_id);

-- 5) Função: nível pelo XP (Bronze 1, Prata 2, Ouro 3, Diamante 4, Lendário 5)
CREATE OR REPLACE FUNCTION public.calc_task_level(p_xp int)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_xp >= 5000 THEN 5
    WHEN p_xp >= 2000 THEN 4
    WHEN p_xp >= 500  THEN 3
    WHEN p_xp >= 100  THEN 2
    ELSE 1
  END;
$$;

-- 6) Função: próxima data de uma recorrência
CREATE OR REPLACE FUNCTION public.next_recurrence_date(
  p_from date, p_type text, p_interval int, p_days int[], p_day_of_month int
) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_d date;
  v_dow int;
  i int;
BEGIN
  IF p_type = 'daily' THEN
    RETURN (p_from + (GREATEST(p_interval,1) || ' day')::interval)::date;
  ELSIF p_type = 'weekly' THEN
    IF p_days IS NULL OR array_length(p_days,1) IS NULL THEN
      RETURN (p_from + (7*GREATEST(p_interval,1) || ' day')::interval)::date;
    END IF;
    -- Procura o próximo dia da semana selecionado nos próximos 14 dias
    FOR i IN 1..14 LOOP
      v_d := p_from + (i || ' day')::interval;
      v_dow := EXTRACT(DOW FROM v_d)::int;
      IF v_dow = ANY(p_days) THEN
        RETURN v_d;
      END IF;
    END LOOP;
    RETURN (p_from + interval '7 day')::date;
  ELSIF p_type = 'monthly' THEN
    v_d := (p_from + (GREATEST(p_interval,1) || ' month')::interval)::date;
    IF p_day_of_month IS NOT NULL THEN
      v_d := date_trunc('month', v_d)::date + ((LEAST(p_day_of_month,28) - 1) || ' day')::interval;
    END IF;
    RETURN v_d::date;
  END IF;
  RETURN NULL;
END;
$$;

-- 7) Trigger: ao concluir tarefa, atualiza XP/streak e gera próxima ocorrência
CREATE OR REPLACE FUNCTION public.on_task_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Fortaleza')::date;
  v_g RECORD;
  v_new_xp int;
  v_new_streak int;
  v_next_date date;
BEGIN
  IF NEW.status = 'done' AND COALESCE(OLD.status,'') <> 'done' THEN
    -- gamificação
    INSERT INTO public.task_gamification(user_id) VALUES (NEW.user_id)
      ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_g FROM public.task_gamification WHERE user_id = NEW.user_id FOR UPDATE;

    v_new_xp := v_g.total_xp + COALESCE(NEW.xp_reward, 10);

    IF v_g.last_completed_date IS NULL THEN
      v_new_streak := 1;
    ELSIF v_g.last_completed_date = v_today THEN
      v_new_streak := v_g.current_streak;
    ELSIF v_g.last_completed_date = v_today - 1 THEN
      v_new_streak := v_g.current_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;

    UPDATE public.task_gamification
    SET total_xp = v_new_xp,
        level = public.calc_task_level(v_new_xp),
        current_streak = v_new_streak,
        longest_streak = GREATEST(v_g.longest_streak, v_new_streak),
        last_completed_date = v_today,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    -- recorrência: gera próxima ocorrência
    IF NEW.recurrence_type IS NOT NULL AND NEW.recurrence_type <> 'none' THEN
      v_next_date := public.next_recurrence_date(
        COALESCE(NEW.due_date, v_today),
        NEW.recurrence_type,
        NEW.recurrence_interval,
        NEW.recurrence_days,
        NEW.recurrence_day_of_month
      );
      IF v_next_date IS NOT NULL
         AND (NEW.recurrence_end_date IS NULL OR v_next_date <= NEW.recurrence_end_date) THEN
        INSERT INTO public.tasks(
          user_id, title, description, day_of_week, due_date, due_time,
          client_id, task_type, status, priority, source,
          recurrence_type, recurrence_days, recurrence_day_of_month,
          recurrence_interval, recurrence_end_date,
          parent_task_id, xp_reward
        ) VALUES (
          NEW.user_id, NEW.title, NEW.description,
          EXTRACT(DOW FROM v_next_date)::int, v_next_date, NEW.due_time,
          NEW.client_id, NEW.task_type, 'pending', NEW.priority, 'manual',
          NEW.recurrence_type, NEW.recurrence_days, NEW.recurrence_day_of_month,
          NEW.recurrence_interval, NEW.recurrence_end_date,
          COALESCE(NEW.parent_task_id, NEW.id), NEW.xp_reward
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_task_completed ON public.tasks;
CREATE TRIGGER trg_on_task_completed
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.on_task_completed();
