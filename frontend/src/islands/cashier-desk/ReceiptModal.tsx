import { useRef } from 'react';
import type { CashierReceipt, PatientPreview } from '@core/types';
import { formatMoney } from './cashierUtils';

interface ReceiptModalProps {
  open: boolean;
  preview: PatientPreview | null;
  receipt: CashierReceipt | null;
  onClose: () => void;
}

export function ReceiptModal({ open, preview, receipt, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!open || !preview || !receipt) return null;

  const identity = preview.identity;

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
      <div
        className="modal fade show d-block"
        id="nc-cashier-receipt-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-cashier-receipt-title"
        aria-modal="true"
      >
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-cashier-receipt-title">Receipt</h5>
              <button type="button" className="close" aria-label="Close" onClick={onClose}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body" id="nc-cashier-receipt-body">
              <div className="nc-receipt-print" ref={printRef}>
                <p>
                  <strong>{identity.display_name}</strong>
                  <br />
                  {receipt.receipt_number ? <>Receipt #{receipt.receipt_number}<br /></> : null}
                  Queue #{receipt.queue_number}
                  <br />
                  Paid: {formatMoney(receipt.amount_paid)}
                  <br />
                  Change: {formatMoney(receipt.change_due)}
                  <br />
                  {new Date().toLocaleString()}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" id="nc-cashier-print-receipt" onClick={handlePrint}>
                Print
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" id="nc-cashier-modal-backdrop" />
    </>
  );
}
