/** Daily Reports (M7) — types mirroring ReportsService payload. */

export interface DailyReportsProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId?: number | string;
  visitBoardUrl: string;
  canCancelVisit: boolean;
  canMarkUnpaid: boolean;
}

export interface VisitSummary {
  started: number;
  completed: number;
  still_open: number;
  cancelled: number;
  by_state: Record<string, number>;
}

export interface CashSummary {
  total_collected: number;
  receipt_count: number;
}

export interface OpenVisitRow {
  id: number;
  queue_number: string | number;
  display_name: string;
  pubpid: string;
  state: string;
  wait_minutes: number;
  row_version: number;
}

export interface EodStateSummary {
  count: number;
  oldest_wait_minutes: number;
}

export interface UnsignedAlerts {
  with_doctor: number;
  ready_for_payment: number;
}

export interface UnpaidVisitRow {
  queue_number: string | number;
  display_name: string;
  charges_total: number;
  unpaid_reason: string;
  left_unpaid_at: string;
}

export interface CompletionBuckets {
  under_40: number;
  from_40_to_69: number;
  from_70_to_99: number;
  complete_100: number;
}

export interface StaleIncompleteRow {
  display_name: string;
  pubpid: string;
  completion_score: number;
}

export interface DataQualitySummary {
  patients_registered_today: number;
  dup_overrides_today: number;
  billing_threshold: number;
  completion_buckets: CompletionBuckets;
  stale_incomplete: StaleIncompleteRow[];
}

export interface UnsignedVisitRow {
  queue_number: string | number;
  display_name: string;
  state: string;
  provider_name: string;
  hours_unsigned: number;
  service_profile: string;
  encounter_url: string;
}

export interface BypassLogRow {
  queue_number: string | number;
  display_name: string;
  bypass_type: string;
  from_state: string;
  reason: string;
  actor_name: string;
}

export interface DailyReportData {
  visit_date: string;
  facility_id: number;
  visits: VisitSummary;
  cash: CashSummary;
  open_visits: OpenVisitRow[];
  eod_open: Record<string, EodStateSummary>;
  unsigned_alerts: UnsignedAlerts;
  unpaid_visits: UnpaidVisitRow[];
  data_quality: DataQualitySummary;
  unsigned_visits: UnsignedVisitRow[];
  queue_bypass: BypassLogRow[];
  last_updated: string;
}

export type ReportTabId =
  | 'visits'
  | 'cash'
  | 'open'
  | 'unpaid'
  | 'quality'
  | 'unsigned'
  | 'bypass';

export const REPORT_TABS: { id: ReportTabId; label: string }[] = [
  { id: 'visits', label: 'Visits' },
  { id: 'cash', label: 'Cash' },
  { id: 'open', label: 'EOD open' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'quality', label: 'Data quality' },
  { id: 'unsigned', label: 'Unsigned' },
  { id: 'bypass', label: 'Queue bypass' },
];

export interface PendingVisitAction {
  visitId: number;
  rowVersion: number;
  displayName: string;
  pubpid: string;
}
