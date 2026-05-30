-- ============================================================================
-- 0001_init_auth_rbac.sql
-- Extensions, helper functions, auth/RBAC schema.
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

create trigger trg_roles_updated_at
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
-- profiles: extends auth.users
-- ---------------------------------------------------------------------------
create type public.user_status as enum ('pending', 'active', 'suspended', 'archived');

create table if not exists public.profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
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

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index if not exists idx_profiles_role on public.profiles(role_id);
create index if not exists idx_profiles_status on public.profiles(status);

-- ---------------------------------------------------------------------------
-- Helper: current profile
-- ---------------------------------------------------------------------------
create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.* from public.profiles p where p.auth_user_id = auth.uid() limit 1;
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
  where p.auth_user_id = auth.uid();
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
    where p.auth_user_id = auth.uid()
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
    where p.auth_user_id = auth.uid()
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
    where auth_user_id = auth.uid()
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
    where p.auth_user_id = auth.uid()
      and perm.module = p_module
      and perm.action = p_action
    limit 1
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Auto-create profile on auth.users insert
-- (will be set to status='pending' until an admin approves)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role uuid;
  v_existing_count int;
begin
  select count(*) into v_existing_count from public.profiles;

  -- Bootstrap: very first user becomes admin & active.
  if v_existing_count = 0 then
    select id into v_role from public.roles where name = 'admin' limit 1;
    insert into public.profiles (auth_user_id, full_name, email, avatar_url, role_id, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
      new.email,
      new.raw_user_meta_data->>'avatar_url',
      v_role,
      'active'
    );
  else
    -- Subsequent users land as "pending" with no role.
    insert into public.profiles (auth_user_id, full_name, email, avatar_url, status)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
      new.email,
      new.raw_user_meta_data->>'avatar_url',
      'pending'
    )
    on conflict (auth_user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
