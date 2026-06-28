import { useRef } from 'react';
import type { ReceiptReprintPayload } from './chartDepthTypes';

interface ReprintReceiptModalProps {
  open: boolean;
  payload: ReceiptReprintPayload | null;
  currencySymbol: string;
  onClose: () => void;
}

function formatMoney(symbol: string, amount: number | undefined): string {
  return `${symbol}${Number(amount ?? 0).toFixed(2)}`;
}

export function ReprintReceiptModal({
  open,
  payload,
  currencySymbol,
  onClose,
}: ReprintReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !payload?.receipt) return null;

  const { receipt, patient } = payload;

  const handlePrint = () => {
    const html = printRef.current?.innerHTML ?? '';
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`<html><head><title>Receipt</title></head><body>${html}</body></html>`);
    printWin.document.close();
    printWin.print();
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Reprint receipt</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <p className="mb-3">
                Reprint receipt #{receipt.receipt_number}?
                <br />
                Patient: {patient?.display_name ?? '—'} · MRN {patient?.pubpid ?? '—'}
                <br />
                Amount: {formatMoney(currencySymbol, receipt.amount_paid)} · {receipt.paid_at_label ?? '—'}
              </p>
              <div className="nc-receipt-print border rounded p-3" ref={printRef}>
                <p className="mb-0">
                  <strong>{patient?.display_name ?? ''}</strong>
                  <br />
                  Receipt #{receipt.receipt_number}
                  <br />
                  Queue #{receipt.queue_number ?? '—'}
                  <br />
                  Paid: {formatMoney(currencySymbol, receipt.amount_paid)}
                  <br />
                  Change: {formatMoney(currencySymbol, receipt.change_due)}
                  <br />
                  {receipt.paid_at_label ?? ''}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={handlePrint}>
                Print
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
