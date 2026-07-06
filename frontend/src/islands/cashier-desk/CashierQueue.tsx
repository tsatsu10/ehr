/**
 * CashierQueue — patients waiting for payment.
 */

import type { CashierPaidTodayRow, CashierQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ChevronRight } from 'lucide-react';
import { CashierQueueCardBadges } from './CashierQueueCardBadges';
import { CashierPaidTodayList } from './CashierPaidTodayList';
import { PatientSearchPanel, type PatientSearchHint } from './PatientSearchPanel';
import { CashierQueuePanel } from './cashierDeskUi';

interface CashierQueueSearchProps {
  ajaxUrl: string;
  csrfToken: string;
  blocked: boolean;
  searchHint: PatientSearchHint | null;
  onSelectPatient: (pid: number) => void;
}

interface CashierQueueBodyProps {
  cards: CashierQueueCard[];
  loading: boolean;
  error: string | null;
  blocked: boolean;
  onSelectVisit: (card: CashierQueueCard) => void;
}

export function CashierQueueSearch({
  ajaxUrl,
  csrfToken,
  blocked,
  searchHint,
  onSelectPatient,
}: CashierQueueSearchProps) {
  return (
    <div className="nc-cashier-queue-search">
      <PatientSearchPanel
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        blocked={blocked}
        hint={searchHint}
        onSelectPatient={onSelectPatient}
      />
    </div>
  );
}

export function CashierQueueBody({
  cards,
  loading,
  error,
  blocked,
  onSelectVisit,
}: CashierQueueBodyProps) {
  return (
    <>
      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {loading && cards.length === 0 && (
        <div className="nc-cashier-queue-empty"><em>Loading payment queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="nc-cashier-queue-empty">
          <em>No patients waiting for payment.</em>
          <span className="nc-cashier-queue-empty__sub">Use Find patient for walk-in checkout.</span>
        </div>
      )}

      <div id="nc-cashier-queue-list" className="nc-cashier-queue-list">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={[
              'nc-cashier-queue-card',
              card.is_urgent === 1 && 'nc-cashier-queue-card--urgent',
              blocked && 'nc-cashier-queue-card--disabled',
            ].filter(Boolean).join(' ')}
            data-visit-id={card.id}
            disabled={blocked}
            onClick={() => !blocked && onSelectVisit(card)}
          >
            <span className="nc-cashier-queue-card__number" aria-hidden="true">
              {card.queue_number}
            </span>
            <span className="nc-cashier-queue-card__body">
              <span className="nc-cashier-queue-card__top">
                <strong className="nc-cashier-queue-card__name">{card.display_name}</strong>
                <CashierQueueCardBadges card={card} />
              </span>
              <span className="nc-cashier-queue-card__meta">
                Ready for payment
                {' · '}
                <WaitTimeSpan card={card} suffix="" />
                {card.visit_type_label ? ` · ${card.visit_type_label}` : ''}
              </span>
            </span>
            {!blocked && (
              <span className="nc-cashier-queue-card__action" aria-hidden="true">
                Open
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

interface CashierQueueProps extends CashierQueueSearchProps, CashierQueueBodyProps {
  paidToday: CashierPaidTodayRow[];
}

export function CashierQueue({
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
}: CashierQueueProps) {
  return (
    <CashierQueuePanel title="Payment queue" count={cards.length}>
      <CashierQueueSearch
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        blocked={blocked}
        searchHint={searchHint}
        onSelectPatient={onSelectPatient}
      />
      <CashierQueueBody
        cards={cards}
        loading={loading}
        error={error}
        blocked={blocked}
        onSelectVisit={onSelectVisit}
      />
      <CashierPaidTodayList paidToday={paidToday} />
    </CashierQueuePanel>
  );
}
