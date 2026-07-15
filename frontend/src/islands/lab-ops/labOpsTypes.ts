export type LabOpsTab = 'pending' | 'in_progress' | 'send_out';
export type FulfillmentFilter = 'all' | 'in_house' | 'send_out';
export type SetupModel = 'in_house' | 'hybrid' | 'send_out_only';

export interface LabOpsHubProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId?: number | string;
  initialTab: LabOpsTab;
  canEnter: boolean;
  canRelease: boolean;
  canManageCatalog: boolean;
}

export interface WorklistCounts {
  pending?: number;
  in_progress?: number;
  send_out?: number;
}

export interface WorklistRow {
  procedure_order_id: number;
  queue_number?: number | string;
  patient_name: string;
  pubpid?: string;
  test_names: string;
  fulfillment: string;
  fulfillment_label: string;
  status_label: string;
  ordered_display?: string;
  is_urgent?: boolean;
  collected?: boolean;
  review_status?: string;
  /** D-LAB-REJECT — specimen was rejected and must be re-collected. */
  rejected?: boolean;
  rejection_reason?: string;
  /** D-LAB-TAT — turnaround-time label (e.g. "TAT 2h 15m", "In lab 30m", "Waiting 3h"). */
  tat_label?: string;
  can_open_lab_desk?: boolean;
  lab_desk_url?: string;
  requisition_url?: string;
}

export interface RejectionReasonOption {
  id: string;
  label: string;
}

/** D-LAB-QC — one tunable test in the admin reference-range editor. */
export interface QcRangeValues {
  warn_min?: number | null;
  warn_max?: number | null;
  crit_min?: number | null;
  crit_max?: number | null;
  reference_range?: string;
}

export interface QcRuleEditorRow {
  procedure_code: string;
  label: string;
  units: string;
  default: QcRangeValues;
  override: QcRangeValues | null;
  has_override: boolean;
}

/** D-LAB-TAT — day-level SLIPTA indicators shown on the worklist header. */
export interface WorklistSummary {
  total_orders: number;
  released: number;
  rejections: number;
  rejection_rate_pct: number;
  median_tat_minutes?: number | null;
  median_tat_label?: string | null;
}

export interface WorklistData {
  rows: WorklistRow[];
  counts: WorklistCounts;
  summary?: WorklistSummary;
  rejection_reasons?: RejectionReasonOption[];
  can_enter?: boolean;
  last_updated?: string;
}

export interface SetupStatus {
  setup_model?: SetupModel;
  needs_inhouse_provider?: boolean;
  needs_sendout_provider?: boolean;
  provider_id?: number;
  provider_name?: string;
  test_count?: number;
  sendout_provider_id?: number;
  sendout_provider_name?: string;
  has_starter_panel?: boolean;
  starter_csv_available?: boolean;
  fees_mapped?: boolean;
  unmapped_fee_count?: number;
  can_manage_catalog?: boolean;
}

export interface ResultLineQc {
  units?: string;
  reference_range?: string;
  hint?: string;
  allowed?: string[];
}

export interface ResultLineValue {
  procedure_result_id?: number | null;
  result?: string;
  units?: string;
  range?: string;
  abnormal?: string;
  comments?: string;
}

export interface ResultLine {
  procedure_order_seq: number;
  procedure_report_id?: number | null;
  procedure_name?: string;
  procedure_code?: string;
  qc?: ResultLineQc;
  results?: ResultLineValue[];
}

export interface ResultOrder {
  patient_name?: string;
  pubpid?: string;
  queue_number?: number | string;
}

export interface ValidationRules {
  rules_by_seq?: Record<string, {
    type?: string;
    label?: string;
    procedure_name?: string;
    min?: number;
    max?: number;
    warn_min?: number;
    warn_max?: number;
    // Critical / panic thresholds (SLIPTA critical-value indicator).
    crit_min?: number;
    crit_max?: number;
    critical_values?: string[];
    min_length?: number;
    allowed?: string[];
    abnormal_values?: string[];
    abnormal_flag?: string;
    units?: string;
    reference_range?: string;
    warn_substrings?: string[];
    warn_message?: string;
  }>;
}

export interface ResultEntryForm {
  order?: ResultOrder;
  lines?: ResultLine[];
  validation?: ValidationRules;
  has_saved_results?: boolean;
  /** D-LAB-AMEND — reports already released; re-editing is a reason-gated correction. */
  already_released?: boolean;
  edit_order_url?: string;
}

export const LAB_OPS_POLL_MS = 45_000;
