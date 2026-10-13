-- ============================================================================
-- 0001_extensions_helpers.sql
-- Extensions and shared helper functions.
--
-- Railway-native port of the original Supabase schema. The one structural
-- difference: there is no `auth` schema and no `auth.uid()`. The current actor
-- is carried on the Postgres session as the `app.profile_id` GUC, set by the
-- application for the duration of each transaction (see src/lib/db/session.ts).
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Current actor, read from the per-transaction session GUC.
-- Returns null when unset (background jobs, migrations, psql) rather than
-- raising, so triggers can still run with a null actor.
-- ---------------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.profile_id', true), '')::uuid;
$$;
