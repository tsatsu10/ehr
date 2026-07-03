import { oeFetch } from '@core/oeFetch';
import { openPrintWindow } from './pharmOpsPrintWindow';

interface RxPrintPrepareResult {
  prescription_id: number;
  print_url: string;
  patient_label?: string;
}

export async function openRxPrintPdf(
  ajaxUrl: string,
  csrfToken: string,
  prescriptionId: number,
): Promise<void> {
  const data = await oeFetch<RxPrintPrepareResult>('pharm_ops.rx_print_pdf', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: { prescription_id: prescriptionId },
  });

  if (!data.print_url) {
    throw new Error('Print URL missing from server');
  }

  openPrintWindow(data.print_url);
}
