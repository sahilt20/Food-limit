-- ============================================
-- Add Family Members Table
-- Run this in your Supabase SQL Editor
-- ============================================

create table if not exists public.family_members (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  age integer not null,
  gender text not null,
  weight_kg numeric(5,1) not null,
  height_cm numeric(5,1) not null,
  activity_level text not null default 'sedentary',
  bmi numeric(5,1) generated always as (
    case when height_cm > 0 then (weight_kg / ((height_cm / 100.0) * (height_cm / 100.0))) else 0 end
  ) stored,
  daily_calorie_goal integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.family_members enable row level security;

create policy "Users can view own family members"
  on public.family_members for select
  using (auth.uid() = user_id);

create policy "Users can insert own family members"
  on public.family_members for insert
  with check (auth.uid() = user_id);

create policy "Users can update own family members"
  on public.family_members for update
  using (auth.uid() = user_id);

create policy "Users can delete own family members"
  on public.family_members for delete
  using (auth.uid() = user_id);

create index if not exists idx_family_members_user_id on public.family_members(user_id);
