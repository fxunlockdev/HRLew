-- ============================================================================
-- 0008_auth_functions.sql
-- Privileged entry points for authentication.
--
-- Resolving a session is a chicken-and-egg problem under RLS: the policies on
-- `profiles` are keyed on app.profile_id, but app.profile_id is exactly what we
-- are trying to discover. Supabase solved this by having a privileged service
-- (GoTrue) own the auth tables. These `security definer` functions play that
-- role: they are the only way the application role reads identity, and each one
-- answers a single narrow question.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- resolve_session: session token digest -> actor, profile, role, permissions.
-- One round trip, and returns nothing at all for an expired or unknown token.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_session(p_token_hash text)
returns table (
  session_id uuid,
  session_expires_at timestamptz,
  session_last_used_at timestamptz,
  user_id uuid,
  user_email citext,
  must_change_password boolean,
  profile_id uuid,
  full_name text,
  profile_email citext,
  phone text,
  avatar_url text,
  role_id uuid,
  role_name text,
  role_description text,
  status public.user_status,
  invited_by uuid,
  last_seen_at timestamptz,
  profile_created_at timestamptz,
  profile_updated_at timestamptz,
  permissions jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.expires_at,
    s.last_used_at,
    u.id,
    u.email,
    u.must_change_password,
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    p.role_id,
    r.name,
    r.description,
    p.status,
    p.invited_by,
    p.last_seen_at,
    p.created_at,
    p.updated_at,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('module', perm.module, 'action', perm.action))
        from public.role_permissions rp
        join public.permissions perm on perm.id = rp.permission_id
        where rp.role_id = p.role_id
      ),
      '[]'::jsonb
    )
  from public.user_sessions s
  join public.app_users u on u.id = s.user_id
  left join public.profiles p on p.user_id = u.id
  left join public.roles r on r.id = p.role_id
  where s.token_hash = p_token_hash
    and s.expires_at > now()
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- touch_session: slide the expiry and record activity. Called at most once per
-- TOUCH_INTERVAL per session, not on every request.
-- ---------------------------------------------------------------------------
create or replace function public.touch_session(p_session_id uuid, p_ttl interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_sessions
  set last_used_at = now(),
      expires_at = now() + p_ttl
  where id = p_session_id;

  update public.profiles
  set last_seen_at = now()
  where user_id = (select user_id from public.user_sessions where id = p_session_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- bootstrap_first_admin: creates the very first account, and only ever that
-- one. The "is the instance empty?" check lives here rather than in the app so
-- it cannot be raced or bypassed by a second request.
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_first_admin(
  p_email citext,
  p_password_hash text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_role_id uuid;
begin
  -- Serialise concurrent setup attempts.
  lock table public.app_users in exclusive mode;

  if exists (select 1 from public.app_users) then
    raise exception 'setup has already been completed';
  end if;

  select id into v_role_id from public.roles where name = 'admin' limit 1;
  if v_role_id is null then
    raise exception 'admin role missing - run the seed migration first';
  end if;

  insert into public.app_users (email, password_hash, password_changed_at)
  values (p_email, p_password_hash, now())
  returning id into v_user_id;

  insert into public.profiles (user_id, full_name, email, role_id, status)
  values (v_user_id, coalesce(nullif(p_full_name, ''), p_email::text), p_email, v_role_id, 'active')
  returning id into v_profile_id;

  return v_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_count: lets the app ask "is this a fresh instance?" without read access
-- to the credential table.
-- ---------------------------------------------------------------------------
create or replace function public.app_user_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.app_users;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'hr_app') then
    grant execute on function public.resolve_session(text) to hr_app;
    grant execute on function public.touch_session(uuid, interval) to hr_app;
    grant execute on function public.bootstrap_first_admin(citext, text, text) to hr_app;
    grant execute on function public.app_user_count() to hr_app;
  end if;
end$$;
