-- Three-card pathway for a new society player who has no established handicap.
-- Assessment cards use par + 2 per hole (the app stores zero handicap strokes),
-- do not receive positions or OOM points, and establish an index after card 3.

create or replace function public.trigger_recalculate_society_index()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_player_id uuid;
  v_latest_fixture_id uuid;
  v_initial_card_count integer;
  v_has_snapshot boolean;
begin
  v_player_id := case when tg_op = 'DELETE' then old.player_id else new.player_id end;
  if exists (select 1 from public.players p where p.id = v_player_id and not p.is_guest) then
    select exists (select 1 from public.handicap_snapshots hs where hs.player_id = v_player_id)
      into v_has_snapshot;
    select count(*) into v_initial_card_count
    from public.fixture_entries e
    where e.player_id = v_player_id
      and e.handicap_index_at_entry is null
      and e.score_differential is not null;

    -- A player without a starting index receives their first index only after
    -- three completed assessment cards.
    if v_has_snapshot or v_initial_card_count >= 3 then
      select e.fixture_id into v_latest_fixture_id
      from public.fixture_entries e join public.fixtures f on f.id = e.fixture_id
      where e.player_id = v_player_id and e.score_differential is not null
      order by f.fixture_date desc, e.entered_at desc limit 1;
      if v_latest_fixture_id is not null then
        perform public.recalculate_society_index(v_player_id, v_latest_fixture_id);
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Assessment cards have no Stableford score, so do not give them a finishing
-- position until their society index has been established.
create or replace function public.recalculate_fixture_positions(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries set competition_position = null, order_of_merit_points = 0 where fixture_id = p_fixture_id;
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
    from public.fixture_entries e left join public.hole_scores h on h.fixture_entry_id = e.id
    where e.fixture_id = p_fixture_id and e.score_status = 'completed' and e.stableford_points is not null
    group by e.id, e.stableford_points
  ), ranked as (
    select id, row_number() over (order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc, front9 desc, front6 desc, front3 desc, h9 desc) as position from scored
  ) update public.fixture_entries e set competition_position = r.position from ranked r where e.id = r.id;
end $$;

create or replace function public.award_fixture_oom(p_fixture_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.fixture_entries set order_of_merit_points = 0 where fixture_id = p_fixture_id;
  if not coalesce((select is_oom_qualifying from public.fixtures where id = p_fixture_id), true) then return; end if;
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
    from public.fixture_entries e join public.fixture_participants fp on fp.fixture_id = e.fixture_id and fp.player_id = e.player_id
    left join public.hole_scores h on h.fixture_entry_id = e.id
    where e.fixture_id = p_fixture_id and e.score_status = 'completed' and not fp.is_guest and e.stableford_points is not null
    group by e.id, e.stableford_points
  ), ranked as (
    select id, row_number() over (order by stableford_points desc, back9 desc, back6 desc, back3 desc, h18 desc, front9 desc, front6 desc, front3 desc, h9 desc) as position from scored
  ) update public.fixture_entries e set order_of_merit_points = case r.position
    when 1 then 20 when 2 then 16 when 3 then 12 when 4 then 8 when 5 then 6 else 1 end
    from ranked r where e.id = r.id;
  update public.fixture_entries e set order_of_merit_points = 1
  from public.fixture_participants fp
  where e.fixture_id = p_fixture_id and fp.fixture_id = e.fixture_id and fp.player_id = e.player_id
    and not fp.is_guest and e.score_status = 'non_return';
end $$;
