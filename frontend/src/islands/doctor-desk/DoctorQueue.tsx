/**
 * DoctorQueue — right column queue list + done today + reopen sections.
 */

import { useState } from 'react';
import type {
  DoctorDoneTodayRow,
  DoctorQueueCard,
  DoctorReopenableRow,
} from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { RoutingChips } from '@components/RoutingChips';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  queueCardCcClass,
  queueCardHeaderClass,
  queueCardMetaClass,
  queueCardShellClass,
} from '@components/queueCardStyles';
import { cn } from '@/lib/utils';

interface DoctorQueueProps {
  cards: DoctorQueueCard[];
  doneToday: DoctorDoneTodayRow[];
  reopenableToday: DoctorReopenableRow[];
  canReopenConsult: boolean;
  hasActiveConsult: boolean;
  loading: boolean;
  error: string | null;
  onTakePatient: (card: DoctorQueueCard) => void;
  onReopenClick: (row: DoctorReopenableRow) => void;
}

function DoctorQueueCardButton({
  card,
  disabled,
  onTake,
}: {
  card: DoctorQueueCard;
  disabled: boolean;
  onTake: (card: DoctorQueueCard) => void;
}) {
  const isClaimLost = !!card.claim_lost;

  const claimLostTitle =
    isClaimLost && card.claim_lost_by
      ? `${card.claim_lost_by.role_label} ${card.claim_lost_by.display_name} took this patient`
      : undefined;

  return (
    <button
      type="button"
      className={queueCardShellClass({
        urgent: Boolean(card.is_urgent),
        claimLost: isClaimLost,
      })}
      data-visit-id={card.id}
      data-from-state="ready_for_doctor"
      disabled={disabled || isClaimLost}
      title={disabled ? 'Complete your current patient first' : claimLostTitle}
      onClick={() => !disabled && !isClaimLost && onTake(card)}
    >
      <div className={cn(queueCardHeaderClass, 'justify-between')}>
        <span>
          <strong>#{card.queue_number} {card.display_name}</strong>
          {card.is_urgent === 1 && (
            <Badge variant="warning" className="ml-1">URGENT</Badge>
          )}
          {card.skipped_triage && (
            <Badge variant="neutral" className="ml-1">Skipped triage</Badge>
          )}
          <AncillaryVisitBadges badges={card.ancillary_badges} />
          {card.assigned_provider_name && (
            <Badge variant="info" className="ml-1">
              Appt: {card.assigned_provider_name}
            </Badge>
          )}
          {card.routing_suggested_provider_name && (
            <Badge className="ml-1" title="Advisory routing suggestion">
              Routing suggests: {card.routing_suggested_provider_name}
            </Badge>
          )}
          {card.hard_assigned_provider_name && (
            <Badge
              variant="neutral"
              className="ml-1 border-transparent bg-slate-800 text-white"
              title="Hard-assigned provider"
            >
              Assigned: {card.hard_assigned_provider_name}
            </Badge>
          )}
          <RoutingChips chips={card.routing_chips} />
        </span>
      </div>
      <div className={queueCardMetaClass}>
        {card.sex} · {card.age_years} · <WaitTimeSpan card={card} suffix=" waiting" /> · {card.visit_type_label}
      </div>
      {card.chief_complaint && (
        <div className={queueCardCcClass}>
          CC: {card.chief_complaint}
        </div>
      )}
    </button>
  );
}

export function DoctorQueue({
  cards,
  doneToday,
  reopenableToday,
  canReopenConsult,
  hasActiveConsult,
  loading,
  error,
  onTakePatient,
  onReopenClick,
}: DoctorQueueProps) {
  const [doneOpen, setDoneOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  return (
    <div className="nc-doctor-queue-panel">
      <div className="mb-2 flex items-center justify-between">
        <strong>My queue</strong>
      </div>

      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {!error && loading && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-3"><em>Loading queue…</em></div>
      )}

      {!error && !loading && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-3">
          <em>No patients ready. New visits appear within 30s.</em>
        </div>
      )}

      <div id="nc-doctor-queue-list">
        {cards.map((card) => (
          <DoctorQueueCardButton
            key={card.id}
            card={card}
            disabled={hasActiveConsult}
            onTake={onTakePatient}
          />
        ))}
      </div>

      {canReopenConsult && (
        <div className="mt-3" id="nc-doctor-reopen-section">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            id="nc-doctor-reopen-toggle"
            onClick={() => setReopenOpen((v) => !v)}
          >
            Reopen consult ({reopenableToday.length})
          </Button>
          {reopenOpen && (
            <div id="nc-doctor-reopen-list" className="mt-2">
              {reopenableToday.length === 0 ? (
                <div className="text-sm text-[var(--oe-nc-text-muted)]">None sent out today</div>
              ) : (
                reopenableToday.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start justify-between border-b py-1"
                  >
                    <div className="text-sm">
                      <div>#{row.queue_number} {row.display_name}</div>
                      <div className="text-[var(--oe-nc-text-muted)]">{row.state.replace(/_/g, ' ')}</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="nc-doctor-reopen-btn border-amber-400 text-amber-800 hover:bg-amber-50"
                      data-visit-id={row.id}
                      onClick={() => onReopenClick(row)}
                    >
                      Reopen
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          id="nc-doctor-done-toggle"
          onClick={() => setDoneOpen((v) => !v)}
        >
          Done today ({doneToday.length})
        </Button>
        {doneOpen && (
          <div id="nc-doctor-done-list" className="mt-2">
            {doneToday.length === 0 ? (
              <div className="text-sm text-[var(--oe-nc-text-muted)]">None yet today</div>
            ) : (
              doneToday.map((row) => (
                <div key={row.id} className="text-sm text-[var(--oe-nc-text-muted)] py-1">
                  #{row.queue_number} {row.display_name}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
