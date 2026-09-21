-- Return only countback totals for an unfinished fixture. This does not expose
-- individual hole scores to ordinary members.
create or replace function public.fixture_provisional_countbacks(p_fixture_id uuid)
returns table (
  fixture_entry_id uuid,
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
  group by hs.fixture_entry_id;
$$;

revoke all on function public.fixture_provisional_countbacks(uuid) from public;
grant execute on function public.fixture_provisional_countbacks(uuid) to authenticated;
