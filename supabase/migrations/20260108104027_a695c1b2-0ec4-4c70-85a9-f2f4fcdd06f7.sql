-- Drop the old constraint and add updated one with "controle" category
ALTER TABLE public.support_materials DROP CONSTRAINT IF EXISTS support_materials_category_check;
ALTER TABLE public.support_materials ADD CONSTRAINT support_materials_category_check CHECK (category IN ('onboarding', 'dieta', 'material_suporte', 'controle'));