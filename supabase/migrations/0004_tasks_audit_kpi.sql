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
create trigger trg_tasks_updated_at before update on public.tasks
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

create trigger trg_kpi_targets_updated_at before update on public.kpi_targets
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
