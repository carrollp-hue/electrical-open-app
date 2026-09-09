-- One end-of-season Order of Merit winner may receive a permanent 1.0
-- society-index reduction. Unlike fixture winner cuts, this award is not
-- attached to a score differential and does not expire after 12 rounds.

create table if not exists public.season_order_of_merit_winner_cuts (
  id uuid primary key default gen_random_uuid(),
  season_year integer not null check (season_year between 2020 and 2100),
  player_id uuid not null references public.players(id) on delete restrict,
  amount numeric(4,1) not null default 1.0 check (amount > 0 and amount <= 5),
  applied_at timestamptz not null default now(),
  applied_by uuid not null references public.profiles(id) on delete restrict,
  unique (season_year)
);

alter table public.season_order_of_merit_winner_cuts enable row level security;
grant select on public.season_order_of_merit_winner_cuts to authenticated;
create policy "Members view season Order of Merit winner cuts"
on public.season_order_of_merit_winner_cuts for select to authenticated using (true);

-- Preserve fixture winner-cut expiry while adding the separately auditable
-- season award to the final index calculation.
create or replace function public.recalculate_society_index(p_player_id uuid, p_fixture_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_count integer; v_used integer; v_rule_adjustment numeric; v_average numeric;
  v_pre_cap numeric; v_baseline numeric; v_soft_cap numeric; v_hard_cap numeric;
  v_soft_reduction numeric := 0; v_calculated numeric; v_club_handicap numeric;
  v_committee_adjustment numeric; v_score_adjustments numeric; v_season_winner_cuts numeric;
  v_result numeric; v_selected numeric[];
begin
  if coalesce(current_setting('electrical_open.expiring_winner_cuts', true), '') <> 'true' then
    perform set_config('electrical_open.expiring_winner_cuts', 'true', true);
    with ranked as (
      select e.id, row_number() over (order by f.fixture_date desc, e.entered_at desc) as round_number
      from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id
      where e.player_id = p_player_id and e.score_differential is not null
    ) update public.fixture_entries e set winner_cut = 0
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
  select coalesce(sum(amount), 0) into v_season_winner_cuts from public.season_order_of_merit_winner_cuts where player_id = p_player_id;
  v_result := round(least(coalesce(v_club_handicap, v_calculated), v_calculated) + v_committee_adjustment - v_score_adjustments - v_season_winner_cuts, 1);
  insert into public.handicap_snapshots (player_id, fixture_id, calculated_at, index_value, calculation)
  values (p_player_id, p_fixture_id, now(), v_result, jsonb_build_object('qualifying_round_count', v_count, 'rounds_used', v_used, 'selected_differentials', v_selected, 'pre_cap_index', v_pre_cap, 'baseline_index', v_baseline, 'soft_cap', v_soft_cap, 'soft_cap_reduction_displayed', v_soft_reduction, 'hard_cap', v_hard_cap, 'calculated_index', v_calculated, 'club_handicap', v_club_handicap, 'committee_adjustment', v_committee_adjustment, 'score_adjustments', v_score_adjustments, 'season_order_of_merit_winner_cuts', v_season_winner_cuts))
  on conflict (player_id, fixture_id) do update set calculated_at = excluded.calculated_at, index_value = excluded.index_value, calculation = excluded.calculation;
  return v_result;
end $$;

create or replace function public.apply_season_order_of_merit_winner_cut(p_season_year integer, p_player_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_latest_fixture_id uuid; v_highest_points integer; v_player_points integer;
begin
  if not public.is_admin() then raise exception 'Administrator access is required'; end if;
  if not exists (select 1 from public.season_members sm join public.players p on p.id = sm.player_id where sm.season_year = p_season_year and sm.player_id = p_player_id and not p.is_guest) then
    raise exception 'The selected player is not a member for that season';
  end if;
  with standings as (
    select e.player_id, coalesce(sum(e.order_of_merit_points), 0)::integer as points
    from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id
    join public.season_members sm on sm.player_id = e.player_id and sm.season_year = p_season_year
    join public.players p on p.id = e.player_id
    where extract(year from f.fixture_date)::integer = p_season_year and f.status = 'completed' and not coalesce(f.is_historical, false) and not p.is_guest
    group by e.player_id
  ) select max(points), coalesce(max(points) filter (where player_id = p_player_id), 0) into v_highest_points, v_player_points from standings;
  if v_highest_points is null or v_player_points <> v_highest_points then raise exception 'The selected player is not currently tied for the highest Order of Merit points'; end if;
  insert into public.season_order_of_merit_winner_cuts (season_year, player_id, amount, applied_by) values (p_season_year, p_player_id, 1.0, auth.uid());
  select e.fixture_id into v_latest_fixture_id from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id where e.player_id = p_player_id and e.score_differential is not null order by f.fixture_date desc, e.entered_at desc limit 1;
  if v_latest_fixture_id is not null then perform public.recalculate_society_index(p_player_id, v_latest_fixture_id); end if;
  insert into public.audit_events (actor_id, event_type, entity_type, entity_id, event_data)
  values (auth.uid(), 'season_order_of_merit_winner_cut_applied', 'player', p_player_id, jsonb_build_object('season_year', p_season_year, 'amount', 1.0));
end $$;

revoke all on function public.apply_season_order_of_merit_winner_cut(integer, uuid) from public;
grant execute on function public.apply_season_order_of_merit_winner_cut(integer, uuid) to authenticated;
