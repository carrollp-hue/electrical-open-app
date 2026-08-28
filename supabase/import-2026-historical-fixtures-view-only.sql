-- Historic display-only import: remaining completed fixtures in the 2026 workbook archive.
-- Source: OneDrive/Electrical Open/Completed Fixtures/2026/*.xlsm
--
-- This creates archived historical fixtures only.  It deliberately leaves every
-- score differential NULL, does not create handicap snapshots and cannot affect
-- current handicap indexes or Order of Merit calculations.
--
-- Dunstable Downs (9 Aug 2026) is already imported separately, with its verified
-- hole-by-hole course card.  The seven fixtures below retain their published
-- result tables; no holes are invented where a verified card was not supplied.

begin;

create temporary table historic_fixture_import (
  fixture_date date not null,
  course_name text not null,
  competition_name text not null,
  course_rating numeric not null,
  slope_rating integer not null,
  course_par integer not null,
  pcc integer not null,
  surname text not null,
  first_name text not null,
  handicap_index numeric,
  playing_handicap integer,
  gross_score integer,
  nett_score integer,
  stableford_points integer not null,
  competition_position integer,
  order_of_merit_points integer not null
) on commit drop;

insert into historic_fixture_import values
  -- 29 March: Stockwood Park, Swan Trophy
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'MCELVENNY','Ben',24,24,91,67,38,null,0),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'DIMMOCK','Dave',25.1,25,95,70,36,1,20),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'O''NEILL','Ryan',25.3,26,95,69,36,2,16),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'REEVES','Ade',10.9,10,81,71,34,3,12),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'DOOLAN','Paul',11.7,11,83,72,33,4,8),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'BRITTON','Gary',6.4,6,79,73,32,5,6),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'DOOLAN','Mark',21.6,22,95,73,32,6,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'KELLY','Brendan',28.6,28,103,75,30,7,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'OBEE','Gary',23.2,23,98,75,30,7,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'BREWER','Nick',8.7,8,84,76,29,9,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'CARROLL','Paul',13.9,14,91,77,29,9,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'KEANE','Matt',14.9,15,92,77,28,11,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'KEANE','Joe',27.5,28,103,75,27,12,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'NICHOLLS','Andy',0,-1,96,97,26,13,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'O''NEILL','Gary',23.4,24,104,80,26,13,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'HARRISON','Nick',30.3,28,116,88,25,15,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'HOLE','Dave',28.1,28,108,80,25,15,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'HARRISON','Carl',0,-1,96,97,24,null,0),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'O''NEILL','Darren',14.4,14,97,83,22,17,1),
  ('2026-03-29','Stockwood Park','Swan Trophy',67.9,119,69,2,'CLIFFORD','John',0,-1,101,102,15,18,1),
  -- 19 April: Little Hay, Doolan Cup
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'DOOLAN','Mark',21.5,21,93,72,36,1,20),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'FLEMING','Dave',17.3,17,86,69,36,2,16),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'O''NEILL','Ryan',24.2,24,98,74,34,3,12),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'SIMMONDS','Andy',16.8,16,93,77,31,4,8),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'KEANE','Matt',15.9,15,90,75,30,5,6),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'DIMMOCK','Dave',22.7,23,101,78,29,6,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'O''NEILL','Gary',23.4,23,102,79,29,6,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'BISSET','Alec',22.9,23,105,82,26,8,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'BRITTON','Gary',6.7,5,87,82,26,8,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'HARRISON','Nick',31,28,111,83,26,8,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'KELLY','Brendan',28.6,28,110,82,26,8,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'O''NEILL','Darren',14.4,13,100,87,25,12,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'REEVES','Ade',10.2,9,94,85,23,13,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'CARROLL','Paul',14.1,13,102,89,20,14,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'HOLE','Dave',28.1,28,115,87,20,14,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'NICHOLLS','Andy',28,28,107,79,19,16,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'DOOLAN','Paul',10.7,9,100,91,17,17,1),
  ('2026-04-19','Little Hay','Doolan Cup',69.3,126,72,2,'HARRISON','Carl',28,28,107,79,13,18,1),
  -- 14 June: Colmworth Golf Club, Carterlee Cup
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'DOOLAN','Mark',19.3,17,96,79,29,1,20),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'DOOLAN','Paul',10.7,8,88,80,28,2,16),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'BREARY','Gary',8.6,6,86,80,28,3,12),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'CARROLL','Paul',15.2,13,94,81,27,4,8),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'KEANE','Matt',15.9,13,97,84,24,5,6),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'O''NEILL','Gary',23.4,21,105,84,24,6,1),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'HOLE','Dave',28.1,26,110,84,24,7,1),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'HARRISON','Nick',31,28,113,85,23,8,1),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'FLEMING','Dave',16,14,103,89,21,9,1),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'DIMMOCK','Dave',22.7,21,110,89,17,10,1),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'KELLY','Brendan',28.6,27,119,92,15,11,1),
  ('2026-06-14','Colmworth Golf Club','Carterlee Cup',69,117,72,1,'REEVES','Ade',10.2,8,null,null,13,12,1),
  -- 28 June: Stevenage Golf Club, Pat O'Neill Memorial
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'O''NEILL','Ryan',23.1,24,92,68,39,1,20),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'DOOLAN','Paul',10.7,10,80,70,37,2,16),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'KEANE','Matt',15.9,16,89,73,34,3,12),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'O''NEILL','Gary',23.4,25,101,76,31,4,8),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'HARRISON','Nick',31,28,109,81,29,5,6),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'FLEMING','Dave',16.5,17,96,79,29,6,1),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'DOOLAN','Mark',18.3,19,98,79,28,7,1),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'KELLY','Brendan',28.6,28,106,78,26,8,1),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'KEANE','Joe',27.5,28,110,82,24,9,1),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'BRITTON','Gary',6.7,6,90,84,23,10,1),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'HOLE','Dave',28.3,28,112,84,22,11,1),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'O''NEILL','Darren',15.4,16,101,85,22,12,1),
  ('2026-06-28','Stevenage Golf Club','Pat O''Neill Memorial',69.4,127,71,1,'REEVES','Ade',10.2,10,93,83,22,13,1),
  -- 5 July: Mill Green, Gary Britton Trophy
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'HARRISON','Nick',31,28,101,73,35,1,20),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'RAMBO','John',0,-3,96,99,35,null,0),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'KELLY','Brendan',28.6,27,104,77,32,2,16),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'FLEMING','Dave',16.5,14,92,78,29,3,12),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'BISSET','Alec',23.3,21,101,80,28,4,8),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'HOLE','Dave',28.3,26,108,82,28,5,6),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'DOOLAN','Mark',18.3,16,96,80,28,6,1),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'DOOLAN','Paul',11.4,9,91,82,26,7,1),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'O''NEILL','Ryan',20.5,18,100,82,26,7,1),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'CARROLL','Paul',15.4,13,96,83,25,9,1),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'O''NEILL','Darren',17.7,15,95,80,25,9,1),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'BRITTON','Gary',6.7,4,89,85,24,11,1),
  ('2026-07-05','Mill Green','Gary Britton Trophy',68.6,119,72,2,'O''NEILL','Gary',23.4,21,108,87,21,12,1),
  -- 15 July: Chartridge Park, Mimram Cup
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'KELLY','Brendan',24.4,25,99,74,30,1,20),
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'DOOLAN','Mark',18.3,18,92,74,30,2,16),
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'DOOLAN','Paul',11.4,12,86,74,30,3,12),
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'HOLE','Dave',28.3,28,106,78,25,4,8),
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'O''NEILL','Darren',17.7,18,101,83,22,5,6),
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'O''NEILL','Gary',23.4,24,105,81,22,6,1),
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'REEVES','Ade',10.2,10,95,85,18,7,1),
  ('2026-07-15','Chartridge Park','Mimram Cup',66.1,113,66,2,'CARROLL','Paul',15.6,16,null,null,0,8,1),
  -- 2 August: Oakland Park, Captains Day
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'HOLE','Dave',28.3,24,89,65,37,1,20),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'DOOLAN','Paul',12.4,9,76,67,36,2,16),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'KELLY','Brendan',23.4,19,89,70,33,3,12),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'CARROLL','Paul',15.7,12,84,72,32,4,8),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'DOOLAN','Mark',19.6,16,94,78,27,5,6),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'BRITTON','Gary',6.7,3,81,78,26,6,1),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'HARRISON','Nick',30,25,105,80,26,7,1),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'O''NEILL','Darren',17.7,14,92,78,25,8,1),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'O''NEILL','Gary',23.4,19,97,78,25,8,1),
  ('2026-08-02','Oakland Park','Captains Day',64.2,106,67,1,'O''NEILL','Ryan',20.5,16,96,80,25,8,1);

do $$
declare
  f record;
  v_course_id uuid;
  v_setup_id uuid;
  v_fixture_id uuid;
begin
  if exists (
    select 1
    from historic_fixture_import d
    left join public.players p on p.surname = d.surname and p.first_name = d.first_name
    where p.id is null
  ) then
    raise exception '2026 historical import stopped: one or more workbook player names could not be matched in public.players';
  end if;

  for f in
    select distinct fixture_date, course_name, competition_name, course_rating, slope_rating, course_par, pcc
    from historic_fixture_import
    order by fixture_date
  loop
    insert into public.courses (name) values (f.course_name)
    on conflict (name) do nothing;
    select id into v_course_id from public.courses where name = f.course_name;

    insert into public.course_setups (course_id, tee_name, course_rating, slope_rating, par, effective_from)
    select v_course_id, 'Historical import', f.course_rating, f.slope_rating, f.course_par, f.fixture_date
    where not exists (
      select 1 from public.course_setups
      where course_id = v_course_id and tee_name = 'Historical import' and effective_from = f.fixture_date
    );
    select id into v_setup_id
    from public.course_setups
    where course_id = v_course_id and tee_name = 'Historical import' and effective_from = f.fixture_date;

    select id into v_fixture_id
    from public.fixtures
    where is_historical = true and fixture_date = f.fixture_date and name = f.course_name
    limit 1;

    if v_fixture_id is null then
      insert into public.fixtures (
        fixture_date, name, competition_name, format, course_setup_id,
        playing_conditions_adjustment, status, is_historical, published_at
      ) values (
        f.fixture_date, f.course_name, f.competition_name, 'Stableford', v_setup_id,
        f.pcc, 'archived', true, now()
      ) returning id into v_fixture_id;
    else
      update public.fixtures set
        competition_name = f.competition_name, format = 'Stableford', course_setup_id = v_setup_id,
        playing_conditions_adjustment = f.pcc, status = 'archived', is_historical = true,
        scores_finalized_at = null, published_at = coalesce(published_at, now())
      where id = v_fixture_id;
    end if;

    delete from public.fixture_entries where fixture_id = v_fixture_id;
    delete from public.fixture_participants where fixture_id = v_fixture_id;

    insert into public.fixture_participants (fixture_id, player_id, handicap_index_override, is_guest)
    select v_fixture_id, p.id, d.handicap_index, p.is_guest
    from historic_fixture_import d
    join public.players p on p.surname = d.surname and p.first_name = d.first_name
    where d.fixture_date = f.fixture_date and d.course_name = f.course_name;

    insert into public.fixture_entries (
      fixture_id, player_id, handicap_index_at_entry, course_handicap, playing_handicap,
      gross_score, nett_score, stableford_points, competition_position,
      order_of_merit_points, score_status, score_differential, esr_adjustment, winner_cut
    )
    select v_fixture_id, p.id, d.handicap_index, d.playing_handicap, d.playing_handicap,
      d.gross_score, d.nett_score, d.stableford_points, d.competition_position,
      d.order_of_merit_points,
      case when d.gross_score is null then 'non_return' else 'completed' end,
      null, 0, 0
    from historic_fixture_import d
    join public.players p on p.surname = d.surname and p.first_name = d.first_name
    where d.fixture_date = f.fixture_date and d.course_name = f.course_name;

    -- The non-return trigger assigns a +5 differential. Clear it so every
    -- imported fixture remains a view-only historic record.
    update public.fixture_entries set score_differential = null where fixture_id = v_fixture_id;
  end loop;
end $$;

commit;

-- Expected verification: 7 historical fixtures, 94 entrants, and zero imported differentials.
select
  count(distinct f.id) as historical_fixtures,
  count(e.id) as entrants,
  count(*) filter (where e.score_differential is not null) as differentials
from public.fixtures f
join public.fixture_entries e on e.fixture_id = f.id
where f.is_historical = true
  and f.fixture_date in (date '2026-03-29', date '2026-04-19', date '2026-06-14', date '2026-06-28', date '2026-07-05', date '2026-07-15', date '2026-08-02');
