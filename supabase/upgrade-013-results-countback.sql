-- Store the complete results order (including guests) and calculate OOM from
-- the same countback, considering members only.
create or replace function public.recalculate_fixture_positions(p_fixture_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries
  set competition_position = null, order_of_merit_points = 0
  where fixture_id = p_fixture_id;

  with scored as (
    select
      e.id,
      fp.is_guest,
      e.stableford_points,
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
    where e.fixture_id = p_fixture_id and e.score_status = 'completed'
    group by e.id, fp.is_guest, e.stableford_points
  ), results_ranked as (
    select id, row_number() over (
      order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc,
               front9 desc, front6 desc, front3 desc, h9 desc
    ) as position
    from scored
  ), members_ranked as (
    select id, row_number() over (
      order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc,
               front9 desc, front6 desc, front3 desc, h9 desc
    ) as position
    from scored
    where not is_guest
  )
  update public.fixture_entries e
  set competition_position = results_ranked.position,
      order_of_merit_points = case
        when members_ranked.position is null then 0
        when members_ranked.position = 1 then 20
        when members_ranked.position = 2 then 16
        when members_ranked.position = 3 then 12
        when members_ranked.position = 4 then 8
        when members_ranked.position = 5 then 6
        else 1
      end
  from results_ranked
  left join members_ranked on members_ranked.id = results_ranked.id
  where e.id = results_ranked.id;
end $$;
