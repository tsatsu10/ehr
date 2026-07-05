import type { LabQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  queueCardHeaderClass,
  queueCardMetaClass,
  queueCardShellClass,
} from '@components/queueCardStyles';

interface LabQueueProps {
  cards: LabQueueCard[];
  hasActiveWork: boolean;
  loading: boolean;
  error: string | null;
  labOpsUrl?: string | null;
  onSelectVisit: (card: LabQueueCard) => void;
}

export function LabQueue({
  cards,
  hasActiveWork,
  loading,
  error,
  labOpsUrl,
  onSelectVisit,
}: LabQueueProps) {
  return (
    <div className="nc-lab-queue-panel">
      <div className="mb-2">
        <strong>Lab queue</strong>
      </div>

      {labOpsUrl && (
        <Button variant="outline" size="sm" className="mb-2" asChild>
          <a href={labOpsUrl} target="_top">
            Lab Operations
          </a>
        </Button>
      )}

      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {loading && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-2"><em>Loading lab queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-3"><em>No lab work pending.</em></div>
      )}

      <div id="nc-lab-queue-list">
        {cards.map((card) => {
          const disabled = hasActiveWork && card.state === 'ready_for_lab';
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
                {card.lab_mine && <Badge className="ml-1">You</Badge>}
                {card.lab_actor_name && !card.lab_mine && (
                  <Badge variant="info" className="ml-1">{card.lab_actor_name}</Badge>
                )}
                {(card.order_count ?? 0) > 0 && (
                  <Badge variant="outline" className="ml-1">{card.order_count} orders</Badge>
                )}
                {(card.unreleased_count ?? 0) > 0 && (
                  <Badge variant="warning" className="ml-1">{card.unreleased_count} unreleased</Badge>
                )}
              </div>
              <div className={queueCardMetaClass}>
                {card.state} · <WaitTimeSpan card={card} suffix="" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[var(--oe-nc-text-muted)] text-sm mt-3 mb-0">
        Skipped lab patients appear on Visit Board under Pharmacy or Payment.
      </p>
    </div>
  );
}
