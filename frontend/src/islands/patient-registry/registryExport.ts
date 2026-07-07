import type { ApiRegistryFilters } from './registryTypes';
import type { RegistrySortKey } from './registryQueryOptions';

/** POST cohort.export and trigger a CSV download (non-JSON response). */
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
