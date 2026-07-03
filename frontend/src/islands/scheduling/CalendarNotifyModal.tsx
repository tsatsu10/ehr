import { ConfirmModal } from '@components/ConfirmModal';

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
      <p className="mb-2 small text-muted">
        <strong>{patientName}</strong>
        {' · '}
        {changeLabel}
      </p>
      <button type="button" className="btn btn-link btn-sm p-0" onClick={onAbort}>
        {abortLabel}
      </button>
    </ConfirmModal>
  );
}
