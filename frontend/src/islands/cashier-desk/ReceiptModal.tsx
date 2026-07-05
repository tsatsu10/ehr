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
  onClose: () => void;
}

export function ReceiptModal({ open, preview, receipt, onClose }: ReceiptModalProps) {
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
              Queue #{receipt.queue_number}
              <br />
              {receipt.payment_method_label ? (
                <>
                  Method: {receipt.payment_method_label}
                  <br />
                </>
              ) : null}
              Paid: {formatMoney(receipt.amount_paid)}
              <br />
              {receipt.payment_method === 'momo' && receipt.momo_reference ? (
                <>
                  MoMo ref: {receipt.momo_reference}
                  <br />
                </>
              ) : null}
              {receipt.payment_method !== 'momo' ? (
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
