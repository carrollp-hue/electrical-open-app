-- Run once in Supabase Dashboard -> SQL Editor before deploying app version 76.
-- This separates imported / historic results from the current Fixtures & Results list.

alter table public.fixtures
  add column if not exists is_historical boolean not null default false;

-- Mark all existing fixtures before the current season as historical.
-- Change the date below before running if your current season started earlier.
update public.fixtures
set is_historical = true
where fixture_date < date '2026-01-01';
