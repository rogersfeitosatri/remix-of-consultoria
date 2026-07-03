create table if not exists ai_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_key text not null,
  prompt_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, context_key)
);

alter table ai_prompts enable row level security;

create policy "Users can manage their own prompts"
  on ai_prompts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
