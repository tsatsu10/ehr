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
  canShowAdvanced: boolean;
  reopenOnCorrection: boolean;
  webroot: string;
  initialVisitId?: number;
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
}

export interface PaymentRow {
  id: number;
  receipt_number: string;
  amount_paid: number;
  paid_at: string;
  reversed_at: string | null;
  reversal_reason: string | null;
  visit_id: number;
  queue_number: number;
  patient_name: string;
  pubpid: string;
  cashier: string | null;
  can_reverse: boolean;
}

export interface PaymentsSearchData {
  currency_symbol: string;
  rows: PaymentRow[];
  total: number;
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
  by_cashier: { cashier: string; total: number }[];
  by_visit_type: { visit_type_label: string; total: number }[];
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
}
