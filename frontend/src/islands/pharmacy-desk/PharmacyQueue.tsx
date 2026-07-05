import type { PharmacyQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import {
  queueCardHeaderClass,
  queueCardMetaClass,
  queueCardShellClass,
} from '@components/queueCardStyles';

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

      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {loading && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-2"><em>Loading pharmacy queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-3"><em>No pharmacy work pending.</em></div>
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
              className={queueCardShellClass({
                urgent: Boolean(card.is_urgent),
                claimLost: !!card.claim_lost,
              })}
              data-visit-id={card.id}
              data-from-state={card.state}
              disabled={disabled}
              title={disabled ? 'Complete your current patient first' : undefined}
              onClick={() => !disabled && onSelectVisit(card)}
            >
              <div className={queueCardHeaderClass}>
                <strong>#{card.queue_number} {card.display_name}</strong>
                {card.is_urgent === 1 && <Badge variant="warning" className="ml-1">URGENT</Badge>}
                <AncillaryVisitBadges badges={card.ancillary_badges} />
                {card.pharmacy_mine && <Badge className="ml-1">You</Badge>}
                {card.pharmacy_actor_name && !card.pharmacy_mine && (
                  <Badge variant="info" className="ml-1">{card.pharmacy_actor_name}</Badge>
                )}
                {rxBadgeLabel ? (
                  <Badge variant="outline" className="ml-1">{rxBadgeLabel}</Badge>
                ) : null}
              </div>
              <div className={queueCardMetaClass}>
                {card.state} · <WaitTimeSpan card={card} suffix="" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[var(--oe-nc-text-muted)] text-sm mt-3 mb-0">
        Skipped pharmacy patients appear on Visit Board under Payment.
      </p>
    </div>
  );
}
