import { useState } from 'react';
import type { CashierPaidTodayRow, CashierQueueCard } from '@core/types';
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
import { formatMoney } from './cashierUtils';
import { PatientSearchPanel, type PatientSearchHint } from './PatientSearchPanel';

interface CashierQueueProps {
  ajaxUrl: string;
  csrfToken: string;
  cards: CashierQueueCard[];
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

      <div className="mb-2 flex items-center justify-between">
        <strong>Payment queue</strong>
      </div>

      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {loading && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-2"><em>Loading payment queue…</em></div>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="text-[var(--oe-nc-text-muted)] py-3"><em>No patients waiting for payment.</em></div>
      )}

      <div id="nc-cashier-queue-list">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={queueCardShellClass({ urgent: Boolean(card.is_urgent) })}
            data-visit-id={card.id}
            onClick={() => onSelectVisit(card)}
          >
            <div className={queueCardHeaderClass}>
              <strong>#{card.queue_number} {card.display_name}</strong>
              {card.is_urgent === 1 && <Badge variant="warning" className="ml-1">URGENT</Badge>}
              <AncillaryVisitBadges badges={card.ancillary_badges} />
              {card.charges_total > 0 ? (
                <Badge variant="outline" className="ml-1">{formatMoney(card.charges_total)}</Badge>
              ) : (
                <Badge variant="warning" className="ml-1">No charges</Badge>
              )}
            </div>
            <div className={queueCardMetaClass}>
              <WaitTimeSpan card={card} suffix="" /> · {card.visit_type_label}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          id="nc-cashier-done-toggle"
          onClick={() => setPaidOpen((v) => !v)}
        >
          Paid today ({paidToday.length})
        </Button>
        {paidOpen && (
          <div id="nc-cashier-paid-list" className="mt-2">
            {paidToday.length === 0 ? (
              <div className="text-sm text-[var(--oe-nc-text-muted)]">None yet today</div>
            ) : (
              paidToday.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center py-1 text-sm text-[var(--oe-nc-text-muted)]">
                  <span>
                    #{row.queue_number} {row.display_name}
                  </span>
                  {row.charge_correction_url && (
                    <Button variant="link" size="sm" className="ml-2 h-auto p-0" asChild>
                      <a href={row.charge_correction_url} target="_top">
                        {row.charge_correction_label || 'Add correction'}
                      </a>
                    </Button>
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
