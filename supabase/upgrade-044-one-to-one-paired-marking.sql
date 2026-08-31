-- Each participant may be marked by one other participant only. This prevents
-- duplicate checks leaving another player's card without a marker.
create or replace function public.enforce_one_to_one_paired_marking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.marked_player_id is not null and exists (
    select 1
    from public.member_scorecards existing
    where existing.fixture_id = new.fixture_id
      and existing.marked_player_id = new.marked_player_id
      and existing.scorer_player_id <> new.scorer_player_id
  ) then
    raise exception 'This participant is already being marked by another player. Choose a different Player A.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_one_to_one_paired_marking_before_save on public.member_scorecards;
create trigger enforce_one_to_one_paired_marking_before_save
before insert or update of fixture_id, scorer_player_id, marked_player_id
on public.member_scorecards
for each row execute function public.enforce_one_to_one_paired_marking();
