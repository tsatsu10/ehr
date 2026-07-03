/**
 * QueueCard — React version of renderQueueCard() in ui-components.js.
 *
 * Uses existing `oe-nc-queue-card` CSS from components.css — no duplicate styles.
 * Mirrors stale badge, similar-surname badge, urgent/claim-lost modifiers, and
 * privacy-mode name masking from the legacy rendering path.
 */

import type { VisitCard } from '@core/types';
import { StatusPill } from './StatusPill';
import { WaitTimeSpan } from './WaitTimeSpan';
import { AncillaryVisitBadges } from './AncillaryVisitBadges';

export interface QueueCardProps {
  card: VisitCard;
  privacyMode?: boolean;
  onClick?: (card: VisitCard) => void;
  selected?: boolean;
}

function privacyDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return '—';
  if (parts.length === 1) return `${parts[0].charAt(0)}.`;
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function patientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

/** ISO date (YYYY-MM-DD) for the current local day. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatStaleDate(visitDate: string): string {
  const parts = visitDate.slice(0, 10).split('-');
  if (parts.length !== 3) return visitDate;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[parseInt(parts[1], 10) - 1] ?? parts[1];
  return `${mon} ${parseInt(parts[2], 10)}`;
}

export function QueueCard({ card, privacyMode = false, onClick, selected = false }: QueueCardProps) {
  const displayName = privacyMode ? privacyDisplayName(card.display_name) : card.display_name;
  const isStale = card.visit_date && card.visit_date.slice(0, 10) < todayIso();
  const isUrgent = Boolean(card.is_urgent);
  const isClaimLost = card.claim_lost;
  const hasSimilarSurname = card.similar_surname_today;

  const modifiers = [
    isUrgent && 'oe-nc-queue-card--urgent',
    isClaimLost && 'oe-nc-queue-card--claim-lost',
    selected && 'oe-nc-queue-card--active',
  ]
    .filter(Boolean)
    .join(' ');

  const claimLostTitle = isClaimLost && card.claim_lost_by
    ? `${card.claim_lost_by.role_label} ${card.claim_lost_by.display_name} took this patient`
    : undefined;

  return (
    <button
      type="button"
      className={`oe-nc-queue-card btn btn-light text-left w-100 mb-2${modifiers ? ` ${modifiers}` : ''}`}
      data-visit-id={card.id}
      disabled={isClaimLost}
      title={claimLostTitle}
      onClick={onClick && !isClaimLost ? () => onClick(card) : undefined}
      aria-pressed={selected}
    >
      <div className="oe-nc-queue-card__row">
        <span className="oe-nc-queue-card__avatar" aria-hidden="true">
          {patientInitials(card.display_name)}
        </span>
        <div className="oe-nc-queue-card__body">
          <div className="oe-nc-queue-card__header">
            <span className="oe-nc-queue-card__queue-num">#{card.queue_number}</span>
            <span className="oe-nc-queue-card__name">{displayName}</span>
            {isUrgent && (
              <span className="badge badge-warning">URGENT</span>
            )}
            {card.skipped_triage && (
              <span className="badge badge-secondary" title="Skipped triage">Skipped triage</span>
            )}
            <AncillaryVisitBadges badges={card.ancillary_badges} />
            {hasSimilarSurname && (
              <span className="badge badge-warning" title="Another patient in today's queue shares this surname">
                Same surname today
              </span>
            )}
            {card.queue_bridge_badge && (
              <a
                href={card.queue_bridge_badge.hub_url}
                className="badge badge-info"
                title={card.queue_bridge_badge.code}
                onClick={(e) => e.stopPropagation()}
              >
                {card.queue_bridge_badge.label}
              </a>
            )}
            {isStale && (
              <span className="oe-nc-stale-badge" title={`Visit opened on ${card.visit_date.slice(0, 10)}`}>
                <i className="fa fa-clock-o" aria-hidden="true" /> {formatStaleDate(card.visit_date)}
              </span>
            )}
          </div>

          <div className="oe-nc-queue-card__meta small text-muted">
            {card.sex} · {card.age_years} · <WaitTimeSpan card={card} suffix=" waiting" /> · {card.visit_type_label}
          </div>

          {card.chief_complaint && (
            <div className="oe-nc-queue-card__cc small text-muted text-truncate">
              CC: {card.chief_complaint}
            </div>
          )}

          <div className="oe-nc-queue-card__footer">
            <StatusPill state={card.state} />
          </div>
        </div>
      </div>
    </button>
  );
}
