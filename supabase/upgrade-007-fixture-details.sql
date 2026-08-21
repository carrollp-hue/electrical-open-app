-- Competition labels and consistent guest-name formatting.
alter table public.fixtures add column if not exists competition_name text;

create or replace function public.normalize_guest_name()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_guest then
    new.first_name := initcap(lower(trim(new.first_name)));
    new.surname := upper(trim(new.surname));
  end if;
  return new;
end $$;

drop trigger if exists normalize_guest_name_before_save on public.players;
create trigger normalize_guest_name_before_save
before insert or update of first_name, surname, is_guest on public.players
for each row execute function public.normalize_guest_name();
