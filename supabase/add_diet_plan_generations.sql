-- ============================================
-- Diet Plan Generations History
-- Stores every generated diet plan instead of only the latest snapshot
-- Re-runnable
-- ============================================

create table if not exists public.diet_plan_generations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  content jsonb not null,
  input_params jsonb,
  provider text,
  feedback text,
  generation_mode text default 'fresh',
  created_at timestamptz default now()
);

alter table public.diet_plan_generations enable row level security;

drop policy if exists "Users can view own diet plan generations" on public.diet_plan_generations;
create policy "Users can view own diet plan generations"
  on public.diet_plan_generations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own diet plan generations" on public.diet_plan_generations;
create policy "Users can insert own diet plan generations"
  on public.diet_plan_generations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own diet plan generations" on public.diet_plan_generations;
create policy "Users can delete own diet plan generations"
  on public.diet_plan_generations for delete
  using (auth.uid() = user_id);

create index if not exists idx_diet_plan_generations_user_created
  on public.diet_plan_generations(user_id, created_at desc);
