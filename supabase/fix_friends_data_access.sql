-- Allow friends to view each other's weight logs and nutrition summaries
-- Required for the friend comparison / shared analytics charts

-- Weight logs: friends can read
drop policy if exists "Friends can view weight logs" on public.weight_logs;
create policy "Friends can view weight logs"
  on public.weight_logs for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((user_id = auth.uid() and friend_id = weight_logs.user_id)
          or (friend_id = auth.uid() and user_id = weight_logs.user_id))
    )
  );

-- Daily nutrition summary: friends can read
drop policy if exists "Friends can view nutrition summaries" on public.daily_nutrition_summary;
create policy "Friends can view nutrition summaries"
  on public.daily_nutrition_summary for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((user_id = auth.uid() and friend_id = daily_nutrition_summary.user_id)
          or (friend_id = auth.uid() and user_id = daily_nutrition_summary.user_id))
    )
  );

-- User stats: friends can read (already exists but re-creating for clarity)
drop policy if exists "Friends can view stats" on public.user_stats;
create policy "Friends can view stats"
  on public.user_stats for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((user_id = auth.uid() and friend_id = user_stats.user_id)
          or (friend_id = auth.uid() and user_id = user_stats.user_id))
    )
  );
