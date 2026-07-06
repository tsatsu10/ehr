import type { ReactNode } from 'react';
import type { CashierQueueCard } from '@core/types';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';
import { formatMoney } from './cashierUtils';

interface BadgeItem {
  key: string;
  node: ReactNode;
  priority: number;
}

function collectCashierQueueBadges(card: CashierQueueCard): BadgeItem[] {
  const items: BadgeItem[] = [];

  if (card.is_urgent === 1) {
    items.push({ key: 'urgent', priority: 0, node: <Badge variant="warning">URGENT</Badge> });
  }
  if (card.ancillary_badges?.length) {
    items.push({
      key: 'ancillary',
      priority: 1,
      node: <AncillaryVisitBadges badges={card.ancillary_badges} />,
    });
  }
  if (card.charges_total > 0) {
    items.push({
      key: 'total',
      priority: 2,
      node: <Badge variant="outline">{formatMoney(card.charges_total)}</Badge>,
    });
  } else {
    items.push({
      key: 'no-charges',
      priority: 2,
      node: <Badge variant="warning">No charges</Badge>,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

const VISIBLE_BADGE_LIMIT = 2;

export function CashierQueueCardBadges({ card }: { card: CashierQueueCard }) {
  const badges = collectCashierQueueBadges(card);
  if (badges.length === 0) {
    return null;
  }

  const visible = badges.slice(0, VISIBLE_BADGE_LIMIT);
  const overflow = badges.slice(VISIBLE_BADGE_LIMIT);

  return (
    <span className="nc-cashier-queue-card__badges">
      <span className="nc-cashier-queue-card__badges-visible">
        {visible.map((item) => (
          <span key={item.key} className="nc-cashier-queue-card__badge">
            {item.node}
          </span>
        ))}
      </span>
      {overflow.length > 0 && (
        <details className="nc-cashier-queue-card__badges-more">
          <summary className="nc-cashier-queue-card__badges-more-trigger">
            +{overflow.length} more
          </summary>
          <div className="nc-cashier-queue-card__badges-overflow">
            {overflow.map((item) => (
              <span key={item.key} className="nc-cashier-queue-card__badge">
                {item.node}
              </span>
            ))}
          </div>
        </details>
      )}
    </span>
  );
}
