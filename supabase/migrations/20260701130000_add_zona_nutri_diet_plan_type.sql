-- Add 'zona_nutri_diet' to the plan_type CHECK constraint on clients table
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_plan_type_check;
ALTER TABLE clients ADD CONSTRAINT clients_plan_type_check
  CHECK (plan_type = ANY (ARRAY['consultoria'::text, 'premium'::text, 'zona_nutri_diet'::text]));
