-- Run this first, by itself, so PostgreSQL can commit the new enum value.
alter type public.app_role add value if not exists 'membership_admin';
