-- Administrator-only in-app and push notification for club-handicap removal requests.
-- Run this after upgrade-043 and upgrade-045.

alter table public.app_notifications
  add column if not exists audience text not null default 'all';

alter table public.app_notifications
  drop constraint if exists app_notifications_audience_check;

alter table public.app_notifications
  add constraint app_notifications_audience_check
  check (audience in ('all', 'membership_admin'));

drop policy if exists "Members view app notifications" on public.app_notifications;
drop policy if exists "Relevant users view app notifications" on public.app_notifications;

create policy "Relevant users view app notifications"
on public.app_notifications for select to authenticated
using (
  audience = 'all'
  or (audience = 'membership_admin' and public.is_membership_admin())
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
