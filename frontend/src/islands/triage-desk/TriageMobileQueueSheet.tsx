import { SlideOver } from '@components/SlideOver';
import { Button } from '@components/ui/button';
import type { TriageQueueCard } from '@core/types';
import { TriageQueueBody } from './TriageQueue';

interface TriageMobileQueueSheetProps {
  open: boolean;
  onClose: () => void;
  queueCount: number;
  cards: TriageQueueCard[];
  activeVisitId: number | null;
  inActiveWork: boolean;
  loading: boolean;
  error: string | null;
  queueDateFilter?: string | null;
  onCardClick: (card: TriageQueueCard) => void;
}

export function TriageMobileQueueBar({
  queueCount,
  inActiveWork,
  onOpen,
}: {
  queueCount: number;
  inActiveWork: boolean;
  onOpen: () => void;
}) {
  if (inActiveWork) {
    return null;
  }

  const label = queueCount > 0
    ? `${queueCount} patient${queueCount === 1 ? '' : 's'} in queue`
    : 'Triage queue';

  return (
    <div className="nc-triage-mobile-queue-bar">
      <Button
        type="button"
        variant="outline"
        className="nc-triage-mobile-queue-bar__btn"
        onClick={onOpen}
        aria-haspopup="dialog"
      >
        {label}
      </Button>
    </div>
  );
}

export function TriageMobileQueueSheet({
  open,
  onClose,
  queueCount,
  cards,
  activeVisitId,
  inActiveWork: _inActiveWork,
  loading,
  error,
  queueDateFilter,
  onCardClick,
}: TriageMobileQueueSheetProps) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Triage queue (${queueCount})`}
      id="nc-triage-mobile-queue-sheet"
      placement="bottom"
    >
      <TriageQueueBody
        cards={cards}
        activeVisitId={activeVisitId}
        loading={loading}
        error={error}
        queueDateFilter={queueDateFilter}
        onCardClick={(card) => {
          onCardClick(card);
          onClose();
        }}
      />
    </SlideOver>
  );
}
