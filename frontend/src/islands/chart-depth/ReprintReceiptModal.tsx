import { useRef } from 'react';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { identityFromLabels } from '@components/patientBannerUtils';
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
import type { ReceiptReprintPayload } from './chartDepthTypes';
import { formatChartMoney } from './chartDepthUtils';

interface ReprintReceiptModalProps {
  open: boolean;
  payload: ReceiptReprintPayload | null;
  onClose: () => void;
}

export function ReprintReceiptModal({
  open,
  payload,
  onClose,
}: ReprintReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!payload?.receipt) return null;

  const { receipt, patient } = payload;
  const patientIdentity = identityFromLabels(patient?.display_name, { pubpid: patient?.pubpid });

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
      <DialogContent className={dialogContentSizeClass.confirm} aria-labelledby="nc-reprint-receipt-title">
        <DialogHeader>
          <DialogTitle id="nc-reprint-receipt-title">Reprint receipt</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          {patientIdentity ? (
            <PatientContextBanner layout="compact" identity={patientIdentity} className="mb-3" />
          ) : null}
          <p className="mb-3">
            Reprint receipt #{receipt.receipt_number}?
            <br />
            Amount: {formatChartMoney(receipt.amount_paid)} · {receipt.paid_at_label ?? '—'}
          </p>
          <div className="nc-receipt-print border rounded p-3" ref={printRef}>
            <p className="mb-0">
              <strong>{patient?.display_name ?? ''}</strong>
              <br />
              Receipt #{receipt.receipt_number}
              <br />
              Queue #{receipt.queue_number ?? '—'}
              <br />
              Paid: {formatChartMoney(receipt.amount_paid)}
              <br />
              Change: {formatChartMoney(receipt.change_due)}
              <br />
              {receipt.paid_at_label ?? ''}
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="cta" onClick={handlePrint}>
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
