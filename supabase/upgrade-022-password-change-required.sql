-- Run once in Supabase Dashboard > SQL Editor.
-- Allows the app to require a password change after an administrator creates an account.

alter table public.profiles
  add column if not exists password_change_required boolean not null default false;

drop policy if exists "Users may clear their completed password change" on public.profiles;
create policy "Users may clear their completed password change"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and password_change_required = false);
