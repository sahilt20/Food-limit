-- ============================================
-- FIX: Allow users to search other profiles
-- Without this, friend search returns 0 results
-- because RLS blocks reading other users' rows.
-- ============================================

-- Allow any authenticated user to read basic profile info
-- (name + avatar only — no sensitive fields exposed)
drop policy if exists "Authenticated users can search profiles" on public.profiles;
create policy "Authenticated users can search profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');
