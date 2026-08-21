-- Course setup, 18-hole scorecards, and scorecard-derived result totals.
alter table public.fixtures add column if not exists handicap_allowance numeric(5,4) not null default 1;
alter table public.fixtures add column if not exists playing_conditions_adjustment integer not null default 0;
alter table public.fixture_entries add column if not exists course_handicap integer;
alter table public.fixture_entries add column if not exists playing_handicap integer;
alter table public.fixture_entries add column if not exists adjusted_gross_score integer;

create table if not exists public.course_holes (
  course_setup_id uuid not null references public.course_setups(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  par integer not null check (par between 3 and 6),
  stroke_index integer not null check (stroke_index between 1 and 18),
  primary key (course_setup_id, hole_number),
  unique (course_setup_id, stroke_index)
);

create table if not exists public.hole_scores (
  fixture_entry_id uuid not null references public.fixture_entries(id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  gross_score integer not null check (gross_score between 1 and 20),
  handicap_strokes integer not null default 0,
  nett_score integer not null,
  stableford_points integer not null check (stableford_points between 0 and 10),
  primary key (fixture_entry_id, hole_number)
);

alter table public.course_holes enable row level security;
alter table public.hole_scores enable row level security;
drop policy if exists "Members view course holes" on public.course_holes;
drop policy if exists "Staff manage course holes" on public.course_holes;
drop policy if exists "Members view permitted hole scores" on public.hole_scores;
drop policy if exists "Staff manage hole scores" on public.hole_scores;
create policy "Members view course holes" on public.course_holes for select to authenticated using (true);
create policy "Staff manage course holes" on public.course_holes for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Members view permitted hole scores" on public.hole_scores for select to authenticated using (public.is_staff() or exists (select 1 from public.fixture_entries e join public.players p on p.id = e.player_id join public.fixtures f on f.id = e.fixture_id where e.id = fixture_entry_id and (p.profile_id = auth.uid() or f.status in ('published', 'archived'))));
create policy "Staff manage hole scores" on public.hole_scores for all to authenticated using (public.is_staff()) with check (public.is_staff());
