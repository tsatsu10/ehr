import type { DaysheetData } from './billOpsTypes';

function csvEscape(value: string | number): string {
  let text = String(value);
  // Neutralize spreadsheet formula injection: a leading =, +, -, @ or control
  // char makes Excel/Sheets evaluate the cell as a formula. Only string fields
  // (names, labels, the manual MoMo note) pass through here — numeric columns
  // are written raw — so prefixing a quote never corrupts a real number.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function daysheetToCsv(data: DaysheetData, momoTally = ''): string {
  const lines: string[] = [
    `Date,${csvEscape(data.date)}`,
    `Receipts,${data.receipt_count}`,
    `Voided,${data.void_count}`,
    `No-charge closes,${data.no_charge_closes}`,
    `Cash collected,${data.cash_collected}`,
    `MoMo tally (manual),${csvEscape(momoTally.trim() === '' ? '—' : momoTally)}`,
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
