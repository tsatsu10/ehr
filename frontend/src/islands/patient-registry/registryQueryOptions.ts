/** Server-supported cohort search sort keys (cohort.search / cohort.export). */
export type RegistrySortKey =
  | 'name_asc'
  | 'name_desc'
  | 'age_asc'
  | 'age_desc'
  | 'completion_asc'
  | 'completion_desc'
  | 'last_visit_asc'
  | 'last_visit_desc'
  | 'dx_date_asc'
  | 'dx_date_desc';

export const REGISTRY_PAGE_SIZES = [25, 50, 100] as const;
export type RegistryPageSize = (typeof REGISTRY_PAGE_SIZES)[number];

export const REGISTRY_DEFAULT_PAGE_SIZE: RegistryPageSize = 25;
export const REGISTRY_DEFAULT_SORT: RegistrySortKey = 'name_asc';
export const REGISTRY_LARGE_MATCH_THRESHOLD = 10_000;

export const REGISTRY_SORT_OPTIONS: { value: RegistrySortKey; label: string }[] = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'age_asc', label: 'Age (youngest first)' },
  { value: 'age_desc', label: 'Age (oldest first)' },
  { value: 'completion_asc', label: 'Profile completion (low first)' },
  { value: 'completion_desc', label: 'Profile completion (high first)' },
  { value: 'last_visit_asc', label: 'Last visit (oldest first)' },
  { value: 'last_visit_desc', label: 'Last visit (recent first)' },
  { value: 'dx_date_asc', label: 'Diagnosis date (oldest first)' },
  { value: 'dx_date_desc', label: 'Diagnosis date (recent first)' },
];

export function isRegistrySortKey(value: string): value is RegistrySortKey {
  return REGISTRY_SORT_OPTIONS.some((option) => option.value === value);
}

export function isRegistryPageSize(value: number): value is RegistryPageSize {
  return REGISTRY_PAGE_SIZES.includes(value as RegistryPageSize);
}
