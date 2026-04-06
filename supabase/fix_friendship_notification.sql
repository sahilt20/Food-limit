-- Fix: NULL full_name causes notification message to be NULL
-- COALESCE falls back to 'Someone' if full_name is not set

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
    coalesce((select full_name from public.profiles where id = p_user_id), 'Someone') || ' wants to connect!',
    p_user_id;

  return v_friendship_id;
end;
$$ language plpgsql security definer;
