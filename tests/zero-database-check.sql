do $$
declare v_count integer; v_entry public.fixture_entries%rowtype; v_hole public.hole_scores%rowtype;
begin
  if not public.scorecards_match_with_pickups((select own_scores from public.member_scorecards where own_status='submitted'), (select marked_scores from public.member_scorecards where marked_status='submitted'), '00000000-0000-0000-0000-000000000001', 28) then raise exception 'equivalent pickup should match'; end if;
  if public.scorecards_match_with_pickups('[0,0,0]'::jsonb, '[0,0,0]'::jsonb, '00000000-0000-0000-0000-000000000001', 28) then raise exception 'incomplete cards must not match'; end if;
  v_count := public.promote_verified_fixture_scorecards('00000000-0000-0000-0000-000000000002');
  if v_count <> 1 then raise exception 'expected one promoted card, got %', v_count; end if;
  select * into strict v_entry from public.fixture_entries;
  select * into strict v_hole from public.hole_scores where hole_number = 15;
  if v_hole.gross_score <> 7 or v_hole.nett_score <> 6 or v_hole.stableford_points <> 0 then raise exception 'incorrect hole values %', row_to_json(v_hole); end if;
  if v_entry.adjusted_gross_score <> 75 then raise exception 'incorrect capped playing-handicap adjusted total %', v_entry.adjusted_gross_score; end if;
  if (select count(*) from public.hole_scores) <> 18 then raise exception 'expected 18 hole scores'; end if;
end $$;
