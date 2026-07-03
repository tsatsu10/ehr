/** Daily Reports (M7) — types mirroring ReportsService payload. */

export interface DailyReportsProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId?: number | string;
  visitBoardUrl: string;
  canCancelVisit: boolean;
  canMarkUnpaid: boolean;
  canRunReconciliation?: boolean;
  scheduledIntegrationEnabled?: boolean;
  ancillaryServicesEnabled?: boolean;
  queueBridgeHubUrl?: string;
  /** When false, do not read or write report date/tab query params (hub embed). */
  syncUrl?: boolean;
  initialVisitDate?: string;
  initialTab?: ReportTabId;
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
  by_category?: CashCategoryRow[];
}

export interface CashCategoryRow {
  category: string;
  label: string;
  amount: number;
}

export interface ReconciliationRunRow {
  id: number;
  run_date: string;
  trigger: string;
  module_total: number;
  core_total: number;
  delta_amount: number;
  status: string;
  completed_at: string;
  actor_user_id: number | null;
}

export interface ReconciliationSummary {
  status: string;
  module_total: number;
  core_total: number;
  delta_amount: number;
  tolerance: number;
  currency_symbol: string;
  latest_run: ReconciliationRunRow | null;
  recent_runs: ReconciliationRunRow[];
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

export interface RegisteringUserQualityRow {
  registrar: string;
  patients_registered: number;
  completion_buckets: CompletionBuckets;
}

export interface DataQualitySummary {
  patients_registered_today: number;
  dup_overrides_today: number;
  billing_threshold: number;
  completion_buckets: CompletionBuckets;
  by_registering_user?: RegisteringUserQualityRow[];
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
  reconciliation: ReconciliationSummary;
  open_visits: OpenVisitRow[];
  eod_open: Record<string, EodStateSummary>;
  unsigned_alerts: UnsignedAlerts;
  unpaid_visits: UnpaidVisitRow[];
  data_quality: DataQualitySummary;
  unsigned_visits: UnsignedVisitRow[];
  queue_bypass: BypassLogRow[];
  last_updated: string;
  currency?: {
    currency_code?: string;
    currency_symbol: string;
    currency_decimals?: number;
    currency_symbol_position?: 'before' | 'after';
  };
}

export interface SchedulingReportData {
  enabled: boolean;
  visit_date: string;
  booked_today?: number;
  booked_week?: number;
  week_range?: { start: string; end: string };
  arrival_funnel?: {
    booked: number;
    arrived: number;
    no_show: number;
  };
  walk_in_vs_scheduled?: {
    scheduled: number;
    walk_in: number;
    scheduled_pct: number;
  };
  recall_funnel?: {
    due: number;
    booked: number;
    completed: number;
    overdue: number;
  };
  orthogonality_note?: string;
  queue_bridge?: {
    enabled: boolean;
    hub_url?: string;
    open_action_count?: number;
    open_info_count?: number;
    open_ex01_count?: number;
    eod_block_enabled?: boolean;
    by_code?: Record<string, number>;
    export_url?: string;
  };
  full_analytics?: SchedulingFullAnalytics;
}

export interface SchedulingCheckInLatency {
  sample_count: number;
  median_minutes: number | null;
  p90_minutes: number | null;
  average_minutes: number | null;
  on_time_count: number;
  on_time_pct: number;
  early_count: number;
  late_count: number;
}

export interface SchedulingProviderUtilizationRow {
  provider_id: number;
  provider_name: string;
  booked: number;
  arrived: number;
  visits_started: number;
  arrival_pct: number;
  visit_start_pct: number;
}

export interface SchedulingFullAnalytics {
  enabled: boolean;
  visit_date?: string;
  on_time_window_minutes?: number;
  check_in_latency?: SchedulingCheckInLatency;
  provider_utilization?: {
    providers: SchedulingProviderUtilizationRow[];
    provider_count: number;
  };
}

export interface AncillaryReportData {
  enabled: boolean;
  start_date: string;
  end_date: string;
  refer_window_hours?: number;
  by_service_profile?: Record<string, number>;
  pharmacy_outcomes?: Record<string, number>;
  lab_direct_without_referral?: number;
  pharmacy_to_opd_chains?: number;
  wrong_visit_type_cancels?: number;
}

export interface DocumentationIntegrityEsignEvent {
  datetime: string;
  signer_name: string | null;
  event_type: 'signature' | 'lock' | 'amendment' | string;
  is_lock: number;
  amendment: string | null;
  table: string;
}

export interface DocumentationIntegrityReopenEvent {
  datetime: string;
  actor_name: string | null;
  from_state: string;
  to_state: string;
  reason: string;
}

export interface DocumentationIntegrityOverrideEvent {
  datetime: string;
  actor_name: string | null;
  reason: string | null;
  encounter_id: number | null;
}

export interface DocumentationIntegrityVisitRow {
  visit_id: number;
  visit_date: string;
  queue_number: number;
  pubpid: string;
  display_name: string;
  encounter_id: number | null;
  encounter_url: string | null;
  esign_events: DocumentationIntegrityEsignEvent[];
  reopened_events: DocumentationIntegrityReopenEvent[];
  esign_override_events: DocumentationIntegrityOverrideEvent[];
}

export interface DocumentationIntegritySummary {
  visits_with_events: number;
  esign_events: number;
  amendment_events: number;
  reopen_events: number;
  override_events: number;
}

export interface DocumentationIntegrityReportData {
  enabled: boolean;
  start_date: string;
  end_date: string;
  summary?: DocumentationIntegritySummary;
  rows?: DocumentationIntegrityVisitRow[];
}

export type ReportTabId =
  | 'visits'
  | 'scheduling'
  | 'ancillary'
  | 'documentation_integrity'
  | 'cash'
  | 'reconciliation'
  | 'open'
  | 'unpaid'
  | 'quality'
  | 'unsigned'
  | 'bypass';

export const REPORT_TABS: { id: ReportTabId; label: string; schedulingOnly?: boolean; ancillaryOnly?: boolean }[] = [
  { id: 'visits', label: 'Visits' },
  { id: 'scheduling', label: 'Scheduling', schedulingOnly: true },
  { id: 'ancillary', label: 'Ancillary', ancillaryOnly: true },
  { id: 'documentation_integrity', label: 'Doc integrity' },
  { id: 'cash', label: 'Cash' },
  { id: 'reconciliation', label: 'Reconciliation' },
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
