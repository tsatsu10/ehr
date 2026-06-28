import { useState } from 'react';
import type { CashierPaidTodayRow, CashierQueueCard } from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { formatMoney } from './cashierUtils';
import { PatientSearchPanel, type PatientSearchHint } from './PatientSearchPanel';

interface CashierQueueProps {
  ajaxUrl: string;
  csrfToken: string;
  cards: CashierQueueCard[];
  counts: { waiting: number; paid_today: number } | null;
  paidToday: CashierPaidTodayRow[];
  loading: boolean;
  error: string | null;
  blocked: boolean;
  searchHint: PatientSearchHint | null;
  onSelectVisit: (card: CashierQueueCard) => void;
  onSelectPatient: (pid: number) => void;
}

export function CashierQueue({
  ajaxUrl,
  csrfToken,
  cards,
  counts,
  paidToday,
  loading,
  error,
  blocked,
  searchHint,
  onSelectVisit,
  onSelectPatient,
}: CashierQueueProps) {
  const [paidOpen, setPaidOpen] = useState(false);

  return (
    <div className="nc-cashier-queue-panel">
      <PatientSearchPanel
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        blocked={blocked}
        hint={searchHint}
        onSelectPatient={onSelectPatient}
      />

      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>Payment queue</strong>
        {counts && (
          <span className="text-muted small" id="nc-cashier-counts">
            {counts.waiting} waiting
          </span>
        )}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading && cards.length === 0 && (
        <div className="text-muted py-2"><em>Loading payment queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-muted py-3"><em>No patients waiting for payment.</em></div>
      )}

      <div id="nc-cashier-queue-list">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`oe-nc-queue-card btn btn-light text-left w-100 mb-2 nc-queue-card${
              card.is_urgent ? ' oe-nc-queue-card--urgent' : ''
            }`}
            data-visit-id={card.id}
            onClick={() => onSelectVisit(card)}
          >
            <div className="oe-nc-queue-card__header">
              <strong>#{card.queue_number} {card.display_name}</strong>
              {card.is_urgent === 1 && <span className="badge badge-warning ml-1">URGENT</span>}
              {card.charges_total > 0 ? (
                <span className="badge badge-light border ml-1">{formatMoney(card.charges_total)}</span>
              ) : (
                <span className="badge badge-warning ml-1">No charges</span>
              )}
            </div>
            <div className="oe-nc-queue-card__meta small text-muted">
              <WaitTimeSpan card={card} suffix="" /> · {card.visit_type_label}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="btn btn-link btn-sm p-0"
          id="nc-cashier-done-toggle"
          onClick={() => setPaidOpen((v) => !v)}
        >
          Paid today ({counts?.paid_today ?? paidToday.length})
        </button>
        {paidOpen && (
          <div id="nc-cashier-paid-list" className="mt-2">
            {paidToday.length === 0 ? (
              <div className="small text-muted">None yet today</div>
            ) : (
              paidToday.map((row) => (
                <div key={row.id} className="small text-muted py-1 d-flex flex-wrap align-items-center">
                  <span>
                    #{row.queue_number} {row.display_name}
                  </span>
                  {row.charge_correction_url && (
                    <a
                      className="btn btn-link btn-sm p-0 ml-2"
                      href={row.charge_correction_url}
                      target="_top"
                    >
                      {row.charge_correction_label || 'Add correction'}
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
