-- ============================================================================
-- 0002_auth_rbac.sql
-- Local credential store, sessions, roles/permissions and profiles.
--
-- Replaces Supabase Auth (GoTrue):
--   auth.users          -> public.app_users (email + bcrypt hash)
--   GoTrue JWT cookies  -> public.user_sessions (opaque token, sha256-hashed)
--   auth.uid()          -> public.current_profile_id() (session GUC)
--   on_auth_user_created trigger -> explicit admin provisioning in the app
-- ============================================================================

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger trg_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- permissions: (module, action) tuples
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  id uuid primary key default uuid_generate_v4(),
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (module, action)
);

-- ---------------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------------
create table if not exists public.role_permissions (
  id uuid primary key default uuid_generate_v4(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  unique (role_id, permission_id)
);

create index if not exists idx_role_permissions_role on public.role_permissions(role_id);

-- ---------------------------------------------------------------------------
-- app_users: credentials only. Domain identity lives on profiles.
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key default uuid_generate_v4(),
  email citext not null unique,
  password_hash text not null,
  must_change_password boolean not null default false,
  failed_login_count int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger trg_app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_sessions: opaque bearer tokens, stored only as sha256 digests so a
-- database leak does not hand over live sessions.
-- ---------------------------------------------------------------------------
create table if not exists public.user_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_user_sessions_user on public.user_sessions(user_id);
create index if not exists idx_user_sessions_expires on public.user_sessions(expires_at);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_status as enum ('pending', 'active', 'suspended', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.app_users(id) on delete cascade,
  full_name text,
  email citext not null unique,
  phone text,
  avatar_url text,
  role_id uuid references public.roles(id),
  status public.user_status not null default 'pending',
  invited_by uuid references public.profiles(id),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index if not exists idx_profiles_role on public.profiles(role_id);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_user on public.profiles(user_id);

-- ---------------------------------------------------------------------------
-- Helpers. All `security definer` so they can read profiles/roles regardless
-- of the caller's own RLS visibility, exactly as the Supabase originals did.
-- ---------------------------------------------------------------------------
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.* from public.profiles p where p.id = public.current_profile_id() limit 1;
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = public.current_profile_id();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select r.name = 'admin'
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = public.current_profile_id()
      and p.status = 'active'
  ), false);
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select r.name in ('admin', 'manager')
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = public.current_profile_id()
      and p.status = 'active'
  ), false);
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select status = 'active'
    from public.profiles
    where id = public.current_profile_id()
  ), false);
$$;

create or replace function public.has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select true
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = public.current_profile_id()
      and p.status = 'active'
      and perm.module = p_module
      and perm.action = p_action
    limit 1
  ), false);
$$;
