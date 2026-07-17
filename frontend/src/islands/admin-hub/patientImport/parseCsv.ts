import Papa from 'papaparse';
import { MAX_IMPORT_ROWS, type ParsedCsv } from './types';

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  if (clean.trim() === '') {
    return { headers: [], rows: [], error: 'The file is empty.', warning: null };
  }

  const parsed = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' });
  const all = parsed.data.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (all.length < 2) {
    return { headers: [], rows: [], error: 'The file needs a header row and at least one patient row.', warning: null };
  }

  const [headers, ...rows] = all;
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      headers: [],
      rows: [],
      error: `This file has ${rows.length.toLocaleString()} rows — the limit is 5,000 per file. Split it into smaller files and import them one after the other.`,
      warning: null,
    };
  }

  return { headers: headers.map((h) => h.trim()), rows, error: null, warning: buildWarning(parsed.errors) };
}

/**
 * papaparse still returns usable rows for a non-fatal issue (e.g. a ragged
 * row with the wrong field count), but records it in `errors`. Summarize just
 * the first one so the user gets a hint to double-check the file, without a
 * wall of parser jargon.
 */
function buildWarning(errors: Papa.ParseError[]): string | null {
  if (errors.length === 0) {
    return null;
  }
  const first = errors[0];
  // papaparse's `row` is 0-based over the raw parsed rows, and the header
  // occupies row 0 — so data row N (1-based, matching the file's line
  // numbers) is `row + 1`.
  const rowLabel = typeof first.row === 'number' ? `row ${first.row + 1}` : 'a row';
  const countLabel = errors.length === 1 ? 'One row' : `${errors.length} rows`;

  return `${countLabel} in this file had a formatting issue (first: ${rowLabel} — ${first.message}). Check that row before importing.`;
}
