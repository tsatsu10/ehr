import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './ui/button';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from './ui/dialog';

export type ConfirmModalVariant = 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

function confirmButtonVariant(variant: ConfirmModalVariant): NonNullable<ButtonProps['variant']> {
  switch (variant) {
    case 'success':
      return 'cta';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'danger';
    case 'secondary':
      return 'secondary';
    case 'primary':
      return 'default';
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

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
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id={modalId}
        className={dialogContentSizeClass.confirm}
        aria-labelledby={titleId}
      >
        <DialogHeader>
          <DialogTitle id={titleId}>{title}</DialogTitle>
          <DialogClose aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          {identityBanner}
          {children}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmButtonVariant(confirmVariant)}
            disabled={confirmDisabled || submitting}
            onClick={onConfirm}
          >
            {submitting ? (submittingLabel ?? 'Saving…') : confirmLabel}
          </Button>
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
    <div className="mb-3 rounded-xl border border-[var(--oe-nc-border,#e2e8f0)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-4 py-3">
      <strong className="text-sm text-[var(--oe-nc-text)]">{parts.join(' · ')}</strong>
      {children}
    </div>
  );
}
