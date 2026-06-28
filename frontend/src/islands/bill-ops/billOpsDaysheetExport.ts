import type { DaysheetData } from './billOpsTypes';

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function daysheetToCsv(data: DaysheetData): string {
  const lines: string[] = [
    `Date,${csvEscape(data.date)}`,
    `Receipts,${data.receipt_count}`,
    `Voided,${data.void_count}`,
    `No-charge closes,${data.no_charge_closes}`,
    `Cash collected,${data.cash_collected}`,
    `Reconciliation status,${csvEscape(data.reconciliation.status)}`,
    `Reconciliation delta,${data.reconciliation.delta_amount}`,
    '',
    'Cashier,Total',
  ];

  for (const row of data.by_cashier) {
    lines.push(`${csvEscape(row.cashier)},${row.total}`);
  }

  lines.push('', 'Visit type,Total');
  for (const row of data.by_visit_type) {
    lines.push(`${csvEscape(row.visit_type_label)},${row.total}`);
  }

  return lines.join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
