-- Let membership administrators decline a club-handicap removal request.
-- Rejection preserves the member's club handicap and sends a private notification.

alter table public.club_handicap_removal_requests
  drop constraint if exists club_handicap_removal_requests_status_check;

alter table public.club_handicap_removal_requests
  add constraint club_handicap_removal_requests_status_check
  check (status in ('pending', 'approved', 'rejected'));

create or replace function public.reject_club_handicap_removal(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_profile_id uuid;
begin
  if not public.is_membership_admin() then
    raise exception 'Membership administrator access is required.';
  end if;

  update public.club_handicap_removal_requests r
  set status = 'rejected', processed_at = now(), processed_by = auth.uid()
  from public.players p
  where r.id = p_request_id and r.status = 'pending' and p.id = r.player_id
  returning p.profile_id into v_profile_id;

  if not found then
    raise exception 'This request has already been processed or no longer exists.';
  end if;

  if v_profile_id is not null then
    insert into public.app_notifications (title, body, url, audience, recipient_profile_id)
    values (
      'Club handicap removal request declined',
      'Your club handicap has not been removed. Please speak to a membership administrator if you have any questions.',
      '/#handicap',
      'profile',
      v_profile_id
    );
  end if;
end;
$function$;

revoke all on function public.reject_club_handicap_removal(uuid) from public;
grant execute on function public.reject_club_handicap_removal(uuid) to authenticated;
