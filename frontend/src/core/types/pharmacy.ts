/**
 * Pharmacy desk domain types.
 */

import type { PatientPreview } from './patient';

export interface PharmacyQueueCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: 'ready_for_pharmacy' | 'in_pharmacy';
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  is_urgent: 0 | 1;
  pharmacy_mine?: boolean;
  pharmacy_actor_name?: string | null;
  rx_count?: number;
  undispensed_rx_count?: number;
  row_version?: number | null;
  claim_lost?: boolean;
  ancillary_badges?: string[];
}

export interface PharmacyVisit {
  id: number;
  pid: number;
  encounter?: number;
  queue_number: string | number;
  state: 'ready_for_pharmacy' | 'in_pharmacy';
  visit_type_label?: string;
  row_version?: number | null;
  service_profile?: string;
}

export interface PharmacyExternalRxStatus {
  fields: {
    prescriber_name: string;
    prescriber_reg_id: string;
    rx_date: string;
  };
  valid: boolean;
  missing: string[];
  field_errors: Record<string, string>;
  max_age_days: number;
  can_override?: boolean;
  pharmacy_service_formdir: string;
  pharmacy_service_title: string;
  pharmacy_service_started: boolean;
  documentation_hub_url?: string | null;
  clinical_doc_hub_enabled?: boolean;
}

export interface PharmacyWalkinTriage {
  enabled: boolean;
  doctor_available: boolean;
  roster_enabled: boolean;
  allergies_undocumented?: boolean;
  dispense_outcomes: string[];
  non_dispense_outcomes: string[];
  can_refer_to_opd?: boolean;
  can_close_without_dispense?: boolean;
  can_dispense?: boolean;
  can_record_no_doctor?: boolean;
  external_rx?: PharmacyExternalRxStatus | null;
}

export interface PharmacyPrescriptionLine {
  id: number;
  drug: string;
  sig: string;
  quantity: string;
  refills?: number;
  status: 'dispensed' | 'to_dispense';
  start_date?: string | null;
  end_date?: string | null;
  stock_status?: 'in_stock' | 'low' | 'out_of_stock' | 'unknown' | string;
  qoh_display?: string;
}

/** Response from pharmacy.queue */
export interface PharmacyQueueData {
  visits: PharmacyQueueCard[];
  /** SCALE-1.2 — true when the queue hit its row cap; show QueueTruncationBanner. */
  queue_truncated?: boolean;
  queue_cap?: number;
  /** SCALE-1.8 — delta-poll token; `unchanged` responses carry only these two. */
  revision?: string;
  unchanged?: boolean;
  claim_lost_cards?: PharmacyQueueCard[];
  counts: { waiting: number; in_pharmacy: number; total: number };
  active_work?: PharmacyVisit | null;
  has_active_work: boolean;
  visit_date?: string;
  pharm_ops_enabled?: boolean;
}

/** Response from pharmacy.select / pharmacy.take / pharmacy.complete */
export interface PharmacySelectData {
  visit: PharmacyVisit;
  preview: PatientPreview;
  prescriptions: PharmacyPrescriptionLine[];
  rx_list_url?: string;
  skipped_triage?: boolean;
  session_bound?: boolean;
  can_skip_to_payment?: boolean;
  pharm_ops_enabled?: boolean;
  can_dispense?: boolean;
  rx_print_enabled?: boolean;
  can_print_rx?: boolean;
  undispensed_rx_count?: number;
  can_undispensed_override?: boolean;
  can_external_rx_override?: boolean;
  walkin_triage?: PharmacyWalkinTriage;
}

/** Pharmacy island props (passed via data-props JSON from Twig) */
export interface PharmacyDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pollMs?: number;
  visitBoardUrl?: string;
  canSkipToPayment?: boolean;
  sharedDeviceWarning?: boolean;
  canEsignOverride?: boolean;
  canSellOtc?: boolean;
  pharmOpsEnabled?: boolean;
  canDispense?: boolean;
  canUndispensedOverride?: boolean;
  canExternalRxOverride?: boolean;
}
