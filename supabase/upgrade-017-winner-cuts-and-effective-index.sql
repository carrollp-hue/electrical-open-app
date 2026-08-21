-- Winner cuts apply only while their score remains in the latest 12 qualifying rounds.
create or replace function public.recalculate_society_index(p_player_id uuid, p_fixture_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_count integer; v_used integer; v_rule_adjustment numeric; v_average numeric;
  v_pre_cap numeric; v_baseline numeric; v_soft_cap numeric; v_hard_cap numeric;
  v_soft_reduction numeric := 0; v_calculated numeric; v_club_handicap numeric;
  v_committee_adjustment numeric; v_score_adjustments numeric; v_result numeric; v_selected numeric[];
begin
  -- Physically clear a winner cut once 12 newer qualifying rounds exist.
  -- The setting prevents the update trigger from repeatedly re-entering this cleanup.
  if coalesce(current_setting('electrical_open.expiring_winner_cuts', true), '') <> 'true' then
    perform set_config('electrical_open.expiring_winner_cuts', 'true', true);
    with ranked as (
      select e.id, row_number() over (order by f.fixture_date desc, e.entered_at desc) as round_number
      from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id
      where e.player_id = p_player_id and e.score_differential is not null
    )
    update public.fixture_entries e set winner_cut = 0
    from ranked r where e.id = r.id and r.round_number > 12 and e.winner_cut <> 0;
  end if;

  select club_handicap, committee_adjustment into v_club_handicap, v_committee_adjustment
  from public.players where id = p_player_id;
  with latest as (
    select e.score_differential, e.handicap_index_at_entry, coalesce(e.esr_adjustment, 0) as esr_adjustment, coalesce(e.winner_cut, 0) as winner_cut
    from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id
    where e.player_id = p_player_id and e.score_differential is not null
    order by f.fixture_date desc, e.entered_at desc limit 12
  ) select count(*), min(handicap_index_at_entry), coalesce(sum(esr_adjustment + winner_cut), 0)
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
    where e.player_id = p_player_id and e.score_differential is not null order by f.fixture_date desc, e.entered_at desc limit 12
  ), lowest as (select score_differential from latest order by score_differential limit v_used)
  select avg(score_differential), array_agg(score_differential order by score_differential) into v_average, v_selected from lowest;
  v_pre_cap := round(v_average + v_rule_adjustment, 1);
  if v_baseline is not null then v_soft_cap := v_baseline + 3; v_hard_cap := v_baseline + 5; end if;
  if v_soft_cap is not null and v_pre_cap > v_soft_cap then v_soft_reduction := round((v_pre_cap - v_soft_cap) / 2, 1); end if;
  v_calculated := round(case when v_hard_cap is null then v_pre_cap else least(v_pre_cap, v_hard_cap) end, 1);
  v_result := round(least(coalesce(v_club_handicap, v_calculated), v_calculated) + v_committee_adjustment - v_score_adjustments, 1);
  insert into public.handicap_snapshots (player_id, fixture_id, calculated_at, index_value, calculation)
  values (p_player_id, p_fixture_id, now(), v_result, jsonb_build_object('qualifying_round_count', v_count, 'rounds_used', v_used, 'selected_differentials', v_selected, 'pre_cap_index', v_pre_cap, 'baseline_index', v_baseline, 'soft_cap', v_soft_cap, 'soft_cap_reduction_displayed', v_soft_reduction, 'hard_cap', v_hard_cap, 'calculated_index', v_calculated, 'club_handicap', v_club_handicap, 'committee_adjustment', v_committee_adjustment, 'score_adjustments', v_score_adjustments))
  on conflict (player_id, fixture_id) do update set calculated_at = excluded.calculated_at, index_value = excluded.index_value, calculation = excluded.calculation;
  return v_result;
end $$;
