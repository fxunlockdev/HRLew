-- =============================================================================
-- HRLew — Full database setup (consolidated)
-- Paste this entire file into Supabase Studio -> SQL Editor and Run.
-- Idempotent: safe to re-run on a partially-applied database.
-- =============================================================================



-- >>> SOURCE: migrations/0001_init_auth_rbac.sql

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
-- profiles: extends auth.users
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_status as enum ('pending', 'active', 'suspended', 'archived');
exception when duplicate_object then null;
end $$;

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

create or replace trigger trg_profiles_updated_at
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
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- >>> SOURCE: migrations/0002_core_entities.sql

-- ============================================================================
-- 0002_core_entities.sql
-- Candidates, clients, jobs, BD leads, staff, settings catalogs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Settings catalog: configurable lists (pipeline stages, statuses, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.settings_lists (
  id uuid primary key default uuid_generate_v4(),
  list_key text not null,
  value text not null,
  label text not null,
  sort_order int not null default 0,
  color text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_key, value)
);

create index if not exists idx_settings_lists_key on public.settings_lists(list_key);
create or replace trigger trg_settings_lists_updated_at
  before update on public.settings_lists
  for each row execute function public.set_updated_at();

-- Sequences backing human-friendly display IDs (defaults are immutable-safe;
-- GENERATED ALWAYS would require an immutable expression, which extract() is not).
create sequence if not exists public.seq_client_display;
create sequence if not exists public.seq_candidate_display;
create sequence if not exists public.seq_job_display;
create sequence if not exists public.seq_bd_display;
create sequence if not exists public.seq_staff_display;

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  display_id text not null default ('CL-' || lpad(nextval('public.seq_client_display')::text, 6, '0')),
  name text not null,
  website text,
  logo_url text,
  logo_file_name text,
  industry text,
  company_size text,
  location text,
  status text not null default 'prospect',
  account_owner_id uuid references public.profiles(id),
  contract_type text,
  commercial_terms text,
  replacement_period_days int,
  payment_terms_days int,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_status on public.clients(status);
create index if not exists idx_clients_owner on public.clients(account_owner_id);
create index if not exists idx_clients_name on public.clients(lower(name));
create or replace trigger trg_clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Client contacts (one-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.client_contacts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  designation text,
  email citext,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_contacts_client on public.client_contacts(client_id);
create or replace trigger trg_client_contacts_updated_at before update on public.client_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Client notes
-- ---------------------------------------------------------------------------
create table if not exists public.client_notes (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_notes_client on public.client_notes(client_id);

-- ---------------------------------------------------------------------------
-- Candidates
-- ---------------------------------------------------------------------------
create table if not exists public.candidates (
  id uuid primary key default uuid_generate_v4(),
  display_id text not null default ('CN-' || lpad(nextval('public.seq_candidate_display')::text, 6, '0')),
  full_name text not null,
  email citext,
  phone text,
  current_company text,
  current_designation text,
  current_location text,
  preferred_location text,
  total_experience_years numeric(4,1),
  relevant_experience_years numeric(4,1),
  current_ctc numeric(14,2),
  expected_ctc numeric(14,2),
  notice_period_days int,
  last_working_day date,
  skills text[] not null default '{}',
  industry text,
  source text,
  resume_url text,
  resume_file_name text,
  linkedin_url text,
  portfolio_url text,
  status text not null default 'new',
  assigned_recruiter_id uuid references public.profiles(id),
  tags text[] not null default '{}',
  notes text,
  is_blacklisted boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_candidates_email on public.candidates(email);
create index if not exists idx_candidates_phone on public.candidates(phone);
create index if not exists idx_candidates_recruiter on public.candidates(assigned_recruiter_id);
create index if not exists idx_candidates_status on public.candidates(status);
create index if not exists idx_candidates_skills on public.candidates using gin (skills);
create index if not exists idx_candidates_name on public.candidates(lower(full_name));
create or replace trigger trg_candidates_updated_at before update on public.candidates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Candidate notes
-- ---------------------------------------------------------------------------
create table if not exists public.candidate_notes (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_candidate_notes_candidate on public.candidate_notes(candidate_id);

-- ---------------------------------------------------------------------------
-- Candidate documents (resumes, offer letters, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.candidate_documents (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  category text not null default 'resume',
  created_at timestamptz not null default now()
);

create index if not exists idx_candidate_documents_candidate on public.candidate_documents(candidate_id);

-- ---------------------------------------------------------------------------
-- Job requirements / mandates
-- ---------------------------------------------------------------------------
create table if not exists public.job_requirements (
  id uuid primary key default uuid_generate_v4(),
  display_id text not null default ('JR-' || lpad(nextval('public.seq_job_display')::text, 6, '0')),
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null,
  department text,
  location text,
  work_mode text check (work_mode in ('onsite','hybrid','remote') or work_mode is null),
  employment_type text check (employment_type in ('full_time','contract','part_time','internship') or employment_type is null),
  openings int not null default 1,
  min_experience_years numeric(4,1),
  max_experience_years numeric(4,1),
  min_salary numeric(14,2),
  max_salary numeric(14,2),
  required_skills text[] not null default '{}',
  good_to_have_skills text[] not null default '{}',
  description text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open',
  target_closure_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_client on public.job_requirements(client_id);
create index if not exists idx_jobs_status on public.job_requirements(status);
create index if not exists idx_jobs_skills on public.job_requirements using gin (required_skills);
create or replace trigger trg_jobs_updated_at before update on public.job_requirements
  for each row execute function public.set_updated_at();

-- Multi-assignment of recruiters to a job
create table if not exists public.job_recruiters (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.job_requirements(id) on delete cascade,
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  is_lead boolean not null default false,
  assigned_at timestamptz not null default now(),
  unique (job_id, recruiter_id)
);

create index if not exists idx_job_recruiters_job on public.job_recruiters(job_id);
create index if not exists idx_job_recruiters_recruiter on public.job_recruiters(recruiter_id);

-- ---------------------------------------------------------------------------
-- BD leads
-- ---------------------------------------------------------------------------
create table if not exists public.bd_leads (
  id uuid primary key default uuid_generate_v4(),
  display_id text not null default ('BD-' || lpad(nextval('public.seq_bd_display')::text, 6, '0')),
  company_name text not null,
  contact_name text,
  contact_email citext,
  contact_phone text,
  linkedin_url text,
  industry text,
  source text,
  owner_id uuid references public.profiles(id),
  stage text not null default 'new_lead',
  expected_value numeric(14,2),
  notes text,
  next_follow_up_at timestamptz,
  converted_client_id uuid references public.clients(id),
  converted_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bd_leads_owner on public.bd_leads(owner_id);
create index if not exists idx_bd_leads_stage on public.bd_leads(stage);
create or replace trigger trg_bd_leads_updated_at before update on public.bd_leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- BD activities (calls, emails, meetings)
-- ---------------------------------------------------------------------------
create table if not exists public.bd_activities (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.bd_leads(id) on delete cascade,
  author_id uuid references public.profiles(id),
  activity_type text not null check (activity_type in ('call','email','meeting','note','proposal_sent','other')),
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_bd_activities_lead on public.bd_activities(lead_id);

-- ---------------------------------------------------------------------------
-- Staff (internal employees)
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_id text not null default ('ST-' || lpad(nextval('public.seq_staff_display')::text, 6, '0')),
  full_name text not null,
  email citext,
  phone text,
  designation text,
  department text,
  manager_id uuid references public.staff(id),
  joining_date date,
  employment_status text not null default 'active',
  salary numeric(14,2),
  incentive_structure text,
  kpi_target jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_manager on public.staff(manager_id);
create index if not exists idx_staff_status on public.staff(employment_status);
create or replace trigger trg_staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();


-- >>> SOURCE: migrations/0003_pipeline_interviews_placements.sql

-- ============================================================================
-- 0003_pipeline_interviews_placements.sql
-- Candidate-job pipeline, stage history, interviews, placements.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- candidate_job_pipeline: A candidate may be submitted to many jobs.
-- ---------------------------------------------------------------------------
create table if not exists public.candidate_job_pipeline (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.job_requirements(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  assigned_recruiter_id uuid references public.profiles(id),
  current_stage text not null default 'sourced',
  submitted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  next_follow_up_at timestamptz,
  rejection_reason text,
  drop_reason text,
  offer_amount numeric(14,2),
  joining_date date,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, job_id)
);

create index if not exists idx_pipeline_candidate on public.candidate_job_pipeline(candidate_id);
create index if not exists idx_pipeline_job on public.candidate_job_pipeline(job_id);
create index if not exists idx_pipeline_client on public.candidate_job_pipeline(client_id);
create index if not exists idx_pipeline_stage on public.candidate_job_pipeline(current_stage);
create index if not exists idx_pipeline_recruiter on public.candidate_job_pipeline(assigned_recruiter_id);
create or replace trigger trg_pipeline_updated_at before update on public.candidate_job_pipeline
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pipeline_stage_history: append-only audit of stage moves
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_stage_history (
  id uuid primary key default uuid_generate_v4(),
  pipeline_id uuid not null references public.candidate_job_pipeline(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles(id),
  notes text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_stage_history_pipeline on public.pipeline_stage_history(pipeline_id);
create index if not exists idx_stage_history_changed_at on public.pipeline_stage_history(changed_at desc);

-- Trigger to auto-record stage history + bump last_activity_at
create or replace function public.pipeline_record_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  select id into v_actor from public.profiles where auth_user_id = auth.uid();

  if (tg_op = 'INSERT') then
    insert into public.pipeline_stage_history (pipeline_id, from_stage, to_stage, changed_by)
    values (new.id, null, new.current_stage, v_actor);
    return new;
  end if;

  if (tg_op = 'UPDATE' and new.current_stage is distinct from old.current_stage) then
    insert into public.pipeline_stage_history (pipeline_id, from_stage, to_stage, changed_by)
    values (new.id, old.current_stage, new.current_stage, v_actor);
    new.last_activity_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pipeline_stage_history on public.candidate_job_pipeline;
create or replace trigger trg_pipeline_stage_history
  after insert on public.candidate_job_pipeline
  for each row execute function public.pipeline_record_stage_change();

drop trigger if exists trg_pipeline_stage_history_upd on public.candidate_job_pipeline;
create or replace trigger trg_pipeline_stage_history_upd
  before update on public.candidate_job_pipeline
  for each row execute function public.pipeline_record_stage_change();

-- ---------------------------------------------------------------------------
-- Interviews
-- ---------------------------------------------------------------------------
create table if not exists public.interviews (
  id uuid primary key default uuid_generate_v4(),
  pipeline_id uuid references public.candidate_job_pipeline(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.job_requirements(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  round_label text,
  interview_type text check (interview_type in ('phone','video','in_person','assignment') or interview_type is null),
  scheduled_at timestamptz,
  duration_minutes int,
  interviewer_name text,
  interviewer_email citext,
  meeting_link text,
  location text,
  status text not null default 'scheduled',
  outcome text check (outcome in ('selected','rejected','on_hold','no_show','rescheduled','pending') or outcome is null),
  feedback text,
  rating int check (rating between 1 and 5 or rating is null),
  next_step text,
  scheduled_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interviews_candidate on public.interviews(candidate_id);
create index if not exists idx_interviews_job on public.interviews(job_id);
create index if not exists idx_interviews_client on public.interviews(client_id);
create index if not exists idx_interviews_scheduled on public.interviews(scheduled_at);
create index if not exists idx_interviews_status on public.interviews(status);
create or replace trigger trg_interviews_updated_at before update on public.interviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Placements
-- ---------------------------------------------------------------------------
create sequence if not exists public.seq_placement_display;

create table if not exists public.placements (
  id uuid primary key default uuid_generate_v4(),
  display_id text not null default ('PL-' || lpad(nextval('public.seq_placement_display')::text, 6, '0')),
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  job_id uuid not null references public.job_requirements(id) on delete restrict,
  pipeline_id uuid references public.candidate_job_pipeline(id),
  recruiter_id uuid references public.profiles(id),
  offered_designation text,
  offered_ctc numeric(14,2),
  billing_percentage numeric(6,2),
  placement_revenue numeric(14,2),
  joining_date date,
  replacement_period_days int,
  replacement_end_date date,
  invoice_status text not null default 'not_raised' check (invoice_status in ('not_raised','raised','partially_paid','paid','overdue','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','partial','received','overdue','written_off')),
  invoice_number text,
  invoice_date date,
  invoice_amount numeric(14,2),
  payment_received_date date,
  status text not null default 'offer_accepted',
  joining_status text check (joining_status in ('pending','joined','backed_out_before','backed_out_after','replacement_required') or joining_status is null),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_placements_candidate on public.placements(candidate_id);
create index if not exists idx_placements_client on public.placements(client_id);
create index if not exists idx_placements_job on public.placements(job_id);
create index if not exists idx_placements_recruiter on public.placements(recruiter_id);
create index if not exists idx_placements_status on public.placements(status);
create index if not exists idx_placements_joining_date on public.placements(joining_date);
create or replace trigger trg_placements_updated_at before update on public.placements
  for each row execute function public.set_updated_at();


-- >>> SOURCE: migrations/0004_tasks_audit_kpi.sql

-- ============================================================================
-- 0004_tasks_audit_kpi.sql
-- Tasks/follow-ups, KPI targets, generic activity log, storage.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tasks / follow-ups
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  related_entity_type text check (related_entity_type in ('candidate','client','bd_lead','job','interview','placement','pipeline') or related_entity_type is null),
  related_entity_id uuid,
  assigned_to_id uuid references public.profiles(id),
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','overdue','cancelled')),
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_assigned on public.tasks(assigned_to_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due on public.tasks(due_at);
create index if not exists idx_tasks_entity on public.tasks(related_entity_type, related_entity_id);
create or replace trigger trg_tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- KPI targets per staff per period
-- ---------------------------------------------------------------------------
create table if not exists public.kpi_targets (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  period text not null check (period in ('monthly','quarterly','yearly')),
  period_start date not null,
  metric_key text not null,
  target_value numeric(14,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, period, period_start, metric_key)
);

create or replace trigger trg_kpi_targets_updated_at before update on public.kpi_targets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity log (append-only audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_entity on public.activity_logs(entity_type, entity_id);
create index if not exists idx_activity_actor on public.activity_logs(actor_id);
create index if not exists idx_activity_created on public.activity_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- Generic audit trigger helper (for sensitive tables)
-- ---------------------------------------------------------------------------
create or replace function public.write_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_entity_id uuid;
begin
  select id into v_actor from public.profiles where auth_user_id = auth.uid();

  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    insert into public.activity_logs (actor_id, entity_type, entity_id, action, previous_value)
    values (v_actor, tg_table_name, v_entity_id, 'delete', to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    insert into public.activity_logs (actor_id, entity_type, entity_id, action, previous_value, new_value)
    values (v_actor, tg_table_name, v_entity_id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'INSERT' then
    v_entity_id := new.id;
    insert into public.activity_logs (actor_id, entity_type, entity_id, action, new_value)
    values (v_actor, tg_table_name, v_entity_id, 'create', to_jsonb(new));
    return new;
  end if;

  return null;
end;
$$;

-- Attach audit triggers to high-value tables
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'candidates','clients','client_contacts','bd_leads','job_requirements',
    'candidate_job_pipeline','interviews','placements','staff','profiles','tasks'
  ]) loop
    execute format('drop trigger if exists trg_audit_%I on public.%I', t, t);
    execute format(
      'create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.write_activity_log()',
      t, t
    );
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- Storage bucket for resumes (created idempotently)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do update
set public = excluded.public;

-- Helpful view: pipeline with denormalized names for list display
create or replace view public.v_pipeline_overview as
select
  p.id,
  p.current_stage,
  p.is_active,
  p.submitted_at,
  p.last_activity_at,
  p.next_follow_up_at,
  p.offer_amount,
  p.joining_date,
  p.notes,
  c.id as candidate_id,
  c.full_name as candidate_name,
  c.email as candidate_email,
  c.phone as candidate_phone,
  j.id as job_id,
  j.title as job_title,
  cl.id as client_id,
  cl.name as client_name,
  pr.id as recruiter_id,
  pr.full_name as recruiter_name
from public.candidate_job_pipeline p
join public.candidates c on c.id = p.candidate_id
join public.job_requirements j on j.id = p.job_id
join public.clients cl on cl.id = p.client_id
left join public.profiles pr on pr.id = p.assigned_recruiter_id;


-- >>> SOURCE: migrations/0005_rls_policies.sql

-- ============================================================================
-- 0005_rls_policies.sql
-- Row-level security policies for all tables.
--
-- Principles:
--   1. Only active users (status='active') can read or write.
--   2. Admins have unrestricted access.
--   3. Managers can read/write all operational data; cannot delete sensitive
--      records by default (placements, staff salaries, etc.) — that is
--      enforced via role_permissions and the app layer.
--   4. Recruiters see records they own or are assigned to.
--   5. Column-level restrictions on sensitive financial fields (salary,
--      placement_revenue, billing_percentage, etc.) are enforced at the
--      application layer via has_permission() — RLS handles row visibility.
-- ============================================================================

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.settings_lists enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_notes enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.job_requirements enable row level security;
alter table public.job_recruiters enable row level security;
alter table public.bd_leads enable row level security;
alter table public.bd_activities enable row level security;
alter table public.staff enable row level security;
alter table public.candidate_job_pipeline enable row level security;
alter table public.pipeline_stage_history enable row level security;
alter table public.interviews enable row level security;
alter table public.placements enable row level security;
alter table public.tasks enable row level security;
alter table public.kpi_targets enable row level security;
alter table public.activity_logs enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select
  using (auth_user_id = auth.uid() or public.is_manager_or_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update
  using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert with check (public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- roles & permissions (admin manages, everyone reads)
-- ---------------------------------------------------------------------------
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select using (public.is_active_user());

drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write on public.roles for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select using (public.is_active_user());

drop policy if exists permissions_admin_write on public.permissions;
create policy permissions_admin_write on public.permissions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select using (public.is_active_user());

drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_admin_write on public.role_permissions for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- settings_lists (admin writes, everyone reads)
-- ---------------------------------------------------------------------------
drop policy if exists settings_lists_read on public.settings_lists;
create policy settings_lists_read on public.settings_lists for select using (public.is_active_user());

drop policy if exists settings_lists_admin_write on public.settings_lists;
create policy settings_lists_admin_write on public.settings_lists for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients
  for select using (public.is_active_user());

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients
  for insert with check (public.is_active_user());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients
  for delete using (public.is_manager_or_admin());

-- client_contacts & client_notes follow client visibility
drop policy if exists client_contacts_read on public.client_contacts;
create policy client_contacts_read on public.client_contacts for select using (public.is_active_user());
drop policy if exists client_contacts_write on public.client_contacts;
create policy client_contacts_write on public.client_contacts for all
  using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists client_notes_read on public.client_notes;
create policy client_notes_read on public.client_notes for select using (public.is_active_user());
drop policy if exists client_notes_write on public.client_notes;
create policy client_notes_write on public.client_notes for all
  using (public.is_active_user()) with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- candidates
-- ---------------------------------------------------------------------------
drop policy if exists candidates_read on public.candidates;
create policy candidates_read on public.candidates
  for select using (public.is_active_user());

drop policy if exists candidates_insert on public.candidates;
create policy candidates_insert on public.candidates
  for insert with check (public.is_active_user());

drop policy if exists candidates_update on public.candidates;
create policy candidates_update on public.candidates
  for update using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists candidates_delete on public.candidates;
create policy candidates_delete on public.candidates
  for delete using (public.is_manager_or_admin());

drop policy if exists candidate_notes_rw on public.candidate_notes;
create policy candidate_notes_rw on public.candidate_notes for all
  using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists candidate_documents_rw on public.candidate_documents;
create policy candidate_documents_rw on public.candidate_documents for all
  using (public.is_active_user()) with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
drop policy if exists jobs_read on public.job_requirements;
create policy jobs_read on public.job_requirements for select using (public.is_active_user());
drop policy if exists jobs_write on public.job_requirements;
create policy jobs_write on public.job_requirements for all
  using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists job_recruiters_rw on public.job_recruiters;
create policy job_recruiters_rw on public.job_recruiters for all
  using (public.is_active_user()) with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- BD leads
-- ---------------------------------------------------------------------------
drop policy if exists bd_leads_read on public.bd_leads;
create policy bd_leads_read on public.bd_leads for select using (public.is_active_user());
drop policy if exists bd_leads_write on public.bd_leads;
create policy bd_leads_write on public.bd_leads for all
  using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists bd_activities_rw on public.bd_activities;
create policy bd_activities_rw on public.bd_activities for all
  using (public.is_active_user()) with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- staff (admin-only mutations; managers can view)
-- ---------------------------------------------------------------------------
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select using (public.is_manager_or_admin());

drop policy if exists staff_self_read on public.staff;
create policy staff_self_read on public.staff
  for select using (profile_id = (select id from public.profiles where auth_user_id = auth.uid()));

drop policy if exists staff_admin_write on public.staff;
create policy staff_admin_write on public.staff for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists kpi_targets_read on public.kpi_targets;
create policy kpi_targets_read on public.kpi_targets for select using (public.is_manager_or_admin());

drop policy if exists kpi_targets_admin_write on public.kpi_targets;
create policy kpi_targets_admin_write on public.kpi_targets for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- pipeline + history
-- ---------------------------------------------------------------------------
drop policy if exists pipeline_rw on public.candidate_job_pipeline;
create policy pipeline_rw on public.candidate_job_pipeline for all
  using (public.is_active_user()) with check (public.is_active_user());

drop policy if exists pipeline_history_read on public.pipeline_stage_history;
create policy pipeline_history_read on public.pipeline_stage_history for select using (public.is_active_user());

drop policy if exists pipeline_history_insert on public.pipeline_stage_history;
create policy pipeline_history_insert on public.pipeline_stage_history for insert with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- interviews
-- ---------------------------------------------------------------------------
drop policy if exists interviews_rw on public.interviews;
create policy interviews_rw on public.interviews for all
  using (public.is_active_user()) with check (public.is_active_user());

-- ---------------------------------------------------------------------------
-- placements (managers can read; admins write; recruiters see their own)
-- ---------------------------------------------------------------------------
drop policy if exists placements_read on public.placements;
create policy placements_read on public.placements for select using (
  public.is_manager_or_admin()
  or recruiter_id = (select id from public.profiles where auth_user_id = auth.uid())
);

drop policy if exists placements_insert on public.placements;
create policy placements_insert on public.placements for insert
  with check (public.is_manager_or_admin());

drop policy if exists placements_update on public.placements;
create policy placements_update on public.placements for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists placements_delete on public.placements;
create policy placements_delete on public.placements for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- tasks (assignee + creator + manager+admin can edit)
-- ---------------------------------------------------------------------------
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select using (public.is_active_user());

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert with check (public.is_active_user());

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update using (
  public.is_manager_or_admin()
  or assigned_to_id = (select id from public.profiles where auth_user_id = auth.uid())
  or created_by = (select id from public.profiles where auth_user_id = auth.uid())
) with check (true);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete using (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- activity_logs (read-only for active users; admins can purge)
-- ---------------------------------------------------------------------------
drop policy if exists activity_logs_read on public.activity_logs;
create policy activity_logs_read on public.activity_logs for select using (public.is_manager_or_admin());

drop policy if exists activity_logs_insert on public.activity_logs;
create policy activity_logs_insert on public.activity_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- Storage policies for resumes bucket
-- ---------------------------------------------------------------------------
drop policy if exists resumes_select on storage.objects;
create policy resumes_select on storage.objects for select
  using (bucket_id = 'resumes' and public.is_active_user());

drop policy if exists resumes_insert on storage.objects;
create policy resumes_insert on storage.objects for insert
  with check (bucket_id = 'resumes' and public.is_active_user());

drop policy if exists resumes_update on storage.objects;
create policy resumes_update on storage.objects for update
  using (bucket_id = 'resumes' and public.is_active_user())
  with check (bucket_id = 'resumes' and public.is_active_user());

drop policy if exists resumes_delete on storage.objects;
create policy resumes_delete on storage.objects for delete
  using (bucket_id = 'resumes' and public.is_manager_or_admin());

drop policy if exists client_logos_insert on storage.objects;
create policy client_logos_insert on storage.objects for insert
  with check (bucket_id = 'client-logos' and public.is_active_user());

drop policy if exists client_logos_update on storage.objects;
create policy client_logos_update on storage.objects for update
  using (bucket_id = 'client-logos' and public.is_active_user())
  with check (bucket_id = 'client-logos' and public.is_active_user());

drop policy if exists client_logos_delete on storage.objects;
create policy client_logos_delete on storage.objects for delete
  using (bucket_id = 'client-logos' and public.is_manager_or_admin());


-- >>> SOURCE: migrations/0006_seed.sql

-- ============================================================================
-- 0006_seed.sql
-- System seed data: roles, permissions, default configurable lists.
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
insert into public.roles (name, description, is_system) values
  ('admin',     'Full access to all modules and settings', true),
  ('manager',   'Operational oversight; limited sensitive edits', true),
  ('recruiter', 'Day-to-day recruiter; access to assigned records', true),
  ('viewer',    'Read-only access to permitted modules', true)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Permissions: (module, action)
-- ---------------------------------------------------------------------------
insert into public.permissions (module, action, description) values
  -- modules: candidates, clients, bd, jobs, pipeline, interviews,
  --          placements, kpi, staff, reports, settings, rbac
  -- actions: view, create, edit, delete, export, manage
  ('candidates','view',null),
  ('candidates','create',null),
  ('candidates','edit',null),
  ('candidates','delete',null),
  ('candidates','export',null),
  ('candidates','view_sensitive','Includes current/expected CTC'),

  ('clients','view',null),
  ('clients','create',null),
  ('clients','edit',null),
  ('clients','delete',null),
  ('clients','export',null),
  ('clients','edit_commercial','Edit commercial terms, replacement period, payment terms'),

  ('bd','view',null),
  ('bd','create',null),
  ('bd','edit',null),
  ('bd','delete',null),
  ('bd','export',null),

  ('jobs','view',null),
  ('jobs','create',null),
  ('jobs','edit',null),
  ('jobs','delete',null),
  ('jobs','export',null),
  ('jobs','view_salary','See min/max salary on a job'),
  ('jobs','edit_salary','Edit min/max salary on a job'),

  ('pipeline','view',null),
  ('pipeline','create',null),
  ('pipeline','edit',null),
  ('pipeline','delete',null),

  ('interviews','view',null),
  ('interviews','create',null),
  ('interviews','edit',null),
  ('interviews','delete',null),

  ('placements','view',null),
  ('placements','create',null),
  ('placements','edit',null),
  ('placements','delete',null),
  ('placements','view_financial','See offered CTC, revenue, billing %'),
  ('placements','edit_financial','Edit offered CTC, revenue, billing %, invoice/payment'),
  ('placements','export',null),

  ('kpi','view',null),
  ('kpi','view_company','View company-level KPIs incl. revenue'),
  ('kpi','export',null),
  ('kpi','edit_targets','Edit recruiter/staff KPI targets'),

  ('staff','view',null),
  ('staff','create',null),
  ('staff','edit',null),
  ('staff','delete',null),
  ('staff','view_salary','See staff salary, incentives'),
  ('staff','edit_salary','Edit staff salary, incentives, KPI targets'),

  ('reports','view',null),
  ('reports','export',null),

  ('settings','view',null),
  ('settings','manage','Edit configurable lists, stages, statuses'),

  ('rbac','view',null),
  ('rbac','manage','Manage roles, permissions, invitations'),

  ('tasks','view',null),
  ('tasks','create',null),
  ('tasks','edit',null),
  ('tasks','delete',null)
on conflict (module, action) do nothing;

-- ---------------------------------------------------------------------------
-- Role -> Permission grants
-- ---------------------------------------------------------------------------
-- Admin: everything
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'admin'
on conflict do nothing;

-- Manager: view+create+edit everywhere; export reports; view_sensitive/financial; no edit_salary, no rbac.manage
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'manager'
  and (
    p.action in ('view','create','edit','export','view_sensitive','view_salary','view_financial','view_company')
    or (p.module = 'tasks' and p.action in ('view','create','edit','delete'))
    or (p.module = 'pipeline' and p.action in ('view','create','edit','delete'))
    or (p.module = 'interviews' and p.action in ('view','create','edit','delete'))
    or (p.module = 'settings' and p.action = 'view')
    or (p.module = 'rbac' and p.action = 'view')
  )
on conflict do nothing;

-- Recruiter: view/create/edit on operational modules; no delete, no financial, no rbac
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'recruiter'
  and (
    (p.module in ('candidates','clients','jobs','bd','pipeline','interviews','tasks') and p.action in ('view','create','edit'))
    or (p.module = 'placements' and p.action = 'view')
    or (p.module = 'kpi' and p.action = 'view')
    or (p.module = 'reports' and p.action = 'view')
    or (p.module = 'settings' and p.action = 'view')
  )
on conflict do nothing;

-- Viewer: view only
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.name = 'viewer'
  and p.action = 'view'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Settings lists: default configurable values
-- ---------------------------------------------------------------------------
insert into public.settings_lists (list_key, value, label, sort_order, color, is_system) values
  -- Candidate statuses
  ('candidate_status','new','New',10,'slate',true),
  ('candidate_status','screened','Screened',20,'blue',true),
  ('candidate_status','shortlisted','Shortlisted',30,'indigo',true),
  ('candidate_status','submitted','Submitted to client',40,'violet',true),
  ('candidate_status','interview_in_progress','Interview in progress',50,'amber',true),
  ('candidate_status','offered','Offered',60,'orange',true),
  ('candidate_status','joined','Joined',70,'green',true),
  ('candidate_status','rejected','Rejected',80,'red',true),
  ('candidate_status','on_hold','On hold',90,'zinc',true),
  ('candidate_status','not_interested','Not interested',100,'gray',true),
  ('candidate_status','blacklisted','Blacklisted',110,'black',true),

  -- Client statuses
  ('client_status','prospect','Prospect',10,'slate',true),
  ('client_status','active','Active',20,'green',true),
  ('client_status','dormant','Dormant',30,'amber',true),
  ('client_status','lost','Lost',40,'red',true),
  ('client_status','on_hold','On hold',50,'zinc',true),

  -- BD stages
  ('bd_stage','new_lead','New lead',10,'slate',true),
  ('bd_stage','contacted','Contacted',20,'blue',true),
  ('bd_stage','meeting_scheduled','Meeting scheduled',30,'indigo',true),
  ('bd_stage','proposal_sent','Proposal sent',40,'violet',true),
  ('bd_stage','negotiation','Negotiation',50,'amber',true),
  ('bd_stage','converted','Converted to client',60,'green',true),
  ('bd_stage','lost','Lost',70,'red',true),
  ('bd_stage','nurture','Nurture later',80,'zinc',true),

  -- Job statuses
  ('job_status','open','Open',10,'green',true),
  ('job_status','on_hold','On hold',20,'amber',true),
  ('job_status','closed','Closed',30,'slate',true),
  ('job_status','cancelled','Cancelled',40,'red',true),
  ('job_status','filled','Filled',50,'indigo',true),

  -- Pipeline stages
  ('pipeline_stage','sourced','Sourced',10,'slate',true),
  ('pipeline_stage','screened','Screened',20,'blue',true),
  ('pipeline_stage','shortlisted','Shortlisted',30,'indigo',true),
  ('pipeline_stage','submitted','Submitted to client',40,'violet',true),
  ('pipeline_stage','client_shortlisted','Client shortlisted',50,'fuchsia',true),
  ('pipeline_stage','interview_scheduled','Interview scheduled',60,'amber',true),
  ('pipeline_stage','interview_round_1','Interview round 1',70,'amber',true),
  ('pipeline_stage','interview_round_2','Interview round 2',80,'amber',true),
  ('pipeline_stage','final_interview','Final interview',90,'orange',true),
  ('pipeline_stage','offer_discussion','Offer discussion',100,'orange',true),
  ('pipeline_stage','offer_released','Offer released',110,'orange',true),
  ('pipeline_stage','offer_accepted','Offer accepted',120,'green',true),
  ('pipeline_stage','joined','Joined',130,'green',true),
  ('pipeline_stage','rejected','Rejected',140,'red',true),
  ('pipeline_stage','dropped','Dropped',150,'gray',true),
  ('pipeline_stage','on_hold','On hold',160,'zinc',true),

  -- Interview statuses
  ('interview_status','scheduled','Scheduled',10,'amber',true),
  ('interview_status','completed','Completed',20,'green',true),
  ('interview_status','rescheduled','Rescheduled',30,'blue',true),
  ('interview_status','cancelled','Cancelled',40,'red',true),
  ('interview_status','no_show','No show',50,'gray',true),
  ('interview_status','selected','Selected',60,'green',true),
  ('interview_status','rejected','Rejected',70,'red',true),
  ('interview_status','on_hold','On hold',80,'zinc',true),

  -- Placement statuses
  ('placement_status','offer_accepted','Offer accepted',10,'orange',true),
  ('placement_status','joined','Joined',20,'green',true),
  ('placement_status','backed_out_before','Backed out before joining',30,'red',true),
  ('placement_status','backed_out_after','Backed out after joining',40,'red',true),
  ('placement_status','replacement_required','Replacement required',50,'amber',true),
  ('placement_status','invoice_raised','Invoice raised',60,'blue',true),
  ('placement_status','payment_received','Payment received',70,'green',true),
  ('placement_status','closed','Closed',80,'slate',true),

  -- Sources
  ('candidate_source','linkedin','LinkedIn',10,null,true),
  ('candidate_source','naukri','Naukri',20,null,true),
  ('candidate_source','referral','Referral',30,null,true),
  ('candidate_source','internal_db','Internal DB',40,null,true),
  ('candidate_source','website','Website',50,null,true),
  ('candidate_source','other','Other',60,null,true),

  ('bd_source','linkedin','LinkedIn',10,null,true),
  ('bd_source','referral','Referral',20,null,true),
  ('bd_source','event','Event',30,null,true),
  ('bd_source','website','Website',40,null,true),
  ('bd_source','cold_outreach','Cold outreach',50,null,true),
  ('bd_source','other','Other',60,null,true)
on conflict (list_key, value) do nothing;
