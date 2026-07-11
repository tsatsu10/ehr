/**
 * Triage desk domain types.
 */

import type { PatientPreview } from './patient';

/** One vitals field rule as returned by VitalsValidationService::getFormRules() */
export interface VitalFieldRule {
  label: string;
  unit?: string;
  required: boolean;
  min: number;
  max: number;
  step?: number;
  warn_min?: number;
  warn_max?: number;
  warn_message?: string;
}

/** Full rules payload — passed via Twig data-props from triage.php */
export interface VitalsRules {
  temperature_unit?: string;
  required?: string[];
  fields: Record<string, VitalFieldRule>;
}

/** One field's validation outcome */
export type FieldValidation =
  | null
  | { level: 'ok' }
  | { level: 'warning'; message: string }
  | { level: 'error'; message: string };

/** Collected vitals from the form */
export type VitalsData = Partial<Record<VitalName, string>>;

export type VitalName =
  | 'bps' | 'bpd' | 'pulse' | 'temperature'
  | 'oxygen_saturation' | 'weight' | 'height' | 'respiration' | 'pain';

export const VITAL_ORDER: VitalName[][] = [
  ['bps', 'bpd', 'pulse', 'temperature'],
  ['oxygen_saturation', 'weight', 'height', 'respiration'],
  ['pain'],
];

/** A single patient in the triage queue */
export interface TriageQueueCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: 'waiting' | 'in_triage';
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  chief_complaint?: string;
  is_urgent: 0 | 1;
  triage_mine?: boolean;
  triage_actor_name?: string;
  claim_lost?: boolean;
  claim_lost_by?: { display_name: string; role_label: string };
  row_version?: number | null;
  ancillary_badges?: string[];
}

/** Response from ?action=triage.queue */
export interface TriageQueueData {
  visits: TriageQueueCard[];
  claim_lost_cards?: TriageQueueCard[];
  counts: { waiting: number; in_triage: number };
  visit_date?: string;
  /** Set when caller passed visit_date; null means all active carry-over visits. */
  queue_date_filter?: string | null;
  vitals_unit_label?: string;
  vitals_form_rules?: VitalsRules;
  hard_provider_assignment_enabled?: boolean;
  can_hard_assign_provider?: boolean;
  assignable_doctors?: Array<{ user_id: number; display_name: string; taking_patients: boolean }>;
}

/** Lightweight visit record returned by triage.select / triage.start */
export interface TriageVisit {
  id: number;
  pid: number;
  queue_number: string;
  state: 'waiting' | 'in_triage';
  visit_type_label?: string;
  chief_complaint?: string;
  row_version?: number | null;
  is_urgent?: 0 | 1;
}

/** Response from ?action=triage.select */
export interface TriageSelectData {
  visit: TriageVisit;
  preview: PatientPreview;
  form_vitals: VitalsData;
  vitals: unknown[];
  vitals_warnings: string[];
  vitals_unit_label?: string;
  vitals_form_rules?: VitalsRules;
}

/** Visit type used in the auto-start modal */
export interface VisitType {
  id: number;
  label: string;
}

/** Triage island props (passed via data-props JSON from Twig) */
export interface TriageDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pollMs?: number;
  visitBoardUrl?: string;
  vitalsRules?: VitalsRules;
  canCancel?: boolean;
  /** T1-F19 — enable shared-device session mismatch probe + banner */
  sharedDeviceWarning?: boolean;
}
