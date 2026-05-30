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
create trigger trg_settings_lists_updated_at
  before update on public.settings_lists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  display_id text generated always as ('CL-' || lpad((floor(extract(epoch from created_at))::bigint % 1000000)::text, 6, '0')) stored,
  name text not null,
  website text,
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
create trigger trg_clients_updated_at before update on public.clients
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
create trigger trg_client_contacts_updated_at before update on public.client_contacts
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
  display_id text generated always as ('CN-' || lpad((floor(extract(epoch from created_at))::bigint % 1000000)::text, 6, '0')) stored,
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
create trigger trg_candidates_updated_at before update on public.candidates
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
  display_id text generated always as ('JR-' || lpad((floor(extract(epoch from created_at))::bigint % 1000000)::text, 6, '0')) stored,
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
create trigger trg_jobs_updated_at before update on public.job_requirements
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
  display_id text generated always as ('BD-' || lpad((floor(extract(epoch from created_at))::bigint % 1000000)::text, 6, '0')) stored,
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
create trigger trg_bd_leads_updated_at before update on public.bd_leads
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
  display_id text generated always as ('ST-' || lpad((floor(extract(epoch from created_at))::bigint % 1000000)::text, 6, '0')) stored,
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
create trigger trg_staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();
