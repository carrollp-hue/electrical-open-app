-- Make each member's current society index available for future-fixture start sheets.
-- Personal historical handicap records remain private; the app calls this function
-- instead of querying other players' snapshot rows directly.
drop policy if exists "Members view current handicap index" on public.handicap_snapshots;
drop function if exists public.is_current_handicap_snapshot(uuid);

create or replace function public.current_handicap_indexes()
returns table (player_id uuid, index_value numeric, calculated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (hs.player_id) hs.player_id, hs.index_value, hs.calculated_at
  from public.handicap_snapshots hs
  order by hs.player_id, hs.calculated_at desc, hs.id desc
$$;

revoke all on function public.current_handicap_indexes() from public;
grant execute on function public.current_handicap_indexes() to authenticated;
