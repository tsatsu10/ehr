import type { PatientCompletion, PatientIdentity, PatientPreview } from '@core/types';

export type ChartTabId =
  | 'overview'
  | 'profile'
  | 'visits'
  | 'clinical'
  | 'documents'
  | 'messages';

export const CHART_TAB_IDS: ChartTabId[] = [
  'overview',
  'profile',
  'visits',
  'clinical',
  'documents',
  'messages',
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
}

export interface PaymentsStripData {
  hidden?: boolean;
  balance_warning?: boolean;
  payments_strip_label?: string;
  can_view_history?: boolean;
  payment_history_url?: string;
  balance_due_amount?: number | null;
  currency_symbol?: string;
  last_receipt?: string | null;
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
  title?: string;
  detail?: string;
}

export interface ClinicalListSection {
  anchor?: string;
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
}

export interface ClinicalReferralsStrip {
  hidden?: boolean;
  open_referrals_url?: string;
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

export interface ChartMessageRow {
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
    pnotes?: string;
    dated_reminders?: string;
  };
}
