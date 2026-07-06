-- Peso manual do atleta, informado pelo nutri para o cálculo de g/kg do plano
-- alimentar quando não há anamnese nem check-in com peso.
alter table public.clients
  add column if not exists manual_weight_kg numeric;

comment on column public.clients.manual_weight_kg is
  'Peso (kg) informado manualmente pelo nutri para g/kg do plano quando não há anamnese/check-in com peso.';
