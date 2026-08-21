-- Prevent an existing course setup from being changed after it has recorded scores.
-- This preserves the rating, slope and hole data used by historical results.
create or replace function public.prevent_historical_course_setup_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.fixtures f
    join public.fixture_entries e on e.fixture_id = f.id
    where f.course_setup_id = old.id
  ) then
    raise exception 'This course setup is already used by a scored fixture. Create a new tee/setup version for future fixtures.';
  end if;
  return new;
end $$;

drop trigger if exists lock_historical_course_setup on public.course_setups;
create trigger lock_historical_course_setup
before update or delete on public.course_setups
for each row execute function public.prevent_historical_course_setup_change();

create or replace function public.prevent_historical_hole_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.fixtures f
    join public.fixture_entries e on e.fixture_id = f.id
    where f.course_setup_id = coalesce(new.course_setup_id, old.course_setup_id)
  ) then
    raise exception 'This scorecard is already used by a scored fixture. Create a new setup version for future fixtures.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists lock_historical_holes on public.course_holes;
create trigger lock_historical_holes
before update or delete on public.course_holes
for each row execute function public.prevent_historical_hole_change();
