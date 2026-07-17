import type { PatientCompletion, PatientIdentity, PatientPreview } from '@core/types';

export type ChartTabId =
  | 'overview'
  | 'profile'
  | 'visits'
  | 'clinical'
  | 'documents'
  | 'messages'
  | 'chat';

export const CHART_TAB_IDS: ChartTabId[] = [
  'overview',
  'profile',
  'visits',
  'clinical',
  'documents',
  'messages',
  'chat',
];

export interface PatientChartProps {
  ajaxUrl: string;
  csrfToken: string;
  pid: number;
  activeTab: ChartTabId;
  clinicalAnchor?: string;
  visitIdFilter?: number;
  visitBoardUrl: string;
  frontDeskUrl: string;
  exportChartUrl?: string;
  registrationMode: string;
  enableInChartPatientSearch?: boolean;
  enableDocuments?: boolean;
  /** Patient chart Chat tab (enable_patient_chat) — staff-facing thread, no delivery provider yet. */
  enablePatientChat?: boolean;
  /** GAP-A A4 — chart/address/barcode label prints (enable_letters_labels). */
  enableLabels?: boolean;
  labelPrintUrl?: string;
  /** GAP-A A4 — deep link to the referral-letter composer (Letters hub view). */
  lettersHubUrl?: string;
  /**
   * G5 — show the "Flag for follow-up" action (creates a recall in the S1 Recalls
   * worklist). True only when scheduling is enabled and the user has recall-write
   * access, matching SchedulingRecallsService::flagFollowUp()'s server-side gates.
   */
  canFlagFollowUp?: boolean;
  /** B2 (G9) — enable the Clinical-tab Vitals Trends panel (enable_vitals_trends). */
  enableVitalsTrends?: boolean;
  /**
   * Whether the current user may edit the profile (front desk, nurse, admin).
   * Everyone else sees a read-only Profile tab with no Edit button. Server-side,
   * patients.update enforces the same set (AjaxActionPolicy::PROFILE_EDIT_ACL_ANY).
   */
  canEditProfile?: boolean;
}

export interface PatientDocument {
  id: number;
  name: string;
  mimetype: string;
  size: number;
  date: string;
  category_id: number;
  category_name: string;
  uploader: string;
  view_url: string;
}

export interface DocumentsListResponse {
  documents: PatientDocument[];
  total: number;
  offset: number;
  page_size: number;
}

export interface DocumentCategory {
  id: number;
  name: string;
}

export interface ChartSearchResultItem {
  id?: number | null;
  category: string;
  title: string;
  detail?: string | null;
  tab: ChartTabId;
  anchor?: string;
}

export interface ChartSearchResponse {
  query: string;
  items: ChartSearchResultItem[];
  truncated?: boolean;
  min_query_length?: number;
}

export interface ChartActiveVisit {
  visit_id?: number;
  queue_number?: string;
  state?: string;
  chief_complaint?: string;
  encounter_signed?: boolean;
  require_esign_before_complete_consult?: boolean;
  /** D-FIN-8 — read-only charge total chip for finance-summary ACL */
  visit_charges_label?: string;
  /** REF-4/D34 — active encounter has an outbound referral (≠ inbound "Referral on file"). */
  referral_issued?: boolean;
}

export interface ChartSafety {
  allergies_undocumented?: boolean;
  allergies_severe?: string[];
  problem_count?: number;
}

export interface ChartVitalsToday {
  summary?: string;
  pain_score?: number | string | null;
  vitals_abnormal_today?: boolean;
  vitals_breach_list?: string[];
}

export interface ChartActionRequired {
  title?: string;
  message?: string;
  badge?: string;
  action_url?: string;
}

export interface ActivityFeedAction {
  label?: string;
  kind?: 'expand' | 'tab' | 'core' | 'board' | 'ledger';
  target?: string;
}

export interface ActivityFeedItem {
  event_type?: string;
  event_id?: string;
  title?: string;
  subtitle?: string;
  queue_number?: number | string;
  visit_id?: number;
  encounter_id?: number;
  expand?: {
    procedure_name?: string;
    drug_name?: string;
    summary?: string;
    from_state?: string;
    to_state?: string;
    reason?: string;
    form_title?: string;
    formdir?: string;
    author?: string;
    saved_at?: string;
    chokepoint?: string;
    score?: number;
    actor?: string;
    encounter_id?: number;
    problem_count?: number;
    variant?: string | null;
    receipt_number?: string;
    amount_paid?: string;
    cashier?: string | null;
  };
  primary_action?: ActivityFeedAction;
  secondary_action?: ActivityFeedAction;
}

export interface ActivityFeed {
  items?: ActivityFeedItem[];
  has_more?: boolean;
  lookback_days?: number;
  max_lookback_days?: number;
  can_extend_lookback?: boolean;
  older_history_message?: string | null;
}

export type ActivityFeedResponse = ActivityFeed;

export interface ChartIdentity extends PatientIdentity {
  phone_masked?: string;
}

export interface ChartPreview extends Omit<PatientPreview, 'identity'> {
  identity: ChartIdentity;
  completion: PatientCompletion;
  safety?: ChartSafety;
  vitals_today?: ChartVitalsToday;
  active_visit?: ChartActiveVisit | null;
  last_visit?: { label?: string };
  action_required?: ChartActionRequired[];
  activity_feed?: ActivityFeed;
  pediatric_dob_block?: boolean;
}

export interface ChecklistField {
  label: string;
  complete: boolean;
}

export interface ChecklistLevel {
  label: string;
  complete: boolean;
  fields?: ChecklistField[];
}

export interface RegistrationGetData {
  completion_by_level?: ChecklistLevel[];
  completion?: PatientCompletion;
  // The demographic values are already returned by patients.registration.get (getFormData) —
  // the Profile tab reads them for a read-only info panel (D-PROF-1).
  pubpid?: string;
  section_1?: {
    fname?: string;
    lname?: string;
    mname?: string;
    sex?: string;
    phone?: string;
    national_id?: string;
    reach_contact_name?: string;
    reach_contact_phone?: string;
    reach_contact_relationship?: string;
    DOB?: string;
    age_years?: number | string | null;
  };
  section_2?: {
    street?: string;
    landmark?: string;
    nationality?: string;
    place_of_birth?: string;
    phone_home?: string;
    email?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
  };
  section_3?: {
    blood_group?: string;
    religion?: string;
    education_level?: string;
    occupation?: string;
  };
  section_4?: {
    insurance_label?: string;
  };
}

export interface PaymentsStripData {
  hidden?: boolean;
  balance_warning?: boolean;
  payments_strip_label?: string;
  can_view_history?: boolean;
  payment_history_url?: string;
  balance_due_amount?: number | null;
  currency_symbol?: string;
  /**
   * ProfilePaymentsSummaryService returns an object, not a string — the old
   * `string | null` type let PaymentsStrip render it as a React child, which
   * crashed the whole chart island for any patient with a receipt (2026-07-11
   * A4 smoke finding).
   */
  last_receipt?: {
    id?: number;
    receipt_number?: string;
    amount_paid?: number;
    at?: string;
    cashier?: string | null;
    visit_id?: number;
  } | null;
}

export interface ChartVisitRow {
  queue_number?: string;
  visit_date?: string;
  state?: string;
  visit_type_label?: string;
  service_profile?: string;
  chief_complaint?: string;
  is_urgent?: boolean;
  skipped_triage?: boolean;
  ancillary_badges?: string[];
  documentation_url?: string;
  export_visit_summary_url?: string;
  /** §503/REF-4 — hub deep link filtered by this visit's encounter; null when CDb off or no view ACL. */
  referrals_url?: string | null;
}

export interface ChartVisitsData {
  today_visits?: ChartVisitRow[];
  past_visits?: ChartVisitRow[];
  past_has_more?: boolean;
  past_offset?: number;
}

export interface ClinicalListItem {
  id?: number;
  title?: string;
  detail?: string;
}

export interface ClinicalListSection {
  anchor?: string;
  /** Issue type (medical_problem | allergy | medication) — present on natively-editable sections. */
  type?: string;
  editor_url?: string;
  items?: ClinicalListItem[];
  undocumented?: boolean;
  none_known?: boolean;
}

export interface ClinicalBackgroundLine {
  label?: string;
  value?: string;
}

export interface ClinicalBackgroundSection {
  anchor?: string;
  editor_url?: string;
  lines?: ClinicalBackgroundLine[];
  /** T1-F20 — SDOH screening summary chips (max 4) */
  sdoh_chips?: string[];
  sdoh_more?: number;
}

export interface ClinicalVitalsSection {
  anchor?: string;
  summary?: string;
  pain_score?: number | string | null;
  abnormal?: boolean;
  warnings?: string[];
}

export interface ClinicalFormRow {
  title?: string;
  date?: string;
  author?: string;
  signed?: boolean;
  form_url?: string;
}

export interface ClinicalEncounterNotePreview {
  native_enabled?: boolean;
  started?: boolean;
  signed?: boolean;
  variant?: string;
  variant_label?: string;
  cc_preview?: string | null;
  problem_count?: number;
  incomplete_problem_count?: number;
  problem_labels?: string[];
  validate_ready?: boolean;
  updated_at?: string | null;
  open_url?: string | null;
}

export interface ClinicalThisVisitSection {
  anchor?: string;
  hidden?: boolean;
  visit_id?: number | null;
  open_encounter_url?: string;
  encounter_note?: ClinicalEncounterNotePreview | null;
  /** D-FIN-8 — active-visit charge total (label only; no receipt/method) */
  charges_total_label?: string | null;
  forms?: ClinicalFormRow[];
  empty?: boolean;
}

export interface ClinicalData {
  background?: ClinicalBackgroundSection;
  problems?: ClinicalListSection;
  allergies?: ClinicalListSection;
  medications?: ClinicalListSection;
  immunizations?: ClinicalListSection & { hidden?: boolean };
  labs?: ClinicalListSection;
  vitals?: ClinicalVitalsSection;
  this_visit?: ClinicalThisVisitSection;
  active_encounter_id?: number | null;
  /** MRD §17.6 — sections hidden via the legacy hide_dashboard_cards global. */
  hidden_sections?: string[];
  /** D4 — edit problems/allergies/meds in a native drawer instead of the stock popup. */
  native_issue_editor?: boolean;
  /** D-HIST-9 — edit Background in a native drawer instead of stock history_full.php. */
  native_history_editor?: boolean;
  /** D-HIST-10 — open the full native History editor instead of stock history_full.php. */
  native_history_full_form?: boolean;
  /** D-IMM-1 — Add/Edit immunizations in a native drawer instead of stock immunizations.php. */
  native_immunization_editor?: boolean;
}

/** D-IMM-1 — one vaccine option for the immunization drawer dropdown. */
export interface VaccineOption {
  id: string;
  label: string;
}

/** D-IMM-1 — an immunization record's editable fields. */
export interface ImmunizationEditorData {
  id: number;
  vaccine_id: string;
  administered_date: string;
  lot_number: string;
  note: string;
  given_elsewhere: boolean;
}

/** D-HIST-9/10 — background fields for the native history editor drawer. The `sleep`,
 *  `suicide`, `risk_factors` and `risk_other` fields are only shown in the full-form mode. */
export interface HistoryEditorData {
  text: {
    family_mother: string;
    family_father: string;
    family_siblings: string;
    tobacco: string;
    alcohol: string;
    recreational_drugs: string;
    exercise: string;
    herbal_medicine: string;
    occupation: string;
    past_medical_history: string;
    last_hb: string;
    sleep: string;
  };
  family_conditions: {
    sickle_cell: boolean;
    hypertension: boolean;
    diabetes: boolean;
    heart: boolean;
    stroke: boolean;
    tuberculosis: boolean;
    cancer: boolean;
    epilepsy: boolean;
    mental_illness: boolean;
    suicide: boolean;
  };
  dates: {
    last_bp_date: string;
    last_glucose_date: string;
  };
  risk_factors: string[];
  risk_other: string;
  stock_editor_url: string;
}

export interface ClinicalReferralsStrip {
  hidden?: boolean;
  open_referrals_url?: string;
  /** Stock transactions screen — the reachable path to non-referral transaction
   *  types (records requests, legal, billing) when the stock menu item is hidden. */
  stock_transactions_url?: string;
  items?: { label?: string; status?: string; occurred_at?: string }[];
}

export interface ClinicalLabsStrip {
  hidden?: boolean;
  pending_warning?: boolean;
  labs_strip_label?: string;
  lab_ops_url?: string;
  place_order_url?: string;
  pending_orders_url?: string;
  view_trends_anchor?: string;
}

export interface ClinicalMedsStrip {
  hidden?: boolean;
  undispensed_warning?: boolean;
  meds_strip_label?: string;
  pharm_ops_url?: string;
  view_meds_anchor?: string;
}

/** B2 (G9) — longitudinal vitals series for the Clinical "Trends" panel. */
export interface VitalsSeriesPoint {
  iso: string;
  label: string;
  value: number;
  encounter_id?: number;
}

export interface VitalsSeriesLine {
  name: string;
  points: VitalsSeriesPoint[];
}

export interface VitalsSeriesReading {
  iso: string;
  label: string;
  display: string;
  encounter_id?: number;
}

export interface VitalsSeriesMeasure {
  key: string;
  label: string;
  unit: string;
  series: VitalsSeriesLine[];
  readings: VitalsSeriesReading[];
}

export interface VitalsSeriesData {
  enabled: boolean;
  measures: VitalsSeriesMeasure[];
  /** W11 — deep link to the stock CDC/WHO growth chart; set only for pediatric patients. */
  growth_chart_url?: string | null;
}

export interface ChartMessageRow {
  /** pnotes id — present on messages (not rule reminders); drives CP-5 detail. */
  id?: number;
  title?: string;
  preview?: string;
  author?: string;
  date?: string;
  status?: string;
  active?: boolean;
  assigned_to?: string;
  detail_url?: string;
}

export interface ChartMessagesData {
  messages?: ChartMessageRow[];
  reminders?: ChartMessageRow[];
  message_total?: number;
  has_more?: boolean;
  offset?: number;
  editor_urls?: {
    add_message?: string;
    pnotes?: string | null;
    dated_reminders?: string;
  };
  /** CP-5 — flag ON: native detail modal + activity filter. */
  native_notes?: boolean;
  activity?: string;
}

export interface ChartChatMessage {
  id: number;
  /** 'out' = staff-authored (everything today); 'in' reserved for a future delivery provider. */
  direction: 'out' | 'in';
  body: string;
  author?: string;
  created_at: string;
}

export interface ChartChatData {
  messages: ChartChatMessage[];
}
