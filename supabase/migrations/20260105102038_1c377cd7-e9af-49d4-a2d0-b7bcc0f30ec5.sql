-- Add comment attachment fields to checkin_questions
ALTER TABLE public.checkin_questions
ADD COLUMN has_comment_field boolean NOT NULL DEFAULT false,
ADD COLUMN comment_field_label text DEFAULT 'Se quiser explicar melhor, comente aqui',
ADD COLUMN comment_field_required boolean NOT NULL DEFAULT false,
ADD COLUMN comment_field_type text DEFAULT 'short' CHECK (comment_field_type IN ('short', 'medium'));