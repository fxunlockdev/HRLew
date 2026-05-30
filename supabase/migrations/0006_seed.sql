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
