-- Competition naming and final event ranking / Order of Merit calculation.
alter table public.fixtures add column if not exists competition_name text;

create or replace function public.recalculate_fixture_positions(p_fixture_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries set competition_position = null, order_of_merit_points = 0 where fixture_id = p_fixture_id;

  with scored as (
    select e.id, e.stableford_points,
      coalesce(sum(h.stableford_points) filter (where h.hole_number between 10 and 18), 0) as back9,
      coalesce(sum(h.stableford_points) filter (where h.hole_number between 13 and 18), 0) as back6,
      coalesce(sum(h.stableford_points) filter (where h.hole_number between 16 and 18), 0) as back3,
      coalesce(max(h.stableford_points) filter (where h.hole_number = 18), 0) as h18,
      coalesce(sum(h.stableford_points) filter (where h.hole_number between 1 and 9), 0) as front9,
      coalesce(sum(h.stableford_points) filter (where h.hole_number between 4 and 9), 0) as front6,
      coalesce(sum(h.stableford_points) filter (where h.hole_number between 7 and 9), 0) as front3,
      coalesce(max(h.stableford_points) filter (where h.hole_number = 9), 0) as h9
    from public.fixture_entries e
    join public.fixture_participants fp on fp.fixture_id = e.fixture_id and fp.player_id = e.player_id
    left join public.hole_scores h on h.fixture_entry_id = e.id
    where e.fixture_id = p_fixture_id and e.score_status = 'completed' and not fp.is_guest
    group by e.id, e.stableford_points
  ), ranked as (
    select id, row_number() over (order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc, front9 desc, front6 desc, front3 desc, h9 desc) as position
    from scored
  )
  update public.fixture_entries e
  set competition_position = r.position,
      order_of_merit_points = case r.position when 1 then 20 when 2 then 16 when 3 then 12 when 4 then 8 when 5 then 6 else 1 end
  from ranked r where e.id = r.id;
end $$;

create or replace function public.finalize_fixture_differentials(p_fixture_id uuid, p_playing_conditions integer default 0)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_staff() then raise exception 'Administrator access is required'; end if;
  update public.fixtures set playing_conditions_adjustment = p_playing_conditions, scores_finalized_at = now() where id = p_fixture_id;
  update public.fixture_entries e set score_differential = round(((e.adjusted_gross_score - cs.course_rating - p_playing_conditions) * 113 / cs.slope_rating)::numeric, 4)
  from public.fixtures f join public.course_setups cs on cs.id = f.course_setup_id
  where e.fixture_id = p_fixture_id and f.id = p_fixture_id and e.adjusted_gross_score is not null;
  get diagnostics v_count = row_count;
  perform public.recalculate_fixture_positions(p_fixture_id);
  return v_count;
end $$;
