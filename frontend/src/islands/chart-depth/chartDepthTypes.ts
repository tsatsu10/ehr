import type { ChartPreview } from '@islands/patient-chart/patientChartTypes';

export type ChartDepthMode = 'payments' | 'referrals' | 'export';

export interface ChartDepthProps {
  mode: ChartDepthMode;
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  visitId?: number;
  encounterId?: number;
  preset?: string;
  /** GAP-A A4 — Letters tab on the referrals hub (enable_letters_labels). */
  enableReferrals?: boolean;
  enableLetters?: boolean;
  initialView?: 'referrals' | 'letters';
  letterPrintUrl?: string;
  chartUrl: string;
  visitBoardUrl: string;
  currencyFormat?: {
    currency_symbol?: string;
    currency_decimals?: number;
    currency_symbol_position?: 'before' | 'after';
  };
}

export interface PaymentHistoryRow {
  type?: 'charge' | 'payment' | 'adjustment';
  occurred_at?: string;
  occurred_at_label?: string;
  label?: string;
  amount?: number;
  receipt_id?: number | null;
  receipt_number?: string | null;
  visit_id?: number | null;
  encounter_id?: number | null;
  queue_number?: string | number | null;
  visit_date?: string | null;
  cashier?: string | null;
  can_reprint?: boolean;
  /** @deprecated legacy receipt table */
  amount_paid?: number;
  /** @deprecated legacy receipt table */
  paid_at_label?: string;
  payment_method?: string | null;
  is_adjustment?: boolean;
}

export interface PaymentHistorySummary {
  charges_amount?: number;
  paid_amount?: number;
  balance_amount?: number;
  last_receipt?: {
    id?: number;
    receipt_number?: string;
    at?: string;
    at_label?: string;
    cashier?: string | null;
  } | null;
}

export type PaymentHistoryFilter = 'this_visit' | 'all_visits' | 'date_range';

export interface PaymentsListData {
  rows?: PaymentHistoryRow[];
  has_more?: boolean;
  offset?: number;
  next_offset?: number;
  currency_symbol?: string;
  filter?: PaymentHistoryFilter;
  date_from?: string | null;
  date_to?: string | null;
  summary?: PaymentHistorySummary | null;
  patient?: { display_name?: string; pubpid?: string };
  can_reprint?: boolean;
  add_correction_visible?: boolean;
  add_correction_url?: string | null;
  add_correction_label?: string | null;
}

export interface ReceiptReprintPayload {
  receipt?: {
    receipt_number?: string;
    queue_number?: number;
    /** print_queue_number_on_receipt admin setting; undefined (older payloads) means show */
    show_queue_number?: boolean;
    amount_paid?: number;
    change_due?: number;
    paid_at_label?: string;
  };
  patient?: { display_name?: string; pubpid?: string };
}

export interface LetterTemplateOption {
  name: string;
}

export interface LetterContactOption {
  id: number;
  label: string;
}

export interface LettersTemplatesData {
  templates?: LetterTemplateOption[];
  contacts?: LetterContactOption[];
}

export interface LetterRenderResult {
  body?: string;
  template?: string;
}

export interface ReferralRow {
  transaction_id?: number;
  label?: string;
  author?: string;
  status?: string;
  /** M11-F03 meta status key: draft | printed | given | result_received */
  status_key?: string | null;
  result_document_id?: number | null;
  occurred_at?: string;
  print_url?: string;
  edit_url?: string;
  /** CP-1 — flag ON: edit opens the native drawer instead of the stock form. */
  can_native_edit?: boolean;
}

/** CP-1 — native referral editor payload (chart_depth.referral_editor_get). */
export interface ReferralEditorData {
  transaction_id: number;
  pid: number;
  fields: Record<string, string>;
  /** Optimistic-concurrency token — echoed back as expected_fingerprint on save. */
  fingerprint?: string;
  has_meta: boolean;
  status: string | null;
  risk_levels: { value: string; label: string }[];
}

export interface ReferralSaveResult {
  transaction_id: number;
  status: string;
  print_url?: string;
}

export interface ReferralsListData {
  items?: ReferralRow[];
  has_more?: boolean;
  offset?: number;
  can_create_referral?: boolean;
  create_referral_url?: string;
  /** D-REF-8 — "Name · MRN" identity line for the print confirm. */
  patient_label?: string;
}

export interface ExportIncludeOption {
  key: string;
  label: string;
  checked?: boolean;
  hidden?: boolean;
}

export interface ExportPreset {
  key: string;
  label: string;
}

export interface ExportEncounter {
  encounter_id: number;
  label: string;
}

export interface ExportBuilderData {
  patient?: { name?: string; pubpid?: string };
  presets?: ExportPreset[];
  encounters?: ExportEncounter[];
  selected_preset?: string;
  selected_encounter_id?: number | string;
  requires_encounter?: boolean;
  include_options?: ExportIncludeOption[];
  confirm_label?: string;
  can_generate?: boolean;
  has_pat_rep_acl?: boolean;
  stock_report_url?: string;
  employer_letter_url?: string;
}

export interface ExportGenerateResult {
  post_url: string;
  fields?: Record<string, string>;
}

export type { ChartPreview };
