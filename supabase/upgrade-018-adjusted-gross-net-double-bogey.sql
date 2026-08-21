-- Enforce WHS net-double-bogey maximums for the adjusted gross score used in
-- score differential calculations: maximum nett score on any hole = par + 2.
create or replace function public.refresh_adjusted_gross_score(p_entry_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries e
  set adjusted_gross_score = calculated.adjusted_gross_score
  from (
    select e2.id, sum(least(
      hs.gross_score,
      ch.par + 2 +
        (case when coalesce(e2.course_handicap, 0) < 0 then -1 else 1 end) *
        (floor(abs(coalesce(e2.course_handicap, 0))::numeric / 18)::integer +
          case when ch.stroke_index <= mod(abs(coalesce(e2.course_handicap, 0)), 18) then 1 else 0 end)
    ))::integer as adjusted_gross_score
    from public.fixture_entries e2
    join public.fixtures f on f.id = e2.fixture_id
    join public.course_holes ch on ch.course_setup_id = f.course_setup_id
    join public.hole_scores hs on hs.fixture_entry_id = e2.id and hs.hole_number = ch.hole_number
    where e2.id = p_entry_id
    group by e2.id, e2.course_handicap
  ) calculated
  where e.id = calculated.id;
end $$;

create or replace function public.trigger_refresh_adjusted_gross_score()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    perform public.refresh_adjusted_gross_score(old.fixture_entry_id);
    return old;
  end if;
  perform public.refresh_adjusted_gross_score(new.fixture_entry_id);
  return new;
end $$;

drop trigger if exists refresh_adjusted_gross_after_hole_score on public.hole_scores;
create trigger refresh_adjusted_gross_after_hole_score
after insert or update of gross_score or delete on public.hole_scores
for each row execute function public.trigger_refresh_adjusted_gross_score();

-- Bring existing saved scorecards into line with the same calculation.
do $$
declare entry_record record;
begin
  for entry_record in select distinct fixture_entry_id from public.hole_scores loop
    perform public.refresh_adjusted_gross_score(entry_record.fixture_entry_id);
  end loop;
end $$;
