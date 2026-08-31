-- A shared in-app record of fixture notifications, visible to signed-in users.
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text not null default '/#home',
  created_at timestamptz not null default now()
);

alter table public.app_notifications enable row level security;

drop policy if exists "Members view app notifications" on public.app_notifications;
create policy "Members view app notifications"
on public.app_notifications for select to authenticated
using (true);

revoke insert, update, delete on public.app_notifications from anon, authenticated;

create or replace function public.log_fixture_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  if tg_op = 'INSERT' then
    v_title := 'New Electrical Open fixture';
    v_body := new.name || ' — ' || new.fixture_date || coalesce(' at ' || to_char(new.tee_time, 'HH24:MI'), '');
  elsif new.status in ('published', 'completed') and old.status not in ('published', 'completed') then
    v_title := 'Results published';
    v_body := new.name || ' results are now available.';
  elsif new.fixture_date is distinct from old.fixture_date or new.tee_time is distinct from old.tee_time then
    v_title := 'Fixture time updated';
    v_body := new.name || ' is now ' || new.fixture_date || coalesce(' at ' || to_char(new.tee_time, 'HH24:MI'), '');
  else
    return new;
  end if;

  insert into public.app_notifications (title, body, url)
  values (v_title, v_body, '/#fixtures/' || new.id);
  return new;
end;
$$;

drop trigger if exists log_fixture_notification_after_change on public.fixtures;
create trigger log_fixture_notification_after_change
after insert or update of fixture_date, tee_time, status on public.fixtures
for each row execute function public.log_fixture_notification();
