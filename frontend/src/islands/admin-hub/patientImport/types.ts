export type ImportField =
  | 'fname' | 'lname' | 'mname' | 'sex' | 'dob' | 'age' | 'phone'
  | 'street' | 'old_clinic_number' | 'national_id';

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  fname: 'First name',
  lname: 'Last name',
  mname: 'Middle name',
  sex: 'Sex',
  dob: 'Date of birth',
  age: 'Age (years)',
  phone: 'Phone',
  street: 'Address',
  old_clinic_number: 'Old clinic number',
  national_id: 'National ID',
};

export const MAX_IMPORT_ROWS = 5000;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  error: string | null;
  /** Non-fatal parse issue (e.g. a ragged row) — file still usable, but flagged. */
  warning: string | null;
}

/** File column index -> our field, or null for "don't import". */
export type ColumnMapping = (ImportField | null)[];

export interface RowResult {
  row_number: number;
  status: 'ok' | 'imported' | 'duplicate' | 'error';
  reason: string;
  name: string;
  pid: number | null;
}

/** Identity keys of rows accepted (ok/imported) in one chunk, bucketed like the server's duplicate index. */
export interface AcceptedKeyBuckets {
  name_dob: string[];
  name_phone: string[];
  national_id: string[];
}

export interface ChunkResponse {
  results: RowResult[];
  summary: { processed: number; ok: number; duplicates: number; errors: number };
  stopped: boolean;
  /** Present only when stopped is true (the breaker tripped). */
  stopped_reason?: string;
  accepted_keys: AcceptedKeyBuckets;
}
