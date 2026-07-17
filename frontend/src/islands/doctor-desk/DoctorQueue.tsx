/**
 * DoctorQueue — waiting patients list with take affordance.
 */

import { useState } from 'react';
import type {
  DoctorDoneTodayRow,
  DoctorQueueCard,
  DoctorReopenableRow,
} from '@core/types';
import { WaitTimeSpan } from '@components/WaitTimeSpan';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { ChevronRight } from 'lucide-react';
import { t } from '@core/i18n';
import { DoctorQueueCardBadges } from './DoctorQueueCardBadges';
import { DoctorQueuePanel } from './doctorDeskUi';
import type { ReactNode } from 'react';

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
  queueHeaderExtra?: ReactNode;
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
  const isUrgent = card.is_urgent === 1;

  const claimLostTitle =
    isClaimLost && card.claim_lost_by
      ? t('{role} {name} took this patient', {
          role: card.claim_lost_by.role_label,
          name: card.claim_lost_by.display_name,
        })
      : undefined;

  return (
    <button
      type="button"
      className={[
        'nc-doctor-queue-card',
        isUrgent && 'nc-doctor-queue-card--urgent',
        isClaimLost && 'nc-doctor-queue-card--claim-lost',
        disabled && 'nc-doctor-queue-card--disabled',
      ].filter(Boolean).join(' ')}
      data-visit-id={card.id}
      data-from-state="ready_for_doctor"
      disabled={disabled || isClaimLost}
      title={disabled ? t('Complete your current patient first') : claimLostTitle}
      onClick={() => !disabled && !isClaimLost && onTake(card)}
    >
      <span className="nc-doctor-queue-card__number" aria-hidden="true">
        {card.queue_number}
      </span>

      <span className="nc-doctor-queue-card__body">
        <span className="nc-doctor-queue-card__top">
          <strong className="nc-doctor-queue-card__name">{card.display_name}</strong>
          <DoctorQueueCardBadges card={card} />
        </span>
        <span className="nc-doctor-queue-card__meta">
          {card.sex} · {card.age_years}
          {' · '}
          <WaitTimeSpan card={card} suffix=" wait" />
          {card.visit_type_label ? ` · ${card.visit_type_label}` : ''}
        </span>
        {card.chief_complaint && (
          <span className="nc-doctor-queue-card__cc">{card.chief_complaint}</span>
        )}
      </span>

      {!disabled && !isClaimLost && (
        <span className="nc-doctor-queue-card__take" aria-hidden="true">
          {t('Take')}
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

export function DoctorQueueBody({
  cards,
  doneToday,
  reopenableToday,
  canReopenConsult,
  hasActiveConsult,
  loading,
  error,
  onTakePatient,
  onReopenClick,
  queueHeaderExtra,
}: DoctorQueueProps) {
  const [doneOpen, setDoneOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  return (
    <>
      {queueHeaderExtra}

      {error && (
        <div className={deskCalloutClass('error', 'mb-2 text-sm')} role="alert">
          {error}
        </div>
      )}

      {hasActiveConsult && cards.length > 0 && (
        <p className="nc-doctor-queue-hint">
          {t('Finish your current consult before taking another patient.')}
        </p>
      )}

      {!error && loading && cards.length === 0 && (
        <div className="nc-doctor-queue-empty"><em>{t('Loading queue…')}</em></div>
      )}

      {!error && !loading && cards.length === 0 && (
        <div className="nc-doctor-queue-empty">
          <em>{t('No patients waiting.')}</em>
          <span className="nc-doctor-queue-empty__sub">{t('New visits appear within 30 seconds.')}</span>
        </div>
      )}

      <div id="nc-doctor-queue-list" className="nc-doctor-queue-list">
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
        <details
          className="nc-doctor-queue-archive"
          id="nc-doctor-reopen-section"
          open={reopenOpen}
          onToggle={(e) => setReopenOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="nc-doctor-queue-archive__summary" id="nc-doctor-reopen-toggle">
            {t('Reopen today ({count})', { count: reopenableToday.length })}
          </summary>
          <div id="nc-doctor-reopen-list" className="nc-doctor-queue-archive__body">
            {reopenableToday.length === 0 ? (
              <div className="nc-doctor-queue-archive__empty">{t('None sent out today')}</div>
            ) : (
              reopenableToday.map((row) => (
                <div key={row.id} className="nc-doctor-queue-archive__row">
                  <div>
                    <div className="nc-doctor-queue-archive__row-title">
                      {t('#{number} {name}', { number: row.queue_number, name: row.display_name })}
                      {row.lab_results_ready && (
                        <Badge variant="info" className="ml-1" title={t('Lab result ready to review')}>
                          {t('Lab ready')}
                        </Badge>
                      )}
                    </div>
                    <div className="nc-doctor-queue-archive__row-meta">
                      {row.state.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="nc-doctor-reopen-btn"
                    data-visit-id={row.id}
                    onClick={() => onReopenClick(row)}
                  >
                    {t('Reopen')}
                  </Button>
                </div>
              ))
            )}
          </div>
        </details>
      )}

      <details
        className="nc-doctor-queue-archive"
        open={doneOpen}
        onToggle={(e) => setDoneOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="nc-doctor-queue-archive__summary" id="nc-doctor-done-toggle">
          {t('Done today ({count})', { count: doneToday.length })}
        </summary>
        <div id="nc-doctor-done-list" className="nc-doctor-queue-archive__body">
          {doneToday.length === 0 ? (
            <div className="nc-doctor-queue-archive__empty">{t('None yet today')}</div>
          ) : (
            doneToday.map((row) => (
              <div key={row.id} className="nc-doctor-queue-archive__row nc-doctor-queue-archive__row--static">
                {t('#{number} {name}', { number: row.queue_number, name: row.display_name })}
              </div>
            ))
          )}
        </div>
      </details>
    </>
  );
}

export function DoctorQueue({
  cards,
  queueHeaderExtra,
  ...rest
}: DoctorQueueProps) {
  return (
    <DoctorQueuePanel title={t('Waiting for doctor')} count={cards.length}>
      <DoctorQueueBody cards={cards} queueHeaderExtra={queueHeaderExtra} {...rest} />
    </DoctorQueuePanel>
  );
}
