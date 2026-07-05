/**
 * QueueCard — React version of renderQueueCard() in ui-components.js.
 *
 * Updated 2026-07-05 for clinical redesign Phase 5:
 * - Clinical color palette and typography
 * - Larger avatar with photo support
 * - Wait time thresholds with color coding
 * - Improved spacing and touch targets
 */

import type { VisitCard } from '@core/types';
import { StatusPill } from './StatusPill';
import { WaitTimeSpan } from './WaitTimeSpan';
import { AncillaryVisitBadges } from './AncillaryVisitBadges';
import { Card } from './ui/card';
import { Badge, badgeVariants } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
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
        // Clinical styling
        'border-[var(--oe-clinical-border)]',
        'hover:border-[var(--oe-clinical-primary-light)]',
        'hover:shadow-[var(--oe-clinical-shadow-md)]',
        'transition-all duration-200',
      )}
    >
      <button
        type="button"
        className={cn(
          'block w-full border-0 bg-transparent p-0 text-left',
          isClaimLost ? 'cursor-not-allowed' : 'cursor-pointer',
          // Clinical touch target - min 44px height
          'min-h-[44px]',
        )}
        data-visit-id={card.id}
        disabled={isClaimLost}
        title={claimLostTitle}
        onClick={onClick && !isClaimLost ? () => onClick(card) : undefined}
        aria-pressed={selected}
      >
        <div className={cn(queueCardRowClass, 'gap-3 p-3')}>
          {/* Clinical Avatar - Larger with photo support */}
          <Avatar className="shrink-0 h-12 w-12 ring-2 ring-[var(--oe-clinical-border)]">
            {card.photo_url && <AvatarImage src={card.photo_url} alt={displayName} />}
            <AvatarFallback className={cn(
              'text-sm font-semibold',
              isUrgent && 'bg-[var(--oe-clinical-warning-bg)] text-[var(--oe-clinical-warning)]',
              isClaimLost && 'bg-[var(--oe-clinical-muted)] text-[var(--oe-clinical-text-muted)]',
            )}>
              {patientInitials(card.display_name)}
            </AvatarFallback>
          </Avatar>

          <div className={cn(queueCardBodyClass, 'flex-1 min-w-0')}>
            <div className={cn(queueCardHeaderClass, 'gap-2 mb-1')}>
              <span className={cn(
                queueCardQueueNumClass,
                'text-[var(--oe-clinical-text-muted)] font-semibold',
              )}>
                #{card.queue_number}
              </span>
              <span className={cn(
                queueCardNameClass,
                'text-[var(--oe-clinical-text)] font-semibold',
              )}>
                {displayName}
              </span>
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
                <span className={cn(
                  queueCardStaleBadgeClass,
                  'text-[var(--oe-clinical-warning)]',
                )} title={`Visit opened on ${card.visit_date.slice(0, 10)}`}>
                  <Clock className="h-3 w-3" aria-hidden="true" /> {formatStaleDate(card.visit_date)}
                </span>
              )}
            </div>

            <div className={cn(
              queueCardMetaClass,
              'text-[var(--oe-clinical-text-muted)] text-[var(--oe-clinical-text-xs)] mb-1',
            )}>
              {card.sex} · {card.age_years} · <WaitTimeSpan card={card} suffix=" waiting" /> · {card.visit_type_label}
            </div>

            {card.chief_complaint && (
              <div className={cn(
                queueCardCcClass,
                'text-[var(--oe-clinical-text)] text-sm mb-2',
              )}>
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
