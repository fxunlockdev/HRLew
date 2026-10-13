-- ============================================================================
-- 0006_rls_policies.sql
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
  using (id = public.current_profile_id() or public.is_manager_or_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update
  using (id = public.current_profile_id() or public.is_admin())
  with check (id = public.current_profile_id() or public.is_admin());

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
  for select using (profile_id = public.current_profile_id());

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
  or recruiter_id = public.current_profile_id()
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
  or assigned_to_id = public.current_profile_id()
  or created_by = public.current_profile_id()
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
-- Credential tables are deliberately NOT under RLS.
--
-- They are read before an actor exists (login, session lookup, first-run
-- setup), so there is no `app.profile_id` to police them with. Nothing outside
-- src/lib/auth touches them, and the application role below has no way to
-- reach them except through that code.
-- ---------------------------------------------------------------------------
alter table public.app_users disable row level security;
alter table public.user_sessions disable row level security;

-- ---------------------------------------------------------------------------
-- Application role.
--
-- Railway hands you a superuser DATABASE_URL, and superusers bypass RLS
-- outright — every policy above would be decorative if the app connected with
-- it. So the app connects as `hr_app` instead: ordinary privileges, nobypassrls,
-- RLS enforced. Migrations keep using the superuser URL.
--
-- The role itself is created by scripts/migrate.mjs (it needs a password from
-- the environment, which plain SQL cannot parameterise). This block only grants
-- privileges, and no-ops when the role is absent.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hr_app') then
    raise notice 'role hr_app not present - skipping grants';
    return;
  end if;

  grant usage on schema public to hr_app;
  grant select, insert, update, delete on all tables in schema public to hr_app;
  grant usage, select on all sequences in schema public to hr_app;
  grant execute on all functions in schema public to hr_app;

  -- Anything created by later migrations should be reachable too.
  alter default privileges in schema public
    grant select, insert, update, delete on tables to hr_app;
  alter default privileges in schema public
    grant usage, select on sequences to hr_app;
  alter default privileges in schema public
    grant execute on functions to hr_app;
end$$;
