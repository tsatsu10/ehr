/**
 * TriageQueue — left-column queue panel with polling.
 *
 * Visual modifiers: triageMine (in triage with you), muted (in triage elsewhere), active (selected).
 */

import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { StatusPill } from '@components/StatusPill';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import {
  queueCardHeaderClass,
  queueCardMetaClass,
  queueCardShellClass,
} from '@components/queueCardStyles';
import { cn } from '@/lib/utils';
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
      <div className="mb-2 flex items-center justify-between">
        <strong>Queue</strong>
      </div>

      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {loading && cards.length === 0 && (
        <div aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="nc-vb-skeleton nc-vb-skeleton--card mb-2" aria-hidden="true" />
          ))}
        </div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-3 text-sm">
          <em>
            {queueDateFilter
              ? `No visits for ${queueDateFilter}. Start a visit at Front Desk or refresh within 30s.`
              : 'No patients in the triage queue. Start a visit at Front Desk or refresh within 30s.'}
          </em>
        </div>
      )}

      <div role="list" aria-label="Triage queue">
        {cards.map((card) => {
          const heldByOther = isHeldByOtherNurse(card);
          const disabled = !!card.claim_lost || heldByOther;
          const triageMine = card.state === 'in_triage' && !!card.triage_mine;

          return (
          <div key={card.id} role="listitem">
            <button
              type="button"
              className={queueCardShellClass({
                active: card.id === activeVisitId,
                claimLost: !!card.claim_lost,
                urgent: !!card.is_urgent,
                triageMine,
                muted: heldByOther,
                disabled: heldByOther,
              })}
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
              <div className={cn(queueCardHeaderClass, 'justify-between')}>
                <span>
                  <strong>#{card.queue_number} {card.display_name}</strong>
                  {!!card.is_urgent && (
                    <Badge variant="warning" className="ml-1">URGENT</Badge>
                  )}
                  <AncillaryVisitBadges badges={card.ancillary_badges} />
                  {card.claim_lost && (
                    <Badge variant="neutral" className="ml-1">Claimed</Badge>
                  )}
                </span>
              </div>

              <div className={queueCardMetaClass}>
                {card.sex} · {card.age_years} · <WaitTimeSpan card={card as Pick<VisitCard, 'wait_minutes' | 'wait_label' | 'visit_date'>} suffix=" waiting" />
                {' · '}
                {triageSubtitle(card)}
              </div>

              <div className="mt-1">
                <StatusPill state={card.state as VisitState} />
              </div>
            </button>
          </div>
          );
        })}
      </div>

      {cards.length > 0 && (
        <p className="text-[var(--oe-nc-text-muted)] text-sm mt-3 mb-0">
          Patients who skipped triage appear on Visit Board → Doctor, not here.
        </p>
      )}
    </div>
  );
}
