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
import type { CashierResolveVisit } from '@core/types';
import { formatMoney } from './cashierUtils';

interface PickVisitModalProps {
  open: boolean;
  visits: CashierResolveVisit[];
  onClose: () => void;
  onPick: (visitId: number) => void;
}

const pickVisitItemClass =
  'block w-full cursor-pointer border-0 border-b border-[var(--oe-nc-border,#e2e8f0)] bg-transparent px-4 py-3 text-left text-[var(--oe-nc-text,#111827)] last:border-b-0 hover:bg-[var(--oe-nc-bg-tint,#f8fafc)] focus-visible:outline-none focus-visible:shadow-[inset_var(--oe-nc-focus-ring,0_0_0_2px_var(--oe-nc-primary,#2563eb))]';

export function PickVisitModal({ open, visits, onClose, onPick }: PickVisitModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className={dialogContentSizeClass.confirm}>
        <DialogHeader>
          <DialogTitle>Select visit to pay</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody className="flex max-h-[min(24rem,50vh)] flex-col overflow-y-auto p-0">
          {visits.map((visit) => (
            <button
              key={visit.id}
              type="button"
              className={pickVisitItemClass}
              onClick={() => onPick(visit.id)}
            >
              <strong>#{visit.queue_number} {visit.display_name}</strong>
              <div className="text-sm text-[var(--oe-nc-text-muted)]">
                {visit.visit_type_label || 'Visit'} · {formatMoney(visit.charges_total ?? 0)}
              </div>
            </button>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
