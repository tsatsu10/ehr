import Papa from 'papaparse';
import { MAX_IMPORT_ROWS, type ParsedCsv } from './types';

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  if (clean.trim() === '') {
    return { headers: [], rows: [], error: 'The file is empty.' };
  }

  const parsed = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' });
  const all = parsed.data.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (all.length < 2) {
    return { headers: [], rows: [], error: 'The file needs a header row and at least one patient row.' };
  }

  const [headers, ...rows] = all;
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      headers: [],
      rows: [],
      error: `This file has ${rows.length.toLocaleString()} rows — the limit is 5,000 per file. Split it into smaller files and import them one after the other.`,
    };
  }

  return { headers: headers.map((h) => h.trim()), rows, error: null };
}
