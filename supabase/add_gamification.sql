-- ============================================
-- GAMIFICATION SCHEMA
-- Achievements, challenges, streaks, levels
-- ============================================

-- ============================================
-- GAMIFICATION ACHIEVEMENTS TABLE
-- ============================================
create table if not exists public.gamification_achievements (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  achievement_id text not null, -- e.g., 'first_pound', 'week_warrior', etc.
  category text not null check (category in ('weight_loss', 'streaks', 'nutrition', 'social', 'challenges', 'special')),
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  points_awarded integer not null default 0,
  xp_awarded integer not null default 0,
  metadata jsonb, -- Additional data like "pounds lost: 5"
  unlocked_at timestamptz default now(),
  created_at timestamptz default now(),
  
  constraint unique_user_achievement unique (user_id, achievement_id)
);

alter table public.gamification_achievements enable row level security;

drop policy if exists "Users can view own achievements" on public.gamification_achievements;
create policy "Users can view own achievements"
  on public.gamification_achievements for select
  using (auth.uid() = user_id);

-- Friends can view each other's achievements (if privacy allows)
drop policy if exists "Friends can view achievements" on public.gamification_achievements;
create policy "Friends can view achievements"
  on public.gamification_achievements for select
  using (
    exists (
      select 1 from public.friendships f
      join public.privacy_settings ps on ps.user_id = gamification_achievements.user_id
      where f.status = 'accepted'
        and ps.share_achievements = true
        and ((f.user_id = auth.uid() and f.friend_id = gamification_achievements.user_id)
         or (f.friend_id = auth.uid() and f.user_id = gamification_achievements.user_id))
    )
  );

drop policy if exists "Users can insert own achievements" on public.gamification_achievements;
create policy "Users can insert own achievements"
  on public.gamification_achievements for insert
  with check (auth.uid() = user_id);

create index if not exists idx_achievements_user on public.gamification_achievements(user_id, unlocked_at desc);
create index if not exists idx_achievements_category on public.gamification_achievements(category);

-- ============================================
-- USER STATS TABLE (Points, XP, Levels, Streaks)
-- ============================================
create table if not exists public.user_stats (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  
  -- Points and levels
  total_points integer default 0,
  total_xp integer default 0,
  level integer default 1,
  level_title text default 'Wellness Wanderer',
  
  -- Streaks
  tracking_streak_current integer default 0,
  tracking_streak_best integer default 0,
  tracking_streak_last_date date,
  
  calorie_goal_streak_current integer default 0,
  calorie_goal_streak_best integer default 0,
  calorie_goal_streak_last_date date,
  
  weigh_in_streak_current integer default 0,
  weigh_in_streak_best integer default 0,
  weigh_in_streak_last_date date,
  
  -- Challenge stats
  challenges_completed integer default 0,
  challenges_won integer default 0,
  challenges_lost integer default 0,
  current_win_streak integer default 0,
  best_win_streak integer default 0,
  
  -- Activity stats
  total_meals_logged integer default 0,
  total_weigh_ins integer default 0,
  days_active integer default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_stats enable row level security;

drop policy if exists "Users can view own stats" on public.user_stats;
create policy "Users can view own stats"
  on public.user_stats for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own stats" on public.user_stats;
create policy "Users can update own stats"
  on public.user_stats for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own stats" on public.user_stats;
create policy "Users can insert own stats"
  on public.user_stats for insert
  with check (auth.uid() = user_id);

-- Friends can view stats (if privacy allows)
drop policy if exists "Friends can view stats" on public.user_stats;
create policy "Friends can view stats"
  on public.user_stats for select
  using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = user_stats.user_id)
         or (f.friend_id = auth.uid() and f.user_id = user_stats.user_id))
    )
  );

-- ============================================
-- CHALLENGES TABLE
-- ============================================
create table if not exists public.challenges (
  id uuid default uuid_generate_v4() primary key,
  creator_user_id uuid references auth.users on delete cascade not null,
  challenge_type text not null check (challenge_type in ('solo', 'head_to_head', 'group', 'daily')),
  
  name text not null,
  description text,
  
  -- Goal configuration
  goal_metric text not null check (goal_metric in ('weight_loss', 'calorie_streak', 'meals_logged', 'step_count', 'workout_days', 'protein_goal')),
  target_value numeric,
  
  -- Timing
  start_date timestamptz not null,
  end_date timestamptz not null,
  duration_days integer generated always as (extract(day from (end_date - start_date))) stored,
  
  -- Stakes (optional, for fun)
  stakes text,
  
  -- Status
  status text default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  
  -- Winner (for completed challenges)
  winner_user_id uuid references auth.users on delete set null,
  
  -- Metadata for daily challenges
  metadata jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.challenges enable row level security;

-- ============================================
-- CHALLENGE PARTICIPANTS TABLE
-- ============================================
create table if not exists public.challenge_participants (
  id uuid default uuid_generate_v4() primary key,
  challenge_id uuid references public.challenges on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  
  -- Status
  invitation_status text default 'pending' check (invitation_status in ('pending', 'accepted', 'declined')),
  
  -- Progress tracking
  current_progress numeric default 0,
  starting_value numeric, -- e.g., starting weight for weight loss challenge
  current_value numeric,
  rank integer,
  
  -- Timestamps
  invited_at timestamptz default now(),
  accepted_at timestamptz,
  
  constraint unique_challenge_participant unique (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;

drop policy if exists "Users can view challenge participants" on public.challenge_participants;
create policy "Users can view challenge participants"
  on public.challenge_participants for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and (c.creator_user_id = auth.uid()
         or exists (
           select 1 from public.challenge_participants cp2
           where cp2.challenge_id = c.id
             and cp2.user_id = auth.uid()
         ))
    )
  );

drop policy if exists "Users can update own participation" on public.challenge_participants;
create policy "Users can update own participation"
  on public.challenge_participants for update
  using (auth.uid() = user_id);

drop policy if exists "Users can insert participation" on public.challenge_participants;
create policy "Users can insert participation"
  on public.challenge_participants for insert
  with check (true); -- Creator can add participants

create index if not exists idx_participants_challenge on public.challenge_participants(challenge_id, rank);
create index if not exists idx_participants_user on public.challenge_participants(user_id, invitation_status);

-- ============================================
-- CHALLENGE POLICIES (Created after tables exist)
-- ============================================

-- Users can view challenges they're part of
drop policy if exists "Users can view own challenges" on public.challenges;
create policy "Users can view own challenges"
  on public.challenges for select
  using (
    creator_user_id = auth.uid()
    or exists (
      select 1 from public.challenge_participants cp
      where cp.challenge_id = challenges.id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create challenges" on public.challenges;
create policy "Users can create challenges"
  on public.challenges for insert
  with check (auth.uid() = creator_user_id);

drop policy if exists "Users can update own challenges" on public.challenges;
create policy "Users can update own challenges"
  on public.challenges for update
  using (auth.uid() = creator_user_id);

create index if not exists idx_challenges_creator on public.challenges(creator_user_id, status);
create index if not exists idx_challenges_status on public.challenges(status, end_date);

-- ============================================
-- DAILY NUTRITION SUMMARY TABLE
-- ============================================
create table if not exists public.daily_nutrition_summary (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  summary_date date not null,
  
  -- Totals
  total_calories numeric(10,1) default 0,
  total_protein_g numeric(10,2) default 0,
  total_carbs_g numeric(10,2) default 0,
  total_fat_g numeric(10,2) default 0,
  total_fiber_g numeric(10,2) default 0,
  
  -- Goals
  calorie_goal integer,
  protein_goal_g integer,
  carbs_goal_g integer,
  fat_goal_g integer,
  
  -- Performance
  calorie_deficit_surplus numeric(10,1), -- negative = deficit, positive = surplus
  met_calorie_goal boolean default false,
  met_protein_goal boolean default false,
  
  -- Activity
  meals_logged integer default 0,
  
  -- Streak tracking
  is_streak_day boolean default false,
  consecutive_days integer default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint unique_user_date unique (user_id, summary_date)
);

alter table public.daily_nutrition_summary enable row level security;

drop policy if exists "Users can view own summaries" on public.daily_nutrition_summary;
create policy "Users can view own summaries"
  on public.daily_nutrition_summary for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own summaries" on public.daily_nutrition_summary;
create policy "Users can insert own summaries"
  on public.daily_nutrition_summary for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own summaries" on public.daily_nutrition_summary;
create policy "Users can update own summaries"
  on public.daily_nutrition_summary for update
  using (auth.uid() = user_id);

create index if not exists idx_daily_summary_user_date on public.daily_nutrition_summary(user_id, summary_date desc);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate user level from XP
create or replace function calculate_level(xp integer)
returns jsonb as $$
declare
  v_level integer;
  v_title text;
  v_xp_for_next integer;
  v_xp_for_current integer;
begin
  -- Level thresholds
  v_level := case
    when xp < 100 then 1
    when xp < 250 then 2
    when xp < 500 then 3
    when xp < 800 then 4
    when xp < 1200 then 5
    when xp < 1700 then 6
    when xp < 2300 then 7
    when xp < 3000 then 8
    when xp < 3800 then 9
    when xp < 4700 then 10
    when xp < 5700 then 11
    when xp < 6800 then 12
    when xp < 8000 then 13
    when xp < 9300 then 14
    when xp < 10700 then 15
    when xp < 12200 then 16
    when xp < 13800 then 17
    when xp < 15500 then 18
    when xp < 17300 then 19
    else 20
  end;
  
  -- Level titles
  v_title := case
    when v_level <= 2 then 'Wellness Wanderer'
    when v_level <= 4 then 'Health Hunter'
    when v_level <= 6 then 'Calorie Conqueror'
    when v_level <= 9 then 'Macro Master'
    when v_level <= 12 then 'Weight Loss Warrior'
    when v_level <= 14 then 'Fitness Fighter'
    when v_level <= 16 then 'Transformation Titan'
    when v_level <= 19 then 'Goals Guru'
    else 'Wellness Wizard'
  end;
  
  -- XP thresholds
  v_xp_for_current := case v_level
    when 1 then 0 when 2 then 100 when 3 then 250 when 4 then 500
    when 5 then 1200 when 6 then 1700 when 7 then 2300 when 8 then 3000
    when 9 then 3800 when 10 then 4700 when 11 then 5700 when 12 then 6800
    when 13 then 8000 when 14 then 9300 when 15 then 10700 when 16 then 12200
    when 17 then 13800 when 18 then 15500 when 19 then 17300 else 20000
  end;
  
  v_xp_for_next := case v_level
    when 1 then 100 when 2 then 250 when 3 then 500 when 4 then 800
    when 5 then 1700 when 6 then 2300 when 7 then 3000 when 8 then 3800
    when 9 then 4700 when 10 then 5700 when 11 then 6800 when 12 then 8000
    when 13 then 9300 when 14 then 10700 when 15 then 12200 when 16 then 13800
    when 17 then 15500 when 18 then 17300 when 19 then 20000 else 99999
  end;
  
  return jsonb_build_object(
    'level', v_level,
    'title', v_title,
    'current_xp', xp,
    'xp_for_current_level', v_xp_for_current,
    'xp_for_next_level', v_xp_for_next,
    'xp_progress', xp - v_xp_for_current,
    'xp_needed', v_xp_for_next - xp
  );
end;
$$ language plpgsql immutable;

-- Function to award achievement
create or replace function award_achievement(
  p_user_id uuid,
  p_achievement_id text,
  p_category text,
  p_tier text,
  p_points integer,
  p_xp integer,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid as $$
declare
  v_achievement_uuid uuid;
  v_new_xp integer;
  v_old_level integer;
  v_new_level integer;
begin
  -- Check if achievement already exists
  if exists (
    select 1 from public.gamification_achievements
    where user_id = p_user_id and achievement_id = p_achievement_id
  ) then
    return null; -- Already awarded
  end if;
  
  -- Insert achievement
  insert into public.gamification_achievements (
    user_id, achievement_id, category, tier, points_awarded, xp_awarded, metadata
  )
  values (
    p_user_id, p_achievement_id, p_category, p_tier, p_points, p_xp, p_metadata
  )
  returning id into v_achievement_uuid;
  
  -- Update user stats
  update public.user_stats
  set 
    total_points = total_points + p_points,
    total_xp = total_xp + p_xp,
    updated_at = now()
  where user_id = p_user_id
  returning total_xp into v_new_xp;
  
  -- Check for level up
  select level into v_old_level
  from public.user_stats
  where user_id = p_user_id;
  
  v_new_level := (calculate_level(v_new_xp)->>'level')::integer;
  
  if v_new_level > v_old_level then
    update public.user_stats
    set 
      level = v_new_level,
      level_title = calculate_level(v_new_xp)->>'title'
    where user_id = p_user_id;
    
    -- Create level-up notification
    insert into public.notifications (user_id, notification_type, title, message)
    values (
      p_user_id,
      'milestone',
      'Level Up!',
      'You reached level ' || v_new_level || ': ' || (calculate_level(v_new_xp)->>'title')
    );
  end if;
  
  -- Create achievement notification
  insert into public.notifications (user_id, notification_type, title, message, related_achievement_id)
  values (
    p_user_id,
    'achievement_unlocked',
    'Achievement Unlocked!',
    'You earned: ' || p_achievement_id,
    p_achievement_id
  );
  
  -- Post to social feed if user allows
  insert into public.social_feed (user_id, post_type, title, content, related_achievement_id)
  select 
    p_user_id,
    'achievement',
    'Achievement Unlocked! 🏆',
    jsonb_build_object(
      'achievement_id', p_achievement_id,
      'tier', p_tier,
      'category', p_category,
      'metadata', p_metadata
    ),
    p_achievement_id
  where exists (
    select 1 from public.privacy_settings
    where user_id = p_user_id and share_achievements = true
  );
  
  return v_achievement_uuid;
end;
$$ language plpgsql security definer;

-- Function to update streak
create or replace function update_streak(
  p_user_id uuid,
  p_streak_type text, -- 'tracking', 'calorie_goal', 'weigh_in'
  p_success boolean,
  p_date date default current_date
)
returns void as $$
declare
  v_current_streak integer;
  v_last_date date;
  v_new_streak integer;
begin
  -- Get current streak and last date
  execute format(
    'select %I_current, %I_last_date from public.user_stats where user_id = $1',
    p_streak_type || '_streak',
    p_streak_type || '_streak'
  ) using p_user_id
  into v_current_streak, v_last_date;
  
  -- Calculate new streak
  if p_success then
    if v_last_date is null or v_last_date < p_date - interval '1 day' then
      -- First time or broke streak
      v_new_streak := 1;
    elsif v_last_date = p_date - interval '1 day' then
      -- Continuing streak
      v_new_streak := v_current_streak + 1;
    else
      -- Same day, don't change
      return;
    end if;
    
    -- Update streak
    execute format(
      'update public.user_stats set %I_current = $1, %I_last_date = $2, %I_best = greatest(%I_best, $1), updated_at = now() where user_id = $3',
      p_streak_type || '_streak',
      p_streak_type || '_streak',
      p_streak_type || '_streak',
      p_streak_type || '_streak'
    ) using v_new_streak, p_date, p_user_id;
    
    -- Check for streak achievements
    if p_streak_type = 'tracking' then
      if v_new_streak = 7 then
        perform award_achievement(p_user_id, 'week_warrior', 'streaks', 'bronze', 50, 100);
      elsif v_new_streak = 30 then
        perform award_achievement(p_user_id, 'monthly_master', 'streaks', 'gold', 200, 500);
      end if;
    end if;
  else
    -- Reset streak
    execute format(
      'update public.user_stats set %I_current = 0, updated_at = now() where user_id = $1',
      p_streak_type || '_streak'
    ) using p_user_id;
  end if;
end;
$$ language plpgsql security definer;

-- Auto-create user stats for new users
create or replace function create_user_stats()
returns trigger as $$
begin
  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_user_created_stats on auth.users;
create trigger on_user_created_stats
  after insert on auth.users
  for each row execute procedure create_user_stats();
