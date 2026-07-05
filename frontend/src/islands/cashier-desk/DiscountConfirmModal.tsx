import { ConfirmModal, IdentityConfirmBanner } from '@components/ConfirmModal';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { CashierDiscountLine, CashierVisit, PatientPreview } from '@core/types';
import { formatMoney } from './cashierUtils';

interface DiscountConfirmModalProps {
  open: boolean;
  preview: PatientPreview | null;
  visit: CashierVisit | null;
  lines: CashierDiscountLine[];
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DiscountConfirmModal({
  open,
  preview,
  visit,
  lines,
  submitting,
  onClose,
  onConfirm,
}: DiscountConfirmModalProps) {
  if (!preview || !visit) return null;

  const identity = preview.identity;

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title="Confirm discounted charges"
      confirmLabel="Post charges"
      confirmVariant="primary"
      submitting={submitting}
      submittingLabel="Posting…"
      onConfirm={onConfirm}
      identityBanner={(
        <IdentityConfirmBanner
          displayName={identity.display_name}
          pubpid={identity.pubpid}
          queueNumber={visit.queue_number}
        />
      )}
    >
      {lines.length === 0 ? (
        <p className="mb-0">Post discounted charges to this visit?</p>
      ) : (
        <>
          <p className="mb-2">The following lines are below the standard fee schedule price:</p>
          <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-2' })}>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Standard</TableHead>
                <TableHead className="text-right">Posted</TableHead>
                <TableHead className="text-right">Discount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.name}>
                  <TableCell>{line.name}</TableCell>
                  <TableCell className="text-right">{formatMoney(line.standard)}</TableCell>
                  <TableCell className="text-right">{formatMoney(line.posted)}</TableCell>
                  <TableCell className="text-right text-[var(--oe-nc-danger,#dc2626)]">-{formatMoney(line.discount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
      <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">Confirm patient identity before posting discounted charges.</p>
    </ConfirmModal>
  );
}
