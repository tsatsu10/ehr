import { oeFetch } from '@core/oeFetch';
import { openPrintWindow } from './pharmOpsPrintWindow';

interface DispenseLabelPrepareResult {
  sale_id: number;
  print_url: string;
  patient_label?: string;
}

export async function openDispenseLabelPdf(
  ajaxUrl: string,
  csrfToken: string,
  saleId: number,
  autoPrint = false,
): Promise<void> {
  const data = await oeFetch<DispenseLabelPrepareResult>('pharm_ops.dispense_label_pdf', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: { sale_id: saleId },
  });

  if (!data.print_url) {
    throw new Error('Print URL missing from server');
  }

  const url = autoPrint
    ? `${data.print_url}${data.print_url.includes('?') ? '&' : '?'}print=1`
    : data.print_url;

  openPrintWindow(url);
}
