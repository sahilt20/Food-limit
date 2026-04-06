-- Fix: accept_friendship notification crashes when full_name is NULL,
-- rolling back the entire transaction (friendship never actually accepted).

create or replace function accept_friendship(p_friendship_id uuid)
returns void as $$
declare
  v_user_id uuid;
  v_friend_id uuid;
  v_requester_id uuid;
  v_accepter_id uuid;
begin
  -- Get friendship details
  select user_id, friend_id, requested_by
  into v_user_id, v_friend_id, v_requester_id
  from public.friendships
  where id = p_friendship_id;

  -- The accepter is whoever is NOT the requester
  v_accepter_id := case
    when v_requester_id = v_user_id then v_friend_id
    else v_user_id
  end;

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

  -- Notify requester (COALESCE prevents NULL message crash)
  insert into public.notifications (user_id, notification_type, title, message, related_user_id)
  values (
    v_requester_id,
    'friend_accepted',
    'Friend request accepted',
    coalesce((select full_name from public.profiles where id = v_accepter_id), 'Someone') || ' accepted your friend request!',
    v_accepter_id
  );
end;
$$ language plpgsql security definer;
