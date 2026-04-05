-- ============================================
-- WEIGHT TRACKING SCHEMA
-- Add weight loss and goal tracking features
-- ============================================

-- ============================================
-- WEIGHT LOGS TABLE
-- ============================================
create table if not exists public.weight_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  weight_kg numeric(5,2) not null,
  body_fat_percentage numeric(4,2),
  muscle_mass_kg numeric(5,2),
  bmi numeric(4,2),
  mood text check (mood in ('great', 'good', 'okay', 'struggling', 'bad')),
  energy_level integer check (energy_level between 1 and 5),
  notes text,
  photo_url text,
  logged_at timestamptz default now() not null,
  created_at timestamptz default now()
);

alter table public.weight_logs enable row level security;

drop policy if exists "Users can view own weight logs" on public.weight_logs;
create policy "Users can view own weight logs"
  on public.weight_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own weight logs" on public.weight_logs;
create policy "Users can insert own weight logs"
  on public.weight_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own weight logs" on public.weight_logs;
create policy "Users can update own weight logs"
  on public.weight_logs for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own weight logs" on public.weight_logs;
create policy "Users can delete own weight logs"
  on public.weight_logs for delete
  using (auth.uid() = user_id);

-- Index for efficient queries
create index if not exists idx_weight_logs_user_date on public.weight_logs(user_id, logged_at desc);

-- ============================================
-- WEIGHT GOALS TABLE
-- ============================================
create table if not exists public.weight_goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  goal_type text not null check (goal_type in ('lose', 'gain', 'maintain', 'recomposition')),
  start_weight_kg numeric(5,2) not null,
  current_weight_kg numeric(5,2),
  target_weight_kg numeric(5,2) not null,
  target_date date,
  weekly_goal_kg numeric(4,2),
  daily_calorie_goal integer not null,
  daily_protein_goal_g integer,
  daily_carbs_goal_g integer,
  daily_fat_goal_g integer,
  strategy text check (strategy in ('calorie_deficit', 'calorie_surplus', 'balanced', 'low_carb', 'keto', 'high_protein', 'intermittent_fasting')),
  activity_level text check (activity_level in ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')),
  status text default 'active' check (status in ('active', 'paused', 'completed', 'abandoned')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.weight_goals enable row level security;

drop policy if exists "Users can view own weight goals" on public.weight_goals;
create policy "Users can view own weight goals"
  on public.weight_goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own weight goals" on public.weight_goals;
create policy "Users can insert own weight goals"
  on public.weight_goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own weight goals" on public.weight_goals;
create policy "Users can update own weight goals"
  on public.weight_goals for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own weight goals" on public.weight_goals;
create policy "Users can delete own weight goals"
  on public.weight_goals for delete
  using (auth.uid() = user_id);

-- Index for active goals
create index if not exists idx_weight_goals_user_status on public.weight_goals(user_id, status);

-- ============================================
-- UPDATE PROFILES TABLE
-- ============================================
-- Add weight tracking fields to existing profiles table
alter table public.profiles add column if not exists height_cm integer;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say'));
alter table public.profiles add column if not exists weight_unit text default 'kg' check (weight_unit in ('kg', 'lbs'));
alter table public.profiles add column if not exists gamification_mode text default 'supportive' check (gamification_mode in ('supportive', 'competitive'));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate BMI
create or replace function calculate_bmi(weight_kg numeric, height_cm integer)
returns numeric as $$
begin
  if height_cm is null or height_cm <= 0 then
    return null;
  end if;
  return round((weight_kg / ((height_cm / 100.0) ^ 2))::numeric, 2);
end;
$$ language plpgsql immutable;

-- Function to get latest weight for a user
create or replace function get_latest_weight(p_user_id uuid)
returns numeric as $$
declare
  latest_weight numeric;
begin
  select weight_kg into latest_weight
  from public.weight_logs
  where user_id = p_user_id
  order by logged_at desc
  limit 1;
  
  return latest_weight;
end;
$$ language plpgsql security definer;

-- Function to calculate weight progress
create or replace function calculate_weight_progress(p_user_id uuid)
returns jsonb as $$
declare
  result jsonb;
  v_start_weight numeric;
  v_current_weight numeric;
  v_target_weight numeric;
  v_weight_lost numeric;
  v_weight_to_go numeric;
  v_progress_percent numeric;
begin
  -- Get active goal
  select start_weight_kg, current_weight_kg, target_weight_kg
  into v_start_weight, v_current_weight, v_target_weight
  from public.weight_goals
  where user_id = p_user_id and status = 'active'
  order by started_at desc
  limit 1;
  
  if v_start_weight is null then
    return jsonb_build_object('error', 'No active goal found');
  end if;
  
  -- Get latest weight if current_weight not set
  if v_current_weight is null then
    v_current_weight := get_latest_weight(p_user_id);
  end if;
  
  -- Calculate progress
  v_weight_lost := v_start_weight - v_current_weight;
  v_weight_to_go := v_current_weight - v_target_weight;
  v_progress_percent := round(((v_weight_lost / (v_start_weight - v_target_weight)) * 100)::numeric, 1);
  
  result := jsonb_build_object(
    'start_weight_kg', v_start_weight,
    'current_weight_kg', v_current_weight,
    'target_weight_kg', v_target_weight,
    'weight_lost_kg', v_weight_lost,
    'weight_to_go_kg', v_weight_to_go,
    'progress_percent', v_progress_percent
  );
  
  return result;
end;
$$ language plpgsql security definer;

-- Trigger to update current_weight in goals when new weight logged
create or replace function update_goal_current_weight()
returns trigger as $$
begin
  update public.weight_goals
  set current_weight_kg = new.weight_kg,
      updated_at = now()
  where user_id = new.user_id
    and status = 'active';
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists weight_log_update_goal on public.weight_logs;
create trigger weight_log_update_goal
  after insert on public.weight_logs
  for each row execute function update_goal_current_weight();

-- ============================================
-- VIEWS FOR CONVENIENCE
-- ============================================

-- View for user's weight progress
create or replace view user_weight_progress as
select 
  wg.user_id,
  wg.id as goal_id,
  wg.goal_type,
  wg.start_weight_kg,
  wg.current_weight_kg,
  wg.target_weight_kg,
  wg.target_date,
  wg.daily_calorie_goal,
  wg.status,
  (wg.start_weight_kg - wg.current_weight_kg) as weight_lost_kg,
  (wg.current_weight_kg - wg.target_weight_kg) as weight_to_go_kg,
  round(((wg.start_weight_kg - wg.current_weight_kg) / 
         nullif(wg.start_weight_kg - wg.target_weight_kg, 0) * 100)::numeric, 1) as progress_percent,
  (select count(*) from public.weight_logs wl where wl.user_id = wg.user_id) as total_weigh_ins,
  (select weight_kg from public.weight_logs wl 
   where wl.user_id = wg.user_id 
   order by logged_at desc limit 1) as latest_weight_kg,
  (select logged_at from public.weight_logs wl 
   where wl.user_id = wg.user_id 
   order by logged_at desc limit 1) as last_weigh_in
from public.weight_goals wg
where wg.status = 'active';

comment on view user_weight_progress is 'Consolidated view of user weight progress with calculations';
