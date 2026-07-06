import type { ReactNode } from 'react';
import type { LabQueueCard } from '@core/types';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';

interface BadgeItem {
  key: string;
  node: ReactNode;
  priority: number;
}

function collectLabQueueBadges(card: LabQueueCard): BadgeItem[] {
  const items: BadgeItem[] = [];

  if (card.is_urgent === 1) {
    items.push({ key: 'urgent', priority: 0, node: <Badge variant="warning">URGENT</Badge> });
  }
  if (card.state === 'in_lab') {
    items.push({ key: 'in-lab', priority: 1, node: <Badge variant="info">In lab</Badge> });
  }
  if (card.ancillary_badges?.length) {
    items.push({
      key: 'ancillary',
      priority: 2,
      node: <AncillaryVisitBadges badges={card.ancillary_badges} />,
    });
  }
  if (card.lab_mine) {
    items.push({ key: 'mine', priority: 3, node: <Badge>You</Badge> });
  }
  if (card.lab_actor_name && !card.lab_mine) {
    items.push({
      key: 'actor',
      priority: 4,
      node: <Badge variant="info">{card.lab_actor_name}</Badge>,
    });
  }
  if ((card.order_count ?? 0) > 0) {
    items.push({
      key: 'orders',
      priority: 5,
      node: <Badge variant="outline">{card.order_count} orders</Badge>,
    });
  }
  if ((card.unreleased_count ?? 0) > 0) {
    items.push({
      key: 'unreleased',
      priority: 6,
      node: <Badge variant="warning">{card.unreleased_count} unreleased</Badge>,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

const VISIBLE_BADGE_LIMIT = 2;

export function LabQueueCardBadges({ card }: { card: LabQueueCard }) {
  const badges = collectLabQueueBadges(card);
  if (badges.length === 0) {
    return null;
  }

  const visible = badges.slice(0, VISIBLE_BADGE_LIMIT);
  const overflow = badges.slice(VISIBLE_BADGE_LIMIT);

  return (
    <span className="nc-lab-queue-card__badges">
      <span className="nc-lab-queue-card__badges-visible">
        {visible.map((item) => (
          <span key={item.key} className="nc-lab-queue-card__badge">
            {item.node}
          </span>
        ))}
      </span>
      {overflow.length > 0 && (
        <details className="nc-lab-queue-card__badges-more">
          <summary className="nc-lab-queue-card__badges-more-trigger">
            +{overflow.length} more
          </summary>
          <div className="nc-lab-queue-card__badges-overflow">
            {overflow.map((item) => (
              <span key={item.key} className="nc-lab-queue-card__badge">
                {item.node}
              </span>
            ))}
          </div>
        </details>
      )}
    </span>
  );
}
