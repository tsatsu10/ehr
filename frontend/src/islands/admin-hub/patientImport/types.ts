export type ImportField =
  | 'fname' | 'lname' | 'mname' | 'sex' | 'dob' | 'phone'
  | 'street' | 'old_clinic_number' | 'national_id';

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  fname: 'First name',
  lname: 'Last name',
  mname: 'Middle name',
  sex: 'Sex',
  dob: 'Date of birth',
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

export interface ChunkResponse {
  results: RowResult[];
  summary: { processed: number; ok: number; duplicates: number; errors: number };
}
