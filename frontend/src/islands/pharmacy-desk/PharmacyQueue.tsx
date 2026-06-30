import type { PharmacyQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';

interface PharmacyQueueProps {
  cards: PharmacyQueueCard[];
  hasActiveWork: boolean;
  loading: boolean;
  error: string | null;
  onSelectVisit: (card: PharmacyQueueCard) => void;
}

export function PharmacyQueue({
  cards,
  hasActiveWork,
  loading,
  error,
  onSelectVisit,
}: PharmacyQueueProps) {
  return (
    <div className="nc-pharmacy-queue-panel">
      <div className="mb-2">
        <strong>Pharmacy queue</strong>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && cards.length === 0 && (
        <div className="text-muted py-2"><em>Loading pharmacy queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-muted py-3"><em>No pharmacy work pending.</em></div>
      )}

      <div id="nc-pharmacy-queue-list">
        {cards.map((card) => {
          const disabled = hasActiveWork && card.state === 'ready_for_pharmacy';
          const rxBadgeLabel = card.undispensed_rx_count != null
            ? (card.undispensed_rx_count > 0 ? `${card.undispensed_rx_count} Rx undispensed` : null)
            : (card.rx_count ?? 0) > 0
              ? `${card.rx_count} Rx`
              : null;

          return (
            <button
              key={card.id}
              type="button"
              className={`oe-nc-queue-card btn btn-light text-left w-100 mb-2 nc-queue-card${
                card.is_urgent ? ' oe-nc-queue-card--urgent' : ''
              }${card.claim_lost ? ' oe-nc-queue-card--claim-lost' : ''}`}
              data-visit-id={card.id}
              data-from-state={card.state}
              disabled={disabled}
              title={disabled ? 'Complete your current patient first' : undefined}
              onClick={() => !disabled && onSelectVisit(card)}
            >
              <div className="oe-nc-queue-card__header">
                <strong>#{card.queue_number} {card.display_name}</strong>
                {card.is_urgent === 1 && <span className="badge badge-warning ml-1">URGENT</span>}
                {card.pharmacy_mine && <span className="badge badge-primary ml-1">You</span>}
                {card.pharmacy_actor_name && !card.pharmacy_mine && (
                  <span className="badge badge-info ml-1">{card.pharmacy_actor_name}</span>
                )}
                {rxBadgeLabel ? (
                  <span className="badge badge-light border ml-1">{rxBadgeLabel}</span>
                ) : null}
              </div>
              <div className="oe-nc-queue-card__meta small text-muted">
                {card.state} · <WaitTimeSpan card={card} suffix="" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-muted small mt-3 mb-0">
        Skipped pharmacy patients appear on Visit Board under Payment.
      </p>
    </div>
  );
}
