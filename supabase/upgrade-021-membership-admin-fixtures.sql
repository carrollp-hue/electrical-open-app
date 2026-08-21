-- Membership admins may create and edit fixture calendar details, but not
-- attach/edit course details, alter scores, finalize, publish, or commit.
drop policy if exists "Membership admins create fixtures" on public.fixtures;
create policy "Membership admins create fixtures" on public.fixtures for insert to authenticated
with check (public.is_membership_admin());

drop policy if exists "Membership admins edit fixtures" on public.fixtures;
create policy "Membership admins edit fixtures" on public.fixtures for update to authenticated
using (public.is_membership_admin())
with check (public.is_membership_admin());

create or replace function public.restrict_membership_admin_fixture_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_membership_admin() and not public.is_staff() then
    if TG_OP = 'INSERT' then
      if new.course_setup_id is not null or new.handicap_allowance <> 1
         or new.playing_conditions_adjustment <> 0 or new.scores_finalized_at is not null
         or new.status <> 'draft' then
        raise exception 'Membership admins may only create draft fixture calendar details';
      end if;
    elsif new.course_setup_id is distinct from old.course_setup_id
       or new.handicap_allowance is distinct from old.handicap_allowance
       or new.playing_conditions_adjustment is distinct from old.playing_conditions_adjustment
       or new.scores_finalized_at is distinct from old.scores_finalized_at
       or new.status is distinct from old.status
       or new.published_at is distinct from old.published_at then
      raise exception 'Membership admins cannot change course details, scores, or fixture status';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists restrict_membership_admin_fixture_changes_before_save on public.fixtures;
create trigger restrict_membership_admin_fixture_changes_before_save
before insert or update on public.fixtures
for each row execute function public.restrict_membership_admin_fixture_changes();
