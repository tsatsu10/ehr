import { SlideOver } from '@components/SlideOver';
import { Button } from '@components/ui/button';
import type { PharmacyQueueCard } from '@core/types';
import { PharmacyQueueBody } from './PharmacyQueue';

interface PharmacyMobileQueueSheetProps {
  open: boolean;
  onClose: () => void;
  waitingCount: number;
  cards: PharmacyQueueCard[];
  hasActiveWork: boolean;
  loading: boolean;
  error: string | null;
  onSelectVisit: (card: PharmacyQueueCard) => void;
}

export function PharmacyMobileQueueBar({
  waitingCount,
  hasActiveWork,
  onOpen,
}: {
  waitingCount: number;
  hasActiveWork: boolean;
  onOpen: () => void;
}) {
  if (hasActiveWork) {
    return null;
  }

  const label = waitingCount > 0
    ? `${waitingCount} patient${waitingCount === 1 ? '' : 's'} waiting`
    : 'Pharmacy queue';

  return (
    <div className="nc-pharmacy-mobile-queue-bar">
      <Button
        type="button"
        variant="outline"
        className="nc-pharmacy-mobile-queue-bar__btn"
        onClick={onOpen}
        aria-haspopup="dialog"
      >
        {label}
      </Button>
    </div>
  );
}

export function PharmacyMobileQueueSheet({
  open,
  onClose,
  waitingCount,
  cards,
  hasActiveWork,
  loading,
  error,
  onSelectVisit,
}: PharmacyMobileQueueSheetProps) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Pharmacy queue (${waitingCount})`}
      id="nc-pharmacy-mobile-queue-sheet"
      placement="bottom"
    >
      <PharmacyQueueBody
        cards={cards}
        hasActiveWork={hasActiveWork}
        loading={loading}
        error={error}
        onSelectVisit={(card) => {
          onSelectVisit(card);
          onClose();
        }}
      />
    </SlideOver>
  );
}
