-- Enforced completion, NR and member-only rules.
do $$ begin
  alter table public.fixtures add constraint fixtures_pcc_range check (playing_conditions_adjustment between -1 and 3);
exception when duplicate_object then null; end $$;

create or replace function public.apply_non_return_differential()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.score_status = 'non_return' then
    if exists (select 1 from public.players p where p.id = new.player_id and p.is_guest) then
      new.score_differential := null;
      new.order_of_merit_points := 0;
    elsif new.handicap_index_at_entry is not null then
      new.score_differential := new.handicap_index_at_entry + 5;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists apply_non_return_differential_before_save on public.fixture_entries;
create trigger apply_non_return_differential_before_save
before insert or update of score_status, handicap_index_at_entry on public.fixture_entries
for each row execute function public.apply_non_return_differential();

create or replace function public.enforce_member_only_oom()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.players p where p.id = new.player_id and p.is_guest) then new.order_of_merit_points := 0; end if;
  return new;
end $$;

drop trigger if exists enforce_member_only_oom_before_save on public.fixture_entries;
create trigger enforce_member_only_oom_before_save
before insert or update of order_of_merit_points on public.fixture_entries
for each row execute function public.enforce_member_only_oom();

create or replace function public.validate_fixture_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    if new.scores_finalized_at is null then raise exception 'Finalize Playing Conditions Adjustment before publishing'; end if;
    if exists (
      select 1 from public.fixture_participants fp
      left join public.fixture_entries e on e.fixture_id = fp.fixture_id and e.player_id = fp.player_id
      where fp.fixture_id = new.id
        and (e.id is null or (e.score_status = 'completed' and (select count(*) from public.hole_scores hs where hs.fixture_entry_id = e.id) <> 18))
    ) then raise exception 'Every participant needs a complete scorecard or Non Return before publishing'; end if;
  end if;
  return new;
end $$;

drop trigger if exists validate_fixture_publish_before_update on public.fixtures;
create trigger validate_fixture_publish_before_update
before update of status on public.fixtures
for each row execute function public.validate_fixture_publish();

create or replace function public.trigger_recalculate_society_index()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.score_differential is not null
     and not exists (select 1 from public.players p where p.id = new.player_id and p.is_guest)
     and exists (select 1 from public.fixtures f where f.id = new.fixture_id and f.scores_finalized_at is not null) then
    perform public.recalculate_society_index(new.player_id, new.fixture_id);
  end if;
  return new;
end $$;
