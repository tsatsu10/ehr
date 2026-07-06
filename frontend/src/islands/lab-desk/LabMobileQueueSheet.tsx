import { SlideOver } from '@components/SlideOver';
import { Button } from '@components/ui/button';
import type { LabQueueCard } from '@core/types';
import { LabQueueBody } from './LabQueue';

interface LabMobileQueueSheetProps {
  open: boolean;
  onClose: () => void;
  waitingCount: number;
  cards: LabQueueCard[];
  hasActiveWork: boolean;
  loading: boolean;
  error: string | null;
  onSelectVisit: (card: LabQueueCard) => void;
}

export function LabMobileQueueBar({
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
    : 'Lab queue';

  return (
    <div className="nc-lab-mobile-queue-bar">
      <Button
        type="button"
        variant="outline"
        className="nc-lab-mobile-queue-bar__btn"
        onClick={onOpen}
        aria-haspopup="dialog"
      >
        {label}
      </Button>
    </div>
  );
}

export function LabMobileQueueSheet({
  open,
  onClose,
  waitingCount,
  cards,
  hasActiveWork,
  loading,
  error,
  onSelectVisit,
}: LabMobileQueueSheetProps) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Lab queue (${waitingCount})`}
      id="nc-lab-mobile-queue-sheet"
      placement="bottom"
    >
      <LabQueueBody
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
