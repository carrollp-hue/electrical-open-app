-- Members can ask an administrator to stop using a club handicap.
create table if not exists public.club_handicap_removal_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  processed_at timestamptz,
  processed_by uuid references auth.users(id)
);

create unique index if not exists club_handicap_removal_requests_one_pending
  on public.club_handicap_removal_requests(player_id) where status = 'pending';

alter table public.club_handicap_removal_requests enable row level security;

create or replace function public.request_my_club_handicap_removal()
returns void language plpgsql security definer set search_path = public as $function$
begin
  if not exists (select 1 from public.players where profile_id = auth.uid() and not is_guest and club_handicap is not null) then
    raise exception 'There is no club handicap on your linked player profile.';
  end if;
  if exists (select 1 from public.club_handicap_removal_requests r join public.players p on p.id = r.player_id where p.profile_id = auth.uid() and r.status = 'pending') then
    raise exception 'Your request is already waiting for an administrator.';
  end if;
  insert into public.club_handicap_removal_requests(player_id)
  select id from public.players where profile_id = auth.uid() and not is_guest and club_handicap is not null;
end;
$function$;

create or replace function public.list_club_handicap_removal_requests()
returns table (request_id uuid, player_id uuid, first_name text, surname text, club_handicap numeric, requested_at timestamptz)
language plpgsql stable security definer set search_path = public as $function$
begin
  if not public.is_membership_admin() then raise exception 'Membership administrator access is required.'; end if;
  return query select r.id, p.id, p.first_name, p.surname, p.club_handicap, r.requested_at
  from public.club_handicap_removal_requests r join public.players p on p.id = r.player_id
  where r.status = 'pending' order by r.requested_at;
end;
$function$;

create or replace function public.approve_club_handicap_removal(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
begin
  if not public.is_membership_admin() then raise exception 'Membership administrator access is required.'; end if;
  update public.players p set club_handicap = null, club_handicap_submitted_at = null
  from public.club_handicap_removal_requests r
  where r.id = p_request_id and r.status = 'pending' and p.id = r.player_id;
  if not found then raise exception 'This request has already been processed or no longer exists.'; end if;
  update public.club_handicap_removal_requests set status = 'approved', processed_at = now(), processed_by = auth.uid()
  where id = p_request_id and status = 'pending';
end;
$function$;

revoke all on function public.request_my_club_handicap_removal() from public;
revoke all on function public.list_club_handicap_removal_requests() from public;
revoke all on function public.approve_club_handicap_removal(uuid) from public;
grant execute on function public.request_my_club_handicap_removal() to authenticated;
grant execute on function public.list_club_handicap_removal_requests() to authenticated;
grant execute on function public.approve_club_handicap_removal(uuid) to authenticated;
