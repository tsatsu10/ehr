/**
 * Lab desk domain types.
 */

import type { PatientPreview } from './patient';

export interface LabQueueCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: 'ready_for_lab' | 'in_lab';
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  is_urgent: 0 | 1;
  lab_mine?: boolean;
  lab_actor_name?: string | null;
  order_count?: number;
  unreleased_count?: number;
  row_version?: number | null;
  claim_lost?: boolean;
  ancillary_badges?: string[];
}

export interface LabVisit {
  id: number;
  pid: number;
  encounter?: number;
  queue_number: string | number;
  state: 'ready_for_lab' | 'in_lab';
  visit_type_label?: string;
  row_version?: number | null;
  service_profile?: string;
  ancillary_badges?: string[];
}

export interface LabDirectIntake {
  enabled: boolean;
  has_referral: boolean;
  referral_required_warning: boolean;
  referral_view_url?: string | null;
  can_create_orders: boolean;
  lab_intake_formdir: string;
  lab_intake_title: string;
  lab_intake_signed: boolean;
  lab_intake_started: boolean;
  documentation_hub_url?: string | null;
  clinical_doc_hub_enabled?: boolean;
  order_count?: number;
}

export interface LabOrderLine {
  id: number;
  title: string;
  code: string;
  status: string;
  fulfillment_label?: string;
  requisition_url?: string | null;
  unreleased_count?: number;
}

/** Response from lab.queue */
export interface LabQueueData {
  visits: LabQueueCard[];
  /** SCALE-1.2 — true when the queue hit its row cap; show QueueTruncationBanner. */
  queue_truncated?: boolean;
  queue_cap?: number;
  /** SCALE-1.8 — delta-poll token; `unchanged` responses carry only these two. */
  revision?: string;
  unchanged?: boolean;
  claim_lost_cards?: LabQueueCard[];
  counts: { waiting: number; in_lab: number; total: number };
  active_work?: LabVisit | null;
  has_active_work: boolean;
  visit_date?: string;
}

/** Response from lab.select / lab.take / lab.complete */
export interface LabSelectData {
  visit: LabVisit;
  preview: PatientPreview;
  lab_orders: LabOrderLine[];
  skipped_triage?: boolean;
  session_bound?: boolean;
  can_skip_to_payment?: boolean;
  critical_unreleased_count?: number;
  critical_unreleased?: boolean;
  lab_direct_intake?: LabDirectIntake;
}

/** Lab island props (passed via data-props JSON from Twig) */
export interface LabDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pollMs?: number;
  visitBoardUrl?: string;
  labOpsUrl?: string | null;
  labOpsEnabled?: boolean;
  canEnterResults?: boolean;
  canReleaseResults?: boolean;
  canSkipToPayment?: boolean;
  sharedDeviceWarning?: boolean;
  canEsignOverride?: boolean;
}
