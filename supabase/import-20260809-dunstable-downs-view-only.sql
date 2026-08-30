-- Historic display-only import: Dunstable Downs, CA Trophy, 9 August 2026.
-- This deliberately leaves score_differential NULL, does not create handicap
-- snapshots, and leaves the fixture archived so it cannot affect live scoring.

begin;

create temporary table dunstable_import (
  surname text, first_name text, handicap_index numeric, playing_handicap integer,
  gross_score integer, nett_score integer, stableford_points integer,
  competition_position integer, order_of_merit_points integer, score_status text,
  hole_scores integer[]
) on commit drop;

insert into dunstable_import values
  ('KEANE','Matt',15.8,15,83,68,38,1,20,'completed',array[4,4,8,5,3,5,5,5,3,5,5,4,4,5,5,6,5,2]),
  ('O''NEILL','Gary',25.9,25,94,69,37,2,16,'completed',array[6,5,5,7,6,4,4,6,4,7,5,5,4,6,6,5,5,4]),
  ('O''NEILL','Ryan',20.5,20,91,71,35,3,12,'completed',array[5,4,6,6,4,5,4,6,6,6,6,5,3,5,5,5,6,4]),
  ('HOLE','Dave',26.9,26,100,74,32,4,8,'completed',array[5,4,7,5,4,5,6,6,6,7,5,6,6,6,7,6,5,4]),
  ('KELLY','Paul',8.9,8,84,76,30,5,6,'completed',array[5,4,5,5,3,3,5,6,5,6,5,4,3,5,5,7,5,3]),
  ('DOOLAN','Paul',11.3,10,86,76,29,6,1,'completed',array[7,4,6,6,4,6,5,5,3,4,4,5,3,5,4,6,5,4]),
  ('KELLY','Brendan',23.4,23,104,81,27,7,1,'completed',array[5,4,8,6,4,7,4,8,6,5,8,6,7,4,6,5,6,5]),
  ('KEANE','Joe',27.5,27,109,82,25,8,1,'completed',array[7,5,9,6,5,5,6,7,3,8,5,9,6,6,6,6,5,5]),
  ('HARRISON','Nick',30.0,28,111,83,22,9,1,'completed',array[9,4,8,8,6,7,6,6,5,6,6,6,5,7,6,7,6,3]),
  ('MILES','Gary',20.7,20,105,85,21,10,1,'completed',array[6,4,8,7,4,5,7,8,5,7,6,5,6,6,6,4,6,5]),
  ('RAMBO','John',25.0,24,109,85,21,10,1,'completed',array[7,5,7,7,5,7,6,8,4,7,8,5,4,5,6,6,6,6]),
  ('SIMMONDS','Andy',16.8,16,102,86,21,10,1,'completed',array[7,4,8,6,5,5,6,6,4,6,7,6,4,5,7,7,4,5]),
  ('BAZELEY','Darryl',18.0,17,null,null,0,13,1,'non_return',null),
  ('BISSET','Alec',23.3,23,null,null,0,13,1,'non_return',null),
  ('CARROLL','Paul',17.5,17,null,null,0,13,1,'non_return',null),
  ('FLEMING','Dave',16.9,16,null,null,0,13,1,'non_return',null),
  ('NICHOLLS','Andy',29.0,28,null,null,0,13,1,'non_return',null),
  ('O''NEILL','Darren',17.7,17,null,null,0,13,1,'non_return',null),
  ('REEVES','Ade',10.2,9,null,null,0,13,1,'non_return',null);

do $$
declare
  v_course_id uuid;
  v_setup_id uuid;
  v_fixture_id uuid := '9cd569f1-eb01-4a35-b9d0-363b6c6fabde';
begin
  if (select count(*) from dunstable_import d join public.players p on p.surname = d.surname and p.first_name = d.first_name) <> 19 then
    raise exception 'Dunstable import stopped: one or more workbook player names could not be matched';
  end if;

  insert into public.courses (name) values ('Dunstable Downs') on conflict (name) do nothing;
  select id into v_course_id from public.courses where name = 'Dunstable Downs';

  insert into public.course_setups (course_id, tee_name, course_rating, slope_rating, par, effective_from)
  select v_course_id, 'Yellow', 68.6, 116, 70, date '2026-08-09'
  where not exists (
    select 1 from public.course_setups
    where course_id = v_course_id and tee_name = 'Yellow' and effective_from = date '2026-08-09'
  );
  select id into v_setup_id from public.course_setups
  where course_id = v_course_id and tee_name = 'Yellow' and effective_from = date '2026-08-09';

  insert into public.course_holes (course_setup_id, hole_number, par, stroke_index) values
    (v_setup_id,1,5,10),(v_setup_id,2,3,14),(v_setup_id,3,5,3),(v_setup_id,4,4,8),
    (v_setup_id,5,3,16),(v_setup_id,6,4,6),(v_setup_id,7,4,12),(v_setup_id,8,4,1),
    (v_setup_id,9,3,18),(v_setup_id,10,4,7),(v_setup_id,11,4,2),(v_setup_id,12,4,5),
    (v_setup_id,13,4,13),(v_setup_id,14,4,15),(v_setup_id,15,4,9),(v_setup_id,16,4,4),
    (v_setup_id,17,4,11),(v_setup_id,18,3,17)
  on conflict do nothing;

  update public.fixtures set
    name = 'Dunstable Downs', competition_name = 'CA Trophy', format = 'Stableford',
    course_setup_id = v_setup_id, playing_conditions_adjustment = 1,
    status = 'archived', is_historical = true, scores_finalized_at = null,
    published_at = coalesce(published_at, now())
  where id = v_fixture_id;
  if not found then raise exception 'Dunstable placeholder fixture was not found'; end if;

  delete from public.fixture_entries where fixture_id = v_fixture_id;
  delete from public.fixture_participants where fixture_id = v_fixture_id;

  insert into public.fixture_participants (fixture_id, player_id, handicap_index_override, is_guest)
  select v_fixture_id, p.id, d.handicap_index, p.is_guest
  from dunstable_import d join public.players p on p.surname = d.surname and p.first_name = d.first_name;

  insert into public.fixture_entries (
    fixture_id, player_id, handicap_index_at_entry, course_handicap, playing_handicap,
    gross_score, nett_score, stableford_points, competition_position,
    order_of_merit_points, score_status, score_differential, esr_adjustment, winner_cut
  )
  select v_fixture_id, p.id, d.handicap_index, d.playing_handicap, d.playing_handicap,
    d.gross_score, d.nett_score, d.stableford_points, d.competition_position,
    d.order_of_merit_points, d.score_status, null, 0, 0
  from dunstable_import d join public.players p on p.surname = d.surname and p.first_name = d.first_name;

  insert into public.hole_scores (fixture_entry_id, hole_number, gross_score, handicap_strokes, nett_score, stableford_points)
  select e.id, score.hole_number, score.gross_score, strokes.value,
    score.gross_score - strokes.value,
    greatest(0, 2 + hole.par - (score.gross_score - strokes.value))
  from dunstable_import d
  join public.players p on p.surname = d.surname and p.first_name = d.first_name
  join public.fixture_entries e on e.fixture_id = v_fixture_id and e.player_id = p.id
  cross join lateral unnest(d.hole_scores) with ordinality as score(gross_score, hole_number)
  join public.course_holes hole on hole.course_setup_id = v_setup_id and hole.hole_number = score.hole_number
  cross join lateral (
    select floor(d.playing_handicap::numeric / 18)::integer
      + case when hole.stroke_index <= mod(d.playing_handicap, 18) then 1 else 0 end as value
  ) strokes;

  -- Differential values are applied by the later WHS recalculation migration.
  -- Do not clear them here: the completed 2026 cards are qualifying app data.
end $$;

commit;

-- Verification: 19 entrants, 12 completed cards and 216 holes.
select
  (select count(*) from public.fixture_participants where fixture_id = '9cd569f1-eb01-4a35-b9d0-363b6c6fabde') as participants,
  (select count(*) from public.fixture_entries where fixture_id = '9cd569f1-eb01-4a35-b9d0-363b6c6fabde' and score_status = 'completed') as completed_cards,
  (select count(*) from public.hole_scores h join public.fixture_entries e on e.id = h.fixture_entry_id where e.fixture_id = '9cd569f1-eb01-4a35-b9d0-363b6c6fabde') as hole_scores,
  (select count(*) from public.fixture_entries where fixture_id = '9cd569f1-eb01-4a35-b9d0-363b6c6fabde' and score_differential is not null) as differentials;
