-- Run once in Supabase Dashboard -> SQL Editor before testing fixture handicap overrides.

alter table public.fixture_participants
  add column if not exists playing_handicap_override integer
  check (playing_handicap_override between -10 and 28);

alter table public.players
  add column if not exists guest_handicap_index numeric(4,1)
  check (guest_handicap_index between -10 and 54),
  add column if not exists guest_handicap_updated_at timestamptz;

-- Preserve the most recently recorded guest index as a helpful starting point
-- when that player returns for a later fixture.
with latest_guest_index as (
  select distinct on (fp.player_id) fp.player_id, fp.handicap_index_override
  from public.fixture_participants fp
  join public.players p on p.id = fp.player_id
  where p.is_guest and fp.handicap_index_override is not null
  order by fp.player_id, fp.created_at desc
)
update public.players p
set guest_handicap_index = latest_guest_index.handicap_index_override,
    guest_handicap_updated_at = now()
from latest_guest_index
where p.id = latest_guest_index.player_id
  and p.guest_handicap_index is null;
