create or replace function public.is_membership_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('membership_admin', 'admin')) $$;

drop policy if exists "Staff may read roles" on public.user_roles;
create policy "Users and staff read roles" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.is_staff());

drop policy if exists "Members see published fixtures" on public.fixtures;
create policy "Members see published fixtures" on public.fixtures for select to authenticated
using (status in ('published', 'completed', 'archived') or public.is_staff() or public.is_membership_admin());

drop policy if exists "Staff manage season members" on public.season_members;
create policy "Staff and membership admins manage season members" on public.season_members for all to authenticated
using (public.is_staff() or public.is_membership_admin())
with check (public.is_staff() or public.is_membership_admin());

drop policy if exists "Staff manage fixture participants" on public.fixture_participants;
create policy "Staff and membership admins manage fixture participants" on public.fixture_participants for all to authenticated
using (public.is_staff() or public.is_membership_admin())
with check (public.is_staff() or public.is_membership_admin());

drop policy if exists "Membership admins add players" on public.players;
create policy "Membership admins add players" on public.players for insert to authenticated
with check (public.is_membership_admin());
