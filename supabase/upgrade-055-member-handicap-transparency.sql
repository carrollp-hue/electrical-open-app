-- The society has agreed that signed-in members can review each member's
-- handicap history. This does not expose profiles, contact details or admin data.
drop policy if exists "Members view own handicap history" on public.handicap_snapshots;

create policy "Members view handicap history"
on public.handicap_snapshots
for select to authenticated
using (true);
