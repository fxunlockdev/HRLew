-- ============================================================================
-- 0009_delete_profile.sql
-- Deleting a user account, safely.
--
-- `profiles` is referenced by 21 columns with no ON DELETE behaviour, so a
-- plain DELETE is simply refused by Postgres. Those references fall into two
-- kinds, and they must be treated differently:
--
--   ownership  - who owns this client / is assigned this candidate / is
--                accountable for this task. Work does not stop existing when
--                someone leaves, so these are REASSIGNED to another user.
--
--   authorship - who wrote this note, who uploaded this document, who moved
--                this candidate, who did the thing in the audit log. These are
--                NULLED, never reassigned: crediting one person's note to
--                someone else would be a lie, and the audit trail has to stay
--                honest about the fact that the actor is gone.
--
-- job_recruiters (cascade) and staff.profile_id (set null) already declare
-- their own behaviour and are left to the foreign keys.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- What would a delete have to move? Drives the confirmation dialog.
-- ---------------------------------------------------------------------------
create or replace function public.profile_record_counts(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clients',   (select count(*) from clients
                   where account_owner_id = p_profile_id or created_by = p_profile_id),
    'candidates',(select count(*) from candidates
                   where assigned_recruiter_id = p_profile_id or created_by = p_profile_id),
    'jobs',      (select count(*) from job_requirements where created_by = p_profile_id),
    'pipeline',  (select count(*) from candidate_job_pipeline
                   where assigned_recruiter_id = p_profile_id or created_by = p_profile_id),
    'interviews',(select count(*) from interviews where scheduled_by = p_profile_id),
    'placements',(select count(*) from placements
                   where recruiter_id = p_profile_id or created_by = p_profile_id),
    'bd_leads',  (select count(*) from bd_leads
                   where owner_id = p_profile_id or created_by = p_profile_id),
    'tasks',     (select count(*) from tasks
                   where assigned_to_id = p_profile_id or created_by = p_profile_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- delete_profile: reassign what is owned, null what is authored, then remove
-- the account. Deleting the app_users row cascades to the profile and to every
-- session the user had, so a deleted user is signed out everywhere at once.
-- ---------------------------------------------------------------------------
create or replace function public.delete_profile(
  p_profile_id uuid,
  p_reassign_to uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_owned bigint;
  v_counts jsonb;
begin
  -- Defence in depth: the application checks rbac.manage before calling this,
  -- and the database insists on it too.
  if not public.is_admin() then
    raise exception 'only an administrator can delete a user';
  end if;

  if p_profile_id = public.current_profile_id() then
    raise exception 'you cannot delete your own account';
  end if;

  select user_id into v_user_id from public.profiles where id = p_profile_id;
  if v_user_id is null then
    raise exception 'user not found';
  end if;

  -- No "last administrator" check is needed: the two guards above already
  -- guarantee one survives. The caller must be an active admin (is_admin), and
  -- cannot be the person being deleted, so there is always at least one active
  -- administrator left standing afterwards.

  v_counts := public.profile_record_counts(p_profile_id);
  select sum(value::bigint) into v_owned
  from jsonb_each_text(v_counts);

  if v_owned > 0 then
    if p_reassign_to is null then
      raise exception 'user still owns % record(s) - choose someone to reassign them to', v_owned
        using detail = v_counts::text;
    end if;
    if p_reassign_to = p_profile_id then
      raise exception 'cannot reassign a user''s records to themselves';
    end if;
    if not exists (
      select 1 from public.profiles where id = p_reassign_to and status = 'active'
    ) then
      raise exception 'the person you are reassigning to must be an active user';
    end if;
  end if;

  if p_reassign_to is not null then
    update clients set account_owner_id = p_reassign_to where account_owner_id = p_profile_id;
    update clients set created_by = p_reassign_to where created_by = p_profile_id;
    update candidates set assigned_recruiter_id = p_reassign_to where assigned_recruiter_id = p_profile_id;
    update candidates set created_by = p_reassign_to where created_by = p_profile_id;
    update job_requirements set created_by = p_reassign_to where created_by = p_profile_id;
    update candidate_job_pipeline set assigned_recruiter_id = p_reassign_to where assigned_recruiter_id = p_profile_id;
    update candidate_job_pipeline set created_by = p_reassign_to where created_by = p_profile_id;
    update interviews set scheduled_by = p_reassign_to where scheduled_by = p_profile_id;
    update placements set recruiter_id = p_reassign_to where recruiter_id = p_profile_id;
    update placements set created_by = p_reassign_to where created_by = p_profile_id;
    update bd_leads set owner_id = p_reassign_to where owner_id = p_profile_id;
    update bd_leads set created_by = p_reassign_to where created_by = p_profile_id;
    update tasks set assigned_to_id = p_reassign_to where assigned_to_id = p_profile_id;
    update tasks set created_by = p_reassign_to where created_by = p_profile_id;
  end if;

  -- Authorship and history: the person is gone, and the record should say so.
  update client_notes        set author_id   = null where author_id   = p_profile_id;
  update candidate_notes     set author_id   = null where author_id   = p_profile_id;
  update candidate_documents set uploaded_by = null where uploaded_by = p_profile_id;
  update bd_activities       set author_id   = null where author_id   = p_profile_id;
  update pipeline_stage_history set changed_by = null where changed_by = p_profile_id;
  update activity_logs       set actor_id    = null where actor_id    = p_profile_id;
  update profiles            set invited_by  = null where invited_by  = p_profile_id;

  -- Cascades to the profile and to every session this user holds.
  delete from public.app_users where id = v_user_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'hr_app') then
    grant execute on function public.profile_record_counts(uuid) to hr_app;
    grant execute on function public.delete_profile(uuid, uuid) to hr_app;
  end if;
end$$;
