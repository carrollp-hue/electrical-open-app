-- A player who does not return a completed score has no gross, nett, points or differential.
alter table public.fixture_entries add column if not exists score_status text not null default 'completed'
  check (score_status in ('completed', 'non_return'));
