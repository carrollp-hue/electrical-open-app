-- Annual member lists, fixture start sheets, and one-off guests.
alter table public.players add column if not exists is_guest boolean not null default false;

create table if not exists public.season_members (
  season_year integer not null check (season_year between 2020 and 2100),
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (season_year, player_id)
);

create table if not exists public.fixture_participants (
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  handicap_index_override numeric(4,1),
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (fixture_id, player_id)
);

alter table public.season_members enable row level security;
alter table public.fixture_participants enable row level security;
drop policy if exists "Members view season members" on public.season_members;
drop policy if exists "Staff manage season members" on public.season_members;
drop policy if exists "Members view fixture participants" on public.fixture_participants;
drop policy if exists "Staff manage fixture participants" on public.fixture_participants;
create policy "Members view season members" on public.season_members for select to authenticated using (true);
create policy "Staff manage season members" on public.season_members for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Members view fixture participants" on public.fixture_participants for select to authenticated using (true);
create policy "Staff manage fixture participants" on public.fixture_participants for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace function public.seed_fixture_participants(p_fixture_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_staff() then raise exception 'Administrator access is required'; end if;
  insert into public.fixture_participants (fixture_id, player_id)
  select p_fixture_id, sm.player_id
  from public.season_members sm
  join public.fixtures f on f.id = p_fixture_id
  where sm.season_year = extract(year from f.fixture_date)::integer
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.seed_fixture_participants(uuid) from public;
grant execute on function public.seed_fixture_participants(uuid) to authenticated;
