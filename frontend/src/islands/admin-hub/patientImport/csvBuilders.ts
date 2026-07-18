import type { RowResult } from './types';

const TEMPLATE_HEADERS = 'first_name,last_name,middle_name,sex,date_of_birth,age,phone,address,old_clinic_number,national_id';

export function buildTemplateCsv(): string {
  return [
    TEMPLATE_HEADERS,
    'Ama,Mensah,,Female,12/03/1988,,0244123456,"12 Ring Road, Accra",OPD-0031,',
    'Kwame,Boateng,Kofi,Male,,36,0209876543,,,',
  ].join('\n') + '\n';
}

function csvCell(value: string): string {
  // Neutralize CSV formula injection: a cell opening with =, +, -, or @ can be
  // interpreted as a formula by Excel/Sheets when the report is opened there.
  // A leading apostrophe forces text interpretation without changing what the
  // user sees in a spreadsheet cell.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildReportCsv(results: RowResult[]): string {
  const lines = ['row,name,status,reason'];
  for (const r of results) {
    lines.push([String(r.row_number), csvCell(r.name), r.status, csvCell(r.reason)].join(','));
  }
  return lines.join('\n') + '\n';
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
