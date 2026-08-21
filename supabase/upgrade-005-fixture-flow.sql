-- Fixture schedule and final WHS differential calculation.
alter table public.fixtures add column if not exists tee_time time;
alter table public.fixtures add column if not exists scores_finalized_at timestamptz;

create or replace function public.finalize_fixture_differentials(p_fixture_id uuid, p_playing_conditions integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_staff() then
    raise exception 'Administrator access is required';
  end if;

  update public.fixtures
  set playing_conditions_adjustment = p_playing_conditions,
      scores_finalized_at = now()
  where id = p_fixture_id;

  update public.fixture_entries e
  set score_differential = round(
    ((e.adjusted_gross_score - cs.course_rating - p_playing_conditions) * 113 / cs.slope_rating)::numeric,
    4
  )
  from public.fixtures f
  join public.course_setups cs on cs.id = f.course_setup_id
  where e.fixture_id = p_fixture_id
    and f.id = p_fixture_id
    and e.adjusted_gross_score is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.finalize_fixture_differentials(uuid, integer) from public;
grant execute on function public.finalize_fixture_differentials(uuid, integer) to authenticated;

-- Scorecards can be saved before the Playing Conditions Calculation is known.
-- Do not update a member's society index until the administrator finalizes the fixture.
create or replace function public.trigger_recalculate_society_index()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.score_differential is not null and exists (
    select 1 from public.fixtures f
    where f.id = new.fixture_id and f.scores_finalized_at is not null
  ) then
    perform public.recalculate_society_index(new.player_id, new.fixture_id);
  end if;
  return new;
end $$;
