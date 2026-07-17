export type BillOpsTab = 'corrections' | 'payments' | 'close' | 'outstanding' | 'insurance';

export interface BillOpsHubProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  cashierUrl: string;
  reportsUrl: string;
  visitBoardUrl: string;
  facilityId: number;
  initialTab: string;
  canCorrect: boolean;
  canPayment: boolean;
  canClose: boolean;
  canOutstanding: boolean;
  canInsurance: boolean;
  canPayerBilling: boolean;
  reopenOnCorrection: boolean;
  webroot: string;
  initialVisitId?: number;
  currencyFormat?: {
    currency_code?: string;
    currency_symbol?: string;
    currency_decimals?: number;
    currency_symbol_position?: 'before' | 'after';
  };
}

export interface PayerScheme {
  id: number;
  name: string;
}

export interface PayerPriceRow {
  id: number;
  insurance_company_id: number;
  item_code: string;
  item_name: string;
  price_amount: number;
  updated_at: string;
}

/** Response from bill_ops.payer_prices */
export interface PayerPricesData {
  enabled: boolean;
  schemes: PayerScheme[];
  insurance_company_id: number;
  rows: PayerPriceRow[];
}

export interface ChargeLine {
  id: number;
  code: string;
  description: string;
  units: number;
  unit_price: number;
  amount: number;
}

export interface FeeScheduleItem {
  id: number;
  code: string;
  name: string;
  price_amount: number;
}

export interface VisitChargesData {
  visit: {
    id: number;
    queue_number: number;
    state: string;
    patient_name?: string;
    pubpid?: string;
  };
  currency_symbol: string;
  charges: ChargeLine[];
  charges_total: number;
  paid_total: number;
  balance_due: number;
  fee_schedule: FeeScheduleItem[];
  can_apply_discount: boolean;
  reopen_on_underpaid?: boolean;
}

export interface PaymentRow {
  id: number;
  receipt_number: string;
  amount_paid: number;
  change_due?: number;
  paid_at: string;
  reversed_at: string | null;
  reversal_reason: string | null;
  visit_id: number;
  /** CP-2 — receipt without a visit (deposit/prepayment). */
  is_deposit?: boolean;
  queue_number: number;
  pid: number;
  posted_payment_id?: number;
  patient_name: string;
  pubpid: string;
  cashier: string | null;
  can_reverse: boolean;
  can_reprint?: boolean;
}

export interface PaymentsSearchData {
  currency_symbol: string;
  rows: PaymentRow[];
  total: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
}

export interface DaysheetData {
  currency_symbol: string;
  date: string;
  receipt_count: number;
  void_count: number;
  no_charge_closes: number;
  cash_collected: number;
  reconciliation: {
    status: string;
    delta_amount: number;
    latest_run: { status: string; completed_at: string } | null;
  };
  momo_tally: MomoTally;
  by_cashier: { cashier: string; total: number }[];
  by_visit_type: { visit_type_label: string; total: number }[];
}

export interface MomoTally {
  amount: number;
  note: string;
  /** True once the day has been reconciled — the tally can no longer be edited. */
  locked: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface OutstandingRow {
  visit_id: number;
  pid: number;
  queue_number: number;
  patient_name: string;
  pubpid: string;
  phone: string | null;
  owed: number;
  age_days: number;
  visit_date: string;
}

export interface OutstandingData {
  currency_symbol: string;
  total_owed: number;
  rows: OutstandingRow[];
  total: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
}
