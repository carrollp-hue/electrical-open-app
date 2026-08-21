-- Optional member-entered paired scorecards. Existing admin score entry remains available.
-- Kept here as a fallback for databases created before the membership-admin upgrade.
create or replace function public.is_membership_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role::text in ('membership_admin', 'admin')
  )
$$;

alter table public.fixtures add column if not exists member_scoring_enabled boolean not null default false;

create table if not exists public.member_scorecards (
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  scorer_player_id uuid not null references public.players(id) on delete cascade,
  marked_player_id uuid references public.players(id) on delete restrict,
  own_scores jsonb not null default '[]'::jsonb,
  marked_scores jsonb not null default '[]'::jsonb,
  own_handicap_index numeric(4,1), own_course_handicap integer, own_playing_handicap integer,
  marked_handicap_index numeric(4,1), marked_course_handicap integer, marked_playing_handicap integer,
  own_status text not null default 'draft' check (own_status in ('draft', 'submitted')),
  marked_status text not null default 'draft' check (marked_status in ('draft', 'submitted')),
  own_submitted_at timestamptz, marked_submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (fixture_id, scorer_player_id)
);

create index if not exists member_scorecards_fixture_marked_idx on public.member_scorecards (fixture_id, marked_player_id);

create or replace function public.current_player_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.players where profile_id = auth.uid() limit 1
$$;

create or replace function public.validate_member_scorecard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_enabled boolean;
begin
  select member_scoring_enabled into v_enabled from public.fixtures where id = new.fixture_id;
  if not coalesce(v_enabled, false) and not public.is_staff() then
    raise exception 'Member score entry is not enabled for this fixture';
  end if;
  if new.scorer_player_id = new.marked_player_id then
    raise exception 'You cannot mark your own scorecard';
  end if;
  if not public.is_staff() and new.scorer_player_id <> public.current_player_id() then
    raise exception 'You may only enter your own paired scorecard';
  end if;
  if not exists (select 1 from public.fixture_participants where fixture_id = new.fixture_id and player_id = new.scorer_player_id) then
    raise exception 'You must be a participant in this fixture';
  end if;
  if new.marked_player_id is not null and not exists (select 1 from public.fixture_participants where fixture_id = new.fixture_id and player_id = new.marked_player_id) then
    raise exception 'Player A must be a participant in this fixture';
  end if;
  if new.own_status = 'submitted' and (jsonb_typeof(new.own_scores) <> 'array' or jsonb_array_length(new.own_scores) <> 18) then
    raise exception 'Enter all 18 of your scores before submitting';
  end if;
  if new.own_status = 'submitted' and exists (
    select 1 from jsonb_array_elements_text(new.own_scores) as score(value)
    where score.value is null or score.value !~ '^(?:[1-9]|1[0-9]|20)$'
  ) then raise exception 'Your scorecard contains an invalid hole score'; end if;
  if new.marked_status = 'submitted' and (new.marked_player_id is null or jsonb_typeof(new.marked_scores) <> 'array' or jsonb_array_length(new.marked_scores) <> 18) then
    raise exception 'Choose Player A and enter all 18 scores before submitting';
  end if;
  if new.marked_status = 'submitted' and exists (
    select 1 from jsonb_array_elements_text(new.marked_scores) as score(value)
    where score.value is null or score.value !~ '^(?:[1-9]|1[0-9]|20)$'
  ) then raise exception 'Player A scorecard contains an invalid hole score'; end if;
  if TG_OP = 'UPDATE' and not public.is_staff() then
    if old.own_status = 'submitted' and (new.own_scores is distinct from old.own_scores or new.own_status is distinct from old.own_status) then
      raise exception 'Your submitted scorecard is locked; ask a score administrator to amend it';
    end if;
    if old.marked_status = 'submitted' and (new.marked_scores is distinct from old.marked_scores or new.marked_player_id is distinct from old.marked_player_id or new.marked_status is distinct from old.marked_status) then
      raise exception 'Your submitted marker scorecard is locked; ask a score administrator to amend it';
    end if;
  end if;
  new.updated_at := now();
  if new.own_status = 'submitted' and new.own_submitted_at is null then new.own_submitted_at := now(); end if;
  if new.marked_status = 'submitted' and new.marked_submitted_at is null then new.marked_submitted_at := now(); end if;
  return new;
end $$;

drop trigger if exists validate_member_scorecard_before_save on public.member_scorecards;
create trigger validate_member_scorecard_before_save
before insert or update on public.member_scorecards
for each row execute function public.validate_member_scorecard();

alter table public.member_scorecards enable row level security;
create or replace function public.can_view_paired_scorecard(p_fixture_id uuid, p_scorer_player_id uuid, p_marked_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_scorer_player_id = public.current_player_id()
    or p_marked_player_id = public.current_player_id()
    or exists (
      select 1 from public.member_scorecards mine
      where mine.fixture_id = p_fixture_id
        and mine.scorer_player_id = public.current_player_id()
        and mine.marked_player_id = p_scorer_player_id
    )
$$;
drop policy if exists "Members view paired scorecards" on public.member_scorecards;
drop policy if exists "Members create paired scorecards" on public.member_scorecards;
drop policy if exists "Members update paired scorecards" on public.member_scorecards;
drop policy if exists "Staff manage paired scorecards" on public.member_scorecards;
create policy "Members view paired scorecards" on public.member_scorecards for select to authenticated using (
  public.is_staff() or public.can_view_paired_scorecard(fixture_id, scorer_player_id, marked_player_id)
);
create policy "Members create paired scorecards" on public.member_scorecards for insert to authenticated
with check (public.is_staff() or scorer_player_id = public.current_player_id());
create policy "Members update paired scorecards" on public.member_scorecards for update to authenticated
using (public.is_staff() or scorer_player_id = public.current_player_id())
with check (public.is_staff() or scorer_player_id = public.current_player_id());
create policy "Staff manage paired scorecards" on public.member_scorecards for delete to authenticated using (public.is_staff());

-- Let a member see a fixture only when they are registered to play in it.
drop policy if exists "Members see published fixtures" on public.fixtures;
create policy "Members see published fixtures" on public.fixtures for select to authenticated using (
  status in ('published', 'completed', 'archived') or public.is_staff() or public.is_membership_admin()
  or exists (select 1 from public.fixture_participants fp where fp.fixture_id = fixtures.id and fp.player_id = public.current_player_id())
);
