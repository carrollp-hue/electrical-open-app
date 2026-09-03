-- Administrator and member in-app/push notifications for club-handicap removal requests.
-- Run this after upgrade-043 and upgrade-045.

alter table public.app_notifications
  add column if not exists audience text not null default 'all';

alter table public.app_notifications
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete cascade;

alter table public.app_notifications
  drop constraint if exists app_notifications_audience_check;

alter table public.app_notifications
  add constraint app_notifications_audience_check
  check (
    (audience in ('all', 'membership_admin') and recipient_profile_id is null)
    or (audience = 'profile' and recipient_profile_id is not null)
  );

drop policy if exists "Members view app notifications" on public.app_notifications;
drop policy if exists "Relevant users view app notifications" on public.app_notifications;

create policy "Relevant users view app notifications"
on public.app_notifications for select to authenticated
using (
  audience = 'all'
  or (audience = 'membership_admin' and public.is_membership_admin())
  or (audience = 'profile' and recipient_profile_id = auth.uid())
);

create or replace function public.request_my_club_handicap_removal()
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_player_id uuid;
  v_player_name text;
begin
  select id, first_name || ' ' || surname
  into v_player_id, v_player_name
  from public.players
  where profile_id = auth.uid() and not is_guest and club_handicap is not null;

  if v_player_id is null then
    raise exception 'There is no club handicap on your linked player profile.';
  end if;

  if exists (
    select 1 from public.club_handicap_removal_requests
    where player_id = v_player_id and status = 'pending'
  ) then
    raise exception 'Your request is already waiting for an administrator.';
  end if;

  insert into public.club_handicap_removal_requests(player_id)
  values (v_player_id);

  insert into public.app_notifications (title, body, url, audience)
  values (
    'Club handicap removal request',
    v_player_name || ' has asked for their club handicap to be removed.',
    '/#admin/members',
    'membership_admin'
  );
end;
$function$;

create or replace function public.approve_club_handicap_removal(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
declare
  v_profile_id uuid;
  v_player_name text;
begin
  if not public.is_membership_admin() then
    raise exception 'Membership administrator access is required.';
  end if;

  update public.players p
  set club_handicap = null, club_handicap_submitted_at = null
  from public.club_handicap_removal_requests r
  where r.id = p_request_id and r.status = 'pending' and p.id = r.player_id
  returning p.profile_id, p.first_name || ' ' || p.surname into v_profile_id, v_player_name;

  if not found then
    raise exception 'This request has already been processed or no longer exists.';
  end if;

  update public.club_handicap_removal_requests
  set status = 'approved', processed_at = now(), processed_by = auth.uid()
  where id = p_request_id and status = 'pending';

  if v_profile_id is not null then
    insert into public.app_notifications (title, body, url, audience, recipient_profile_id)
    values (
      'Club handicap removed',
      'Your club handicap has been removed. Your society index will now be used.',
      '/#handicap',
      'profile',
      v_profile_id
    );
  end if;
end;
$function$;
