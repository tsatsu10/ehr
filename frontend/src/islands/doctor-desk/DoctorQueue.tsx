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

interface DoctorQueueProps {
  cards: DoctorQueueCard[];
  counts: { waiting: number; done_today: number; reopenable_today: number } | null;
  doneToday: DoctorDoneTodayRow[];
  reopenableToday: DoctorReopenableRow[];
  canReopenConsult: boolean;
  hasActiveConsult: boolean;
  loading: boolean;
  error: string | null;
  multiDoctorFilters?: boolean;
  scope?: 'me' | 'all';
  onScopeChange?: (scope: 'me' | 'all') => void;
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
  const modifiers = [
    card.is_urgent ? 'oe-nc-queue-card--urgent' : '',
    isClaimLost ? 'oe-nc-queue-card--claim-lost' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const claimLostTitle =
    isClaimLost && card.claim_lost_by
      ? `${card.claim_lost_by.role_label} ${card.claim_lost_by.display_name} took this patient`
      : undefined;

  return (
    <button
      type="button"
      className={`oe-nc-queue-card btn btn-light text-left w-100 mb-2 nc-queue-card${modifiers ? ` ${modifiers}` : ''}`}
      data-visit-id={card.id}
      data-from-state="ready_for_doctor"
      disabled={disabled || isClaimLost}
      title={disabled ? 'Complete your current patient first' : claimLostTitle}
      onClick={() => !disabled && !isClaimLost && onTake(card)}
    >
      <div className="oe-nc-queue-card__header d-flex justify-content-between align-items-start flex-wrap">
        <span>
          <strong>#{card.queue_number} {card.display_name}</strong>
          {card.is_urgent === 1 && (
            <span className="badge badge-warning ml-1">URGENT</span>
          )}
          {card.skipped_triage && (
            <span className="badge badge-secondary ml-1">Skipped triage</span>
          )}
          {card.assigned_provider_name && (
            <span className="badge badge-info ml-1">
              Appt: {card.assigned_provider_name}
            </span>
          )}
          <RoutingChips chips={card.routing_chips} />
        </span>
      </div>
      <div className="oe-nc-queue-card__meta small text-muted">
        {card.sex} · {card.age_years} · <WaitTimeSpan card={card} suffix=" waiting" /> · {card.visit_type_label}
      </div>
      {card.chief_complaint && (
        <div className="oe-nc-queue-card__cc small text-muted text-truncate">
          CC: {card.chief_complaint}
        </div>
      )}
    </button>
  );
}

export function DoctorQueue({
  cards,
  counts,
  doneToday,
  reopenableToday,
  canReopenConsult,
  hasActiveConsult,
  loading,
  error,
  multiDoctorFilters = false,
  scope = 'me',
  onScopeChange,
  onTakePatient,
  onReopenClick,
}: DoctorQueueProps) {
  const [doneOpen, setDoneOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  return (
    <div className="nc-doctor-queue-panel">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>My queue</strong>
        <div className="d-flex align-items-center">
          {counts && (
            <span className="text-muted small mr-2" id="nc-doctor-counts">
              {counts.waiting} waiting
            </span>
          )}
          {multiDoctorFilters && onScopeChange && (
            <select
              className="form-control form-control-sm mr-2"
              style={{ maxWidth: 120 }}
              id="nc-doctor-scope"
              value={scope}
              onChange={(e) => onScopeChange(e.target.value === 'all' ? 'all' : 'me')}
              aria-label="Queue scope"
            >
              <option value="me">Me</option>
              <option value="all">All</option>
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      {!error && loading && cards.length === 0 && (
        <div className="text-muted py-3"><em>Loading queue…</em></div>
      )}

      {!error && !loading && cards.length === 0 && (
        <div className="text-muted py-3">
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
          <button
            type="button"
            className="btn btn-link btn-sm p-0"
            id="nc-doctor-reopen-toggle"
            onClick={() => setReopenOpen((v) => !v)}
          >
            Reopen consult ({counts?.reopenable_today ?? reopenableToday.length})
          </button>
          {reopenOpen && (
            <div id="nc-doctor-reopen-list" className="mt-2">
              {reopenableToday.length === 0 ? (
                <div className="small text-muted">None sent out today</div>
              ) : (
                reopenableToday.map((row) => (
                  <div
                    key={row.id}
                    className="d-flex justify-content-between align-items-start py-1 border-bottom"
                  >
                    <div className="small">
                      <div>#{row.queue_number} {row.display_name}</div>
                      <div className="text-muted">{row.state.replace(/_/g, ' ')}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-warning btn-sm nc-doctor-reopen-btn"
                      data-visit-id={row.id}
                      onClick={() => onReopenClick(row)}
                    >
                      Reopen
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          id="nc-doctor-done-toggle"
          onClick={() => setDoneOpen((v) => !v)}
        >
          Done today ({counts?.done_today ?? doneToday.length})
        </button>
        {doneOpen && (
          <div id="nc-doctor-done-list" className="mt-2">
            {doneToday.length === 0 ? (
              <div className="small text-muted">None yet today</div>
            ) : (
              doneToday.map((row) => (
                <div key={row.id} className="small text-muted py-1">
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
