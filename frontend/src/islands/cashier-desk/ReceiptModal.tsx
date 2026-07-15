import { useRef } from 'react';
import { Button } from '@components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
import type { CashierReceipt, PatientPreview } from '@core/types';
import { formatMoney } from './cashierUtils';

interface ReceiptModalProps {
  open: boolean;
  preview: PatientPreview | null;
  receipt: CashierReceipt | null;
  /** M11-F12 — chart-depth payment history for the paid visit */
  historyUrl?: string | null;
  onClose: () => void;
}

export function ReceiptModal({ open, preview, receipt, historyUrl, onClose }: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!preview || !receipt) return null;

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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-cashier-receipt-modal"
        className={dialogContentSizeClass.confirm}
        aria-labelledby="nc-cashier-receipt-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-cashier-receipt-title">Receipt</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody id="nc-cashier-receipt-body">
          <div className="nc-receipt-print" ref={printRef}>
            <p>
              <strong>{identity.display_name}</strong>
              <br />
              {receipt.receipt_number ? <>Receipt #{receipt.receipt_number}<br /></> : null}
              {receipt.show_queue_number !== false ? (
                <>
                  Queue #{receipt.queue_number}
                  <br />
                </>
              ) : null}
              {receipt.payment_method_label ? (
                <>
                  Method: {receipt.payment_method_label}
                  <br />
                </>
              ) : null}
              Paid: {formatMoney(receipt.amount_paid)}
              <br />
              {receipt.balance_due !== undefined && receipt.balance_due > 0 ? (
                <>
                  <strong>Balance owed: {formatMoney(receipt.balance_due)}</strong>
                  <br />
                </>
              ) : null}
              {receipt.scheme_owed !== undefined && receipt.scheme_owed > 0 ? (
                <>
                  Scheme owes: {formatMoney(receipt.scheme_owed)}
                  <br />
                </>
              ) : null}
              {receipt.payment_method === 'momo' && receipt.momo_reference ? (
                <>
                  MoMo ref: {receipt.momo_reference}
                  <br />
                </>
              ) : null}
              {receipt.payment_method !== 'momo' && !receipt.partial ? (
                <>
                  Change: {formatMoney(receipt.change_due)}
                  <br />
                </>
              ) : null}
              {new Date().toLocaleString()}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          {historyUrl && (
            <Button type="button" variant="outline" asChild>
              <a href={historyUrl} target="_top">
                History
              </a>
            </Button>
          )}
          <Button type="button" variant="cta" id="nc-cashier-print-receipt" onClick={handlePrint}>
            Print
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
