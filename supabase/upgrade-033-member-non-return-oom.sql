-- Members receive one participation point for a Non Return when the fixture
-- is committed. Guests never receive Order of Merit points.
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
    from public.fixture_entries e
    join public.fixture_participants fp on fp.fixture_id = e.fixture_id and fp.player_id = e.player_id
    left join public.hole_scores h on h.fixture_entry_id = e.id
    where e.fixture_id = p_fixture_id and e.score_status = 'completed' and not fp.is_guest
    group by e.id, e.stableford_points
  ), ranked as (
    select id, row_number() over (
      order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc,
      front9 desc, front6 desc, front3 desc, h9 desc
    ) as position
    from scored
  )
  update public.fixture_entries e
  set order_of_merit_points = case r.position
    when 1 then 20 when 2 then 16 when 3 then 12 when 4 then 8 when 5 then 6 else 1
  end
  from ranked r where e.id = r.id;

  update public.fixture_entries e
  set order_of_merit_points = 1
  from public.fixture_participants fp
  where e.fixture_id = p_fixture_id
    and fp.fixture_id = e.fixture_id
    and fp.player_id = e.player_id
    and not fp.is_guest
    and e.score_status = 'non_return';
end $$;

-- Correct the two 2026 NRs already recorded during the historic restoration.
update public.fixture_entries e
set order_of_merit_points = 1
from public.fixtures f, public.players p, public.fixture_participants fp
where e.fixture_id = f.id
  and e.player_id = p.id
  and fp.fixture_id = e.fixture_id
  and fp.player_id = e.player_id
  and not fp.is_guest
  and e.score_status = 'non_return'
  and (
    (f.name = 'Colmworth Golf Club' and f.fixture_date = date '2026-06-14' and p.surname = 'REEVES' and p.first_name = 'Ade')
    or
    (f.name = 'Chartridge Park' and f.fixture_date = date '2026-07-15' and p.surname = 'CARROLL' and p.first_name = 'Paul')
  );
