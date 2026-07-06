import { SlideOver } from '@components/SlideOver';
import { Button } from '@components/ui/button';
import type { CashierPaidTodayRow, CashierQueueCard } from '@core/types';
import { CashierQueueBody, CashierQueueSearch } from './CashierQueue';
import { CashierPaidTodayList } from './CashierPaidTodayList';
import type { PatientSearchHint } from './PatientSearchPanel';

interface CashierMobileQueueSheetProps {
  open: boolean;
  onClose: () => void;
  waitingCount: number;
  ajaxUrl: string;
  csrfToken: string;
  cards: CashierQueueCard[];
  paidToday: CashierPaidTodayRow[];
  loading: boolean;
  error: string | null;
  blocked: boolean;
  searchHint: PatientSearchHint | null;
  onSelectVisit: (card: CashierQueueCard) => void;
  onSelectPatient: (pid: number) => void;
}

export function CashierMobileQueueBar({
  waitingCount,
  inCheckout,
  onOpen,
}: {
  waitingCount: number;
  inCheckout: boolean;
  onOpen: () => void;
}) {
  if (inCheckout) {
    return null;
  }

  const label = waitingCount > 0
    ? `${waitingCount} patient${waitingCount === 1 ? '' : 's'} waiting`
    : 'Payment queue';

  return (
    <div className="nc-cashier-mobile-queue-bar">
      <Button
        type="button"
        variant="outline"
        className="nc-cashier-mobile-queue-bar__btn"
        onClick={onOpen}
        aria-haspopup="dialog"
      >
        {label}
      </Button>
    </div>
  );
}

export function CashierMobileQueueSheet({
  open,
  onClose,
  waitingCount,
  ajaxUrl,
  csrfToken,
  cards,
  paidToday,
  loading,
  error,
  blocked,
  searchHint,
  onSelectVisit,
  onSelectPatient,
}: CashierMobileQueueSheetProps) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Payment queue (${waitingCount})`}
      id="nc-cashier-mobile-queue-sheet"
      placement="bottom"
    >
      <CashierQueueSearch
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        blocked={blocked}
        searchHint={searchHint}
        onSelectPatient={(pid) => {
          onSelectPatient(pid);
          onClose();
        }}
      />
      <CashierQueueBody
        cards={cards}
        loading={loading}
        error={error}
        blocked={blocked}
        onSelectVisit={(card) => {
          onSelectVisit(card);
          onClose();
        }}
      />
      <CashierPaidTodayList paidToday={paidToday} />
    </SlideOver>
  );
}
