-- Run once in Supabase Dashboard -> SQL Editor before testing the course library.
-- A new dated version can then be stored when a club changes a rating, slope or scorecard.

alter table public.course_setups
  add column if not exists effective_from date;

update public.course_setups
set effective_from = current_date
where effective_from is null;

alter table public.course_setups
  alter column effective_from set not null;

alter table public.course_setups
  add column if not exists retired_on date,
  add column if not exists created_at timestamptz not null default now();

alter table public.course_setups
  drop constraint if exists course_setups_course_id_tee_name_key;

alter table public.course_setups
  add constraint course_setups_course_tee_effective_from_key
  unique (course_id, tee_name, effective_from);

alter table public.course_setups
  drop constraint if exists course_setups_date_order;

alter table public.course_setups
  add constraint course_setups_date_order
  check (retired_on is null or retired_on >= effective_from);
