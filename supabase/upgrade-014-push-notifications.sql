create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Members manage their own push subscriptions" on public.push_subscriptions;
create policy "Members manage their own push subscriptions"
on public.push_subscriptions for all to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());
