/**
 * Shared types for the OpenEMR modern frontend.
 */

// ── Mount contract ─────────────────────────────────────────────────────────

export type IslandProps = Record<string, unknown>;

export interface NcPageContext {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: string | null;
  queuePollMs: number;
}

/** @deprecated Use {@link NcPageContext} */
export type OeNcPageContext = NcPageContext;

export function readPageContext(root: HTMLElement = document.body): NcPageContext | null {
  const shell = root.querySelector<HTMLElement>('#nc-t1');
  if (shell === null) return null;
  return {
    ajaxUrl: shell.dataset.ajaxUrl ?? '',
    csrfToken: shell.dataset.csrfToken ?? '',
    facilityId: shell.dataset.facilityId ?? null,
    queuePollMs: Number.parseInt(shell.dataset.queuePollMs ?? '30000', 10),
  };
}

// ── FSM visit states ───────────────────────────────────────────────────────

export type VisitState =
  | 'waiting'
  | 'in_triage'
  | 'ready_for_doctor'
  | 'with_doctor'
  | 'ready_for_lab'
  | 'in_lab'
  | 'lab_complete'
  | 'ready_for_pharmacy'
  | 'in_pharmacy'
  | 'pharmacy_complete'
  | 'ready_for_payment'
  | 'completed'
  | 'closed_unpaid'
  | 'cancelled';

export type PillVariant = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

// ── Queue / Visit Board domain types ─────────────────────────────────────

export interface VisitCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: VisitState;
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  chief_complaint: string;
  is_urgent: 0 | 1;
  skipped_triage: boolean;
  similar_surname_today: boolean;
  claim_lost: boolean;
  claim_lost_by?: { display_name: string; role_label: string };
  photo_url?: string;
  queue_bridge_badge?: {
    code: string;
    label: string;
    hub_url: string;
  };
  /** PRD §6.8.6 — when enable_ancillary_services is on */
  ancillary_badges?: string[];
}

export type ColumnKey =
  | 'waiting'
  | 'triage'
  | 'doctor'
  | 'lab'
  | 'pharmacy'
  | 'payment'
  | 'done';

export interface BoardConfig {
  enable_triage: boolean;
  enable_lab_role: boolean;
  enable_pharmacy_role: boolean;
  enable_queue_bridge?: boolean;
}

export interface BoardData {
  columns: Partial<Record<ColumnKey, VisitCard[]>>;
  config: BoardConfig;
  stale_count: number;
  visit_date?: string;
  cancelled?: BoardTerminalVisit[];
  closed_unpaid?: BoardTerminalVisit[];
  queue_bridge_badges?: Record<string, {
    code: string;
    label: string;
    hub_url: string;
  }>;
}

/** One row in a visit-board terminal collapsible (cancelled / left unpaid). */
export interface BoardTerminalVisit {
  id?: number;
  queue_number: string | number;
  display_name: string;
  cancel_reason?: string | null;
  unpaid_reason?: string | null;
}

/** @deprecated Use BoardTerminalVisit */
export type CancelledVisit = BoardTerminalVisit;

// ── Triage desk domain types ──────────────────────────────────────────────

/** One vitals field rule as returned by VitalsValidationService::getFormRules() */
export interface VitalFieldRule {
  label: string;
  unit?: string;
  required: boolean;
  min: number;
  max: number;
  step?: number;
  warn_min?: number;
  warn_max?: number;
  warn_message?: string;
}

/** Full rules payload — passed via Twig data-props from triage.php */
export interface VitalsRules {
  temperature_unit?: string;
  required?: string[];
  fields: Record<string, VitalFieldRule>;
}

/** One field's validation outcome */
export type FieldValidation =
  | null
  | { level: 'ok' }
  | { level: 'warning'; message: string }
  | { level: 'error'; message: string };

/** Collected vitals from the form */
export type VitalsData = Partial<Record<VitalName, string>>;

export type VitalName =
  | 'bps' | 'bpd' | 'pulse' | 'temperature'
  | 'oxygen_saturation' | 'weight' | 'height' | 'respiration' | 'pain';

export const VITAL_ORDER: VitalName[][] = [
  ['bps', 'bpd', 'pulse', 'temperature'],
  ['oxygen_saturation', 'weight', 'height', 'respiration'],
  ['pain'],
];

/** A single patient in the triage queue */
export interface TriageQueueCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: 'waiting' | 'in_triage';
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  chief_complaint?: string;
  is_urgent: 0 | 1;
  triage_mine?: boolean;
  triage_actor_name?: string;
  claim_lost?: boolean;
  claim_lost_by?: { display_name: string; role_label: string };
  row_version?: number | null;
  ancillary_badges?: string[];
}

/** Response from ?action=triage.queue */
export interface TriageQueueData {
  visits: TriageQueueCard[];
  claim_lost_cards?: TriageQueueCard[];
  counts: { waiting: number; in_triage: number };
  visit_date?: string;
  /** Set when caller passed visit_date; null means all active carry-over visits. */
  queue_date_filter?: string | null;
  vitals_unit_label?: string;
  vitals_form_rules?: VitalsRules;
  hard_provider_assignment_enabled?: boolean;
  can_hard_assign_provider?: boolean;
  assignable_doctors?: Array<{ user_id: number; display_name: string; taking_patients: boolean }>;
}

/** Patient identity/safety/completion context */
export interface PatientIdentity {
  pid: number;
  pubpid: string;
  display_name: string;
  sex: string;
  age_years: string;
}

export interface PatientCompletion {
  score: number;
  billing_threshold: number;
  missing_labels?: string[];
  chart_url?: string;
  chart_open_url?: string;
  demographics_url?: string;
}

export interface PatientVitalsToday {
  summary?: string;
  vitals_missing_today?: boolean;
  vitals_abnormal_today?: boolean;
}

export interface PatientPreview {
  identity: PatientIdentity;
  completion: PatientCompletion;
  safety?: {
    allergies_severe?: string[];
    allergies_undocumented?: boolean;
    pregnant?: boolean;
    problem_count?: number;
    allergy_count?: number;
  };
  vitals_today?: PatientVitalsToday;
  banner_mrd_deep_links?: boolean;
  allergy_count_chip?: boolean;
}

/** Lightweight visit record returned by triage.select / triage.start */
export interface TriageVisit {
  id: number;
  pid: number;
  queue_number: string;
  state: 'waiting' | 'in_triage';
  visit_type_label?: string;
  chief_complaint?: string;
  row_version?: number | null;
}

/** Response from ?action=triage.select */
export interface TriageSelectData {
  visit: TriageVisit;
  preview: PatientPreview;
  form_vitals: VitalsData;
  vitals: unknown[];
  vitals_warnings: string[];
  vitals_unit_label?: string;
  vitals_form_rules?: VitalsRules;
}

/** Visit type used in the auto-start modal */
export interface VisitType {
  id: number;
  label: string;
}

/** Triage island props (passed via data-props JSON from Twig) */
export interface TriageDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pollMs?: number;
  visitBoardUrl?: string;
  vitalsRules?: VitalsRules;
  canCancel?: boolean;
  /** T1-F19 — enable shared-device session mismatch probe + banner */
  sharedDeviceWarning?: boolean;
}

// ── Visit Board island props (passed via data-props JSON from Twig) ───────

export interface VisitBoardProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  /** Milliseconds between auto-polls (default 30 000). */
  pollMs?: number;
  /** 'wall' renders privacy mode + now-serving banner. */
  profile?: 'default' | 'wall';
  privacyMode?: boolean;
  canCancel?: boolean;
  /** Desk-specific navigation URLs keyed by role slug. */
  deskUrls?: Record<string, string>;
  /** V1.1-OPS — fullscreen + wake-lock toolbar on wall profile. */
  kioskChrome?: boolean;
  /** Clinic display name for kiosk toolbar. */
  clinicName?: string;
}

// ── Visit Board detail modal (visit.detail) ───────────────────────────────

export interface VisitDetailSummary {
  state: string;
  state_label: string;
  queue_number: number;
  visit_type_label: string;
  started_at_label?: string | null;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  provider_hint: string;
  chief_complaint?: string | null;
  badges?: string[];
  dob_label?: string | null;
}

export interface VisitDetailAuditItem {
  type: string;
  label: string;
  subtitle?: string | null;
  at: string;
  at_label?: string | null;
}

export interface VisitDetailVisit {
  id: number;
  pid: number;
  queue_number: string | number;
  state: VisitState;
  row_version?: number | null;
  is_urgent?: 0 | 1;
  chief_complaint?: string | null;
  visit_type_label?: string;
}

export interface VisitDetailData {
  visit: VisitDetailVisit;
  preview: PatientPreview;
  visit_summary: VisitDetailSummary;
  skipped_triage?: boolean;
  audit_timeline?: VisitDetailAuditItem[];
  chart_history_url?: string | null;
  queue_bridge_action?: {
    exception_code: string;
    pid: number;
    pc_eid: number;
    visit_id: number;
    appt_date: string;
    label: string;
    summary?: string;
    appt_time_label?: string | null;
    can_resolve: boolean;
    hub_url?: string;
  } | null;
}

// ── Doctor desk domain types ──────────────────────────────────────────────

/** Lab/Rx routing badges on queue cards and patient banner */
export interface RoutingChips {
  results_ready?: boolean;
  lab_order_incomplete?: boolean;
  lab_ordered?: boolean;
  rx_pending?: boolean;
}

/** One patient in the doctor queue (ready_for_doctor) */
export interface DoctorQueueCard {
  id: number;
  queue_number: string;
  display_name: string;
  pid: number;
  pubpid: string;
  state: 'ready_for_doctor';
  sex: string;
  age_years: string;
  wait_minutes: number;
  wait_label: string;
  visit_date: string;
  visit_type_label: string;
  chief_complaint?: string;
  is_urgent: 0 | 1;
  skipped_triage?: boolean;
  assigned_provider_name?: string;
  routing_suggested_provider_id?: number;
  routing_suggested_provider_name?: string;
  hard_assigned_provider_id?: number;
  hard_assigned_provider_name?: string;
  routing_chips?: RoutingChips;
  row_version?: number | null;
  claim_lost?: boolean;
  claim_lost_by?: { display_name: string; role_label: string };
  ancillary_badges?: string[];
}

/** Active consult visit record */
export interface DoctorVisit {
  id: number;
  pid: number;
  encounter: number;
  queue_number: string;
  state: 'with_doctor';
  visit_type_label?: string;
  chief_complaint?: string;
  row_version?: number | null;
}

/** Routing detection shown in the complete-consult modal */
export interface RoutingPreview {
  detected_lab: boolean;
  detected_rx: boolean;
  lab_count: number;
  rx_count: number;
}

/** Unsigned required form from documentation_status (M4-F40) */
export interface DocumentationRequiredForm {
  formdir: string;
  title: string;
  started?: boolean;
}

export interface DocumentationStatus {
  hub_enabled: boolean;
  encounter_signed: boolean;
  unsigned_required: DocumentationRequiredForm[];
  documentation_hub_url?: string | null;
  encounter_note_preview?: {
    cc_preview?: string | null;
    problem_count?: number;
    signed?: boolean;
    validate_ready?: boolean;
    variant_label?: string;
  } | null;
}

/** Response from doctor.take / doctor.active / doctor.reopen */
export interface DoctorConsultPayload {
  visit: DoctorVisit;
  preview: PatientPreview;
  routing_chips?: RoutingChips;
  routing_preview?: RoutingPreview;
  encounter_signed: boolean;
  require_esign_before_complete_consult: boolean;
  encounter_url?: string;
  clinical_doc_hub_enabled?: boolean;
  documentation_status?: DocumentationStatus;
  supervisor_id?: number | null;
  supervisor_display_name?: string | null;
  supervisor_from_profile?: boolean;
  pharm_ops_enabled?: boolean;
  rx_print_enabled?: boolean;
  can_print_rx?: boolean;
  prescriptions?: PharmacyPrescriptionLine[];
  rx_list_url?: string;
}

export interface DoctorDoneTodayRow {
  id: number;
  queue_number: string;
  display_name: string;
}

export interface DoctorReopenableRow {
  id: number;
  queue_number: string;
  display_name: string;
  pubpid: string;
  state: string;
  row_version?: number | null;
}

/** Response from ?action=doctor.queue */
export interface DoctorQueueData {
  visits: DoctorQueueCard[];
  claim_lost_cards?: DoctorQueueCard[];
  counts: { waiting: number; done_today: number; reopenable_today: number };
  active_consult?: DoctorQueueCard | null;
  has_active_consult: boolean;
  visit_date?: string;
  scope?: string;
  done_today?: DoctorDoneTodayRow[];
  reopenable_today?: DoctorReopenableRow[];
  can_reopen_consult?: boolean;
  advisory_routing_enabled?: boolean;
  hard_provider_assignment_enabled?: boolean;
  doctor_ready_notify_enabled?: boolean;
  can_take_assigned_override?: boolean;
  ready_notify_pending?: Array<{ visit_id: number; display_name: string; queue_number: string | number }>;
  require_override_reason?: boolean;
  my_user_id?: number;
}

/** Doctor island props (passed via data-props JSON from Twig) */
export interface DoctorDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  pollMs?: number;
  visitBoardUrl?: string;
  multiDoctorFilters?: boolean;
  doctorRosterEnabled?: boolean;
  advisoryRoutingEnabled?: boolean;
  sharedDeviceWarning?: boolean;
  labPanelOrderEnabled?: boolean;
  formularyRxEnabled?: boolean;
  currencyFormat?: {
    currency_symbol?: string;
    currency_decimals?: number;
    currency_symbol_position?: 'before' | 'after';
  };
  /** V1.1-OPS — one-time success banner when lab results become ready. */
  labResultsToastEnabled?: boolean;
  /** Emergency Rx when allergies undocumented (`new_rx_undocumented_allergy_override`). */
  canRxAllergyOverride?: boolean;
}

/** Provider row from doctor.search_providers */
export interface DoctorProviderSearchResult {
  id: number;
  display_name: string;
  username: string;
}

/** Supervisor metadata on active consult */
export interface DoctorSupervisorMeta {
  supervisor_id?: number | null;
  supervisor_display_name?: string | null;
  supervisor_from_profile?: boolean;
}

/** One test in the doctor quick lab panel catalog */
export interface LabPanelCatalogTest {
  procedure_type_id: number;
  name: string;
  code: string;
  fee_amount: number | null;
  has_fee: boolean;
  is_starter: boolean;
}

/** Response from doctor.lab_panel_catalog */
export interface LabPanelCatalogData {
  enabled: boolean;
  provider_id?: number | null;
  provider_name?: string | null;
  tests: LabPanelCatalogTest[];
  has_catalog: boolean;
  currency_symbol: string;
  auto_bill_on_order: boolean;
}

/** One drug in the doctor quick formulary catalog */
export interface FormularyRxCatalogDrug {
  drug_id: number;
  name: string;
  display_name?: string;
  dosage?: string;
  quantity?: string;
  route?: string;
  period_days?: number;
  fee_amount?: number | null;
  has_fee?: boolean;
  is_starter?: boolean;
  stock_status?: string;
  qoh_display?: string | null;
}

/** Response from doctor.formulary_rx_catalog */
export interface FormularyRxCatalogData {
  enabled: boolean;
  drugs: FormularyRxCatalogDrug[];
  has_catalog: boolean;
  currency_symbol?: string;
  starter_drug_names?: string[];
  drug_count?: number;
}

/** Response from doctor.formulary_rx_place */
export interface FormularyRxPlaceResult {
  visit_id: number;
  prescription_ids: number[];
  prescription_count: number;
  prescriptions?: PharmacyPrescriptionLine[];
}

/** Response from doctor.lab_panel_place */
export interface LabPanelPlaceResult {
  procedure_order_id: number;
  visit_id: number;
  test_count: number;
  routing_chips: RoutingChips;
  billing: {
    posted_count?: number;
    charges_total?: number;
    currency_symbol?: string;
    unmapped_codes?: string[];
  };
}

// ── Cashier desk domain types ─────────────────────────────────────────────

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
}

/** Response from ?action=cashier.queue */
export interface CashierQueueData {
  visits: CashierQueueCard[];
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

// ── Lab desk domain types ─────────────────────────────────────────────────

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

// ── Pharmacy desk domain types ────────────────────────────────────────────

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

// ── Front desk domain types ───────────────────────────────────────────────

export interface AppointmentTodayChip {
  pc_eid?: number;
  appt_date?: string;
  start_time_label?: string;
  provider_name?: string;
  tooltip?: string;
  default_visit_type_id?: number;
}

export interface RecallDueChip {
  recall_id: number;
  due_date: string;
  days_delta: number;
  reason?: string;
  status?: string;
  worklist_url: string;
  label: string;
}

/** V1.2 hard-assign doctor roster row (triage + front desk) */
export interface AssignableDoctor {
  user_id: number;
  display_name: string;
  taking_patients: boolean;
}

/** Response from patients.preview on front desk */
export interface FrontDeskPreviewData {
  identity: PatientIdentity & { phone_masked?: string };
  completion: PatientCompletion & {
    chart_open_url?: string;
    chart_url?: string;
  };
  safety?: {
    allergies_severe?: string[];
    allergies_undocumented?: boolean;
    pregnant?: boolean;
    problem_count?: number;
    allergy_count?: number;
  };
  banner_mrd_deep_links?: boolean;
  allergy_count_chip?: boolean;
  active_visit?: {
    visit_id: number;
    state: VisitState;
    queue_number: number | string;
    row_version?: number;
    chief_complaint?: string | null;
    hard_assigned_provider_id?: number;
    hard_assigned_provider_name?: string;
  } | null;
  hard_provider_assignment_enabled?: boolean;
  can_hard_assign_provider?: boolean;
  assignable_doctors?: AssignableDoctor[];
  appointment_today?: AppointmentTodayChip | null;
  recall_due?: RecallDueChip | null;
  chips?: {
    appointment_today?: AppointmentTodayChip | null;
    recall_due?: RecallDueChip | null;
  };
  visits_today?: TodayVisitRow[];
  revisit_gate?: RevisitGate;
  /** Insurance type that is effective today (expired NHIS → 'cash'). Only present in front-desk context. */
  insurance_effective?: 'cash' | 'nhis' | 'private';
  /** Display label e.g. 'Cash (NHIS expired)'. Only present in front-desk context. */
  insurance_label?: string;
  /** Count of closed_unpaid visits for this patient. Only present in front-desk context. */
  unpaid_visits_count?: number;
  queue_bridge?: {
    enabled?: boolean;
    hub_url?: string;
    ex01_open?: boolean;
    block_plain_start?: boolean;
    show_arrival_advisor?: boolean;
  };
}

export interface TodayVisitRow {
  visit_id: number;
  queue_number: number;
  state: VisitState;
  visit_type_label?: string;
  is_finished: boolean;
}

export interface RevisitGate {
  applies: boolean;
  blocked: boolean;
  score: number;
  threshold: number;
  pediatric_dob_block: boolean;
  missing_labels?: string[];
  can_manager_override: boolean;
}

export interface FrontDeskDeskStats {
  visits_started_today: number;
  waiting_count: number;
  recent_starts: Array<{
    visit_id: number;
    queue_number: number;
    state: VisitState;
    pid: number;
    display_name: string;
    pubpid: string;
  }>;
}

/** Row from front_desk.todays_appointments */
export interface TodaysAppointmentRow {
  pid: number;
  display_name: string;
  pubpid: string;
  pc_eid: number;
  start_time_label?: string | null;
  provider_name?: string | null;
}

export interface DeskVisitType {
  id: number;
  label: string;
  is_default?: boolean;
  service_profile?: string;
  service_profile_hint?: string | null;
  referral_required?: boolean;
  allows_referral_upload?: boolean;
}

/** Priority flags set at registration — drives fast-track sorting */
export type VisitPriorityFlag = 'standard' | 'elderly' | 'pregnant' | 'under_5' | 'urgent';

/** Today's flow chart data for the front desk collapsible strip */
export interface FrontDeskFlowChartsData {
  hourly_visits: { hour: number; count: number }[];
  adherence: { scheduled: number; arrived: number; no_show: number; pending: number };
  wait_avg_today_mins: number;
  wait_avg_yesterday_mins: number;
}

/** Response from visit.start / visit.start_from_appointment */
export interface VisitStartData {
  visit: {
    id: number;
    queue_number: string | number;
    state?: VisitState;
    row_version?: number;
    priority_flag?: VisitPriorityFlag;
  };
  queue_slip_enabled?: boolean;
  queue_slip_url?: string;
  appointment_status_updated?: boolean;
  recurring_guard_fired?: boolean;
}

/** Front desk island props (passed via data-props JSON from Twig) */
export interface FrontDeskProps {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  moduleUrl: string;
  visitBoardUrl?: string;
  registrationMode?: string;
  pinnedPreview?: boolean;
  printQueueSlip?: boolean;
  canSkipTriage?: boolean;
  canCancelVisit?: boolean;
  canRevisitOverride?: boolean;
  enforceCompletionOnRevisit?: boolean;
  scheduledIntegrationEnabled?: boolean;
  appointmentsTodayCount?: number;
  calendarUrl?: string;
  recallsUrl?: string;
}

export interface RegistrationDupCandidate {
  pid: number;
  display_name: string;
  pubpid: string;
  score: number;
  match_reasons?: string[];
}

export interface RegistrationDupResult {
  level: 'none' | 'warn' | 'block';
  candidates?: RegistrationDupCandidate[];
}

export interface RegistrationFormData {
  pid?: number;
  pubpid?: string;
  section_1?: Record<string, unknown>;
  section_2?: Record<string, unknown>;
  section_3?: Record<string, unknown>;
  section_4?: Record<string, unknown>;
  completion?: { score?: number; missing?: string[] };
}

export interface RegistrationSaveResult {
  pid: number;
  completion_score?: number;
  completion_missing?: string[];
}
