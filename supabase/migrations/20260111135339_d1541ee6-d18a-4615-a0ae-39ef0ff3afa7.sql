-- Drop the old constraint and add a new one with all valid categories
ALTER TABLE public.support_materials DROP CONSTRAINT IF EXISTS support_materials_category_check;

ALTER TABLE public.support_materials ADD CONSTRAINT support_materials_category_check 
CHECK (category IN ('onboarding', 'inicio', 'dieta', 'historico', 'materiais', 'material_suporte', 'desafio42', 'controle'));