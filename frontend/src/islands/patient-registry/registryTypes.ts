/** Patient Registry (M10) — cohort search types. */

export interface PatientRegistryProps {
  ajaxUrl: string;
  csrfToken: string;
  chartUrlBase: string;
  billingThreshold?: number;
}

/** Form state — all fields are strings (or string[]) for controlled inputs. */
export interface RegistryFilters {
  record_status: string;
  sex: string;
  age_today_min: string;
  age_today_max: string;
  name_contains: string;
  mrn: string;
  national_id: string;
  nhis_number: string;
  phone: string;
  completion_min: string;
  completion_max: string;
  active_visit_today: string;
  visit_states: string[];
  visit_type_id: string;
  visit_date_from: string;
  visit_date_to: string;
  payment_status: string;
  last_visit_from: string;
  last_visit_to: string;
  condition_key: string;
  problem_title_contains: string;
  icd_prefix: string;
  lab_test_contains: string;
  confirmation_source: string;
  age_at_diagnosis_min: string;
  age_at_diagnosis_max: string;
  diagnosis_date_from: string;
  diagnosis_date_to: string;
  appointment_today: string;
  appointment_date_from: string;
  appointment_date_to: string;
  recall_due: string;
  recall_date_from: string;
  recall_date_to: string;
  my_provider_today: boolean;
  allergy_substance_contains: string;
  medication_contains: string;
  unread_staff_message: string;
  open_dated_reminder: string;
}

/** API payload shape sent to cohort.search / cohort.export. */
export interface ApiRegistryFilters {
  record_status: string;
  sex: string;
  age_today_min: number | null;
  age_today_max: number | null;
  name_contains: string | null;
  mrn: string | null;
  national_id: string | null;
  nhis_number: string | null;
  phone: string | null;
  completion_min: number | null;
  completion_max: number | null;
  active_visit_today: string | null;
  visit_states: string[] | null;
  visit_type_id: number | null;
  visit_date_from: string | null;
  visit_date_to: string | null;
  payment_status: string;
  last_visit_from: string | null;
  last_visit_to: string | null;
  condition_key: string | null;
  problem_title_contains: string | null;
  icd_prefix: string | null;
  lab_test_contains: string | null;
  confirmation_source: string | null;
  age_at_diagnosis_min: number | null;
  age_at_diagnosis_max: number | null;
  diagnosis_date_from: string | null;
  diagnosis_date_to: string | null;
  appointment_today: string | null;
  appointment_date_from: string | null;
  appointment_date_to: string | null;
  recall_due: string;
  recall_date_from: string | null;
  recall_date_to: string | null;
  my_provider_today?: boolean;
  allergy_substance_contains: string | null;
  medication_contains: string | null;
  unread_staff_message: string | null;
  open_dated_reminder: string | null;
}

export interface RegistryPreset {
  id: string;
  label: string;
  filters: Partial<ApiRegistryFilters>;
  saved_id?: number;
  can_delete?: boolean;
  owned_by_user?: boolean;
  is_shared?: boolean;
}

export interface RegistryPresetsData {
  builtins: RegistryPreset[];
  saved: RegistryPreset[];
  can_share_filter: boolean;
  visit_states: string[];
  visit_types: { id: number; label: string }[];
  confirmation_sources: { value: string; label: string }[];
  condition_map: { key: string; label: string }[];
}

export interface RegistryRow {
  pid: number;
  name: string;
  age_today: number | null;
  sex: string;
  mrn: string;
  completion_pct: number;
  condition_summary?: string;
  age_at_diagnosis?: number | null;
  index_diagnosis_date?: string;
  chart_url?: string;
}

export interface RegistrySearchMeta {
  filter_summary?: string;
  excluded_missing_dob?: number;
  query_ms?: number;
}

export interface RegistrySearchResult {
  rows: RegistryRow[];
  total: number;
  page: number;
  page_size: number;
  meta: RegistrySearchMeta;
}

export type RegistrySearchStatus = 'idle' | 'loading' | 'success' | 'error';
