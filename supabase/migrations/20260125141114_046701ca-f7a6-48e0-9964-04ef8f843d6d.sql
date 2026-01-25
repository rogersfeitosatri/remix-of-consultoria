-- Create task_labels table for custom labels
CREATE TABLE public.task_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  due_date DATE,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_label_assignments junction table
CREATE TABLE public.task_label_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.task_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, label_id)
);

-- Enable RLS
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_label_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_labels
CREATE POLICY "Users can view their own labels" ON public.task_labels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own labels" ON public.task_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own labels" ON public.task_labels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own labels" ON public.task_labels FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for tasks
CREATE POLICY "Users can view their own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for task_label_assignments (based on task ownership)
CREATE POLICY "Users can view their task label assignments" ON public.task_label_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_id AND tasks.user_id = auth.uid())
);
CREATE POLICY "Users can create their task label assignments" ON public.task_label_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_id AND tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete their task label assignments" ON public.task_label_assignments FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_id AND tasks.user_id = auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();