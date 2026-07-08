/**
 * Visit board queue and detail modal types.
 */

import type { VisitState } from './common';
import type { PatientPreview } from './patient';

export interface VisitCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: VisitState;
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  chief_complaint: string;
  is_urgent: 0 | 1;
  skipped_triage: boolean;
  similar_surname_today: boolean;
  claim_lost: boolean;
  claim_lost_by?: { display_name: string; role_label: string };
  photo_url?: string;
  queue_bridge_badge?: {
    code: string;
    label: string;
    hub_url: string;
  };
  /** PRD §6.8.6 — when enable_ancillary_services is on */
  ancillary_badges?: string[];
}

export type ColumnKey =
  | 'waiting'
  | 'triage'
  | 'doctor'
  | 'lab'
  | 'pharmacy'
  | 'payment'
  | 'done';

export interface BoardConfig {
  enable_triage: boolean;
  enable_lab_role: boolean;
  enable_pharmacy_role: boolean;
  enable_queue_bridge?: boolean;
}

export interface BoardData {
  columns: Partial<Record<ColumnKey, VisitCard[]>>;
  config: BoardConfig;
  stale_count: number;
  visit_date?: string;
  cancelled?: BoardTerminalVisit[];
  closed_unpaid?: BoardTerminalVisit[];
  queue_bridge_badges?: Record<string, {
    code: string;
    label: string;
    hub_url: string;
  }>;
}

/** One row in a visit-board terminal collapsible (cancelled / left unpaid). */
export interface BoardTerminalVisit {
  id?: number;
  queue_number: string | number;
  display_name: string;
  cancel_reason?: string | null;
  unpaid_reason?: string | null;
}

/** @deprecated Use BoardTerminalVisit */
export type CancelledVisit = BoardTerminalVisit;

export interface VisitBoardProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  /** Milliseconds between auto-polls (default 30 000). */
  pollMs?: number;
  /** 'wall' renders privacy mode + now-serving banner. */
  profile?: 'default' | 'wall';
  privacyMode?: boolean;
  canCancel?: boolean;
  /** Desk-specific navigation URLs keyed by role slug. */
  deskUrls?: Record<string, string>;
  /** V1.1-OPS — fullscreen + wake-lock toolbar on wall profile. */
  kioskChrome?: boolean;
  /** Clinic display name for kiosk toolbar. */
  clinicName?: string;
}

export interface VisitDetailSummary {
  state: string;
  state_label: string;
  queue_number: number;
  visit_type_label: string;
  started_at_label?: string | null;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  provider_hint: string;
  chief_complaint?: string | null;
  badges?: string[];
  dob_label?: string | null;
}

export interface VisitDetailAuditItem {
  type: string;
  label: string;
  subtitle?: string | null;
  at: string;
  at_label?: string | null;
}

export interface VisitDetailVisit {
  id: number;
  pid: number;
  queue_number: string | number;
  state: VisitState;
  row_version?: number | null;
  is_urgent?: 0 | 1;
  chief_complaint?: string | null;
  visit_type_label?: string;
}

export interface VisitDetailData {
  visit: VisitDetailVisit;
  preview: PatientPreview;
  visit_summary: VisitDetailSummary;
  skipped_triage?: boolean;
  audit_timeline?: VisitDetailAuditItem[];
  chart_history_url?: string | null;
  queue_bridge_action?: {
    exception_code: string;
    pid: number;
    pc_eid: number;
    visit_id: number;
    appt_date: string;
    label: string;
    summary?: string;
    appt_time_label?: string | null;
    can_resolve: boolean;
    hub_url?: string;
  } | null;
}
