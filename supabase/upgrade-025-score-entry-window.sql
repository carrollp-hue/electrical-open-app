-- Reserved for the later fixture-day-only entry rule. It defaults to false,
-- so this migration does not restrict score entry during testing.
alter table public.fixtures
  add column if not exists score_entry_day_only boolean not null default false;
