-- Make the scorecard-derived WHS differential authoritative for completed 2026 fixtures.
-- Non Returns use the handicap index recorded at entry plus 5.0.
-- historic_display_differential is intentionally retained as an audit reference only.

begin;

with hole_totals as (
  select e.id as fixture_entry_id,
    sum(least(
      hs.gross_score,
      ch.par + 2
        + floor(greatest(0, coalesce(e.course_handicap, 0)) / 18.0)::integer
        + case when ch.stroke_index <= mod(greatest(0, coalesce(e.course_handicap, 0))::integer, 18)
          then 1 else 0 end
    )) as recalculated_adjusted_gross,
    count(*) as holes_recorded
  from public.fixture_entries e
  join public.hole_scores hs on hs.fixture_entry_id = e.id
  join public.fixtures f on f.id = e.fixture_id
  join public.course_holes ch
    on ch.course_setup_id = f.course_setup_id
   and ch.hole_number = hs.hole_number
  where f.fixture_date >= date '2026-01-01'
    and f.fixture_date <= current_date
    and f.status in ('completed', 'published')
  group by e.id
)
update public.fixture_entries e
set adjusted_gross_score = ht.recalculated_adjusted_gross,
    score_differential = round(
      ((ht.recalculated_adjusted_gross - cs.course_rating
        - coalesce(f.playing_conditions_adjustment, 0)) * 113 / cs.slope_rating)::numeric,
      1
    )
from hole_totals ht, public.fixtures f, public.course_setups cs
where e.id = ht.fixture_entry_id
  and f.id = e.fixture_id
  and cs.id = f.course_setup_id
  and e.score_status = 'completed'
  and ht.holes_recorded = 18;

update public.fixture_entries e
set score_differential = round((e.handicap_index_at_entry + 5)::numeric, 1)
from public.fixtures f
where e.fixture_id = f.id
  and f.fixture_date >= date '2026-01-01'
  and f.fixture_date <= current_date
  and f.status in ('completed', 'published')
  and e.score_status = 'non_return'
  and e.handicap_index_at_entry is not null;

commit;
