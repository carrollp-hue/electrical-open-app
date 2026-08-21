-- Live member-card results are read-only verification evidence.  They are not
-- copied into official fixture_entries, which remain the paper-card record.
create or replace function public.fixture_paired_scorecards_for_results(p_fixture_id uuid)
returns table (
  scorer_player_id uuid,
  marked_player_id uuid,
  own_scores jsonb,
  marked_scores jsonb,
  own_playing_handicap integer,
  marked_playing_handicap integer,
  own_status text,
  marked_status text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() and not exists (
    select 1 from public.fixture_participants where fixture_id = p_fixture_id and player_id = public.current_player_id()
  ) then
    raise exception 'You must be a fixture participant to view provisional results';
  end if;
  return query select c.scorer_player_id, c.marked_player_id, c.own_scores, c.marked_scores,
    c.own_playing_handicap, c.marked_playing_handicap, c.own_status, c.marked_status
  from public.member_scorecards c where c.fixture_id = p_fixture_id;
end;
$$;
revoke all on function public.fixture_paired_scorecards_for_results(uuid) from public;
grant execute on function public.fixture_paired_scorecards_for_results(uuid) to authenticated;

-- Positions may be shown after finalisation, but Order of Merit is awarded only
-- at commit.  Guests retain a result position but never receive OOM points.
create or replace function public.recalculate_fixture_positions(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
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
    from public.fixture_entries e left join public.hole_scores h on h.fixture_entry_id = e.id
    where e.fixture_id = p_fixture_id and e.score_status = 'completed'
    group by e.id, e.stableford_points
  ), ranked as (
    select id, row_number() over (order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc, front9 desc, front6 desc, front3 desc, h9 desc) as position from scored
  ) update public.fixture_entries e set competition_position = r.position from ranked r where e.id = r.id;
end $$;

create or replace function public.award_fixture_oom(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries set order_of_merit_points = 0 where fixture_id = p_fixture_id;
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
    from public.fixture_entries e join public.fixture_participants fp on fp.fixture_id = e.fixture_id and fp.player_id = e.player_id
    left join public.hole_scores h on h.fixture_entry_id = e.id
    where e.fixture_id = p_fixture_id and e.score_status = 'completed' and not fp.is_guest
    group by e.id, e.stableford_points
  ), ranked as (
    select id, row_number() over (order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc, front9 desc, front6 desc, front3 desc, h9 desc) as position from scored
  ) update public.fixture_entries e set order_of_merit_points = case r.position when 1 then 20 when 2 then 16 when 3 then 12 when 4 then 8 when 5 then 6 else 1 end from ranked r where e.id = r.id;
end $$;

create or replace function public.finalize_fixture_differentials(p_fixture_id uuid, p_playing_conditions integer default 0)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_staff() then raise exception 'Administrator access is required'; end if;
  if exists (select 1 from public.fixture_participants fp left join public.fixture_entries e on e.fixture_id = fp.fixture_id and e.player_id = fp.player_id where fp.fixture_id = p_fixture_id and (e.id is null or (e.score_status = 'completed' and (select count(*) from public.hole_scores hs where hs.fixture_entry_id = e.id) <> 18))) then
    raise exception 'Every participant needs a complete official scorecard or a Non Return before finalising';
  end if;
  update public.fixtures set playing_conditions_adjustment = p_playing_conditions, scores_finalized_at = now() where id = p_fixture_id;
  update public.fixture_entries e set score_differential = round(((e.adjusted_gross_score - cs.course_rating - p_playing_conditions) * 113 / cs.slope_rating)::numeric, 4)
  from public.fixtures f join public.course_setups cs on cs.id = f.course_setup_id where e.fixture_id = p_fixture_id and f.id = p_fixture_id and e.adjusted_gross_score is not null;
  get diagnostics v_count = row_count;
  perform public.recalculate_fixture_positions(p_fixture_id);
  return v_count;
end $$;

create or replace function public.commit_fixture(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access is required'; end if;
  if not exists (select 1 from public.fixtures where id = p_fixture_id and scores_finalized_at is not null and status <> 'archived') then raise exception 'Finalize the fixture before committing it'; end if;
  if not exists (select 1 from public.fixture_participants where fixture_id = p_fixture_id) then raise exception 'Add at least one participant before committing the fixture'; end if;
  if exists (select 1 from public.fixture_participants fp left join public.fixture_entries e on e.fixture_id = fp.fixture_id and e.player_id = fp.player_id where fp.fixture_id = p_fixture_id and (e.id is null or (e.score_status = 'completed' and (select count(*) from public.hole_scores hs where hs.fixture_entry_id = e.id) <> 18))) then raise exception 'Every participant needs a complete scorecard or a Non Return before committing'; end if;
  perform public.award_fixture_oom(p_fixture_id);
  update public.fixtures set status = 'completed', member_scoring_enabled = false, published_at = coalesce(published_at, now()) where id = p_fixture_id;
end $$;
