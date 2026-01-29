-- =====================================================
-- RESUMO DO ATLETA - Migração de Banco de Dados
-- =====================================================

-- 1. Adicionar colunas para notas do admin na tabela clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS admin_summary TEXT,
ADD COLUMN IF NOT EXISTS admin_attention_points TEXT,
ADD COLUMN IF NOT EXISTS admin_next_focus TEXT,
ADD COLUMN IF NOT EXISTS admin_notes_short TEXT;

-- 2. Criar tabela de anexos do atleta
CREATE TABLE IF NOT EXISTS public.athlete_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  type_tag TEXT NOT NULL DEFAULT 'documento',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para athlete_attachments
CREATE INDEX IF NOT EXISTS idx_athlete_attachments_client_id ON public.athlete_attachments(client_id);
CREATE INDEX IF NOT EXISTS idx_athlete_attachments_user_id ON public.athlete_attachments(user_id);

-- RLS para athlete_attachments
ALTER TABLE public.athlete_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view attachments for their clients"
ON public.athlete_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = athlete_attachments.client_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert attachments for their clients"
ON public.athlete_attachments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = athlete_attachments.client_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can update attachments for their clients"
ON public.athlete_attachments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = athlete_attachments.client_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete attachments for their clients"
ON public.athlete_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = athlete_attachments.client_id
    AND c.user_id = auth.uid()
  )
);

-- 3. Criar tabela de audit logs para o resumo do atleta
CREATE TABLE IF NOT EXISTS public.athlete_summary_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para athlete_summary_audit_logs
CREATE INDEX IF NOT EXISTS idx_athlete_summary_audit_logs_client_id ON public.athlete_summary_audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_athlete_summary_audit_logs_admin_id ON public.athlete_summary_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_athlete_summary_audit_logs_created_at ON public.athlete_summary_audit_logs(created_at);

-- RLS para athlete_summary_audit_logs
ALTER TABLE public.athlete_summary_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs for their clients"
ON public.athlete_summary_audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = athlete_summary_audit_logs.client_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert audit logs"
ON public.athlete_summary_audit_logs
FOR INSERT
WITH CHECK (
  auth.uid() = admin_id
);

-- 4. Trigger para atualizar updated_at em athlete_attachments
CREATE TRIGGER update_athlete_attachments_updated_at
BEFORE UPDATE ON public.athlete_attachments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Criar bucket de storage para anexos de atletas (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('athlete-attachments', 'athlete-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para athlete-attachments
CREATE POLICY "Admins can upload athlete attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'athlete-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can view athlete attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'athlete-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can delete athlete attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'athlete-attachments' AND
  auth.uid() IS NOT NULL
);