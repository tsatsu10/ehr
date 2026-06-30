import { oeFetch } from '@core/oeFetch';
import { localDateString } from '@islands/daily-reports/reportsFormatters';

function triggerCsvDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadCsvResponse(response: Response): Promise<void> {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  let filename = 'report-hub-export.csv';
  const match = /filename="([^"]+)"/.exec(disposition);
  if (match) filename = match[1];

  const blob = await response.blob();
  triggerCsvDownload(filename, blob);
}

async function pollExportJob(
  ajaxUrl: string,
  csrfToken: string,
  jobId: number,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = await oeFetch<{
      status: string;
      ready?: boolean;
      message?: string;
    }>('reports.export_status', {
      ajaxUrl,
      csrfToken,
      params: { job_id: jobId },
    });

    if (status.status === 'ok' && status.ready) {
      const response = await fetch(`${ajaxUrl}?action=reports.export_download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          csrf_token_form: csrfToken,
          job_id: jobId,
        }),
      });

      const contentType = response.headers.get('Content-Type') ?? '';
      if (!response.ok || !contentType.includes('text/csv')) {
        throw new Error('Export download failed');
      }

      await downloadCsvResponse(response);
      return;
    }

    if (status.status === 'failed') {
      throw new Error(status.message || 'Export failed');
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  throw new Error('Export timed out');
}

export interface HubExportParams {
  reportKey: string;
  dateFrom: string;
  dateTo: string;
}

export async function exportHubReportCsv(
  ajaxUrl: string,
  csrfToken: string,
  params: HubExportParams,
): Promise<void> {
  const response = await fetch(`${ajaxUrl}?action=reports.export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      csrf_token_form: csrfToken,
      report_key: params.reportKey,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    }),
  });

  const contentType = response.headers.get('Content-Type') ?? '';
  if (response.ok && contentType.includes('text/csv')) {
    await downloadCsvResponse(response);
    return;
  }

  let message = 'Export failed';
  try {
    const payload = (await response.json()) as {
      message?: string;
      data?: { mode?: string; job_id?: number };
    };
    if (payload.message) message = payload.message;
    if (payload.data?.mode === 'async' && payload.data.job_id) {
      await pollExportJob(ajaxUrl, csrfToken, payload.data.job_id);
      return;
    }
  } catch {
    /* non-JSON */
  }

  throw new Error(message);
}

export async function runHubReportPreview(
  ajaxUrl: string,
  csrfToken: string,
  params: HubExportParams,
) {
  return oeFetch<{
    report_key: string;
    columns: string[];
    rows: string[][];
    total: number;
    limit: number;
    offset: number;
  }>('reports.run', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      report_key: params.reportKey,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      limit: 25,
      offset: 0,
    },
  });
}

export function defaultReportDateRange(): { from: string; to: string } {
  const today = localDateString();
  const year = today.slice(0, 4);
  const month = today.slice(5, 7);

  return {
    from: `${year}-${month}-01`,
    to: today,
  };
}
