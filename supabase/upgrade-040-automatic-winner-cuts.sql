-- The original Handicap Adjustment workbook deducts one stroke for a
-- competition winner.  Award this to a season member only, never a guest.

create or replace function public.award_fixture_winner_cut(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fixture_entries e
  set winner_cut = case
    when e.score_status = 'completed'
      and e.competition_position = 1
      and exists (
        select 1
        from public.fixtures f
        join public.players p on p.id = e.player_id
        join public.season_members sm
          on sm.player_id = e.player_id
         and sm.season_year = extract(year from f.fixture_date)::integer
        where f.id = e.fixture_id
          and not p.is_guest
      )
    then 1.0
    else 0.0
  end
  where e.fixture_id = p_fixture_id
    and e.winner_cut is distinct from case
      when e.score_status = 'completed'
        and e.competition_position = 1
        and exists (
          select 1
          from public.fixtures f
          join public.players p on p.id = e.player_id
          join public.season_members sm
            on sm.player_id = e.player_id
           and sm.season_year = extract(year from f.fixture_date)::integer
          where f.id = e.fixture_id
            and not p.is_guest
        )
      then 1.0
      else 0.0
    end;
end;
$$;

-- Award the cut at the same point that positions and Order of Merit points
-- are made final.
create or replace function public.commit_fixture(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access is required'; end if;
  if not exists (select 1 from public.fixtures where id = p_fixture_id and scores_finalized_at is not null and status <> 'archived') then raise exception 'Finalize the fixture before committing it'; end if;
  if not exists (select 1 from public.fixture_participants where fixture_id = p_fixture_id) then raise exception 'Add at least one participant before committing the fixture'; end if;
  if exists (
    select 1
    from public.fixture_participants fp
    left join public.fixture_entries e on e.fixture_id = fp.fixture_id and e.player_id = fp.player_id
    where fp.fixture_id = p_fixture_id
      and (e.id is null or (e.score_status = 'completed' and (select count(*) from public.hole_scores hs where hs.fixture_entry_id = e.id) <> 18))
  ) then
    raise exception 'Every participant needs a complete scorecard or a Non Return before committing';
  end if;
  perform public.award_fixture_oom(p_fixture_id);
  perform public.award_fixture_winner_cut(p_fixture_id);
  update public.fixtures
  set status = 'completed', member_scoring_enabled = false, published_at = coalesce(published_at, now())
  where id = p_fixture_id;
end;
$$;

-- One-off correction: award a 1.0 cut for only the winning member entries
-- that remain within each player's latest 12 qualifying rounds. Older wins
-- remain at zero and therefore stay expired.
with qualifying as (
  select e.id, e.player_id, e.fixture_id, e.competition_position,
    row_number() over (partition by e.player_id order by f.fixture_date desc, e.entered_at desc) as round_number
  from public.fixture_entries e
  join public.fixtures f on f.id = e.fixture_id
  where e.score_differential is not null
), eligible_wins as (
  select q.id
  from qualifying q
  join public.players p on p.id = q.player_id
  join public.fixtures f on f.id = q.fixture_id
  join public.season_members sm
    on sm.player_id = q.player_id
   and sm.season_year = extract(year from f.fixture_date)::integer
  where q.round_number <= 12
    and q.competition_position = 1
    and not p.is_guest
)
update public.fixture_entries e
set winner_cut = case when ew.id is null then 0.0 else 1.0 end
from (select id from public.fixture_entries) all_entries
left join eligible_wins ew on ew.id = all_entries.id
where e.id = all_entries.id
  and e.winner_cut is distinct from case when ew.id is null then 0.0 else 1.0 end;

-- Refresh all current snapshots after the award.  The index function also
-- expires any future cut that reaches its twelfth newer qualifying round.
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
