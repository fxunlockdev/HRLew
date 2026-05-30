/**
 * Domain types used across the app. Kept hand-rolled (rather than codegen) so
 * the codebase compiles before the Supabase project is linked.
 */

export type UserStatus = "pending" | "active" | "suspended" | "archived";
export type RoleName = "admin" | "manager" | "recruiter" | "viewer";

export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role_id: string | null;
  status: UserStatus;
  invited_by: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  role?: { id: string; name: RoleName; description: string | null } | null;
}

export interface Role {
  id: string;
  name: RoleName;
  description: string | null;
  is_system: boolean;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

export interface Candidate {
  id: string;
  display_id: string;
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
  skills: string[];
  industry: string | null;
  source: string | null;
  resume_url: string | null;
  resume_file_name: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  status: string;
  assigned_recruiter_id: string | null;
  tags: string[];
  notes: string | null;
  is_blacklisted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  display_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  status: string;
  account_owner_id: string | null;
  contract_type: string | null;
  commercial_terms: string | null;
  replacement_period_days: number | null;
  payment_terms_days: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
}

export interface BdLead {
  id: string;
  display_id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linkedin_url: string | null;
  industry: string | null;
  source: string | null;
  owner_id: string | null;
  stage: string;
  expected_value: number | null;
  notes: string | null;
  next_follow_up_at: string | null;
  converted_client_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRequirement {
  id: string;
  display_id: string;
  client_id: string;
  title: string;
  department: string | null;
  location: string | null;
  work_mode: "onsite" | "hybrid" | "remote" | null;
  employment_type: "full_time" | "contract" | "part_time" | "internship" | null;
  openings: number;
  min_experience_years: number | null;
  max_experience_years: number | null;
  min_salary: number | null;
  max_salary: number | null;
  required_skills: string[];
  good_to_have_skills: string[];
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: string;
  target_closure_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineRow {
  id: string;
  candidate_id: string;
  job_id: string;
  client_id: string;
  assigned_recruiter_id: string | null;
  current_stage: string;
  submitted_at: string | null;
  last_activity_at: string;
  next_follow_up_at: string | null;
  rejection_reason: string | null;
  drop_reason: string | null;
  offer_amount: number | null;
  joining_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  candidate_name?: string;
  job_title?: string;
  client_name?: string;
  recruiter_name?: string;
}

export interface Interview {
  id: string;
  pipeline_id: string | null;
  candidate_id: string;
  job_id: string;
  client_id: string;
  round_label: string | null;
  interview_type: "phone" | "video" | "in_person" | "assignment" | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  interviewer_name: string | null;
  interviewer_email: string | null;
  meeting_link: string | null;
  location: string | null;
  status: string;
  outcome: string | null;
  feedback: string | null;
  rating: number | null;
  next_step: string | null;
  scheduled_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Placement {
  id: string;
  display_id: string;
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
  invoice_status: "not_raised" | "raised" | "partially_paid" | "paid" | "overdue" | "cancelled";
  payment_status: "pending" | "partial" | "received" | "overdue" | "written_off";
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
  payment_received_date: string | null;
  status: string;
  joining_status:
    | "pending"
    | "joined"
    | "backed_out_before"
    | "backed_out_after"
    | "replacement_required"
    | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffMember {
  id: string;
  display_id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  manager_id: string | null;
  joining_date: string | null;
  employment_status: string;
  salary: number | null;
  incentive_structure: string | null;
  kpi_target: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  related_entity_type:
    | "candidate"
    | "client"
    | "bd_lead"
    | "job"
    | "interview"
    | "placement"
    | "pipeline"
    | null;
  related_entity_id: string | null;
  assigned_to_id: string | null;
  due_at: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettingsListItem {
  id: string;
  list_key: string;
  value: string;
  label: string;
  sort_order: number;
  color: string | null;
  is_system: boolean;
  is_active: boolean;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  previous_value: unknown;
  new_value: unknown;
  metadata: unknown;
  created_at: string;
}
