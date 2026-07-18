/**
 * Shared CSV building blocks (promoted from pharm-ops reorder export so every
 * island escapes and downloads the same way).
 */

export function csvEscape(value: string | number): string {
  let text = String(value);
  // Neutralize spreadsheet formula injection: a leading =, +, -, @ or control
  // char makes Excel/Sheets evaluate the cell as a formula. Prefixing a quote
  // is only applied to string content, never raw numeric columns.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(filename: string, content: string): void {
  // UTF-8 BOM: without it Excel on Windows decodes the file as ANSI and
  // mangles any non-ASCII (em dashes, accented names). Written as an explicit
  // char code — a literal BOM character kept getting stripped by tooling.
  const blob = new Blob([String.fromCharCode(0xfeff), content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
