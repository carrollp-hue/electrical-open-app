-- Run once in Supabase Dashboard -> SQL Editor.
-- This changes future fixture finalisation only. It does not alter any existing
-- score differentials, handicap snapshots, fixtures or results.
--
-- WHS Rule 5.1a: each 18-hole Score Differential is rounded to the nearest
-- tenth, with .5 rounded upwards.

create or replace function public.finalize_fixture_differentials(p_fixture_id uuid, p_playing_conditions integer default 0)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_staff() then raise exception 'Administrator access is required'; end if;

  if exists (
    select 1
    from public.fixture_participants fp
    left join public.fixture_entries e
      on e.fixture_id = fp.fixture_id and e.player_id = fp.player_id
    where fp.fixture_id = p_fixture_id
      and (e.id is null or (e.score_status = 'completed' and (
        select count(*) from public.hole_scores hs where hs.fixture_entry_id = e.id
      ) <> 18))
  ) then
    raise exception 'Every participant needs a complete official scorecard or a Non Return before finalising';
  end if;

  update public.fixtures
  set playing_conditions_adjustment = p_playing_conditions,
      scores_finalized_at = now()
  where id = p_fixture_id;

  update public.fixture_entries e
  set score_differential = round(
    ((e.adjusted_gross_score - cs.course_rating - p_playing_conditions) * 113 / cs.slope_rating)::numeric,
    1
  )
  from public.fixtures f
  join public.course_setups cs on cs.id = f.course_setup_id
  where e.fixture_id = p_fixture_id
    and f.id = p_fixture_id
    and e.adjusted_gross_score is not null;

  get diagnostics v_count = row_count;
  perform public.recalculate_fixture_positions(p_fixture_id);
  return v_count;
end $$;
