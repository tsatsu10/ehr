import { oeFetch } from '@core/oeFetch';

/**
 * Shared background-export polling (SCALE-2.2).
 *
 * When a heavy export is deferred to the worker, the server returns
 * `{ mode: 'async', job_id }`. This polls the given status action until the job is
 * ready (or failed / times out), then downloads the file via the given download
 * action. Reused across export surfaces (registry cohort, report hub, …) so each
 * one only differs by its two action names.
 */

const POLL_ATTEMPTS = 150;
const POLL_INTERVAL_MS = 1000;

interface ExportJobActions {
  statusAction: string;
  downloadAction: string;
}

function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Poll an async export job to completion and download its file.
 * Throws on failure or timeout.
 */
export async function pollExportJobToDownload(
  ajaxUrl: string,
  csrfToken: string,
  jobId: number,
  actions: ExportJobActions,
): Promise<void> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const status = await oeFetch<{ status: string; ready?: boolean; filename?: string; message?: string }>(
      actions.statusAction,
      { ajaxUrl, csrfToken, params: { job_id: jobId } },
    );

    if (status.status === 'ok' && status.ready) {
      const response = await fetch(`${ajaxUrl}?action=${actions.downloadAction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        credentials: 'same-origin',
        body: JSON.stringify({ csrf_token_form: csrfToken, job_id: jobId }),
      });
      const contentType = response.headers.get('Content-Type') ?? '';
      if (!response.ok || !contentType.includes('text/csv')) {
        throw new Error('Export download failed');
      }
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename="([^"]+)"/.exec(disposition);
      triggerBlobDownload(match ? match[1] : status.filename || 'export.csv', await response.blob());
      return;
    }

    if (status.status === 'failed') {
      throw new Error(status.message || 'Export failed');
    }

    await new Promise((resolve) => {
      setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }

  throw new Error('Export timed out');
}
