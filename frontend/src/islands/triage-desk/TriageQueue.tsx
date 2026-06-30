/**
 * TriageQueue — left-column queue panel with polling.
 *
 * Mirrors the #nc-triage-queue-list + renderQueueCard() from triage.js.
 * Visual modifiers: mine (in triage with you), muted (in triage elsewhere), active (selected).
 */

import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { StatusPill } from '@components/StatusPill';
import type { TriageQueueCard, VisitCard, VisitState } from '@core/types';

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

function cardModifiers(card: TriageQueueCard, activeVisitId: number | null): string {
  const parts: string[] = ['nc-queue-card', 'oe-nc-queue-card', 'btn', 'btn-light', 'text-left', 'w-100', 'mb-2'];
  if (card.id === activeVisitId) parts.push('oe-nc-queue-card--active');
  if (card.claim_lost) parts.push('oe-nc-queue-card--claim-lost');
  if (card.is_urgent) parts.push('oe-nc-queue-card--urgent');
  if (card.state === 'in_triage' && card.triage_mine) parts.push('oe-nc-triage-card--mine');
  if (isHeldByOtherNurse(card)) parts.push('oe-nc-triage-card--muted', 'oe-nc-queue-card--disabled');
  return parts.join(' ');
}

function triageSubtitle(card: TriageQueueCard): string {
  if (card.state === 'waiting') return 'Waiting';
  if (card.triage_mine) return 'In triage · With you';
  if (card.triage_actor_name) return `In triage · ${card.triage_actor_name}`;
  return 'In triage';
}

export function TriageQueue({
  cards,
  activeVisitId,
  loading,
  error,
  queueDateFilter,
  onCardClick,
}: TriageQueueProps) {
  return (
    <div className="nc-triage-queue-panel">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>Queue</strong>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger py-2 small" role="alert">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && cards.length === 0 && (
        <div aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="oe-nc-vb-skeleton oe-nc-vb-skeleton--card mb-2" aria-hidden="true" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && cards.length === 0 && (
        <div className="text-muted py-3 small">
          <em>
            {queueDateFilter
              ? `No visits for ${queueDateFilter}. Start a visit at Front Desk or refresh within 30s.`
              : 'No patients in the triage queue. Start a visit at Front Desk or refresh within 30s.'}
          </em>
        </div>
      )}

      {/* Cards */}
      <div role="list" aria-label="Triage queue">
        {cards.map((card) => {
          const heldByOther = isHeldByOtherNurse(card);
          const disabled = !!card.claim_lost || heldByOther;
          return (
          <div key={card.id} role="listitem">
            <button
              type="button"
              className={cardModifiers(card, activeVisitId)}
              data-visit-id={card.id}
              disabled={disabled}
              title={
                card.claim_lost && card.claim_lost_by
                  ? `${card.claim_lost_by.role_label} ${card.claim_lost_by.display_name} took this patient`
                  : heldByOther && card.triage_actor_name
                    ? `In triage with ${card.triage_actor_name}`
                    : undefined
              }
              onClick={() => !disabled && onCardClick(card)}
              aria-pressed={card.id === activeVisitId}
            >
              {/* Header */}
              <div className="oe-nc-queue-card__header d-flex justify-content-between align-items-start flex-wrap">
                <span>
                  <strong>#{card.queue_number} {card.display_name}</strong>
                  {!!card.is_urgent && (
                    <span className="badge badge-warning ml-1">URGENT</span>
                  )}
                  {card.claim_lost && (
                    <span className="badge badge-secondary ml-1">Claimed</span>
                  )}
                </span>
              </div>

              {/* Subtitle */}
              <div className="oe-nc-queue-card__meta small text-muted">
                {card.sex} · {card.age_years} · <WaitTimeSpan card={card as Pick<VisitCard, 'wait_minutes' | 'wait_label' | 'visit_date'>} suffix=" waiting" />
                {' · '}
                {triageSubtitle(card)}
              </div>

              {/* State pill */}
              <div className="mt-1">
                <StatusPill state={card.state as VisitState} />
              </div>
            </button>
          </div>
          );
        })}
      </div>

      {/* Skipped-triage hint */}
      {cards.length > 0 && (
        <p className="text-muted small mt-3 mb-0">
          Patients who skipped triage appear on Visit Board → Doctor, not here.
        </p>
      )}
    </div>
  );
}
