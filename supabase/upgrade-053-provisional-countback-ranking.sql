-- The v2 summary adds the score total needed to rank different Stableford
-- totals before applying the countback columns. It only exposes aggregates.
create or replace function public.fixture_provisional_countbacks_v2(p_fixture_id uuid)
returns table (
  fixture_entry_id uuid,
  stableford_points integer,
  back_nine integer,
  last_six integer,
  last_three integer,
  hole_eighteen integer,
  front_nine integer,
  front_six integer,
  front_three integer,
  hole_nine integer
)
language sql
security definer
set search_path = public
as $$
  select
    hs.fixture_entry_id,
    e.stableford_points,
    sum(hs.stableford_points) filter (where hs.hole_number between 10 and 18)::integer,
    sum(hs.stableford_points) filter (where hs.hole_number between 13 and 18)::integer,
    sum(hs.stableford_points) filter (where hs.hole_number between 16 and 18)::integer,
    max(hs.stableford_points) filter (where hs.hole_number = 18)::integer,
    sum(hs.stableford_points) filter (where hs.hole_number between 1 and 9)::integer,
    sum(hs.stableford_points) filter (where hs.hole_number between 4 and 9)::integer,
    sum(hs.stableford_points) filter (where hs.hole_number between 7 and 9)::integer,
    max(hs.stableford_points) filter (where hs.hole_number = 9)::integer
  from public.hole_scores hs
  join public.fixture_entries e on e.id = hs.fixture_entry_id
  join public.fixtures f on f.id = e.fixture_id
  where e.fixture_id = p_fixture_id
    and f.status not in ('completed', 'published', 'archived')
    and e.stableford_points is not null
  group by hs.fixture_entry_id, e.stableford_points;
$$;

revoke all on function public.fixture_provisional_countbacks_v2(uuid) from public;
grant execute on function public.fixture_provisional_countbacks_v2(uuid) to authenticated;
