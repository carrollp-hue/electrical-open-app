alter table public.players add column if not exists club_handicap_submitted_at timestamptz;

update public.players
set club_handicap_submitted_at = coalesce(club_handicap_submitted_at, now())
where club_handicap is not null;

create or replace function public.set_club_handicap_submission_date()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.club_handicap is distinct from old.club_handicap then new.club_handicap_submitted_at := now(); end if;
  return new;
end $$;

drop trigger if exists set_club_handicap_submission_date_before_save on public.players;
create trigger set_club_handicap_submission_date_before_save
before update of club_handicap on public.players
for each row execute function public.set_club_handicap_submission_date();
