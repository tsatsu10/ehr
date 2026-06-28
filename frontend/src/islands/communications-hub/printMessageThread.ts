/** Client-only message thread print (COM-F14). */

export interface MessagePrintData {
  patient_name?: string | null;
  type?: string;
  from_name?: string;
  date_display?: string | null;
  date?: string;
  status?: string | null;
  thread_html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printMessageThread(detail: MessagePrintData): void {
  const title = detail.patient_name || detail.type || 'Message';
  const meta = [
    detail.from_name,
    detail.date_display || detail.date,
    detail.type,
    detail.status,
  ].filter(Boolean).join(' · ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12pt; line-height: 1.5; margin: 1.5rem; color: #111; }
    h1 { font-size: 16pt; margin: 0 0 0.5rem; }
    .meta { color: #555; font-size: 10pt; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #ccc; }
    .thread { font-size: 11pt; }
    @media print {
      body { margin: 0.75in; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(meta)}</div>
  <div class="thread">${detail.thread_html}</div>
</body>
</html>`;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    return;
  }
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  printWin.print();
}
