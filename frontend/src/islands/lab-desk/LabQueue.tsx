import type { LabQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';

interface LabQueueProps {
  cards: LabQueueCard[];
  counts: { waiting: number; in_lab: number } | null;
  hasActiveWork: boolean;
  loading: boolean;
  error: string | null;
  labOpsUrl?: string | null;
  onSelectVisit: (card: LabQueueCard) => void;
}

export function LabQueue({
  cards,
  counts,
  hasActiveWork,
  loading,
  error,
  labOpsUrl,
  onSelectVisit,
}: LabQueueProps) {
  return (
    <div className="nc-lab-queue-panel">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>Lab queue</strong>
        {counts && (
          <span className="text-muted small" id="nc-lab-counts">
            {counts.waiting} waiting
          </span>
        )}
      </div>

      {labOpsUrl && (
        <a className="btn btn-outline-secondary btn-sm mb-2 d-inline-block" href={labOpsUrl} target="_top">
          Lab Operations
        </a>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && cards.length === 0 && (
        <div className="text-muted py-2"><em>Loading lab queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-muted py-3"><em>No lab work pending.</em></div>
      )}

      <div id="nc-lab-queue-list">
        {cards.map((card) => {
          const disabled = hasActiveWork && card.state === 'ready_for_lab';
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
                {card.lab_mine && <span className="badge badge-primary ml-1">You</span>}
                {card.lab_actor_name && !card.lab_mine && (
                  <span className="badge badge-info ml-1">{card.lab_actor_name}</span>
                )}
                {(card.order_count ?? 0) > 0 && (
                  <span className="badge badge-light border ml-1">{card.order_count} orders</span>
                )}
                {(card.unreleased_count ?? 0) > 0 && (
                  <span className="badge badge-warning ml-1">{card.unreleased_count} unreleased</span>
                )}
              </div>
              <div className="oe-nc-queue-card__meta small text-muted">
                {card.state} · <WaitTimeSpan card={card} suffix="" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-muted small mt-3 mb-0">
        Skipped lab patients appear on Visit Board under Pharmacy or Payment.
      </p>
    </div>
  );
}
