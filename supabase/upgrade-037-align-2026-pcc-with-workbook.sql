-- Align the three imported 2026 PCC values with the verified workbook values.
-- Recalculate all completed cards affected by those fixture-level changes.

begin;

update public.fixtures
set playing_conditions_adjustment = case
  when fixture_date = '2026-03-29'::date and name = 'Stockwood Park' then 1
  when fixture_date = '2026-04-19'::date and name = 'Little Hay' then 1
  when fixture_date = '2026-08-02'::date and name = 'Oakland Park' then 0
end
where (fixture_date = '2026-03-29'::date and name = 'Stockwood Park')
   or (fixture_date = '2026-04-19'::date and name = 'Little Hay')
   or (fixture_date = '2026-08-02'::date and name = 'Oakland Park');

with hole_totals as (
  select e.id as fixture_entry_id,
    sum(least(
      hs.gross_score,
      ch.par + 2
        + floor(greatest(0, coalesce(e.course_handicap, 0)) / 18.0)::integer
        + case when ch.stroke_index <= mod(greatest(0, coalesce(e.course_handicap, 0))::integer, 18)
          then 1 else 0 end
    )) as adjusted_gross,
    count(hs.fixture_entry_id) as holes_recorded
  from public.fixture_entries e
  join public.fixtures f on f.id = e.fixture_id
  join public.hole_scores hs on hs.fixture_entry_id = e.id
  join public.course_holes ch on ch.course_setup_id = f.course_setup_id and ch.hole_number = hs.hole_number
  where (f.fixture_date = '2026-03-29'::date and f.name = 'Stockwood Park')
     or (f.fixture_date = '2026-04-19'::date and f.name = 'Little Hay')
     or (f.fixture_date = '2026-08-02'::date and f.name = 'Oakland Park')
  group by e.id
)
update public.fixture_entries e
set adjusted_gross_score = ht.adjusted_gross,
    score_differential = round(
      ((ht.adjusted_gross - cs.course_rating - coalesce(f.playing_conditions_adjustment, 0)) * 113 / cs.slope_rating)::numeric,
      1
    )
from hole_totals ht
join public.fixture_entries source_entry on source_entry.id = ht.fixture_entry_id
join public.fixtures f on f.id = source_entry.fixture_id
join public.course_setups cs on cs.id = f.course_setup_id
where e.id = ht.fixture_entry_id
  and e.score_status = 'completed'
  and ht.holes_recorded = 18;

commit;
