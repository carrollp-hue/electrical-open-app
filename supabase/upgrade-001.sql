-- Run this once because the initial schema has already been applied.
alter table public.fixture_entries add column if not exists esr_adjustment numeric(4,1) not null default 0;
alter table public.fixture_entries add column if not exists winner_cut numeric(4,1) not null default 0;
alter table public.fixture_entries add column if not exists score_differential numeric(8,4);
