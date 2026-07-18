import { t } from '@core/i18n';
import type { StaffProvisionCreated } from './adminTypes';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Printable slip for the one-time starter sign-ins: one cut-out section per
 * person with their sign-in, temporary password, and first-login steps.
 * Client-only, same pattern as the comms thread print.
 */
export function printHandoverSheet(created: StaffProvisionCreated[], clinicLabel?: string): void {
  const rows = created
    .filter((row) => row.temp_password)
    .map((row) => `
      <section class="slip">
        <h2>${escapeHtml(row.role_label)}</h2>
        <table>
          <tr><th>${escapeHtml(t('Sign-in'))}</th><td class="mono">${escapeHtml(row.username)}</td></tr>
          <tr><th>${escapeHtml(t('Temporary password'))}</th><td class="mono">${escapeHtml(row.temp_password ?? '')}</td></tr>
        </table>
        <ol>
          <li>${escapeHtml(t('Sign in on the clinic computer with the details above.'))}</li>
          <li>${escapeHtml(t('Open My profile and change your password straight away.'))}</li>
          <li>${escapeHtml(t('Destroy this slip once your password is changed.'))}</li>
        </ol>
      </section>`)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(t('Staff sign-in handover'))}</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12pt; line-height: 1.5; margin: 1.5rem; color: #111; }
    h1 { font-size: 15pt; margin: 0 0 0.25rem; }
    .meta { color: #555; font-size: 10pt; margin-bottom: 1rem; }
    .warn { border: 1px solid #b45309; background: #fef3c7; padding: 0.5rem 0.75rem; font-size: 10.5pt; margin-bottom: 1rem; }
    .slip { border: 1px dashed #999; padding: 0.75rem 1rem; margin-bottom: 1rem; page-break-inside: avoid; }
    .slip h2 { font-size: 13pt; margin: 0 0 0.5rem; }
    table { border-collapse: collapse; margin-bottom: 0.5rem; }
    th { text-align: left; padding-right: 1rem; font-size: 10.5pt; color: #555; }
    td.mono { font-family: ui-monospace, Consolas, monospace; font-size: 12pt; font-weight: 600; }
    ol { margin: 0; padding-left: 1.25rem; font-size: 10.5pt; }
    @media print { body { margin: 0.75in; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(t('Staff sign-in handover'))}</h1>
  <div class="meta">${escapeHtml([clinicLabel, new Date().toLocaleDateString()].filter(Boolean).join(' · '))}</div>
  <div class="warn">${escapeHtml(t('Private — these passwords work until each person changes theirs. Cut the slips apart, hand each to its person, and destroy them once passwords are changed.'))}</div>
  ${rows}
</body>
</html>`;

  // Hidden srcdoc iframe instead of window.open + document.write: no popup
  // blocker involvement and no document.write (flagged by security guidance).
  // All interpolated values are HTML-escaped above.
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  frame.srcdoc = html;
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      return;
    }
    win.addEventListener('afterprint', () => frame.remove());
    // Fallback removal in case afterprint never fires (some browsers).
    window.setTimeout(() => frame.remove(), 60_000);
    win.focus();
    win.print();
  };
  document.body.appendChild(frame);
}
