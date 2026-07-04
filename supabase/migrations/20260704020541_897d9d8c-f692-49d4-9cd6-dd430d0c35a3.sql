
create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default '',
  calories_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  fiber_per_100g numeric not null default 0,
  source text not null default 'taco',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.food_measures (
  id uuid primary key default gen_random_uuid(),
  food_item_id uuid not null references public.food_items(id) on delete cascade,
  measure_name text not null,
  measure_weight_g numeric not null,
  created_at timestamptz not null default now()
);

grant select on public.food_items to anon, authenticated;
grant insert, update on public.food_items to authenticated;
grant all on public.food_items to service_role;

grant select on public.food_measures to anon, authenticated;
grant insert on public.food_measures to authenticated;
grant all on public.food_measures to service_role;

create index if not exists idx_food_items_name on public.food_items using gin (to_tsvector('portuguese', name));
create index if not exists idx_food_items_category on public.food_items (category);
create index if not exists idx_food_items_source on public.food_items (source);
create index if not exists idx_food_measures_food_id on public.food_measures (food_item_id);

alter table public.food_items enable row level security;
alter table public.food_measures enable row level security;

do $$ begin
  create policy "Everyone can read food items" on public.food_items for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated users can insert custom foods" on public.food_items for insert
    with check (auth.uid() is not null and source = 'custom');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Users can update their own custom foods" on public.food_items for update
    using (auth.uid() = created_by);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Everyone can read food measures" on public.food_measures for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Authenticated users can insert measures for custom foods" on public.food_measures for insert
    with check (auth.uid() is not null);
exception when duplicate_object then null; end $$;

create or replace function public._seed_food(
  p_name text, p_category text,
  p_cal numeric, p_ptn numeric, p_cho numeric, p_fat numeric, p_fiber numeric,
  p_measures jsonb default '[]'
) returns void language plpgsql
set search_path = public
as $$
declare
  v_food_id uuid;
  m jsonb;
begin
  if exists (select 1 from public.food_items where name = p_name and source = 'taco') then
    return;
  end if;
  insert into public.food_items (name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source)
  values (p_name, p_category, p_cal, p_ptn, p_cho, p_fat, p_fiber, 'taco')
  returning id into v_food_id;

  for m in select * from jsonb_array_elements(p_measures) loop
    insert into public.food_measures (food_item_id, measure_name, measure_weight_g)
    values (v_food_id, m->>'n', (m->>'g')::numeric);
  end loop;

  insert into public.food_measures (food_item_id, measure_name, measure_weight_g)
  values (v_food_id, 'Gramas', 1);
end;
$$;

select public._seed_food('Arroz branco cozido', 'Cereais', 128, 2.5, 28.1, 0.2, 1.6,
  '[{"n":"Colher de sopa cheia","g":25},{"n":"Colher de servir cheia","g":55},{"n":"Xícara cheia","g":160},{"n":"Escumadeira média","g":90}]');
select public._seed_food('Arroz integral cozido', 'Cereais', 124, 2.6, 25.8, 1.0, 2.7,
  '[{"n":"Colher de sopa cheia","g":25},{"n":"Colher de servir cheia","g":55},{"n":"Xícara cheia","g":160}]');
select public._seed_food('Aveia em flocos', 'Cereais', 394, 13.9, 66.6, 8.5, 9.1,
  '[{"n":"Colher de sopa cheia","g":15},{"n":"Xícara cheia","g":80}]');
select public._seed_food('Pão francês', 'Cereais', 300, 8.0, 58.6, 3.1, 2.3,
  '[{"n":"Unidade (50g)","g":50}]');
select public._seed_food('Pão integral', 'Cereais', 253, 9.4, 49.9, 3.7, 6.9,
  '[{"n":"Fatia (25g)","g":25},{"n":"Fatia grossa (35g)","g":35}]');
select public._seed_food('Tapioca (goma hidratada)', 'Cereais', 345, 0.5, 84.5, 0.1, 0.5,
  '[{"n":"Colher de sopa cheia","g":20},{"n":"Porção (50g)","g":50}]');
select public._seed_food('Macarrão cozido', 'Cereais', 102, 3.4, 19.9, 0.6, 1.5,
  '[{"n":"Pegador cheio","g":110},{"n":"Xícara cheia","g":140},{"n":"Colher de servir cheia","g":65}]');
select public._seed_food('Batata doce cozida', 'Cereais', 77, 0.6, 18.4, 0.1, 2.2,
  '[{"n":"Unidade média (130g)","g":130},{"n":"Fatia grossa","g":50},{"n":"Colher de sopa cheia","g":40}]');
select public._seed_food('Batata inglesa cozida', 'Cereais', 52, 1.2, 11.9, 0.1, 1.3,
  '[{"n":"Unidade média (120g)","g":120},{"n":"Colher de sopa cheia","g":40}]');
select public._seed_food('Mandioca cozida', 'Cereais', 125, 0.6, 30.1, 0.3, 1.6,
  '[{"n":"Pedaço médio (60g)","g":60},{"n":"Colher de sopa cheia","g":40}]');
select public._seed_food('Inhame cozido', 'Cereais', 97, 2.0, 23.2, 0.1, 1.7,
  '[{"n":"Fatia média (50g)","g":50},{"n":"Pedaço médio (80g)","g":80}]');
select public._seed_food('Cuscuz de milho cozido', 'Cereais', 113, 2.6, 23.5, 0.5, 1.8,
  '[{"n":"Fatia média (80g)","g":80},{"n":"Colher de sopa cheia","g":35}]');
select public._seed_food('Granola', 'Cereais', 421, 10.7, 63.3, 15.2, 5.6,
  '[{"n":"Colher de sopa cheia","g":15},{"n":"Xícara cheia","g":60}]');
select public._seed_food('Farinha de aveia', 'Cereais', 388, 14.0, 65.7, 8.0, 9.0,
  '[{"n":"Colher de sopa cheia","g":12},{"n":"Xícara cheia","g":75}]');
select public._seed_food('Cream cracker', 'Cereais', 432, 10.0, 68.7, 13.6, 2.5,
  '[{"n":"Unidade","g":8},{"n":"Pacotinho (3 un)","g":24}]');
select public._seed_food('Torrada integral', 'Cereais', 374, 12.0, 62.0, 8.0, 7.0,
  '[{"n":"Unidade","g":8}]');
select public._seed_food('Farinha de mandioca', 'Cereais', 361, 1.6, 87.9, 0.3, 6.5,
  '[{"n":"Colher de sopa cheia","g":16}]');
select public._seed_food('Milho verde cozido', 'Cereais', 138, 6.6, 28.6, 1.3, 3.9,
  '[{"n":"Espiga média","g":100},{"n":"Colher de sopa cheia","g":25}]');

select public._seed_food('Frango peito grelhado', 'Carnes', 159, 32.0, 0, 2.5, 0, '[{"n":"Filé médio (120g)","g":120},{"n":"Fatia fina","g":30}]');
select public._seed_food('Frango coxa/sobrecoxa assada', 'Carnes', 215, 27.0, 0, 12.0, 0, '[{"n":"Unidade média (100g)","g":100}]');
select public._seed_food('Carne bovina patinho grelhado', 'Carnes', 219, 35.9, 0, 7.3, 0, '[{"n":"Bife médio (100g)","g":100},{"n":"Fatia fina","g":30}]');
select public._seed_food('Carne bovina alcatra grelhada', 'Carnes', 235, 32.4, 0, 11.0, 0, '[{"n":"Bife médio (100g)","g":100}]');
select public._seed_food('Carne bovina músculo cozido', 'Carnes', 191, 32.4, 0, 6.7, 0, '[{"n":"Pedaço médio (60g)","g":60},{"n":"Colher de sopa desfiado","g":30}]');
select public._seed_food('Carne moída refogada', 'Carnes', 212, 26.7, 0, 11.3, 0, '[{"n":"Colher de sopa cheia","g":25},{"n":"Concha média","g":80}]');
select public._seed_food('Tilápia grelhada', 'Carnes', 115, 24.0, 0, 2.0, 0, '[{"n":"Filé médio (120g)","g":120}]');
select public._seed_food('Salmão grelhado', 'Carnes', 208, 27.3, 0, 10.9, 0, '[{"n":"Filé médio (120g)","g":120},{"n":"Posta (100g)","g":100}]');
select public._seed_food('Atum em conserva (light)', 'Carnes', 109, 25.5, 0, 0.6, 0, '[{"n":"Lata drenada (120g)","g":120},{"n":"Colher de sopa","g":20}]');
select public._seed_food('Sardinha em conserva', 'Carnes', 214, 24.6, 0, 12.4, 0, '[{"n":"Unidade média","g":20},{"n":"Lata drenada (84g)","g":84}]');
select public._seed_food('Ovo inteiro cozido', 'Carnes', 146, 13.3, 0.6, 9.5, 0, '[{"n":"Unidade média (50g)","g":50}]');
select public._seed_food('Clara de ovo cozida', 'Carnes', 44, 9.7, 1.2, 0, 0, '[{"n":"Unidade (33g)","g":33}]');
select public._seed_food('Ovo mexido', 'Carnes', 170, 11.1, 1.6, 13.0, 0, '[{"n":"Colher de sopa cheia","g":30},{"n":"Unidade equivalente","g":60}]');
select public._seed_food('Carne suína lombo assado', 'Carnes', 210, 33.0, 0, 8.0, 0, '[{"n":"Fatia média (60g)","g":60}]');
select public._seed_food('Peru peito defumado', 'Carnes', 130, 19.0, 2.5, 4.5, 0, '[{"n":"Fatia fina (15g)","g":15}]');
select public._seed_food('Camarão cozido', 'Carnes', 90, 18.4, 0, 1.5, 0, '[{"n":"Unidade grande","g":15},{"n":"Xícara (100g)","g":100}]');

select public._seed_food('Feijão preto cozido', 'Leguminosas', 77, 4.5, 14.0, 0.5, 8.4, '[{"n":"Concha média cheia","g":80},{"n":"Colher de sopa cheia","g":25},{"n":"Concha pequena","g":50}]');
select public._seed_food('Feijão carioca cozido', 'Leguminosas', 76, 4.8, 13.6, 0.5, 8.5, '[{"n":"Concha média cheia","g":80},{"n":"Colher de sopa cheia","g":25}]');
select public._seed_food('Lentilha cozida', 'Leguminosas', 93, 6.3, 16.3, 0.5, 7.9, '[{"n":"Concha média cheia","g":80},{"n":"Colher de sopa cheia","g":25}]');
select public._seed_food('Grão de bico cozido', 'Leguminosas', 164, 8.9, 27.4, 2.6, 7.6, '[{"n":"Concha média cheia","g":80},{"n":"Colher de sopa cheia","g":25}]');
select public._seed_food('Ervilha cozida', 'Leguminosas', 63, 4.6, 10.5, 0.2, 6.3, '[{"n":"Colher de sopa cheia","g":20}]');
select public._seed_food('Soja cozida', 'Leguminosas', 151, 14.0, 8.6, 7.7, 5.6, '[{"n":"Colher de sopa cheia","g":25}]');

select public._seed_food('Leite integral', 'Laticínios', 61, 3.2, 4.3, 3.5, 0, '[{"n":"Copo (200ml)","g":200},{"n":"Xícara (240ml)","g":240},{"n":"Colher de sopa","g":15}]');
select public._seed_food('Leite desnatado', 'Laticínios', 35, 3.4, 5.0, 0.2, 0, '[{"n":"Copo (200ml)","g":200},{"n":"Xícara (240ml)","g":240}]');
select public._seed_food('Iogurte natural integral', 'Laticínios', 51, 4.1, 5.0, 1.6, 0, '[{"n":"Pote (170g)","g":170},{"n":"Colher de sopa cheia","g":20}]');
select public._seed_food('Iogurte natural desnatado', 'Laticínios', 40, 4.3, 5.5, 0.2, 0, '[{"n":"Pote (170g)","g":170},{"n":"Colher de sopa cheia","g":20}]');
select public._seed_food('Iogurte grego natural', 'Laticínios', 97, 9.0, 3.9, 5.0, 0, '[{"n":"Pote (100g)","g":100},{"n":"Colher de sopa cheia","g":20}]');
select public._seed_food('Queijo minas frescal', 'Laticínios', 264, 17.4, 3.2, 20.2, 0, '[{"n":"Fatia média (30g)","g":30},{"n":"Fatia fina (20g)","g":20}]');
select public._seed_food('Queijo cottage', 'Laticínios', 98, 11.5, 3.4, 4.3, 0, '[{"n":"Colher de sopa cheia","g":30},{"n":"Porção (50g)","g":50}]');
select public._seed_food('Queijo muçarela', 'Laticínios', 330, 22.6, 3.0, 25.2, 0, '[{"n":"Fatia média (20g)","g":20},{"n":"Fatia grossa (30g)","g":30}]');
select public._seed_food('Requeijão cremoso', 'Laticínios', 257, 6.3, 2.5, 24.5, 0, '[{"n":"Colher de sopa cheia","g":20},{"n":"Porção (30g)","g":30}]');
select public._seed_food('Requeijão light', 'Laticínios', 140, 8.0, 4.0, 10.0, 0, '[{"n":"Colher de sopa cheia","g":20}]');
select public._seed_food('Ricota fresca', 'Laticínios', 140, 12.6, 3.4, 8.1, 0, '[{"n":"Fatia média (30g)","g":30},{"n":"Colher de sopa cheia","g":25}]');
select public._seed_food('Creme de leite', 'Laticínios', 221, 2.0, 3.6, 22.5, 0, '[{"n":"Colher de sopa cheia","g":18}]');

select public._seed_food('Banana prata', 'Frutas', 98, 1.3, 26.0, 0.1, 2.0, '[{"n":"Unidade média (65g)","g":65},{"n":"Unidade grande (85g)","g":85}]');
select public._seed_food('Banana nanica', 'Frutas', 92, 1.4, 23.8, 0.1, 1.9, '[{"n":"Unidade média (70g)","g":70},{"n":"Unidade grande (100g)","g":100}]');
select public._seed_food('Maçã com casca', 'Frutas', 63, 0.3, 16.6, 0.1, 1.3, '[{"n":"Unidade média (130g)","g":130}]');
select public._seed_food('Laranja (suco)', 'Frutas', 37, 0.8, 8.9, 0.1, 0.1, '[{"n":"Copo (200ml)","g":200},{"n":"Unidade espremida (90ml)","g":90}]');
select public._seed_food('Laranja (fruta)', 'Frutas', 47, 1.0, 11.5, 0.1, 1.7, '[{"n":"Unidade média (135g)","g":135}]');
select public._seed_food('Mamão papaia', 'Frutas', 40, 0.5, 10.4, 0.1, 1.0, '[{"n":"Fatia média (150g)","g":150},{"n":"Unidade pequena (280g)","g":280}]');
select public._seed_food('Mamão formosa', 'Frutas', 45, 0.8, 11.6, 0.1, 1.8, '[{"n":"Fatia média (170g)","g":170}]');
select public._seed_food('Morango', 'Frutas', 30, 0.9, 6.8, 0.3, 1.7, '[{"n":"Unidade média","g":12},{"n":"Xícara (150g)","g":150}]');
select public._seed_food('Abacate', 'Frutas', 96, 1.2, 6.0, 8.4, 6.3, '[{"n":"Colher de sopa cheia","g":30},{"n":"Metade pequena (100g)","g":100}]');
select public._seed_food('Manga', 'Frutas', 64, 0.4, 16.7, 0.3, 1.6, '[{"n":"Fatia média (70g)","g":70},{"n":"Unidade média (200g)","g":200}]');
select public._seed_food('Melancia', 'Frutas', 33, 0.9, 8.1, 0, 0.1, '[{"n":"Fatia média (200g)","g":200},{"n":"Xícara picada (150g)","g":150}]');
select public._seed_food('Uva', 'Frutas', 53, 0.7, 13.7, 0.2, 0.9, '[{"n":"Cacho pequeno (100g)","g":100},{"n":"Unidade","g":5}]');
select public._seed_food('Kiwi', 'Frutas', 51, 1.3, 11.5, 0.6, 2.7, '[{"n":"Unidade média (75g)","g":75}]');
select public._seed_food('Abacaxi', 'Frutas', 48, 0.9, 12.3, 0.1, 1.0, '[{"n":"Fatia média (75g)","g":75},{"n":"Xícara picada (150g)","g":150}]');
select public._seed_food('Pera', 'Frutas', 53, 0.6, 14.0, 0.1, 3.0, '[{"n":"Unidade média (150g)","g":150}]');
select public._seed_food('Melão', 'Frutas', 29, 0.7, 7.5, 0, 0.3, '[{"n":"Fatia média (120g)","g":120}]');
select public._seed_food('Açaí (polpa pura)', 'Frutas', 58, 0.8, 6.2, 3.9, 2.6, '[{"n":"Tigela (200g)","g":200},{"n":"Colher de sopa cheia","g":20}]');
select public._seed_food('Goiaba', 'Frutas', 54, 1.1, 13.0, 0.4, 6.2, '[{"n":"Unidade média (140g)","g":140}]');
select public._seed_food('Maracujá (suco)', 'Frutas', 39, 0.4, 9.6, 0.1, 0.2, '[{"n":"Copo (200ml)","g":200}]');

select public._seed_food('Alface crespa', 'Vegetais', 11, 1.3, 1.7, 0.2, 1.8, '[{"n":"Folha média","g":8},{"n":"Porção (30g)","g":30},{"n":"Prato cheio (50g)","g":50}]');
select public._seed_food('Tomate', 'Vegetais', 15, 1.1, 3.1, 0.2, 1.2, '[{"n":"Unidade média (80g)","g":80},{"n":"Fatia (15g)","g":15}]');
select public._seed_food('Brócolis cozido', 'Vegetais', 25, 2.1, 4.4, 0.3, 3.4, '[{"n":"Colher de sopa cheia","g":20},{"n":"Ramo médio","g":30},{"n":"Xícara picado","g":80}]');
select public._seed_food('Couve refogada', 'Vegetais', 90, 2.9, 5.0, 7.3, 3.1, '[{"n":"Colher de sopa cheia","g":30},{"n":"Pegador cheio","g":60}]');
select public._seed_food('Cenoura crua', 'Vegetais', 34, 1.3, 7.7, 0.2, 3.2, '[{"n":"Unidade média (90g)","g":90},{"n":"Colher de sopa ralada","g":12}]');
select public._seed_food('Beterraba cozida', 'Vegetais', 32, 1.2, 7.2, 0.1, 1.9, '[{"n":"Fatia média (20g)","g":20},{"n":"Unidade média (80g)","g":80}]');
select public._seed_food('Pepino', 'Vegetais', 10, 0.7, 2.0, 0.1, 1.1, '[{"n":"Fatia (5g)","g":5},{"n":"Unidade média (130g)","g":130}]');
select public._seed_food('Abobrinha refogada', 'Vegetais', 18, 0.8, 2.8, 0.5, 1.0, '[{"n":"Colher de sopa cheia","g":30},{"n":"Fatia média","g":15}]');
select public._seed_food('Espinafre cozido', 'Vegetais', 16, 1.9, 1.5, 0.2, 2.1, '[{"n":"Colher de sopa cheia","g":25},{"n":"Xícara (100g)","g":100}]');
select public._seed_food('Rúcula', 'Vegetais', 16, 2.1, 2.2, 0.3, 1.6, '[{"n":"Porção (20g)","g":20},{"n":"Maço (50g)","g":50}]');
select public._seed_food('Cebola crua', 'Vegetais', 39, 1.7, 8.9, 0.1, 2.2, '[{"n":"Unidade média (80g)","g":80},{"n":"Colher de sopa picada","g":10}]');
select public._seed_food('Vagem cozida', 'Vegetais', 25, 1.6, 5.0, 0.1, 2.7, '[{"n":"Colher de sopa cheia","g":20},{"n":"Xícara (100g)","g":100}]');
select public._seed_food('Berinjela refogada', 'Vegetais', 30, 0.7, 3.2, 1.5, 2.5, '[{"n":"Colher de sopa cheia","g":30}]');
select public._seed_food('Repolho cru', 'Vegetais', 17, 0.9, 3.9, 0.1, 1.9, '[{"n":"Colher de sopa picado","g":10},{"n":"Xícara picado (70g)","g":70}]');
select public._seed_food('Couve-flor cozida', 'Vegetais', 19, 1.2, 3.4, 0.2, 2.1, '[{"n":"Ramo médio","g":30},{"n":"Xícara (100g)","g":100}]');
select public._seed_food('Abóbora cozida', 'Vegetais', 24, 0.7, 5.6, 0.1, 1.6, '[{"n":"Colher de sopa cheia","g":36},{"n":"Pedaço médio (60g)","g":60}]');

select public._seed_food('Azeite de oliva', 'Gorduras', 884, 0, 0, 100, 0, '[{"n":"Colher de sopa (13ml)","g":12},{"n":"Colher de chá (5ml)","g":4.5},{"n":"Fio (5ml)","g":4.5}]');
select public._seed_food('Óleo de coco', 'Gorduras', 862, 0, 0, 100, 0, '[{"n":"Colher de sopa","g":13},{"n":"Colher de chá","g":4.5}]');
select public._seed_food('Manteiga', 'Gorduras', 726, 0.8, 0.1, 81.1, 0, '[{"n":"Colher de chá","g":5},{"n":"Colher de sopa","g":12},{"n":"Ponta de faca","g":3}]');
select public._seed_food('Castanha do pará', 'Gorduras', 643, 14.5, 15.1, 63.5, 7.9, '[{"n":"Unidade","g":4}]');
select public._seed_food('Castanha de caju', 'Gorduras', 570, 18.5, 29.1, 46.3, 3.7, '[{"n":"Unidade","g":3},{"n":"Punhado (30g)","g":30}]');
select public._seed_food('Amendoim torrado', 'Gorduras', 606, 27.2, 12.5, 49.4, 8.0, '[{"n":"Colher de sopa cheia","g":15},{"n":"Punhado (30g)","g":30}]');
select public._seed_food('Amêndoa', 'Gorduras', 581, 18.6, 29.5, 47.3, 11.6, '[{"n":"Unidade","g":1.2},{"n":"Punhado (30g)","g":30}]');
select public._seed_food('Pasta de amendoim integral', 'Gorduras', 593, 23.7, 22.3, 46.1, 8.2, '[{"n":"Colher de sopa cheia","g":20},{"n":"Colher de chá","g":8}]');
select public._seed_food('Semente de chia', 'Gorduras', 486, 16.5, 42.1, 30.7, 34.4, '[{"n":"Colher de sopa cheia","g":12},{"n":"Colher de chá","g":4}]');
select public._seed_food('Semente de linhaça', 'Gorduras', 495, 14.1, 43.3, 32.3, 33.5, '[{"n":"Colher de sopa cheia","g":12},{"n":"Colher de chá","g":4}]');
select public._seed_food('Nozes', 'Gorduras', 620, 14.0, 18.0, 59.0, 5.0, '[{"n":"Unidade","g":5},{"n":"Punhado (30g)","g":30}]');
select public._seed_food('Abacate (como gordura)', 'Gorduras', 96, 1.2, 6.0, 8.4, 6.3, '[{"n":"Colher de sopa cheia","g":30}]');

select public._seed_food('Whey protein concentrado', 'Suplementos', 394, 75.0, 13.0, 5.0, 0, '[{"n":"Scoop (30g)","g":30},{"n":"Scoop duplo (60g)","g":60}]');
select public._seed_food('Whey protein isolado', 'Suplementos', 372, 86.0, 4.5, 1.5, 0, '[{"n":"Scoop (30g)","g":30}]');
select public._seed_food('Caseína', 'Suplementos', 370, 80.0, 5.0, 2.0, 0, '[{"n":"Scoop (30g)","g":30}]');
select public._seed_food('Maltodextrina', 'Suplementos', 380, 0, 95.0, 0, 0, '[{"n":"Colher de sopa cheia","g":20},{"n":"Scoop (40g)","g":40}]');
select public._seed_food('Albumina em pó', 'Suplementos', 381, 82.4, 5.3, 2.5, 0, '[{"n":"Colher de sopa cheia","g":10},{"n":"Scoop (30g)","g":30}]');
select public._seed_food('Creatina monohidratada', 'Suplementos', 0, 0, 0, 0, 0, '[{"n":"Colher de chá (5g)","g":5},{"n":"Scoop (3g)","g":3}]');
select public._seed_food('Dextrose', 'Suplementos', 400, 0, 100, 0, 0, '[{"n":"Colher de sopa cheia","g":20},{"n":"Scoop (40g)","g":40}]');
select public._seed_food('Palatinose', 'Suplementos', 400, 0, 100, 0, 0, '[{"n":"Colher de sopa cheia","g":15},{"n":"Scoop (30g)","g":30}]');
select public._seed_food('Proteína vegana (ervilha)', 'Suplementos', 370, 75.0, 8.0, 6.0, 3.0, '[{"n":"Scoop (30g)","g":30}]');

select public._seed_food('Mel', 'Outros', 309, 0.3, 84.0, 0, 0.2, '[{"n":"Colher de sopa cheia","g":21},{"n":"Colher de chá","g":7}]');
select public._seed_food('Açúcar refinado', 'Outros', 387, 0, 99.5, 0, 0, '[{"n":"Colher de chá","g":5},{"n":"Colher de sopa","g":14},{"n":"Sachê (5g)","g":5}]');
select public._seed_food('Açúcar demerara', 'Outros', 376, 0, 97.0, 0, 0, '[{"n":"Colher de chá","g":5},{"n":"Colher de sopa","g":14}]');
select public._seed_food('Geleia de frutas', 'Outros', 259, 0.3, 67.0, 0.1, 0.5, '[{"n":"Colher de sopa cheia","g":20},{"n":"Colher de chá","g":7}]');
select public._seed_food('Leite de coco', 'Outros', 175, 1.5, 2.5, 18.0, 0, '[{"n":"Colher de sopa","g":15},{"n":"Xícara (200ml)","g":200}]');
select public._seed_food('Coco ralado', 'Outros', 592, 5.4, 26.0, 52.0, 15.0, '[{"n":"Colher de sopa cheia","g":10}]');
select public._seed_food('Cacau em pó', 'Outros', 228, 19.0, 57.9, 13.7, 33.2, '[{"n":"Colher de sopa cheia","g":8},{"n":"Colher de chá","g":3}]');
select public._seed_food('Café (infusão)', 'Outros', 2, 0.3, 0, 0, 0, '[{"n":"Xícara (50ml)","g":50},{"n":"Copo (200ml)","g":200}]');
select public._seed_food('Água de coco', 'Outros', 22, 0, 5.3, 0, 0, '[{"n":"Copo (200ml)","g":200},{"n":"Caixinha (330ml)","g":330}]');
select public._seed_food('Suco de uva integral', 'Outros', 57, 0.2, 14.2, 0.1, 0, '[{"n":"Copo (200ml)","g":200}]');

drop function public._seed_food(text, text, numeric, numeric, numeric, numeric, numeric, jsonb);
