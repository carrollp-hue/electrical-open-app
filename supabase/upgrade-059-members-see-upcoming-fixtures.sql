-- Upcoming fixtures are the society calendar.  They are created in the
-- "draft" state so administrators can continue to manage participants and
-- course details; that must not hide the calendar from ordinary members.
-- Completed and archived fixtures retain their existing visibility rules.

drop policy if exists "Members see published fixtures" on public.fixtures;

create policy "Members see upcoming and published fixtures"
on public.fixtures
for select
to authenticated
using (
  status in ('draft', 'published', 'completed', 'archived')
  or public.is_staff()
);
