-- Repair any stored handicap snapshot after historic imports or score corrections,
-- then make the normal trigger refresh an index when a qualifying score is removed
-- as well as when one is entered or amended.

create or replace function public.trigger_recalculate_society_index()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_latest_fixture_id uuid;
begin
  if tg_op = 'DELETE' then
    v_player_id := old.player_id;
  else
    v_player_id := new.player_id;
  end if;

  if exists (
    select 1
    from public.players p
    where p.id = v_player_id
      and not p.is_guest
  ) then
    -- Use the player's latest remaining qualifying round.  This also covers an
    -- update that changes score_differential from a number to NULL.
    select e.fixture_id
    into v_latest_fixture_id
    from public.fixture_entries e
    join public.fixtures f on f.id = e.fixture_id
    where e.player_id = v_player_id
      and e.score_differential is not null
    order by f.fixture_date desc, e.entered_at desc
    limit 1;

    if v_latest_fixture_id is not null then
      perform public.recalculate_society_index(v_player_id, v_latest_fixture_id);
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists calculate_society_index_after_score on public.fixture_entries;
create trigger calculate_society_index_after_score
after insert or update of score_differential, esr_adjustment, winner_cut, handicap_index_at_entry
on public.fixture_entries
for each row execute function public.trigger_recalculate_society_index();

drop trigger if exists calculate_society_index_after_entry_delete on public.fixture_entries;
create trigger calculate_society_index_after_entry_delete
after delete on public.fixture_entries
for each row execute function public.trigger_recalculate_society_index();

-- Refresh every non-guest player with at least one qualifying differential.
-- This is safe to run again after future historical imports or data repairs.
with latest_qualifying_round as (
  select distinct on (e.player_id)
    e.player_id,
    e.fixture_id
  from public.fixture_entries e
  join public.fixtures f on f.id = e.fixture_id
  join public.players p on p.id = e.player_id
  where e.score_differential is not null
    and not p.is_guest
  order by e.player_id, f.fixture_date desc, e.entered_at desc
)
select public.recalculate_society_index(player_id, fixture_id)
from latest_qualifying_round;

-- Verification report: after the refresh, each player below should have a
-- current snapshot against their latest qualifying fixture.
with latest_qualifying_round as (
  select distinct on (e.player_id)
    e.player_id,
    e.fixture_id,
    f.fixture_date
  from public.fixture_entries e
  join public.fixtures f on f.id = e.fixture_id
  join public.players p on p.id = e.player_id
  where e.score_differential is not null
    and not p.is_guest
  order by e.player_id, f.fixture_date desc, e.entered_at desc
), current_indexes as (
  select * from public.current_handicap_indexes()
)
select
  p.surname,
  p.first_name,
  ci.index_value as current_index,
  l.fixture_date as latest_qualifying_date,
  ci.calculated_at,
  coalesce((hs.calculation ->> 'score_adjustments')::numeric, 0) as active_score_adjustments,
  case when ci.player_id is null then 'MISSING SNAPSHOT' else 'OK' end as audit_status
from latest_qualifying_round l
join public.players p on p.id = l.player_id
left join current_indexes ci on ci.player_id = l.player_id
left join public.handicap_snapshots hs
  on hs.player_id = ci.player_id
 and hs.calculated_at = ci.calculated_at
order by p.surname, p.first_name;
