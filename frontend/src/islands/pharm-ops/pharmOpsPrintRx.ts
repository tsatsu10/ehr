import { openRxPrintPdf } from './rxPrintUtils';

export async function printRxWithNotice(
  ajaxUrl: string,
  csrfToken: string,
  prescriptionId: number,
  onError: (message: string) => void,
): Promise<void> {
  try {
    await openRxPrintPdf(ajaxUrl, csrfToken, prescriptionId);
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Print Rx failed');
  }
}
