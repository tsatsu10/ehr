import { SlideOver } from '@components/SlideOver';
import { Button } from '@components/ui/button';
import { t } from '@core/i18n';
import type {
  DoctorDoneTodayRow,
  DoctorQueueCard,
  DoctorReopenableRow,
} from '@core/types';
import { DoctorQueueBody } from './DoctorQueue';
import type { ReactNode } from 'react';

interface DoctorMobileQueueSheetProps {
  open: boolean;
  onClose: () => void;
  waitingCount: number;
  cards: DoctorQueueCard[];
  doneToday: DoctorDoneTodayRow[];
  reopenableToday: DoctorReopenableRow[];
  canReopenConsult: boolean;
  hasActiveConsult: boolean;
  loading: boolean;
  error: string | null;
  onTakePatient: (card: DoctorQueueCard) => void;
  onReopenClick: (row: DoctorReopenableRow) => void;
  queueHeaderExtra?: ReactNode;
}

export function DoctorMobileQueueBar({
  waitingCount,
  hasActiveConsult,
  onOpen,
}: {
  waitingCount: number;
  hasActiveConsult: boolean;
  onOpen: () => void;
}) {
  if (hasActiveConsult) {
    return null;
  }

  const label = waitingCount > 0
    ? (waitingCount === 1 ? t('1 patient ready') : t('{count} patients ready', { count: waitingCount }))
    : t('Doctor queue');

  return (
    <div className="nc-doctor-mobile-queue-bar">
      <Button
        type="button"
        variant="outline"
        className="nc-doctor-mobile-queue-bar__btn"
        onClick={onOpen}
        aria-haspopup="dialog"
      >
        {label}
      </Button>
    </div>
  );
}

export function DoctorMobileQueueSheet({
  open,
  onClose,
  waitingCount,
  cards,
  doneToday,
  reopenableToday,
  canReopenConsult,
  hasActiveConsult,
  loading,
  error,
  onTakePatient,
  onReopenClick,
  queueHeaderExtra,
}: DoctorMobileQueueSheetProps) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={t('My queue ({count} waiting)', { count: waitingCount })}
      id="nc-doctor-mobile-queue-sheet"
      placement="bottom"
    >
      <DoctorQueueBody
        cards={cards}
        doneToday={doneToday}
        reopenableToday={reopenableToday}
        canReopenConsult={canReopenConsult}
        hasActiveConsult={hasActiveConsult}
        loading={loading}
        error={error}
        queueHeaderExtra={queueHeaderExtra}
        onTakePatient={(card) => {
          onTakePatient(card);
          onClose();
        }}
        onReopenClick={onReopenClick}
      />
    </SlideOver>
  );
}
