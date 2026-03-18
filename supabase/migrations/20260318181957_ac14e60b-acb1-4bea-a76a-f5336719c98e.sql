
-- Add task_type enum
CREATE TYPE public.task_type AS ENUM ('meal_plan', 'checkin_response', 'consultation_prep', 'diet_adjustment', 'custom');

-- Add task_status enum
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'done', 'overdue');

-- Add task_priority enum  
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Add task_source enum
CREATE TYPE public.task_source AS ENUM ('manual', 'auto_anamnese', 'auto_checkin', 'auto_consultation', 'auto_diet');

-- Add new columns to tasks table
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_type task_type NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS status task_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS source task_source NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type);
