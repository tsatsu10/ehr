import type { PharmReorderRow } from './pharmOpsTypes';

function csvEscape(value: string | number): string {
  let text = String(value);
  // Neutralize spreadsheet formula injection: a leading =, +, -, @ or control
  // char makes Excel/Sheets evaluate the cell as a formula. Only string fields
  // (drug names) pass through here — numeric columns are written raw — so
  // prefixing a quote never corrupts a real number.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Purchase-order CSV for the reorder list (INV-5/INV-7): one row per drug that needs restocking,
 * using the pharmacist's edited order quantities (falls back to the suggested quantity when not
 * edited), grouped by supplier — real suppliers alphabetically, then drugs with no supplier on
 * record — so the sheet can be split and handed to each supplier directly, with a subtotal per
 * group and a grand total.
 */
export function reorderToCsv(
  rows: PharmReorderRow[],
  orderQty: Record<number, number>,
  currencySymbol: string,
): string {
  const lines: string[] = [
    `Purchase order,${csvEscape(new Date().toLocaleDateString())}`,
    '',
    'Drug,On hand,Reorder point,Days left,Order qty,Unit cost,Est. cost,Status',
  ];

  const groups = new Map<string, PharmReorderRow[]>();
  for (const row of rows) {
    const key = row.supplier_name?.trim() || '';
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const supplierNames = [...groups.keys()].filter((k) => k !== '').sort((a, b) => a.localeCompare(b));
  if (groups.has('')) {
    supplierNames.push('');
  }

  let total = 0;
  let totalKnown = true;

  for (const supplierName of supplierNames) {
    const groupRows = groups.get(supplierName) ?? [];
    lines.push('');
    lines.push(`Supplier: ${csvEscape(supplierName || 'No supplier on record')}`);

    let groupTotal = 0;
    let groupKnown = true;
    for (const row of groupRows) {
      const qty = orderQty[row.drug_id] ?? row.suggested_order_qty;
      const unitCost = row.unit_cost ?? null;
      const estCost = unitCost !== null ? Math.round(unitCost * qty * 100) / 100 : null;
      if (estCost !== null) {
        groupTotal += estCost;
        total += estCost;
      } else {
        groupKnown = false;
        totalKnown = false;
      }
      lines.push([
        csvEscape(row.drug_name),
        row.on_hand,
        row.reorder_point,
        row.days_of_supply ?? '',
        qty,
        unitCost ?? '',
        estCost ?? '',
        csvEscape(row.status_label),
      ].join(','));
    }
    lines.push(`Subtotal${groupKnown ? '' : ' (partial)'},,,,,,${groupTotal.toFixed(2)},`);
  }

  lines.push('');
  lines.push(`Estimated total${totalKnown ? '' : ' (partial — some costs unknown)'},${currencySymbol}${total.toFixed(2)}`);

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
