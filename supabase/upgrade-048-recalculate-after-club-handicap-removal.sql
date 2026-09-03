-- Clearing a club handicap changes the effective index immediately. Rebuild the
-- player's latest stored snapshot so the app does not continue to display the
-- former (lower) club handicap until another score is entered.

create or replace function public.approve_club_handicap_removal(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_profile_id uuid;
  v_player_id uuid;
  v_player_name text;
  v_latest_fixture_id uuid;
begin
  if not public.is_membership_admin() then
    raise exception 'Membership administrator access is required.';
  end if;

  update public.players p
  set club_handicap = null, club_handicap_submitted_at = null
  from public.club_handicap_removal_requests r
  where r.id = p_request_id and r.status = 'pending' and p.id = r.player_id
  returning p.id, p.profile_id, p.first_name || ' ' || p.surname
    into v_player_id, v_profile_id, v_player_name;

  if not found then
    raise exception 'This request has already been processed or no longer exists.';
  end if;

  -- Recalculate against the most recent qualifying fixture for this player.
  select e.fixture_id into v_latest_fixture_id
  from public.fixture_entries e
  join public.fixtures f on f.id = e.fixture_id
  where e.player_id = v_player_id and e.score_differential is not null
  order by f.fixture_date desc, e.entered_at desc
  limit 1;

  if v_latest_fixture_id is not null then
    perform public.recalculate_society_index(v_player_id, v_latest_fixture_id);
  end if;

  update public.club_handicap_removal_requests
  set status = 'approved', processed_at = now(), processed_by = auth.uid()
  where id = p_request_id and status = 'pending';

  if v_profile_id is not null then
    insert into public.app_notifications (title, body, url, audience, recipient_profile_id)
    values (
      'Club handicap removed',
      'Your club handicap has been removed. Your society index is now being used.',
      '/#handicap', 'profile', v_profile_id
    );
  end if;
end;
$function$;

-- One-time repair for anyone whose most recent snapshot still records a club
-- handicap although the player record no longer has one.
do $repair$
declare
  r record;
begin
  for r in
    select distinct on (p.id) p.id as player_id, e.fixture_id
    from public.players p
    join public.fixture_entries e on e.player_id = p.id and e.score_differential is not null
    join public.fixtures f on f.id = e.fixture_id
    join public.handicap_snapshots hs on hs.player_id = p.id and hs.fixture_id = e.fixture_id
    where p.club_handicap is null
      and nullif(hs.calculation ->> 'club_handicap', '') is not null
    order by p.id, f.fixture_date desc, e.entered_at desc
  loop
    perform public.recalculate_society_index(r.player_id, r.fixture_id);
  end loop;
end;
$repair$;

revoke all on function public.approve_club_handicap_removal(uuid) from public;
grant execute on function public.approve_club_handicap_removal(uuid) to authenticated;
