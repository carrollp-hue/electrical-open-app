-- Electrical Open Golf Society: hosted application foundation
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create type public.app_role as enum ('member', 'scorekeeper', 'handicap_committee', 'admin');
create type public.fixture_status as enum ('draft', 'open', 'scoring', 'published', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  surname text not null,
  first_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (surname, first_name)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.course_setups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  tee_name text not null,
  course_rating numeric(4,1) not null check (course_rating between 50 and 85),
  slope_rating integer check (slope_rating between 55 and 155),
  par integer not null check (par between 54 and 80),
  unique (course_id, tee_name)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  fixture_date date not null,
  name text not null,
  course_setup_id uuid references public.course_setups(id),
  format text not null default 'Stableford',
  status public.fixture_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.fixture_entries (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  handicap_index_at_entry numeric(4,1),
  gross_score integer check (gross_score between 1 and 200),
  nett_score integer,
  stableford_points integer check (stableford_points between 0 and 90),
  esr_adjustment numeric(4,1) not null default 0,
  winner_cut numeric(4,1) not null default 0,
  score_differential numeric(8,4),
  competition_position integer check (competition_position > 0),
  order_of_merit_points integer not null default 0 check (order_of_merit_points >= 0),
  entered_at timestamptz not null default now(),
  unique (fixture_id, player_id)
);

create table public.handicap_adjustments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  fixture_id uuid references public.fixtures(id) on delete set null,
  adjustment_type text not null check (adjustment_type in ('esr', 'competition_win', 'committee_override')),
  amount numeric(4,1) not null,
  reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.handicap_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  fixture_id uuid references public.fixtures(id) on delete set null,
  calculated_at timestamptz not null default now(),
  index_value numeric(4,1) not null check (index_value between 0 and 54),
  calculation jsonb not null default '{}'::jsonb,
  unique (player_id, fixture_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index fixture_entries_fixture_id_idx on public.fixture_entries(fixture_id);
create index fixture_entries_player_id_idx on public.fixture_entries(player_id);
create index handicap_snapshots_player_date_idx on public.handicap_snapshots(player_id, calculated_at desc);
create index fixtures_status_date_idx on public.fixtures(status, fixture_date desc);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('scorekeeper', 'handicap_committee', 'admin')) $$;

create or replace function public.is_committee()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('handicap_committee', 'admin')) $$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.players enable row level security;
alter table public.courses enable row level security;
alter table public.course_setups enable row level security;
alter table public.fixtures enable row level security;
alter table public.fixture_entries enable row level security;
alter table public.handicap_adjustments enable row level security;
alter table public.handicap_snapshots enable row level security;
alter table public.audit_events enable row level security;

create policy "Users may read their own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "Staff may read roles" on public.user_roles for select to authenticated using (public.is_staff());
create policy "Members may view the player directory" on public.players for select to authenticated using (true);
create policy "Staff manage players" on public.players for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Members view courses" on public.courses for select to authenticated using (true);
create policy "Staff manage courses" on public.courses for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Members view course setups" on public.course_setups for select to authenticated using (true);
create policy "Staff manage course setups" on public.course_setups for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Members see published fixtures" on public.fixtures for select to authenticated using (status in ('published', 'archived') or public.is_staff());
create policy "Staff manage fixtures" on public.fixtures for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Members see permitted results" on public.fixture_entries for select to authenticated using (
  public.is_staff() or exists (select 1 from public.players p where p.id = player_id and p.profile_id = auth.uid()) or exists (select 1 from public.fixtures f where f.id = fixture_id and f.status in ('published', 'archived'))
);
create policy "Staff manage fixture entries" on public.fixture_entries for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Committee views adjustments" on public.handicap_adjustments for select to authenticated using (public.is_committee());
create policy "Committee manages adjustments" on public.handicap_adjustments for all to authenticated using (public.is_committee()) with check (public.is_committee());
create policy "Members view own handicap history" on public.handicap_snapshots for select to authenticated using (public.is_staff() or exists (select 1 from public.players p where p.id = player_id and p.profile_id = auth.uid()));
create policy "Committee manages handicap history" on public.handicap_snapshots for all to authenticated using (public.is_committee()) with check (public.is_committee());
create policy "Staff view audit events" on public.audit_events for select to authenticated using (public.is_staff());

-- First-owner bootstrap: after creating your first Auth user in the Dashboard,
-- replace the two placeholders below with that user's UUID and run once.
-- insert into public.profiles (id, display_name) values ('OWNER-USER-UUID', 'Society Administrator');
-- insert into public.user_roles (user_id, role) values ('OWNER-USER-UUID', 'admin');
