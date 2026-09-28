-- A zero in a member-entered paired scorecard means net double bogey, not a
-- literal zero strokes. It therefore earns no Stableford points.
create or replace function public.promote_verified_fixture_scorecards(p_fixture_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_fixture record; v_card record; v_entry_id uuid; v_course_handicap integer;
  v_playing_handicap integer; v_gross integer; v_nett integer; v_points integer;
  v_adjusted_gross integer; v_promoted integer := 0;
begin
  if not public.is_staff() then raise exception 'Administrator access is required'; end if;
  select f.id, f.course_setup_id, f.handicap_allowance, cs.course_rating, cs.slope_rating, cs.par
  into v_fixture from public.fixtures f join public.course_setups cs on cs.id = f.course_setup_id
  where f.id = p_fixture_id;
  if not found then raise exception 'This fixture needs a complete course scorecard before verified cards can be promoted'; end if;
  if (select count(*) from public.course_holes where course_setup_id = v_fixture.course_setup_id) <> 18 then raise exception 'This fixture needs a complete 18-hole course scorecard before verified cards can be promoted'; end if;
  for v_card in
    select c.* from public.member_scorecards c
    join public.fixture_participants fp on fp.fixture_id = c.fixture_id and fp.player_id = c.scorer_player_id
    left join public.fixture_entries e on e.fixture_id = c.fixture_id and e.player_id = c.scorer_player_id
    where c.fixture_id = p_fixture_id and c.own_status = 'submitted' and jsonb_array_length(c.own_scores) = 18 and e.id is null
      and exists (select 1 from public.member_scorecards marker where marker.fixture_id = c.fixture_id and marker.marked_player_id = c.scorer_player_id and marker.marked_status = 'submitted' and marker.marked_scores = c.own_scores)
  loop
    v_course_handicap := coalesce(v_card.own_course_handicap, round(v_card.own_handicap_index * v_fixture.slope_rating / 113 + v_fixture.course_rating - v_fixture.par)::integer);
    v_playing_handicap := coalesce(v_card.own_playing_handicap, least(28, round(v_course_handicap * coalesce(v_fixture.handicap_allowance, 1))::integer));
    select
      sum(case when score.value::integer = 0 then hole.par + 2 + strokes.playing else score.value::integer end),
      sum(case when score.value::integer = 0 then hole.par + 2 else score.value::integer - strokes.playing end),
      sum(case when score.value::integer = 0 then 0 else greatest(0, 2 + hole.par - (score.value::integer - strokes.playing)) end),
      sum(case when score.value::integer = 0 then hole.par + 2 + strokes.course else least(score.value::integer, hole.par + 2 + strokes.course) end)
    into v_gross, v_nett, v_points, v_adjusted_gross
    from jsonb_array_elements_text(v_card.own_scores) with ordinality as score(value, hole_number)
    join public.course_holes hole on hole.course_setup_id = v_fixture.course_setup_id and hole.hole_number = score.hole_number
    cross join lateral (select (v_playing_handicap / 18) + case when hole.stroke_index <= mod(v_playing_handicap, 18) then 1 else 0 end as playing, (v_course_handicap / 18) + case when hole.stroke_index <= mod(v_course_handicap, 18) then 1 else 0 end as course) strokes;
    insert into public.fixture_entries (fixture_id, player_id, handicap_index_at_entry, course_handicap, playing_handicap, gross_score, nett_score, stableford_points, adjusted_gross_score, score_differential, order_of_merit_points, esr_adjustment, winner_cut, score_status)
    values (p_fixture_id, v_card.scorer_player_id, v_card.own_handicap_index, v_course_handicap, v_playing_handicap, v_gross, v_nett, v_points, v_adjusted_gross, null, 0, 0, 0, 'completed') returning id into v_entry_id;
    insert into public.hole_scores (fixture_entry_id, hole_number, gross_score, handicap_strokes, nett_score, stableford_points)
    select v_entry_id, hole.hole_number,
      case when score.value::integer = 0 then hole.par + 2 + strokes.playing else score.value::integer end,
      strokes.playing,
      case when score.value::integer = 0 then hole.par + 2 else score.value::integer - strokes.playing end,
      case when score.value::integer = 0 then 0 else greatest(0, 2 + hole.par - (score.value::integer - strokes.playing)) end
    from jsonb_array_elements_text(v_card.own_scores) with ordinality as score(value, hole_number)
    join public.course_holes hole on hole.course_setup_id = v_fixture.course_setup_id and hole.hole_number = score.hole_number
    cross join lateral (select (v_playing_handicap / 18) + case when hole.stroke_index <= mod(v_playing_handicap, 18) then 1 else 0 end as playing) strokes;
    v_promoted := v_promoted + 1;
  end loop;
  return v_promoted;
end $$;
