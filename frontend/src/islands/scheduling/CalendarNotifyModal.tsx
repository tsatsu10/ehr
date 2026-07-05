import { ConfirmModal } from '@components/ConfirmModal';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { identityFromLabels } from '@components/patientBannerUtils';
import { Button } from '@components/ui/button';

interface CalendarNotifyModalProps {
  open: boolean;
  patientName: string;
  changeLabel: string;
  notifyLabel: string;
  skipNotifyLabel: string;
  abortLabel: string;
  title: string;
  body: string;
  onNotify: () => void;
  onSkipNotify: () => void;
  onAbort: () => void;
}

export function CalendarNotifyModal({
  open,
  patientName,
  changeLabel,
  notifyLabel,
  skipNotifyLabel,
  abortLabel,
  title,
  body,
  onNotify,
  onSkipNotify,
  onAbort,
}: CalendarNotifyModalProps) {
  const patientIdentity = identityFromLabels(patientName);

  return (
    <ConfirmModal
      open={open}
      onClose={onSkipNotify}
      title={title}
      confirmLabel={notifyLabel}
      cancelLabel={skipNotifyLabel}
      onConfirm={onNotify}
    >
      <p className="mb-2">{body}</p>
      {patientIdentity ? (
        <PatientContextBanner
          layout="compact"
          identity={patientIdentity}
          className="mb-2"
          aside={<span className="text-sm text-[var(--oe-nc-text-muted)]">{changeLabel}</span>}
        />
      ) : (
        <p className="mb-2 text-sm text-[var(--oe-nc-text-muted)]">{changeLabel}</p>
      )}
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onAbort}>
        {abortLabel}
      </Button>
    </ConfirmModal>
  );
}
