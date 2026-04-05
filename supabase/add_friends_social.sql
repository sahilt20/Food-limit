-- ============================================
-- FRIENDS & SOCIAL SCHEMA
-- Add friend connections and social features
-- ============================================

-- ============================================
-- FRIENDS/FRIENDSHIPS TABLE
-- ============================================
create table if not exists public.friendships (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  friend_id uuid references auth.users on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  requested_by uuid references auth.users on delete cascade not null,
  requested_at timestamptz default now(),
  responded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Ensure unique friendship pairs (bidirectional)
  constraint unique_friendship unique (user_id, friend_id),
  constraint no_self_friendship check (user_id != friend_id)
);

alter table public.friendships enable row level security;

-- Users can view friendships they're part of
drop policy if exists "Users can view own friendships" on public.friendships;
create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Users can create friendship requests
drop policy if exists "Users can create friendships" on public.friendships;
create policy "Users can create friendships"
  on public.friendships for insert
  with check (auth.uid() = user_id and auth.uid() = requested_by);

-- Users can update friendships they're part of
drop policy if exists "Users can update friendships" on public.friendships;
create policy "Users can update friendships"
  on public.friendships for update
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Users can delete friendships they're part of
drop policy if exists "Users can delete friendships" on public.friendships;
create policy "Users can delete friendships"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Indexes
create index if not exists idx_friendships_user on public.friendships(user_id, status);
create index if not exists idx_friendships_friend on public.friendships(friend_id, status);
create index if not exists idx_friendships_status on public.friendships(status);

-- ============================================
-- PRIVACY SETTINGS TABLE
-- ============================================
create table if not exists public.privacy_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  
  -- What to share
  share_weight boolean default true,
  share_weight_goal boolean default true,
  share_weight_progress boolean default true,
  share_current_weight_value boolean default false, -- Actual number
  share_calories boolean default true,
  share_calorie_details boolean default false, -- Specific meals
  share_macros boolean default true,
  share_achievements boolean default true,
  share_body_photos boolean default false,
  share_meal_photos boolean default false,
  
  -- Social features
  show_in_leaderboards boolean default true,
  allow_challenge_invites boolean default true,
  allow_friend_requests boolean default true,
  show_online_status boolean default true,
  
  -- Visibility mode
  profile_visibility text default 'friends' check (profile_visibility in ('public', 'friends', 'private')),
  
  -- Notifications
  notify_friend_requests boolean default true,
  notify_friend_achievements boolean default true,
  notify_challenge_invites boolean default true,
  notify_challenge_updates boolean default true,
  notify_being_overtaken boolean default false,
  notify_encouragement boolean default true,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.privacy_settings enable row level security;

drop policy if exists "Users can view own privacy settings" on public.privacy_settings;
create policy "Users can view own privacy settings"
  on public.privacy_settings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own privacy settings" on public.privacy_settings;
create policy "Users can insert own privacy settings"
  on public.privacy_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own privacy settings" on public.privacy_settings;
create policy "Users can update own privacy settings"
  on public.privacy_settings for update
  using (auth.uid() = user_id);

-- ============================================
-- SOCIAL FEED TABLE
-- ============================================
create table if not exists public.social_feed (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  post_type text not null check (post_type in ('achievement', 'milestone', 'progress_update', 'challenge_start', 'challenge_complete', 'goal_reached', 'streak_milestone', 'custom')),
  
  -- Content
  title text,
  content jsonb not null,
  visibility text default 'friends' check (visibility in ('public', 'friends', 'private')),
  
  -- Engagement
  reactions jsonb default '{"heart": 0, "fire": 0, "muscle": 0, "party": 0}'::jsonb,
  comment_count integer default 0,
  
  -- Metadata
  related_achievement_id text,
  related_challenge_id uuid,
  related_goal_id uuid,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.social_feed enable row level security;

-- Users can view posts from friends or public posts
drop policy if exists "Users can view social feed" on public.social_feed;
create policy "Users can view social feed"
  on public.social_feed for select
  using (
    visibility = 'public'
    or user_id = auth.uid()
    or (visibility = 'friends' and exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((user_id = auth.uid() and friend_id = social_feed.user_id)
         or (friend_id = auth.uid() and user_id = social_feed.user_id))
    ))
  );

drop policy if exists "Users can insert own posts" on public.social_feed;
create policy "Users can insert own posts"
  on public.social_feed for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own posts" on public.social_feed;
create policy "Users can update own posts"
  on public.social_feed for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own posts" on public.social_feed;
create policy "Users can delete own posts"
  on public.social_feed for delete
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_social_feed_user on public.social_feed(user_id, created_at desc);
create index if not exists idx_social_feed_created on public.social_feed(created_at desc);
create index if not exists idx_social_feed_type on public.social_feed(post_type);

-- ============================================
-- SOCIAL FEED COMMENTS TABLE
-- ============================================
create table if not exists public.social_feed_comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.social_feed on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  comment_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.social_feed_comments enable row level security;

-- Users can view comments on posts they can see
drop policy if exists "Users can view comments" on public.social_feed_comments;
create policy "Users can view comments"
  on public.social_feed_comments for select
  using (
    exists (
      select 1 from public.social_feed sf
      where sf.id = post_id
        and (sf.visibility = 'public'
         or sf.user_id = auth.uid()
         or (sf.visibility = 'friends' and exists (
           select 1 from public.friendships
           where status = 'accepted'
             and ((user_id = auth.uid() and friend_id = sf.user_id)
              or (friend_id = auth.uid() and user_id = sf.user_id))
         )))
    )
  );

drop policy if exists "Users can insert comments" on public.social_feed_comments;
create policy "Users can insert comments"
  on public.social_feed_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own comments" on public.social_feed_comments;
create policy "Users can update own comments"
  on public.social_feed_comments for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own comments" on public.social_feed_comments;
create policy "Users can delete own comments"
  on public.social_feed_comments for delete
  using (auth.uid() = user_id);

create index if not exists idx_comments_post on public.social_feed_comments(post_id, created_at);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  notification_type text not null check (notification_type in (
    'friend_request', 'friend_accepted', 'achievement_unlocked', 
    'challenge_invite', 'challenge_started', 'challenge_completed',
    'position_changed', 'encouragement', 'milestone', 'goal_reached',
    'streak_reminder', 'weigh_in_reminder', 'meal_log_reminder'
  )),
  
  title text not null,
  message text not null,
  
  -- Associated data
  action_url text,
  related_user_id uuid references auth.users on delete set null,
  related_challenge_id uuid,
  related_achievement_id text,
  
  read boolean default false,
  read_at timestamptz,
  
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

create index if not exists idx_notifications_user_unread on public.notifications(user_id, read, created_at desc);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create bidirectional friendship
create or replace function create_friendship(
  p_user_id uuid,
  p_friend_id uuid
)
returns uuid as $$
declare
  v_friendship_id uuid;
begin
  -- Check if friendship already exists
  if exists (
    select 1 from public.friendships
    where (user_id = p_user_id and friend_id = p_friend_id)
       or (user_id = p_friend_id and friend_id = p_user_id)
  ) then
    raise exception 'Friendship already exists';
  end if;
  
  -- Create friendship request
  insert into public.friendships (user_id, friend_id, requested_by, status)
  values (p_user_id, p_friend_id, p_user_id, 'pending')
  returning id into v_friendship_id;
  
  -- Create notification for friend
  insert into public.notifications (user_id, notification_type, title, message, related_user_id)
  select 
    p_friend_id,
    'friend_request',
    'New friend request',
    (select full_name from public.profiles where id = p_user_id) || ' wants to connect!',
    p_user_id;
  
  return v_friendship_id;
end;
$$ language plpgsql security definer;

-- Function to accept friendship
create or replace function accept_friendship(p_friendship_id uuid)
returns void as $$
declare
  v_user_id uuid;
  v_friend_id uuid;
  v_requester_id uuid;
begin
  -- Get friendship details
  select user_id, friend_id, requested_by
  into v_user_id, v_friend_id, v_requester_id
  from public.friendships
  where id = p_friendship_id;
  
  -- Update status
  update public.friendships
  set status = 'accepted',
      responded_at = now(),
      updated_at = now()
  where id = p_friendship_id;
  
  -- Create reverse friendship for bidirectional access
  insert into public.friendships (user_id, friend_id, requested_by, status, responded_at)
  values (v_friend_id, v_user_id, v_requester_id, 'accepted', now())
  on conflict (user_id, friend_id) do nothing;
  
  -- Notify requester
  insert into public.notifications (user_id, notification_type, title, message, related_user_id)
  select 
    v_requester_id,
    'friend_accepted',
    'Friend request accepted',
    (select full_name from public.profiles where id = (case when v_requester_id = v_user_id then v_friend_id else v_user_id end)) || ' accepted your friend request!',
    (case when v_requester_id = v_user_id then v_friend_id else v_user_id end);
end;
$$ language plpgsql security definer;

-- Function to get friend list
create or replace function get_friends(p_user_id uuid)
returns table (
  friend_id uuid,
  friend_name text,
  friend_avatar text,
  friendship_since timestamptz,
  latest_weight_kg numeric,
  total_weight_lost_kg numeric,
  current_streak integer
) as $$
begin
  return query
  select 
    p.id,
    p.full_name,
    p.avatar_url,
    f.responded_at,
    wl.weight_kg,
    (wg.start_weight_kg - wg.current_weight_kg) as weight_lost,
    0 as streak -- Will be calculated from streak tracking
  from public.friendships f
  join public.profiles p on (
    case 
      when f.user_id = p_user_id then p.id = f.friend_id
      else p.id = f.user_id
    end
  )
  left join lateral (
    select weight_kg
    from public.weight_logs
    where user_id = p.id
    order by logged_at desc
    limit 1
  ) wl on true
  left join public.weight_goals wg on wg.user_id = p.id and wg.status = 'active'
  where f.status = 'accepted'
    and (f.user_id = p_user_id or f.friend_id = p_user_id);
end;
$$ language plpgsql security definer;

-- Trigger to increment comment count on social feed
create or replace function increment_comment_count()
returns trigger as $$
begin
  update public.social_feed
  set comment_count = comment_count + 1
  where id = new.post_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists social_feed_comment_count on public.social_feed_comments;
create trigger social_feed_comment_count
  after insert on public.social_feed_comments
  for each row execute function increment_comment_count();

-- Auto-create privacy settings for new users
create or replace function create_default_privacy_settings()
returns trigger as $$
begin
  insert into public.privacy_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_user_created_privacy on auth.users;
create trigger on_user_created_privacy
  after insert on auth.users
  for each row execute procedure create_default_privacy_settings();
