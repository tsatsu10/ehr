/**
 * LabQueue — waiting / in-lab patients with take/open affordance.
 */

import type { LabQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ChevronRight } from 'lucide-react';
import { LabQueueCardBadges } from './LabQueueCardBadges';
import { LabQueuePanel } from './labDeskUi';

interface LabQueueProps {
  cards: LabQueueCard[];
  hasActiveWork: boolean;
  loading: boolean;
  error: string | null;
  onSelectVisit: (card: LabQueueCard) => void;
}

function formatState(state: LabQueueCard['state']): string {
  return state === 'in_lab' ? 'In lab' : 'Ready';
}

function LabQueueCardButton({
  card,
  disabled,
  onSelect,
}: {
  card: LabQueueCard;
  disabled: boolean;
  onSelect: (card: LabQueueCard) => void;
}) {
  const isClaimLost = !!card.claim_lost;
  const isUrgent = card.is_urgent === 1;
  const actionLabel = card.state === 'in_lab' ? 'Open' : 'Take';

  return (
    <button
      type="button"
      className={[
        'nc-lab-queue-card',
        isUrgent && 'nc-lab-queue-card--urgent',
        isClaimLost && 'nc-lab-queue-card--claim-lost',
        disabled && 'nc-lab-queue-card--disabled',
      ].filter(Boolean).join(' ')}
      data-visit-id={card.id}
      data-from-state={card.state}
      disabled={disabled || isClaimLost}
      title={disabled ? 'Complete your current patient first' : undefined}
      onClick={() => !disabled && !isClaimLost && onSelect(card)}
    >
      <span className="nc-lab-queue-card__number" aria-hidden="true">
        {card.queue_number}
      </span>
      <span className="nc-lab-queue-card__body">
        <span className="nc-lab-queue-card__top">
          <strong className="nc-lab-queue-card__name">{card.display_name}</strong>
          <LabQueueCardBadges card={card} />
        </span>
        <span className="nc-lab-queue-card__meta">
          {formatState(card.state)}
          {' · '}
          <WaitTimeSpan card={card} suffix="" />
          {card.visit_type_label ? ` · ${card.visit_type_label}` : ''}
        </span>
      </span>
      {!disabled && !isClaimLost && (
        <span className="nc-lab-queue-card__action" aria-hidden="true">
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

export function LabQueueBody({
  cards,
  hasActiveWork,
  loading,
  error,
  onSelectVisit,
}: LabQueueProps) {
  return (
    <>
      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {hasActiveWork && cards.some((c) => c.state === 'ready_for_lab') && (
        <p className="nc-lab-queue-hint">
          Finish your current patient before taking another from the queue.
        </p>
      )}

      {loading && cards.length === 0 && (
        <div className="nc-lab-queue-empty"><em>Loading queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="nc-lab-queue-empty">
          <em>No lab work pending.</em>
          <span className="nc-lab-queue-empty__sub">Skipped patients appear on Visit Board.</span>
        </div>
      )}

      <div id="nc-lab-queue-list" className="nc-lab-queue-list">
        {cards.map((card) => {
          const disabled = hasActiveWork && card.state === 'ready_for_lab';
          return (
            <LabQueueCardButton
              key={card.id}
              card={card}
              disabled={disabled}
              onSelect={onSelectVisit}
            />
          );
        })}
      </div>
    </>
  );
}

export function LabQueue(props: LabQueueProps) {
  return (
    <LabQueuePanel title="Lab queue" count={props.cards.length}>
      <LabQueueBody {...props} />
    </LabQueuePanel>
  );
}
