-- Apply the WHS exceptional-score reduction automatically when a fixture is
-- finalised.  It uses the player's Handicap Index captured at entry and the
-- final, PCC-adjusted Score Differential for that same round.
--
-- 7.0 to 9.9 strokes better: 1.0 reduction
-- 10.0 or more strokes better: 2.0 reduction
-- The existing index calculation retains the reduction for its 12-round
-- rolling window, alongside any society winner-cut adjustments.

create or replace function public.finalize_fixture_differentials(p_fixture_id uuid, p_playing_conditions integer default 0)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_staff() then
    raise exception 'Administrator access is required';
  end if;

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
  set score_differential = calculated.differential,
      esr_adjustment = case
        when e.handicap_index_at_entry is null then 0
        when e.handicap_index_at_entry - calculated.differential >= 10.0 then 2.0
        when e.handicap_index_at_entry - calculated.differential >= 7.0 then 1.0
        else 0
      end
  from (
    select e2.id,
      round(
        ((e2.adjusted_gross_score - cs.course_rating - p_playing_conditions) * 113 / cs.slope_rating)::numeric,
        1
      ) as differential
    from public.fixture_entries e2
    join public.fixtures f on f.id = e2.fixture_id
    join public.course_setups cs on cs.id = f.course_setup_id
    where e2.fixture_id = p_fixture_id
      and e2.adjusted_gross_score is not null
  ) calculated
  where e.id = calculated.id;

  get diagnostics v_count = row_count;
  perform public.recalculate_fixture_positions(p_fixture_id);
  return v_count;
end $$;
