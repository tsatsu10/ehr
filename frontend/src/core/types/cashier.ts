/**
 * Cashier desk domain types.
 */

import type { AppointmentTodayChip, RecallDueChip } from './chips';
import type { VisitState } from './common';
import type { PatientPreview } from './patient';

/** One patient in the payment queue */
export interface CashierQueueCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: 'ready_for_payment';
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  is_urgent: 0 | 1;
  charges_total: number;
  row_version?: number | null;
  ancillary_badges?: string[];
}

export interface CashierPaidTodayRow {
  id: number;
  queue_number: string;
  display_name: string;
  charge_correction_url?: string;
  charge_correction_label?: string;
  /** M11-F12 — chart-depth payment history for this visit */
  payment_history_url?: string;
}

/** Response from ?action=cashier.queue */
export interface CashierQueueData {
  visits: CashierQueueCard[];
  /** SCALE-1.2 — true when the queue hit its row cap; show QueueTruncationBanner. */
  queue_truncated?: boolean;
  queue_cap?: number;
  /** SCALE-1.8 — delta-poll token; `unchanged` responses carry only these two. */
  revision?: string;
  unchanged?: boolean;
  counts: { waiting: number; paid_today: number; closed_unpaid: number };
  visit_date?: string;
  paid_today?: CashierPaidTodayRow[];
  closed_unpaid?: CashierPaidTodayRow[];
}

export interface CashierVisit {
  id: number;
  pid: number;
  encounter: number;
  queue_number: string;
  state: 'ready_for_payment';
  visit_type_label?: string;
  row_version?: number | null;
}

export interface CashierChargeLine {
  id: number;
  code: string;
  description: string;
  units: number;
  unit_price: number;
  amount: number;
}

export interface CashierFeeScheduleItem {
  id: number;
  code: string;
  name: string;
  price_amount: number;
  billing_code?: string;
}

export interface CashierStagedLine {
  fee_schedule_id: number;
  code: string;
  name: string;
  units: number;
  unit_price: number;
  suggested?: boolean;
}

export interface CashierSignMeta {
  encounter_signed: boolean;
  unsigned_message?: string;
  encounter_url?: string;
  can_esign_override?: boolean;
}

/** Response from cashier.select / cashier.charges.post */
export interface CashierSelectData {
  visit: CashierVisit;
  preview: PatientPreview;
  charges: CashierChargeLine[];
  charges_total: number;
  fee_schedule: CashierFeeScheduleItem[];
  suggested_fees: CashierFeeScheduleItem[];
  completion_blocked: boolean;
  can_skip_completion: boolean;
  can_close_without_charge: boolean;
  fee_sheet_url?: string;
  advanced_billing_url?: string;
  advanced_billing_label?: string;
  advanced_billing_external?: boolean;
  front_payment_url?: string;
  encounter_signed: boolean;
  unsigned_message?: string;
  encounter_url?: string;
  can_apply_discount?: boolean;
  can_esign_override?: boolean;
  enable_momo_payment?: boolean;
}

export type CashierPaymentMethod = 'cash' | 'momo';

export interface CashierReceipt {
  queue_number: number | string;
  /** print_queue_number_on_receipt admin setting; undefined (older payloads) means show */
  show_queue_number?: boolean;
  amount_paid: number;
  change_due: number;
  paid_at?: string;
  receipt_number?: string;
  payment_method?: CashierPaymentMethod;
  payment_method_label?: string;
  momo_reference?: string;
}

/** Response from cashier.pay */
export interface CashierPayResult {
  visit: CashierVisit;
  amount_paid: number;
  change_due: number;
  receipt: CashierReceipt;
  /** M11-F12 — chart-depth payment history for the paid visit */
  payment_history_url?: string | null;
}

/** Patient row from patients.search */
export interface PatientSearchRow {
  pid: number;
  display_name: string;
  pubpid: string;
  sex?: string;
  age_years?: string | number;
  dob_estimated?: boolean;
  phone_masked?: string;
  completion_score?: number;
  last_visit_label?: string | null;
  active_visit?: {
    state: VisitState;
    queue_number: number | string;
    chief_complaint?: string | null;
  };
  chips?: {
    appointment_today?: AppointmentTodayChip | null;
    recall_due?: RecallDueChip | null;
  };
}

/** Visit row from cashier.resolve_patient ready_for_payment */
export interface CashierResolveVisit {
  id: number;
  queue_number: string | number;
  display_name: string;
  visit_type_label?: string;
  charges_total?: number;
}

/** Response from cashier.resolve_patient */
export interface CashierResolveData {
  preview: PatientPreview;
  ready_for_payment: CashierResolveVisit[];
  active_visits?: CashierResolveVisit[];
  resolution: 'single' | 'pick_visit' | 'preview_only' | 'not_ready';
  message?: string;
}

/** Discount line summary for confirm modal */
export interface CashierDiscountLine {
  name: string;
  standard: number;
  posted: number;
  discount: number;
}

/** Cashier island props (passed via data-props JSON from Twig) */
export interface CashierDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pollMs?: number;
  visitBoardUrl?: string;
  canMarkUnpaid?: boolean;
  canSkipCompletion?: boolean;
  canApplyDiscount?: boolean;
  canEsignOverride?: boolean;
  sharedDeviceWarning?: boolean;
  currencyFormat?: {
    currency_code?: string;
    currency_symbol?: string;
    currency_decimals?: number;
    currency_symbol_position?: 'before' | 'after';
  };
}
