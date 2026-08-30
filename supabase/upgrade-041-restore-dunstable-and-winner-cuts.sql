-- Restore Dunstable Downs (9 August 2026) as a normal completed fixture and
-- bring forward the eight still-active historic winner cuts confirmed against
-- the original fixture workbooks.  This migration is deliberately narrow:
-- it does not recreate, delete, or alter any other 2026 scorecards/results.

begin;

-- A winner cut remains in force for the following eleven qualifying rounds.
-- The original workbook removes it when it becomes the player's 12th latest
-- qualifying result, so rank 12 is the expiry point (not rank 13).
create or replace function public.recalculate_society_index(p_player_id uuid, p_fixture_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_count integer; v_used integer; v_rule_adjustment numeric; v_average numeric;
  v_pre_cap numeric; v_baseline numeric; v_soft_cap numeric; v_hard_cap numeric;
  v_soft_reduction numeric := 0; v_calculated numeric; v_club_handicap numeric;
  v_committee_adjustment numeric; v_score_adjustments numeric; v_result numeric; v_selected numeric[];
begin
  with ranked as (
    select e.id, row_number() over (order by f.fixture_date desc, e.entered_at desc) as round_number
    from public.fixture_entries e
    join public.fixtures f on f.id = e.fixture_id
    where e.player_id = p_player_id and e.score_differential is not null
  )
  update public.fixture_entries e set winner_cut = 0
  from ranked r where e.id = r.id and r.round_number >= 12 and e.winner_cut <> 0;

  select club_handicap, committee_adjustment into v_club_handicap, v_committee_adjustment
  from public.players where id = p_player_id;
  with latest as (
    select e.score_differential, e.handicap_index_at_entry,
      coalesce(e.esr_adjustment, 0) as esr_adjustment, coalesce(e.winner_cut, 0) as winner_cut
    from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id
    where e.player_id = p_player_id and e.score_differential is not null
    order by f.fixture_date desc, e.entered_at desc limit 12
  )
  select count(*), min(nullif(handicap_index_at_entry, 0)),
    coalesce(sum(esr_adjustment + winner_cut), 0)
  into v_count, v_baseline, v_score_adjustments from latest;
  if v_count = 0 then return null; end if;
  if v_count < 4 then v_used := 1; v_rule_adjustment := -2;
  elsif v_count = 4 then v_used := 1; v_rule_adjustment := -1;
  elsif v_count = 5 then v_used := 1; v_rule_adjustment := 0;
  elsif v_count = 6 then v_used := 2; v_rule_adjustment := -1;
  elsif v_count <= 8 then v_used := 2; v_rule_adjustment := 0;
  elsif v_count <= 11 then v_used := 3; v_rule_adjustment := 0;
  else v_used := 4; v_rule_adjustment := 0; end if;
  with latest as (
    select e.score_differential from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id
    where e.player_id = p_player_id and e.score_differential is not null
    order by f.fixture_date desc, e.entered_at desc limit 12
  ), lowest as (select score_differential from latest order by score_differential limit v_used)
  select avg(score_differential), array_agg(score_differential order by score_differential)
  into v_average, v_selected from lowest;
  v_pre_cap := round(v_average + v_rule_adjustment, 1);
  if v_baseline is not null then v_soft_cap := v_baseline + 3; v_hard_cap := v_baseline + 5; end if;
  if v_soft_cap is not null and v_pre_cap > v_soft_cap then
    v_soft_reduction := round((v_pre_cap - v_soft_cap) / 2, 1);
  end if;
  v_calculated := round(case when v_hard_cap is null then v_pre_cap else least(v_pre_cap, v_hard_cap) end, 1);
  v_result := round(least(coalesce(v_club_handicap, v_calculated), v_calculated)
    + v_committee_adjustment - v_score_adjustments, 1);
  insert into public.handicap_snapshots (player_id, fixture_id, calculated_at, index_value, calculation)
  values (p_player_id, p_fixture_id, now(), v_result, jsonb_build_object(
    'qualifying_round_count', v_count, 'rounds_used', v_used,
    'selected_differentials', v_selected, 'pre_cap_index', v_pre_cap,
    'baseline_index', v_baseline, 'soft_cap', v_soft_cap,
    'soft_cap_reduction_displayed', v_soft_reduction, 'hard_cap', v_hard_cap,
    'calculated_index', v_calculated, 'club_handicap', v_club_handicap,
    'committee_adjustment', v_committee_adjustment, 'score_adjustments', v_score_adjustments))
  on conflict (player_id, fixture_id) do update set
    calculated_at = excluded.calculated_at, index_value = excluded.index_value,
    calculation = excluded.calculation;
  return v_result;
end $$;

do $$
declare
  v_fixture_id uuid := '9cd569f1-eb01-4a35-b9d0-363b6c6fabde';
  v_course_setup_id uuid;
  v_course_rating numeric;
  v_slope_rating numeric;
  v_pcc numeric;
begin
  select f.course_setup_id, cs.course_rating, cs.slope_rating,
    coalesce(f.playing_conditions_adjustment, 0)
  into v_course_setup_id, v_course_rating, v_slope_rating, v_pcc
  from public.fixtures f
  join public.course_setups cs on cs.id = f.course_setup_id
  where f.id = v_fixture_id;

  if v_course_setup_id is null or v_course_rating is null or v_slope_rating is null then
    raise exception 'Dunstable restoration stopped: course setup, rating, or slope is missing';
  end if;
  if (select count(*) from public.fixture_participants where fixture_id = v_fixture_id) <> 19 then
    raise exception 'Dunstable restoration stopped: expected 19 participants';
  end if;
  if (select count(*) from public.fixture_entries where fixture_id = v_fixture_id and score_status = 'completed') <> 12 then
    raise exception 'Dunstable restoration stopped: expected 12 completed scorecards';
  end if;
  if (select count(*) from public.hole_scores h join public.fixture_entries e on e.id = h.fixture_entry_id where e.fixture_id = v_fixture_id) <> 216 then
    raise exception 'Dunstable restoration stopped: expected 216 entered hole scores';
  end if;

  -- Make the already-imported scorecards/results live.  No participant, entry,
  -- result, or hole score is deleted or recreated here.
  update public.fixtures
  set status = 'completed', is_historical = false,
      playing_conditions_adjustment = 1,
      scores_finalized_at = coalesce(scores_finalized_at, now()),
      published_at = coalesce(published_at, now())
  where id = v_fixture_id;

  -- Score differentials use WHS net double bogey (par + 2 + strokes received)
  -- for each hole, then the already-recorded PCC of +1.
  with adjusted_scores as (
    select e.id,
      sum(least(h.gross_score, ch.par + 2 + h.handicap_strokes))::numeric as adjusted_gross
    from public.fixture_entries e
    join public.hole_scores h on h.fixture_entry_id = e.id
    join public.course_holes ch on ch.course_setup_id = v_course_setup_id and ch.hole_number = h.hole_number
    where e.fixture_id = v_fixture_id and e.score_status = 'completed'
    group by e.id
  )
  update public.fixture_entries e
  set adjusted_gross_score = s.adjusted_gross,
      score_differential = round(((s.adjusted_gross - v_course_rating - v_pcc) * 113 / v_slope_rating), 4)
  from adjusted_scores s
  where e.id = s.id;

  -- Society rule for a Non Return: entry handicap index + 5.
  update public.fixture_entries
  set adjusted_gross_score = null,
      score_differential = round(handicap_index_at_entry + 5, 4)
  where fixture_id = v_fixture_id and score_status = 'non_return';

  -- Matt Keane won Dunstable; the source workbook records one winner cut.
  if not exists (
    select 1 from public.fixture_entries e
    join public.players p on p.id = e.player_id
    where e.fixture_id = v_fixture_id and p.surname = 'KEANE' and p.first_name = 'Matt'
  ) then
    raise exception 'Dunstable restoration stopped: Matt Keane entry is missing';
  end if;
  update public.fixture_entries e set winner_cut = case
    when p.surname = 'KEANE' and p.first_name = 'Matt' then 1 else coalesce(e.winner_cut, 0) end
  from public.players p
  where p.id = e.player_id and e.fixture_id = v_fixture_id;
end $$;

-- The only historic cuts that remain active today, confirmed against column P
-- in the original fixture workbooks.  They are deliberately named one by one
-- rather than inferred from positions, so historic/source anomalies are not
-- carried into the live records.
with expected_cut(fixture_date, surname, first_name) as (
  values
    (date '2023-09-03', 'BAZELEY', 'Darryl'),
    (date '2024-10-12', 'BREWER', 'Nick'),
    (date '2025-05-18', 'BISSET', 'Alec'),
    (date '2025-08-10', 'KEANE', 'Joe'),
    (date '2025-08-31', 'REEVES', 'Ade'),
    (date '2025-09-21', 'KELLY', 'Paul'),
    (date '2025-09-28', 'BRITTON', 'Gary'),
    (date '2025-09-28', 'CARROLL', 'Paul')
)
update public.fixture_entries e
set winner_cut = 1
from expected_cut x
join public.fixtures f on f.fixture_date = x.fixture_date
join public.players p on p.surname = x.surname and p.first_name = x.first_name
where e.fixture_id = f.id and e.player_id = p.id;

-- Refresh every non-guest player with qualifying history.  This also clears
-- any expired historical cut at round 12 before the latest snapshot is saved.
with latest_qualifying_round as (
  select distinct on (e.player_id) e.player_id, e.fixture_id
  from public.fixture_entries e
  join public.fixtures f on f.id = e.fixture_id
  join public.players p on p.id = e.player_id
  where e.score_differential is not null and not p.is_guest
  order by e.player_id, f.fixture_date desc, e.entered_at desc
)
select public.recalculate_society_index(player_id, fixture_id)
from latest_qualifying_round;

-- Refuse a partial deployment if any of the restored differentials or the
-- eight named historic cuts could not be found.
do $$
begin
  if (select count(*) from public.fixture_entries where fixture_id = '9cd569f1-eb01-4a35-b9d0-363b6c6fabde' and score_differential is not null) <> 19 then
    raise exception 'Dunstable restoration verification failed: expected 19 differentials';
  end if;
  if (select count(*) from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id join public.players p on p.id = e.player_id
      where (f.fixture_date, p.surname, p.first_name) in (
        (date '2023-09-03','BAZELEY','Darryl'), (date '2024-10-12','BREWER','Nick'),
        (date '2025-05-18','BISSET','Alec'), (date '2025-08-10','KEANE','Joe'),
        (date '2025-08-31','REEVES','Ade'), (date '2025-09-21','KELLY','Paul'),
        (date '2025-09-28','BRITTON','Gary'), (date '2025-09-28','CARROLL','Paul')
      ) and e.winner_cut = 1) <> 8 then
    raise exception 'Historic winner-cut verification failed: expected eight active cuts';
  end if;
end $$;

commit;
