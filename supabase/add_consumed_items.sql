-- Daily consumed item logging
create extension if not exists "uuid-ossp";

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
