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
