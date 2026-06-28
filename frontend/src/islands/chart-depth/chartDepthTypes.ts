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
  chartUrl: string;
  visitBoardUrl: string;
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
    amount_paid?: number;
    change_due?: number;
    paid_at_label?: string;
  };
  patient?: { display_name?: string; pubpid?: string };
}

export interface ReferralRow {
  label?: string;
  author?: string;
  status?: string;
  occurred_at?: string;
  print_url?: string;
  edit_url?: string;
}

export interface ReferralsListData {
  items?: ReferralRow[];
  has_more?: boolean;
  offset?: number;
  can_create_referral?: boolean;
  create_referral_url?: string;
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
