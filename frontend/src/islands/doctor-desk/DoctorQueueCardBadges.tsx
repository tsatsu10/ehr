import type { ReactNode } from 'react';
import type { DoctorQueueCard } from '@core/types';
import { RoutingChips } from '@components/RoutingChips';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';
import { t } from '@core/i18n';

interface BadgeItem {
  key: string;
  node: ReactNode;
  priority: number;
}

function collectQueueBadges(card: DoctorQueueCard): BadgeItem[] {
  const items: BadgeItem[] = [];

  if (card.is_urgent === 1) {
    items.push({
      key: 'urgent',
      priority: 0,
      node: <Badge variant="warning">{t('URGENT')}</Badge>,
    });
  }
  if (card.skipped_triage) {
    items.push({
      key: 'skipped-triage',
      priority: 1,
      node: <Badge variant="neutral">{t('Skipped triage')}</Badge>,
    });
  }
  if (card.ancillary_badges?.length) {
    items.push({
      key: 'ancillary',
      priority: 2,
      node: <AncillaryVisitBadges badges={card.ancillary_badges} />,
    });
  }
  if (card.assigned_provider_name) {
    items.push({
      key: 'appt',
      priority: 3,
      node: <Badge variant="info">{t('Appt: {name}', { name: card.assigned_provider_name })}</Badge>,
    });
  }
  if (card.routing_suggested_provider_name) {
    items.push({
      key: 'routing',
      priority: 4,
      node: (
        <Badge title={t('Advisory routing suggestion')}>
          {t('Routing suggests: {name}', { name: card.routing_suggested_provider_name })}
        </Badge>
      ),
    });
  }
  if (card.hard_assigned_provider_name) {
    items.push({
      key: 'assigned',
      priority: 5,
      node: (
        <Badge
          variant="neutral"
          className="border-transparent bg-slate-800 text-white"
          title={t('Hard-assigned provider')}
        >
          {t('Assigned: {name}', { name: card.hard_assigned_provider_name })}
        </Badge>
      ),
    });
  }
  if (card.routing_chips) {
    items.push({
      key: 'routing-chips',
      priority: 6,
      node: <RoutingChips chips={card.routing_chips} />,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

const VISIBLE_BADGE_LIMIT = 2;

export function DoctorQueueCardBadges({ card }: { card: DoctorQueueCard }) {
  const badges = collectQueueBadges(card);
  if (badges.length === 0) {
    return null;
  }

  const visible = badges.slice(0, VISIBLE_BADGE_LIMIT);
  const overflow = badges.slice(VISIBLE_BADGE_LIMIT);

  return (
    <span className="nc-doctor-queue-card__badges">
      <span className="nc-doctor-queue-card__badges-visible">
        {visible.map((item) => (
          <span key={item.key} className="nc-doctor-queue-card__badge">
            {item.node}
          </span>
        ))}
      </span>
      {overflow.length > 0 && (
        <details className="nc-doctor-queue-card__badges-more">
          <summary className="nc-doctor-queue-card__badges-more-trigger">
            {t('+{count} more', { count: overflow.length })}
          </summary>
          <div className="nc-doctor-queue-card__badges-overflow">
            {overflow.map((item) => (
              <span key={item.key} className="nc-doctor-queue-card__badge">
                {item.node}
              </span>
            ))}
          </div>
        </details>
      )}
    </span>
  );
}
