-- ============================================
-- HELPER FUNCTIONS
-- Utility RPCs used by frontend components
-- ============================================

-- Function to increment user XP and points atomically
create or replace function increment_user_stats(
  p_user_id uuid,
  p_xp integer default 0,
  p_points integer default 0
)
returns void as $$
begin
  update public.user_stats
  set
    total_xp    = total_xp + p_xp,
    total_points = total_points + p_points,
    updated_at  = now()
  where user_id = p_user_id;

  -- Also update level if XP changed
  if p_xp > 0 then
    update public.user_stats
    set
      level       = (calculate_level(total_xp) ->> 'level')::integer,
      level_title = calculate_level(total_xp) ->> 'title'
    where user_id = p_user_id;
  end if;
end;
$$ language plpgsql security definer;

-- Function to get achievement count for a user
create or replace function get_achievement_count(p_user_id uuid)
returns integer as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.gamification_achievements
  where user_id = p_user_id;
  return coalesce(v_count, 0);
end;
$$ language plpgsql security definer;
