/**
 * TriageQueue — waiting / in-triage patients with open affordance.
 */

import type { TriageQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { ChevronRight } from 'lucide-react';
import { TriageQueueCardBadges } from './TriageQueueCardBadges';
import { TriageQueuePanel } from './triageDeskUi';

interface TriageQueueProps {
  cards: TriageQueueCard[];
  activeVisitId: number | null;
  loading: boolean;
  error: string | null;
  queueDateFilter?: string | null;
  onCardClick: (card: TriageQueueCard) => void;
}

/** In triage with another nurse — not unclaimed/orphan rows (those stay clickable). */
function isHeldByOtherNurse(card: TriageQueueCard): boolean {
  return card.state === 'in_triage'
    && !card.triage_mine
    && !!card.triage_actor_name;
}

function triageSubtitle(card: TriageQueueCard): string {
  if (card.state === 'waiting') return 'Waiting';
  if (card.triage_mine) return 'In triage · With you';
  if (card.triage_actor_name) return `In triage · ${card.triage_actor_name}`;
  return 'In triage';
}

function TriageQueueCardButton({
  card,
  activeVisitId,
  disabled,
  onClick,
}: {
  card: TriageQueueCard;
  activeVisitId: number | null;
  disabled: boolean;
  onClick: (card: TriageQueueCard) => void;
}) {
  const isActive = card.id === activeVisitId;
  const isClaimLost = !!card.claim_lost;
  const isUrgent = card.is_urgent === 1;
  const triageMine = card.state === 'in_triage' && !!card.triage_mine;
  const heldByOther = isHeldByOtherNurse(card);
  const actionLabel = card.state === 'in_triage' ? 'Open' : 'Take';

  return (
    <button
      type="button"
      className={[
        'nc-triage-queue-card',
        isUrgent && 'nc-triage-queue-card--urgent',
        isClaimLost && 'nc-triage-queue-card--claim-lost',
        heldByOther && 'nc-triage-queue-card--held',
        disabled && 'nc-triage-queue-card--disabled',
        isActive && 'nc-triage-queue-card--active',
        triageMine && 'nc-triage-queue-card--mine',
      ].filter(Boolean).join(' ')}
      data-visit-id={card.id}
      disabled={disabled}
      title={
        card.claim_lost && card.claim_lost_by
          ? `${card.claim_lost_by.role_label} ${card.claim_lost_by.display_name} took this patient`
          : heldByOther && card.triage_actor_name
            ? `In triage with ${card.triage_actor_name}`
            : undefined
      }
      onClick={() => !disabled && onClick(card)}
      aria-pressed={isActive}
      aria-label={`#${card.queue_number} ${card.display_name}`}
    >
      <span className="nc-triage-queue-card__number" aria-hidden="true">
        {card.queue_number}
      </span>
      <span className="nc-triage-queue-card__body">
        <span className="nc-triage-queue-card__top">
          <strong className="nc-triage-queue-card__name">{card.display_name}</strong>
          <TriageQueueCardBadges card={card} />
        </span>
        <span className="nc-triage-queue-card__meta">
          {card.sex} · {card.age_years}
          {' · '}
          <WaitTimeSpan card={card} suffix=" waiting" />
          {' · '}
          {triageSubtitle(card)}
        </span>
      </span>
      {!disabled && !isClaimLost && (
        <span className="nc-triage-queue-card__action" aria-hidden="true">
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

export function TriageQueueBody({
  cards,
  activeVisitId,
  loading,
  error,
  queueDateFilter,
  onCardClick,
}: TriageQueueProps) {
  return (
    <>
      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {loading && cards.length === 0 && (
        <div className="nc-triage-queue-empty"><em>Loading queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="nc-triage-queue-empty">
          <em>
            {queueDateFilter
              ? `No visits for ${queueDateFilter}. Start a visit at Front Desk or refresh within 30s.`
              : 'No patients in the triage queue. Start a visit at Front Desk or refresh within 30s.'}
          </em>
        </div>
      )}

      <div id="nc-triage-queue-list" className="nc-triage-queue-list" role="list" aria-label="Triage queue">
        {cards.map((card) => {
          const heldByOther = isHeldByOtherNurse(card);
          const disabled = !!card.claim_lost || heldByOther;
          return (
            <div key={card.id} role="listitem">
              <TriageQueueCardButton
                card={card}
                activeVisitId={activeVisitId}
                disabled={disabled}
                onClick={onCardClick}
              />
            </div>
          );
        })}
      </div>

      {cards.length > 0 && (
        <p className="nc-triage-queue-hint">
          Patients who skipped triage appear on Visit Board → Doctor, not here.
        </p>
      )}
    </>
  );
}

export function TriageQueue(props: TriageQueueProps) {
  return (
    <TriageQueuePanel title="Triage queue" count={props.cards.length}>
      <TriageQueueBody {...props} />
    </TriageQueuePanel>
  );
}
