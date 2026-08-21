-- Run this first, by itself, so PostgreSQL can commit the new enum value.
alter type public.fixture_status add value if not exists 'completed';
