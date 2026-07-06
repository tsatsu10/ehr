import type { ReactNode } from 'react';
import type { PharmacyQueueCard } from '@core/types';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';

interface BadgeItem {
  key: string;
  node: ReactNode;
  priority: number;
}

function collectPharmacyQueueBadges(card: PharmacyQueueCard): BadgeItem[] {
  const items: BadgeItem[] = [];

  if (card.is_urgent === 1) {
    items.push({ key: 'urgent', priority: 0, node: <Badge variant="warning">URGENT</Badge> });
  }
  if (card.state === 'in_pharmacy') {
    items.push({ key: 'in-pharm', priority: 1, node: <Badge variant="info">In pharmacy</Badge> });
  }
  if (card.ancillary_badges?.length) {
    items.push({
      key: 'ancillary',
      priority: 2,
      node: <AncillaryVisitBadges badges={card.ancillary_badges} />,
    });
  }
  if (card.pharmacy_mine) {
    items.push({ key: 'mine', priority: 3, node: <Badge>You</Badge> });
  }
  if (card.pharmacy_actor_name && !card.pharmacy_mine) {
    items.push({
      key: 'actor',
      priority: 4,
      node: <Badge variant="info">{card.pharmacy_actor_name}</Badge>,
    });
  }
  const rxLabel = card.undispensed_rx_count != null
    ? (card.undispensed_rx_count > 0 ? `${card.undispensed_rx_count} Rx undispensed` : null)
    : (card.rx_count ?? 0) > 0
      ? `${card.rx_count} Rx`
      : null;
  if (rxLabel) {
    items.push({
      key: 'rx',
      priority: 5,
      node: <Badge variant="outline">{rxLabel}</Badge>,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

const VISIBLE_BADGE_LIMIT = 2;

export function PharmacyQueueCardBadges({ card }: { card: PharmacyQueueCard }) {
  const badges = collectPharmacyQueueBadges(card);
  if (badges.length === 0) {
    return null;
  }

  const visible = badges.slice(0, VISIBLE_BADGE_LIMIT);
  const overflow = badges.slice(VISIBLE_BADGE_LIMIT);

  return (
    <span className="nc-pharmacy-queue-card__badges">
      <span className="nc-pharmacy-queue-card__badges-visible">
        {visible.map((item) => (
          <span key={item.key} className="nc-pharmacy-queue-card__badge">
            {item.node}
          </span>
        ))}
      </span>
      {overflow.length > 0 && (
        <details className="nc-pharmacy-queue-card__badges-more">
          <summary className="nc-pharmacy-queue-card__badges-more-trigger">
            +{overflow.length} more
          </summary>
          <div className="nc-pharmacy-queue-card__badges-overflow">
            {overflow.map((item) => (
              <span key={item.key} className="nc-pharmacy-queue-card__badge">
                {item.node}
              </span>
            ))}
          </div>
        </details>
      )}
    </span>
  );
}
