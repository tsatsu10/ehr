/**
 * Front desk and registration domain types.
 */

import type { AppointmentTodayChip, RecallDueChip } from './chips';
import type { VisitState } from './common';
import type { PatientCompletion, PatientIdentity } from './patient';

/** V1.2 hard-assign doctor roster row (triage + front desk) */
export interface AssignableDoctor {
  user_id: number;
  display_name: string;
  taking_patients: boolean;
}

/** Response from patients.preview on front desk */
export interface FrontDeskPreviewData {
  identity: PatientIdentity & { phone_masked?: string };
  completion: PatientCompletion & {
    chart_open_url?: string;
    chart_url?: string;
  };
  safety?: {
    allergies_severe?: string[];
    allergies_undocumented?: boolean;
    pregnant?: boolean;
    problem_count?: number;
    allergy_count?: number;
  };
  banner_mrd_deep_links?: boolean;
  allergy_count_chip?: boolean;
  active_visit?: {
    visit_id: number;
    state: VisitState;
    queue_number: number | string;
    row_version?: number;
    chief_complaint?: string | null;
    hard_assigned_provider_id?: number;
    hard_assigned_provider_name?: string;
  } | null;
  hard_provider_assignment_enabled?: boolean;
  can_hard_assign_provider?: boolean;
  assignable_doctors?: AssignableDoctor[];
  appointment_today?: AppointmentTodayChip | null;
  recall_due?: RecallDueChip | null;
  chips?: {
    appointment_today?: AppointmentTodayChip | null;
    recall_due?: RecallDueChip | null;
  };
  visits_today?: TodayVisitRow[];
  revisit_gate?: RevisitGate;
  /** Insurance type that is effective today (expired NHIS → 'cash'). Only present in front-desk context. */
  insurance_effective?: 'cash' | 'nhis' | 'private';
  /** Display label e.g. 'Cash (NHIS expired)'. Only present in front-desk context. */
  insurance_label?: string;
  /** Count of closed_unpaid visits for this patient. Only present in front-desk context. */
  unpaid_visits_count?: number;
  queue_bridge?: {
    enabled?: boolean;
    hub_url?: string;
    ex01_open?: boolean;
    block_plain_start?: boolean;
    show_arrival_advisor?: boolean;
  };
}

export interface TodayVisitRow {
  visit_id: number;
  queue_number: number;
  state: VisitState;
  visit_type_label?: string;
  is_finished: boolean;
}

export interface RevisitGate {
  applies: boolean;
  blocked: boolean;
  score: number;
  threshold: number;
  pediatric_dob_block: boolean;
  missing_labels?: string[];
  can_manager_override: boolean;
}

export interface FrontDeskDeskStats {
  visits_started_today: number;
  waiting_count: number;
  recent_starts: Array<{
    visit_id: number;
    queue_number: number;
    state: VisitState;
    pid: number;
    display_name: string;
    pubpid: string;
  }>;
}

/** Row from front_desk.todays_appointments */
export interface TodaysAppointmentRow {
  pid: number;
  display_name: string;
  pubpid: string;
  pc_eid: number;
  start_time_label?: string | null;
  provider_name?: string | null;
}

export interface DeskVisitType {
  id: number;
  label: string;
  is_default?: boolean;
  service_profile?: string;
  service_profile_hint?: string | null;
  referral_required?: boolean;
  allows_referral_upload?: boolean;
}

/** Priority flags set at registration — drives fast-track sorting */
export type VisitPriorityFlag = 'standard' | 'elderly' | 'pregnant' | 'under_5' | 'urgent';

/** Today's flow chart data for the front desk collapsible strip */
export interface FrontDeskFlowChartsData {
  hourly_visits: { hour: number; count: number }[];
  adherence: { scheduled: number; arrived: number; no_show: number; pending: number };
  wait_avg_today_mins: number;
  wait_avg_yesterday_mins: number;
}

/** Response from visit.start / visit.start_from_appointment */
export interface VisitStartData {
  visit: {
    id: number;
    queue_number: string | number;
    state?: VisitState;
    row_version?: number;
    priority_flag?: VisitPriorityFlag;
  };
  queue_slip_enabled?: boolean;
  queue_slip_url?: string;
  appointment_status_updated?: boolean;
  recurring_guard_fired?: boolean;
}

/** Front desk island props (passed via data-props JSON from Twig) */
export interface FrontDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  moduleUrl: string;
  visitBoardUrl?: string;
  registrationMode?: string;
  pinnedPreview?: boolean;
  printQueueSlip?: boolean;
  canSkipTriage?: boolean;
  canCancelVisit?: boolean;
  canRevisitOverride?: boolean;
  enforceCompletionOnRevisit?: boolean;
  scheduledIntegrationEnabled?: boolean;
  appointmentsTodayCount?: number;
  calendarUrl?: string;
  recallsUrl?: string;
  enablePayerBilling?: boolean;
}

export interface RegistrationDupCandidate {
  pid: number;
  display_name: string;
  pubpid: string;
  score: number;
  match_reasons?: string[];
}

export interface RegistrationDupResult {
  level: 'none' | 'warn' | 'block';
  candidates?: RegistrationDupCandidate[];
}

export interface RegistrationFormData {
  pid?: number;
  pubpid?: string;
  section_1?: Record<string, unknown>;
  section_2?: Record<string, unknown>;
  section_3?: Record<string, unknown>;
  section_4?: Record<string, unknown>;
  completion?: { score?: number; missing?: string[] };
}

export interface RegistrationSaveResult {
  pid: number;
  completion_score?: number;
  completion_missing?: string[];
}
