-- Let a signed-in member confirm or update only their own club handicap.
-- A confirmation refreshes the submitted date even where the value is unchanged.
create or replace function public.submit_my_club_handicap(p_club_handicap numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_club_handicap is null or p_club_handicap < 0 or p_club_handicap > 54 then
    raise exception 'Enter a club handicap from 0.0 to 54.0.';
  end if;

  update public.players
  set club_handicap = round(p_club_handicap, 1),
      club_handicap_submitted_at = now()
  where profile_id = auth.uid() and not is_guest;

  if not found then
    raise exception 'No eligible player profile is linked to this account.';
  end if;
end $$;

revoke all on function public.submit_my_club_handicap(numeric) from public;
grant execute on function public.submit_my_club_handicap(numeric) to authenticated;

-- Supplies the pre-club society calculation so the app can explain when the
-- lower club handicap is the figure being used.
create or replace function public.current_handicap_details()
returns table (player_id uuid, index_value numeric, calculated_at timestamptz,
  calculated_society_index numeric, club_handicap_used boolean)
language sql stable security definer set search_path = public as $$
  select distinct on (hs.player_id)
    hs.player_id, hs.index_value, hs.calculated_at,
    nullif(hs.calculation ->> 'calculated_index', '')::numeric as calculated_society_index,
    coalesce(p.club_handicap < nullif(hs.calculation ->> 'calculated_index', '')::numeric, false) as club_handicap_used
  from public.handicap_snapshots hs
  join public.players p on p.id = hs.player_id
  order by hs.player_id,
    coalesce(hs.calculation ->> 'source' = 'Initial workbook migration', false) asc,
    hs.calculated_at desc, hs.id desc
$$;

revoke all on function public.current_handicap_details() from public;
grant execute on function public.current_handicap_details() to authenticated;
