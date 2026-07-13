import type { ApiRegistryFilters } from './registryTypes';
import type { RegistrySortKey } from './registryQueryOptions';
import { pollExportJobToDownload } from '@core/exportJobPolling';

/**
 * POST cohort.export and download the CSV. Small cohorts come back as a direct CSV
 * (sync); large cohorts (SCALE-2.2) come back as JSON `{ mode:'async', job_id }` —
 * built by the background worker — so we poll for completion and then download.
 */
export async function exportRegistryCsv(
  ajaxUrl: string,
  csrfToken: string,
  filters: ApiRegistryFilters,
  sort: RegistrySortKey = 'name_asc',
): Promise<void> {
  const response = await fetch(`${ajaxUrl}?action=cohort.export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      csrf_token_form: csrfToken,
      sort,
      filters,
    }),
  });

  const contentType = response.headers.get('Content-Type') ?? '';

  // Large cohort → deferred to the worker; poll then download.
  if (response.ok && contentType.includes('application/json')) {
    const payload = (await response.json()) as {
      success?: boolean;
      message?: string;
      data?: { mode?: string; job_id?: number };
    };
    if (payload.data?.mode === 'async' && payload.data.job_id) {
      await pollExportJobToDownload(ajaxUrl, csrfToken, payload.data.job_id, {
        statusAction: 'cohort.export_status',
        downloadAction: 'cohort.export_download',
      });
      return;
    }
    throw new Error(payload.message || 'Export failed');
  }

  if (!response.ok || !contentType.includes('text/csv')) {
    let message = 'Export failed';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  let filename = 'patient-registry.csv';
  const match = /filename="([^"]+)"/.exec(disposition);
  if (match) filename = match[1];

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
