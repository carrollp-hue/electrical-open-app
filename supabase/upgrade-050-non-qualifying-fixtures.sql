-- A non-qualifying fixture is fully played and included in handicap
-- calculations, but awards neither Order of Merit points nor a fixture winner
-- cut. Existing fixtures remain qualifying by default.

alter table public.fixtures
  add column if not exists is_oom_qualifying boolean not null default true;

create or replace function public.award_fixture_oom(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries set order_of_merit_points = 0 where fixture_id = p_fixture_id;
  if not coalesce((select is_oom_qualifying from public.fixtures where id = p_fixture_id), true) then return; end if;

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
  ) update public.fixture_entries e set order_of_merit_points = case r.position
    when 1 then 20 when 2 then 16 when 3 then 12 when 4 then 8 when 5 then 6 else 1 end
    from ranked r where e.id = r.id;

  update public.fixture_entries e set order_of_merit_points = 1
  from public.fixture_participants fp
  where e.fixture_id = p_fixture_id and fp.fixture_id = e.fixture_id and fp.player_id = e.player_id
    and not fp.is_guest and e.score_status = 'non_return';
end $$;

create or replace function public.award_fixture_winner_cut(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries e
  set winner_cut = case
    when coalesce((select f.is_oom_qualifying from public.fixtures f where f.id = e.fixture_id), true)
      and e.score_status = 'completed' and e.competition_position = 1
      and exists (
        select 1 from public.fixtures f join public.players p on p.id = e.player_id
        join public.season_members sm on sm.player_id = e.player_id and sm.season_year = extract(year from f.fixture_date)::integer
        where f.id = e.fixture_id and not p.is_guest
      ) then 1.0 else 0.0 end
  where e.fixture_id = p_fixture_id;
end $$;

-- If an uncommitted fixture is changed to non-qualifying, clear any provisional
-- awards immediately. Completed fixtures stay protected by the normal UI.
create or replace function public.clear_non_qualifying_fixture_awards()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_oom_qualifying = false then
    update public.fixture_entries set order_of_merit_points = 0, winner_cut = 0 where fixture_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists clear_non_qualifying_fixture_awards on public.fixtures;
create trigger clear_non_qualifying_fixture_awards
after update of is_oom_qualifying on public.fixtures
for each row when (new.is_oom_qualifying = false)
execute function public.clear_non_qualifying_fixture_awards();
