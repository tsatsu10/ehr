import { DEFAULT_REGISTRY_FILTERS } from './registryDefaults';
import type { ApiRegistryFilters, RegistryFilters } from './registryTypes';

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isNaN(n) ? null : n;
}

function parseText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseOptional(value: string): string | null {
  return value === '' ? null : value;
}

/** Convert controlled form state to the API filter payload. */
export function filtersToApiPayload(filters: RegistryFilters): ApiRegistryFilters {
  const payload: ApiRegistryFilters = {
    record_status: filters.record_status,
    sex: filters.sex,
    age_today_min: parseNum(filters.age_today_min),
    age_today_max: parseNum(filters.age_today_max),
    name_contains: parseText(filters.name_contains),
    mrn: parseText(filters.mrn),
    national_id: parseText(filters.national_id),
    nhis_number: parseText(filters.nhis_number),
    phone: parseText(filters.phone),
    completion_min: parseNum(filters.completion_min),
    completion_max: parseNum(filters.completion_max),
    active_visit_today: parseOptional(filters.active_visit_today),
    visit_states: filters.visit_states.length ? filters.visit_states : null,
    visit_type_id: parseNum(filters.visit_type_id),
    visit_date_from: parseText(filters.visit_date_from),
    visit_date_to: parseText(filters.visit_date_to),
    payment_status: filters.payment_status,
    last_visit_from: parseText(filters.last_visit_from),
    last_visit_to: parseText(filters.last_visit_to),
    condition_key: filters.condition_key !== '' ? filters.condition_key : null,
    problem_title_contains: parseText(filters.problem_title_contains),
    icd_prefix: parseText(filters.icd_prefix),
    lab_test_contains: parseText(filters.lab_test_contains),
    confirmation_source: filters.confirmation_source !== '' ? filters.confirmation_source : null,
    age_at_diagnosis_min: parseNum(filters.age_at_diagnosis_min),
    age_at_diagnosis_max: parseNum(filters.age_at_diagnosis_max),
    diagnosis_date_from: parseText(filters.diagnosis_date_from),
    diagnosis_date_to: parseText(filters.diagnosis_date_to),
    appointment_today: parseOptional(filters.appointment_today),
    appointment_date_from: parseText(filters.appointment_date_from),
    appointment_date_to: parseText(filters.appointment_date_to),
    recall_due: filters.recall_due || 'any',
    recall_date_from: parseText(filters.recall_date_from),
    recall_date_to: parseText(filters.recall_date_to),
    allergy_substance_contains: parseText(filters.allergy_substance_contains),
    medication_contains: parseText(filters.medication_contains),
    unread_staff_message: parseOptional(filters.unread_staff_message),
    open_dated_reminder: parseOptional(filters.open_dated_reminder),
  };

  if (filters.my_provider_today) {
    payload.my_provider_today = true;
  }

  return payload;
}

function strFromApi(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Merge a preset/API filter object into form state. */
export function applyPresetToFilters(
  preset: Partial<ApiRegistryFilters>
): RegistryFilters {
  const base = { ...DEFAULT_REGISTRY_FILTERS, visit_states: [] as string[] };

  if (preset.record_status !== undefined) base.record_status = preset.record_status;
  if (preset.sex !== undefined) base.sex = preset.sex;
  if (preset.age_today_min !== undefined) base.age_today_min = strFromApi(preset.age_today_min);
  if (preset.age_today_max !== undefined) base.age_today_max = strFromApi(preset.age_today_max);
  if (preset.name_contains) base.name_contains = preset.name_contains;
  if (preset.mrn) base.mrn = preset.mrn;
  if (preset.national_id) base.national_id = preset.national_id;
  if (preset.nhis_number) base.nhis_number = preset.nhis_number;
  if (preset.phone) base.phone = preset.phone;
  if (preset.completion_min !== undefined) base.completion_min = strFromApi(preset.completion_min);
  if (preset.completion_max !== undefined) base.completion_max = strFromApi(preset.completion_max);
  if (preset.active_visit_today) base.active_visit_today = preset.active_visit_today;
  if (preset.visit_states?.length) base.visit_states = [...preset.visit_states];
  if (preset.visit_type_id !== undefined && preset.visit_type_id !== null) {
    base.visit_type_id = String(preset.visit_type_id);
  }
  if (preset.visit_date_from) base.visit_date_from = preset.visit_date_from;
  if (preset.visit_date_to) base.visit_date_to = preset.visit_date_to;
  if (preset.payment_status !== undefined) base.payment_status = preset.payment_status;
  if (preset.last_visit_from) base.last_visit_from = preset.last_visit_from;
  if (preset.last_visit_to) base.last_visit_to = preset.last_visit_to;
  if (preset.condition_key) base.condition_key = preset.condition_key;
  if (preset.problem_title_contains) base.problem_title_contains = preset.problem_title_contains;
  if (preset.icd_prefix) base.icd_prefix = preset.icd_prefix;
  if (preset.lab_test_contains) base.lab_test_contains = preset.lab_test_contains;
  if (preset.confirmation_source) base.confirmation_source = preset.confirmation_source;
  if (preset.age_at_diagnosis_min !== undefined) {
    base.age_at_diagnosis_min = strFromApi(preset.age_at_diagnosis_min);
  }
  if (preset.age_at_diagnosis_max !== undefined) {
    base.age_at_diagnosis_max = strFromApi(preset.age_at_diagnosis_max);
  }
  if (preset.diagnosis_date_from) base.diagnosis_date_from = preset.diagnosis_date_from;
  if (preset.diagnosis_date_to) base.diagnosis_date_to = preset.diagnosis_date_to;
  if (preset.appointment_today) base.appointment_today = preset.appointment_today;
  if (preset.appointment_date_from) base.appointment_date_from = preset.appointment_date_from;
  if (preset.appointment_date_to) base.appointment_date_to = preset.appointment_date_to;
  if (preset.recall_due) base.recall_due = preset.recall_due;
  if (preset.recall_date_from) base.recall_date_from = preset.recall_date_from;
  if (preset.recall_date_to) base.recall_date_to = preset.recall_date_to;
  if (preset.allergy_substance_contains) {
    base.allergy_substance_contains = preset.allergy_substance_contains;
  }
  if (preset.medication_contains) base.medication_contains = preset.medication_contains;
  if (preset.unread_staff_message) base.unread_staff_message = preset.unread_staff_message;
  if (preset.open_dated_reminder) base.open_dated_reminder = preset.open_dated_reminder;

  if (preset.my_provider_today) {
    base.my_provider_today = true;
    base.active_visit_today = 'yes';
  }

  return base;
}

/** Build a human-readable summary line from search meta. */
export function formatSearchSummary(
  total: number,
  meta: { filter_summary?: string; excluded_missing_dob?: number; query_ms?: number }
): string {
  const parts = [`${total} patient(s) match`];
  if (meta.filter_summary) parts.push(meta.filter_summary);
  if (meta.excluded_missing_dob) {
    parts.push(`${meta.excluded_missing_dob} excluded (missing DOB for age-at-diagnosis)`);
  }
  if (meta.query_ms !== undefined) parts.push(`${meta.query_ms} ms`);
  return parts.join(' · ');
}
