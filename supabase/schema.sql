-- ============================================
-- FoodLimit Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  dietary_preferences text[] default '{}',
  daily_calorie_goal integer default 2000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- GROCERY SESSIONS TABLE
-- ============================================
create table if not exists public.grocery_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_name text not null,
  session_date date default current_date,
  store_name text,
  total_spent numeric(10,2) default 0,
  total_calories numeric(10,1) default 0,
  total_items integer default 0,
  receipt_image_url text,
  notes text,
  created_at timestamptz default now()
);

alter table public.grocery_sessions enable row level security;

drop policy if exists "Users can view own sessions" on public.grocery_sessions;
create policy "Users can view own sessions"
  on public.grocery_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own sessions" on public.grocery_sessions;
create policy "Users can insert own sessions"
  on public.grocery_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own sessions" on public.grocery_sessions;
create policy "Users can update own sessions"
  on public.grocery_sessions for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own sessions" on public.grocery_sessions;
create policy "Users can delete own sessions"
  on public.grocery_sessions for delete
  using (auth.uid() = user_id);

-- ============================================
-- GROCERY ITEMS TABLE
-- ============================================
create table if not exists public.grocery_items (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.grocery_sessions on delete cascade not null,
  name text not null,
  quantity numeric(10,2) default 1,
  unit text default 'piece',
  price numeric(10,2) default 0,
  category text default 'Other',
  created_at timestamptz default now()
);

alter table public.grocery_items enable row level security;

drop policy if exists "Users can view own items" on public.grocery_items;
create policy "Users can view own items"
  on public.grocery_items for select
  using (
    exists (
      select 1 from public.grocery_sessions
      where grocery_sessions.id = grocery_items.session_id
      and grocery_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own items" on public.grocery_items;
create policy "Users can insert own items"
  on public.grocery_items for insert
  with check (
    exists (
      select 1 from public.grocery_sessions
      where grocery_sessions.id = grocery_items.session_id
      and grocery_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own items" on public.grocery_items;
create policy "Users can update own items"
  on public.grocery_items for update
  using (
    exists (
      select 1 from public.grocery_sessions
      where grocery_sessions.id = grocery_items.session_id
      and grocery_sessions.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own items" on public.grocery_items;
create policy "Users can delete own items"
  on public.grocery_items for delete
  using (
    exists (
      select 1 from public.grocery_sessions
      where grocery_sessions.id = grocery_items.session_id
      and grocery_sessions.user_id = auth.uid()
    )
  );

-- ============================================
-- NUTRITION DATA TABLE
-- ============================================
create table if not exists public.nutrition_data (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.grocery_items on delete cascade not null unique,
  -- Macronutrients (per serving)
  calories numeric(10,1) default 0,
  protein_g numeric(10,2) default 0,
  carbs_g numeric(10,2) default 0,
  fat_g numeric(10,2) default 0,
  fiber_g numeric(10,2) default 0,
  sugar_g numeric(10,2) default 0,
  -- Micronutrients
  sodium_mg numeric(10,2) default 0,
  potassium_mg numeric(10,2) default 0,
  calcium_mg numeric(10,2) default 0,
  iron_mg numeric(10,2) default 0,
  vitamin_a_mcg numeric(10,2) default 0,
  vitamin_c_mg numeric(10,2) default 0,
  vitamin_d_mcg numeric(10,2) default 0,
  vitamin_b12_mcg numeric(10,2) default 0,
  vitamin_e_mg numeric(10,2) default 0,
  vitamin_k_mcg numeric(10,2) default 0,
  zinc_mg numeric(10,2) default 0,
  magnesium_mg numeric(10,2) default 0,
  folate_mcg numeric(10,2) default 0,
  omega_3_mg numeric(10,2) default 0,
  created_at timestamptz default now()
);

alter table public.nutrition_data enable row level security;

drop policy if exists "Users can view own nutrition data" on public.nutrition_data;
create policy "Users can view own nutrition data"
  on public.nutrition_data for select
  using (
    exists (
      select 1 from public.grocery_items gi
      join public.grocery_sessions gs on gi.session_id = gs.id
      where gi.id = nutrition_data.item_id
      and gs.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own nutrition data" on public.nutrition_data;
create policy "Users can insert own nutrition data"
  on public.nutrition_data for insert
  with check (
    exists (
      select 1 from public.grocery_items gi
      join public.grocery_sessions gs on gi.session_id = gs.id
      where gi.id = nutrition_data.item_id
      and gs.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own nutrition data" on public.nutrition_data;
create policy "Users can update own nutrition data"
  on public.nutrition_data for update
  using (
    exists (
      select 1 from public.grocery_items gi
      join public.grocery_sessions gs on gi.session_id = gs.id
      where gi.id = nutrition_data.item_id
      and gs.user_id = auth.uid()
    )
  );

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_sessions_user_id on public.grocery_sessions(user_id);
create index if not exists idx_sessions_date on public.grocery_sessions(session_date);
create index if not exists idx_items_session_id on public.grocery_items(session_id);
create index if not exists idx_nutrition_item_id on public.nutrition_data(item_id);

-- ============================================
-- CONSUMED ITEMS TABLE
-- ============================================
create table if not exists public.consumed_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  consumed_on date default current_date not null,
  meal_type text default 'snack',
  name text not null,
  brand text,
  description text,
  barcode text,
  quantity numeric(10,2) default 1,
  serving_size numeric(10,2) default 1,
  serving_unit text default 'serving',
  category text default 'Other',
  source text default 'manual',
  ai_provider text,
  confidence text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.consumed_items enable row level security;

drop policy if exists "Users can view own consumed items" on public.consumed_items;
create policy "Users can view own consumed items"
  on public.consumed_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own consumed items" on public.consumed_items;
create policy "Users can insert own consumed items"
  on public.consumed_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own consumed items" on public.consumed_items;
create policy "Users can update own consumed items"
  on public.consumed_items for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own consumed items" on public.consumed_items;
create policy "Users can delete own consumed items"
  on public.consumed_items for delete
  using (auth.uid() = user_id);

-- ============================================
-- CONSUMED ITEM NUTRITION TABLE
-- ============================================
create table if not exists public.consumed_item_nutrition (
  id uuid default uuid_generate_v4() primary key,
  consumed_item_id uuid references public.consumed_items on delete cascade not null unique,
  calories numeric(10,1) default 0,
  protein_g numeric(10,2) default 0,
  carbs_g numeric(10,2) default 0,
  fat_g numeric(10,2) default 0,
  fiber_g numeric(10,2) default 0,
  sugar_g numeric(10,2) default 0,
  sodium_mg numeric(10,2) default 0,
  potassium_mg numeric(10,2) default 0,
  calcium_mg numeric(10,2) default 0,
  iron_mg numeric(10,2) default 0,
  vitamin_a_mcg numeric(10,2) default 0,
  vitamin_c_mg numeric(10,2) default 0,
  vitamin_d_mcg numeric(10,2) default 0,
  vitamin_b12_mcg numeric(10,2) default 0,
  vitamin_e_mg numeric(10,2) default 0,
  vitamin_k_mcg numeric(10,2) default 0,
  zinc_mg numeric(10,2) default 0,
  magnesium_mg numeric(10,2) default 0,
  folate_mcg numeric(10,2) default 0,
  omega_3_mg numeric(10,2) default 0,
  created_at timestamptz default now()
);

alter table public.consumed_item_nutrition enable row level security;

drop policy if exists "Users can view own consumed nutrition" on public.consumed_item_nutrition;
create policy "Users can view own consumed nutrition"
  on public.consumed_item_nutrition for select
  using (
    exists (
      select 1 from public.consumed_items ci
      where ci.id = consumed_item_nutrition.consumed_item_id
      and ci.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own consumed nutrition" on public.consumed_item_nutrition;
create policy "Users can insert own consumed nutrition"
  on public.consumed_item_nutrition for insert
  with check (
    exists (
      select 1 from public.consumed_items ci
      where ci.id = consumed_item_nutrition.consumed_item_id
      and ci.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own consumed nutrition" on public.consumed_item_nutrition;
create policy "Users can update own consumed nutrition"
  on public.consumed_item_nutrition for update
  using (
    exists (
      select 1 from public.consumed_items ci
      where ci.id = consumed_item_nutrition.consumed_item_id
      and ci.user_id = auth.uid()
    )
  );

create index if not exists idx_consumed_items_user_date on public.consumed_items(user_id, consumed_on desc);
create index if not exists idx_consumed_items_barcode on public.consumed_items(barcode);
create index if not exists idx_consumed_item_nutrition_item_id on public.consumed_item_nutrition(consumed_item_id);

-- ============================================
-- DIET PLAN GENERATIONS TABLE
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
