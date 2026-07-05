/**
 * QueueCard — React version of renderQueueCard() in ui-components.js.
 *
 * shadcn Card shell + Tailwind layout (queueCardStyles). WaitTimeSpan rule unchanged.
 */

import type { VisitCard } from '@core/types';
import { StatusPill } from './StatusPill';
import { WaitTimeSpan } from './WaitTimeSpan';
import { AncillaryVisitBadges } from './AncillaryVisitBadges';
import { Card } from './ui/card';
import { Badge, badgeVariants } from './ui/badge';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import {
  queueCardAvatarClass,
  queueCardBodyClass,
  queueCardCcClass,
  queueCardFooterClass,
  queueCardHeaderClass,
  queueCardMetaClass,
  queueCardNameClass,
  queueCardQueueNumClass,
  queueCardRowClass,
  queueCardShellClass,
  queueCardStaleBadgeClass,
} from './queueCardStyles';

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

  const claimLostTitle = isClaimLost && card.claim_lost_by
    ? `${card.claim_lost_by.role_label} ${card.claim_lost_by.display_name} took this patient`
    : undefined;

  return (
    <Card
      className={cn(
        queueCardShellClass({ urgent: isUrgent, active: selected, claimLost: isClaimLost }),
        'overflow-hidden p-0 shadow-none',
      )}
    >
      <button
        type="button"
        className={cn(
          'block w-full border-0 bg-transparent p-0 text-left',
          isClaimLost ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
        data-visit-id={card.id}
        disabled={isClaimLost}
        title={claimLostTitle}
        onClick={onClick && !isClaimLost ? () => onClick(card) : undefined}
        aria-pressed={selected}
      >
        <div className={queueCardRowClass}>
          <span className={queueCardAvatarClass(isUrgent, isClaimLost)} aria-hidden="true">
            {patientInitials(card.display_name)}
          </span>
          <div className={queueCardBodyClass}>
            <div className={queueCardHeaderClass}>
              <span className={queueCardQueueNumClass}>#{card.queue_number}</span>
              <span className={queueCardNameClass}>{displayName}</span>
              {isUrgent && (
                <Badge variant="warning">URGENT</Badge>
              )}
              {card.skipped_triage && (
                <Badge variant="neutral" title="Skipped triage">Skipped triage</Badge>
              )}
              <AncillaryVisitBadges badges={card.ancillary_badges} />
              {hasSimilarSurname && (
                <Badge variant="warning" title="Another patient in today's queue shares this surname">
                  Same surname today
                </Badge>
              )}
              {card.queue_bridge_badge && (
                <a
                  href={card.queue_bridge_badge.hub_url}
                  className={cn(badgeVariants({ variant: 'info' }), 'no-underline hover:opacity-90')}
                  title={card.queue_bridge_badge.code}
                  onClick={(e) => e.stopPropagation()}
                >
                  {card.queue_bridge_badge.label}
                </a>
              )}
              {isStale && (
                <span className={queueCardStaleBadgeClass} title={`Visit opened on ${card.visit_date.slice(0, 10)}`}>
                  <Clock className="h-3 w-3" aria-hidden="true" /> {formatStaleDate(card.visit_date)}
                </span>
              )}
            </div>

            <div className={queueCardMetaClass}>
              {card.sex} · {card.age_years} · <WaitTimeSpan card={card} suffix=" waiting" /> · {card.visit_type_label}
            </div>

            {card.chief_complaint && (
              <div className={queueCardCcClass}>
                CC: {card.chief_complaint}
              </div>
            )}

            <div className={queueCardFooterClass}>
              <StatusPill state={card.state} />
            </div>
          </div>
        </div>
      </button>
    </Card>
  );
}
