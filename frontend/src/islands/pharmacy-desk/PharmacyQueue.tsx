/**
 * PharmacyQueue — waiting / in-pharmacy patients.
 */

import type { PharmacyQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ChevronRight } from 'lucide-react';
import { PharmacyQueueCardBadges } from './PharmacyQueueCardBadges';
import { PharmacyQueuePanel } from './pharmacyDeskUi';

interface PharmacyQueueProps {
  cards: PharmacyQueueCard[];
  hasActiveWork: boolean;
  loading: boolean;
  error: string | null;
  onSelectVisit: (card: PharmacyQueueCard) => void;
}

function formatState(state: PharmacyQueueCard['state']): string {
  return state === 'in_pharmacy' ? 'In pharmacy' : 'Ready';
}

function PharmacyQueueCardButton({
  card,
  disabled,
  onSelect,
}: {
  card: PharmacyQueueCard;
  disabled: boolean;
  onSelect: (card: PharmacyQueueCard) => void;
}) {
  const isClaimLost = !!card.claim_lost;
  const isUrgent = card.is_urgent === 1;
  const actionLabel = card.state === 'in_pharmacy' ? 'Open' : 'Take';

  return (
    <button
      type="button"
      className={[
        'nc-pharmacy-queue-card',
        isUrgent && 'nc-pharmacy-queue-card--urgent',
        isClaimLost && 'nc-pharmacy-queue-card--claim-lost',
        disabled && 'nc-pharmacy-queue-card--disabled',
      ].filter(Boolean).join(' ')}
      data-visit-id={card.id}
      data-from-state={card.state}
      disabled={disabled || isClaimLost}
      title={disabled ? 'Complete your current patient first' : undefined}
      onClick={() => !disabled && !isClaimLost && onSelect(card)}
    >
      <span className="nc-pharmacy-queue-card__number" aria-hidden="true">
        {card.queue_number}
      </span>
      <span className="nc-pharmacy-queue-card__body">
        <span className="nc-pharmacy-queue-card__top">
          <strong className="nc-pharmacy-queue-card__name">{card.display_name}</strong>
          <PharmacyQueueCardBadges card={card} />
        </span>
        <span className="nc-pharmacy-queue-card__meta">
          {formatState(card.state)}
          {' · '}
          <WaitTimeSpan card={card} suffix="" />
          {card.visit_type_label ? ` · ${card.visit_type_label}` : ''}
        </span>
      </span>
      {!disabled && !isClaimLost && (
        <span className="nc-pharmacy-queue-card__action" aria-hidden="true">
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

export function PharmacyQueueBody({
  cards,
  hasActiveWork,
  loading,
  error,
  onSelectVisit,
}: PharmacyQueueProps) {
  return (
    <>
      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {hasActiveWork && cards.some((c) => c.state === 'ready_for_pharmacy') && (
        <p className="nc-pharmacy-queue-hint">
          Finish your current patient before taking another from the queue.
        </p>
      )}

      {loading && cards.length === 0 && (
        <div className="nc-pharmacy-queue-empty"><em>Loading queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="nc-pharmacy-queue-empty">
          <em>No pharmacy work pending.</em>
          <span className="nc-pharmacy-queue-empty__sub">Skipped patients appear on Visit Board.</span>
        </div>
      )}

      <div id="nc-pharmacy-queue-list" className="nc-pharmacy-queue-list">
        {cards.map((card) => {
          const disabled = hasActiveWork && card.state === 'ready_for_pharmacy';
          return (
            <PharmacyQueueCardButton
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

export function PharmacyQueue(props: PharmacyQueueProps) {
  return (
    <PharmacyQueuePanel title="Pharmacy queue" count={props.cards.length}>
      <PharmacyQueueBody {...props} />
    </PharmacyQueuePanel>
  );
}
