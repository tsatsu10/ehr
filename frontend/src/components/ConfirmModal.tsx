import type { ReactNode } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import './ui/ui-primitives.css';

export type ConfirmModalVariant = 'primary' | 'success' | 'warning' | 'danger';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  modalId?: string;
  identityBanner?: ReactNode;
  children: ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  confirmVariant?: ConfirmModalVariant;
  confirmDisabled?: boolean;
  submitting?: boolean;
  submittingLabel?: string;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  onClose,
  title,
  titleId,
  modalId,
  identityBanner,
  children,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmVariant = 'primary',
  submitting = false,
  submittingLabel,
  onConfirm,
  confirmDisabled = false,
}: ConfirmModalProps) {
  const confirmClass =
    confirmVariant === 'success'
      ? 'btn-success'
      : confirmVariant === 'warning'
        ? 'btn-warning'
        : confirmVariant === 'danger'
          ? 'btn-danger'
          : 'btn-primary';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id={modalId}
        className="oe-nc-confirm-modal"
        aria-labelledby={titleId}
      >
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          <DialogClose className="oe-nc-dialog__close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <div className="oe-nc-dialog__body">
          {identityBanner}
          {children}
        </div>
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${confirmClass}`}
            disabled={confirmDisabled || submitting}
            onClick={onConfirm}
          >
            {submitting ? (submittingLabel ?? 'Saving…') : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface IdentityConfirmBannerProps {
  displayName: string;
  pubpid?: string;
  queueNumber?: string | number;
  receiptNumber?: string;
  children?: ReactNode;
}

/** G12 identity repeat strip for confirm modals. */
export function IdentityConfirmBanner({
  displayName,
  pubpid,
  queueNumber,
  receiptNumber,
  children,
}: IdentityConfirmBannerProps) {
  const parts = [
    displayName,
    pubpid ? `MRN ${pubpid}` : null,
    queueNumber !== undefined ? `Queue #${queueNumber}` : null,
    receiptNumber ? `Receipt #${receiptNumber}` : null,
  ].filter(Boolean);

  return (
    <div className="oe-nc-confirm-identity nc-patient-context-banner p-3 border rounded bg-light mb-3">
      <strong>{parts.join(' · ')}</strong>
      {children}
    </div>
  );
}
