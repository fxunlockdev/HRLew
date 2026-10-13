import type { Generated } from "kysely";

/**
 * Kysely table interfaces, hand-kept against db/migrations/*.sql.
 *
 * Hand-written rather than generated so `tsc` never needs a live database.
 * When you add a migration, add the columns here in the same change.
 *
 * Timestamps are ISO strings and numerics are numbers — see pg-types.ts.
 */

export type UserStatusDb = "pending" | "active" | "suspended" | "archived";

/** Columns below carry CHECK constraints; these mirror them exactly. */
export type WorkMode = "onsite" | "hybrid" | "remote";
export type EmploymentType = "full_time" | "contract" | "part_time" | "internship";
export type Priority = "low" | "normal" | "high" | "urgent";
export type InterviewType = "phone" | "video" | "in_person" | "assignment";
export type InterviewOutcome =
  | "selected"
  | "rejected"
  | "on_hold"
  | "no_show"
  | "rescheduled"
  | "pending";
export type InvoiceStatus =
  | "not_raised"
  | "raised"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";
export type PaymentStatus = "pending" | "partial" | "received" | "overdue" | "written_off";
export type JoiningStatus =
  | "pending"
  | "joined"
  | "backed_out_before"
  | "backed_out_after"
  | "replacement_required";
export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
export type TaskEntityType =
  | "candidate"
  | "client"
  | "bd_lead"
  | "job"
  | "interview"
  | "placement"
  | "pipeline";
export type BdActivityType = "call" | "email" | "meeting" | "note" | "proposal_sent" | "other";
export type KpiPeriod = "monthly" | "quarterly" | "yearly";

export interface AppUsersTable {
  id: Generated<string>;
  email: string;
  password_hash: string;
  must_change_password: Generated<boolean>;
  failed_login_count: Generated<number>;
  locked_until: string | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface UserSessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Generated<string>;
  last_used_at: Generated<string>;
  expires_at: string;
}

export interface RolesTable {
  id: Generated<string>;
  name: string;
  description: string | null;
  is_system: Generated<boolean>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface PermissionsTable {
  id: Generated<string>;
  module: string;
  action: string;
  description: string | null;
  created_at: Generated<string>;
}

export interface RolePermissionsTable {
  id: Generated<string>;
  role_id: string;
  permission_id: string;
}

export interface ProfilesTable {
  id: Generated<string>;
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role_id: string | null;
  status: Generated<UserStatusDb>;
  invited_by: string | null;
  last_seen_at: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface SettingsListsTable {
  id: Generated<string>;
  list_key: string;
  value: string;
  label: string;
  sort_order: Generated<number>;
  color: string | null;
  is_system: Generated<boolean>;
  is_active: Generated<boolean>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface ClientsTable {
  id: Generated<string>;
  display_id: Generated<string>;
  name: string;
  website: string | null;
  /** External image URL, or an object key in the Railway bucket. */
  logo_url: string | null;
  logo_file_name: string | null;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  status: Generated<string>;
  account_owner_id: string | null;
  contract_type: string | null;
  commercial_terms: string | null;
  replacement_period_days: number | null;
  payment_terms_days: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface ClientContactsTable {
  id: Generated<string>;
  client_id: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  is_primary: Generated<boolean>;
  notes: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface ClientNotesTable {
  id: Generated<string>;
  client_id: string;
  author_id: string | null;
  body: string;
  created_at: Generated<string>;
}

export interface CandidatesTable {
  id: Generated<string>;
  display_id: Generated<string>;
  full_name: string;
  email: string | null;
  phone: string | null;
  current_company: string | null;
  current_designation: string | null;
  current_location: string | null;
  preferred_location: string | null;
  total_experience_years: number | null;
  relevant_experience_years: number | null;
  current_ctc: number | null;
  expected_ctc: number | null;
  notice_period_days: number | null;
  last_working_day: string | null;
  skills: Generated<string[]>;
  industry: string | null;
  source: string | null;
  /** Object key of the most recent resume in the bucket. */
  resume_url: string | null;
  resume_file_name: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  status: Generated<string>;
  assigned_recruiter_id: string | null;
  tags: Generated<string[]>;
  notes: string | null;
  is_blacklisted: Generated<boolean>;
  created_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface CandidateNotesTable {
  id: Generated<string>;
  candidate_id: string;
  author_id: string | null;
  body: string;
  created_at: Generated<string>;
}

export interface CandidateDocumentsTable {
  id: Generated<string>;
  candidate_id: string;
  uploaded_by: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: Generated<string>;
  created_at: Generated<string>;
}

export interface JobRequirementsTable {
  id: Generated<string>;
  display_id: Generated<string>;
  client_id: string;
  title: string;
  department: string | null;
  location: string | null;
  work_mode: WorkMode | null;
  employment_type: EmploymentType | null;
  openings: Generated<number>;
  min_experience_years: number | null;
  max_experience_years: number | null;
  min_salary: number | null;
  max_salary: number | null;
  required_skills: Generated<string[]>;
  good_to_have_skills: Generated<string[]>;
  description: string | null;
  priority: Generated<Priority>;
  status: Generated<string>;
  target_closure_date: string | null;
  created_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface JobRecruitersTable {
  id: Generated<string>;
  job_id: string;
  recruiter_id: string;
  is_lead: Generated<boolean>;
  assigned_at: Generated<string>;
}

export interface BdLeadsTable {
  id: Generated<string>;
  display_id: Generated<string>;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linkedin_url: string | null;
  industry: string | null;
  source: string | null;
  owner_id: string | null;
  stage: Generated<string>;
  expected_value: number | null;
  notes: string | null;
  next_follow_up_at: string | null;
  converted_client_id: string | null;
  converted_at: string | null;
  created_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface BdActivitiesTable {
  id: Generated<string>;
  lead_id: string;
  author_id: string | null;
  activity_type: BdActivityType;
  subject: string | null;
  body: string | null;
  occurred_at: Generated<string>;
  created_at: Generated<string>;
}

export interface StaffTable {
  id: Generated<string>;
  profile_id: string | null;
  display_id: Generated<string>;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  manager_id: string | null;
  joining_date: string | null;
  employment_status: Generated<string>;
  salary: number | null;
  incentive_structure: string | null;
  kpi_target: Generated<Record<string, unknown>>;
  notes: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface CandidateJobPipelineTable {
  id: Generated<string>;
  candidate_id: string;
  job_id: string;
  client_id: string;
  assigned_recruiter_id: string | null;
  current_stage: Generated<string>;
  submitted_at: string | null;
  last_activity_at: Generated<string>;
  next_follow_up_at: string | null;
  rejection_reason: string | null;
  drop_reason: string | null;
  offer_amount: number | null;
  joining_date: string | null;
  notes: string | null;
  is_active: Generated<boolean>;
  created_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface PipelineStageHistoryTable {
  id: Generated<string>;
  pipeline_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  notes: string | null;
  changed_at: Generated<string>;
}

export interface InterviewsTable {
  id: Generated<string>;
  pipeline_id: string | null;
  candidate_id: string;
  job_id: string;
  client_id: string;
  round_label: string | null;
  interview_type: InterviewType | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  interviewer_name: string | null;
  interviewer_email: string | null;
  meeting_link: string | null;
  location: string | null;
  status: Generated<string>;
  outcome: InterviewOutcome | null;
  feedback: string | null;
  rating: number | null;
  next_step: string | null;
  scheduled_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface PlacementsTable {
  id: Generated<string>;
  display_id: Generated<string>;
  candidate_id: string;
  client_id: string;
  job_id: string;
  pipeline_id: string | null;
  recruiter_id: string | null;
  offered_designation: string | null;
  offered_ctc: number | null;
  billing_percentage: number | null;
  placement_revenue: number | null;
  joining_date: string | null;
  replacement_period_days: number | null;
  replacement_end_date: string | null;
  invoice_status: Generated<InvoiceStatus>;
  payment_status: Generated<PaymentStatus>;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
  payment_received_date: string | null;
  status: Generated<string>;
  joining_status: JoiningStatus | null;
  notes: string | null;
  created_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface TasksTable {
  id: Generated<string>;
  title: string;
  description: string | null;
  related_entity_type: TaskEntityType | null;
  related_entity_id: string | null;
  assigned_to_id: string | null;
  due_at: string | null;
  priority: Generated<Priority>;
  status: Generated<TaskStatus>;
  completed_at: string | null;
  created_by: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface KpiTargetsTable {
  id: Generated<string>;
  staff_id: string;
  period: KpiPeriod;
  period_start: string;
  metric_key: string;
  target_value: number;
  notes: string | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface ActivityLogsTable {
  id: Generated<string>;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Generated<string>;
}

/** Read-only view: pipeline rows with candidate/job/client/recruiter names. */
export interface VPipelineOverview {
  id: string;
  current_stage: string;
  is_active: boolean;
  submitted_at: string | null;
  last_activity_at: string;
  next_follow_up_at: string | null;
  offer_amount: number | null;
  joining_date: string | null;
  notes: string | null;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  job_id: string;
  job_title: string;
  client_id: string;
  client_name: string;
  recruiter_id: string | null;
  recruiter_name: string | null;
}

export interface DB {
  activity_logs: ActivityLogsTable;
  app_users: AppUsersTable;
  bd_activities: BdActivitiesTable;
  bd_leads: BdLeadsTable;
  candidate_documents: CandidateDocumentsTable;
  candidate_job_pipeline: CandidateJobPipelineTable;
  candidate_notes: CandidateNotesTable;
  candidates: CandidatesTable;
  client_contacts: ClientContactsTable;
  client_notes: ClientNotesTable;
  clients: ClientsTable;
  interviews: InterviewsTable;
  job_recruiters: JobRecruitersTable;
  job_requirements: JobRequirementsTable;
  kpi_targets: KpiTargetsTable;
  permissions: PermissionsTable;
  pipeline_stage_history: PipelineStageHistoryTable;
  placements: PlacementsTable;
  profiles: ProfilesTable;
  role_permissions: RolePermissionsTable;
  roles: RolesTable;
  settings_lists: SettingsListsTable;
  staff: StaffTable;
  tasks: TasksTable;
  user_sessions: UserSessionsTable;
  v_pipeline_overview: VPipelineOverview;
}
