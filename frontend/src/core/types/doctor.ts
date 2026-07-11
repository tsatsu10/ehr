/**
 * Doctor desk domain types.
 */

import type { PatientPreview } from './patient';
import type { PharmacyPrescriptionLine } from './pharmacy';

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
  assigned_provider_id?: number | null;
  /** Neutral "a lab result is ready to look at" signal — no severity/abnormal judgment. */
  lab_results_ready?: boolean;
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
