import type { ReactNode } from 'react';
import type { TriageQueueCard } from '@core/types';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';

interface BadgeItem {
  key: string;
  node: ReactNode;
  priority: number;
}

function collectTriageQueueBadges(card: TriageQueueCard): BadgeItem[] {
  const items: BadgeItem[] = [];

  if (card.is_urgent === 1) {
    items.push({ key: 'urgent', priority: 0, node: <Badge variant="warning">URGENT</Badge> });
  }
  if (card.state === 'in_triage' && card.triage_mine) {
    items.push({ key: 'mine', priority: 1, node: <Badge>You</Badge> });
  }
  if (card.state === 'in_triage' && card.triage_actor_name && !card.triage_mine) {
    items.push({
      key: 'actor',
      priority: 2,
      node: <Badge variant="info">{card.triage_actor_name}</Badge>,
    });
  }
  if (card.ancillary_badges?.length) {
    items.push({
      key: 'ancillary',
      priority: 3,
      node: <AncillaryVisitBadges badges={card.ancillary_badges} />,
    });
  }
  if (card.claim_lost) {
    items.push({ key: 'claimed', priority: 4, node: <Badge variant="neutral">Claimed</Badge> });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

const VISIBLE_BADGE_LIMIT = 2;

export function TriageQueueCardBadges({ card }: { card: TriageQueueCard }) {
  const badges = collectTriageQueueBadges(card);
  if (badges.length === 0) {
    return null;
  }

  const visible = badges.slice(0, VISIBLE_BADGE_LIMIT);
  const overflow = badges.slice(VISIBLE_BADGE_LIMIT);

  return (
    <span className="nc-triage-queue-card__badges">
      <span className="nc-triage-queue-card__badges-visible">
        {visible.map((item) => (
          <span key={item.key} className="nc-triage-queue-card__badge">
            {item.node}
          </span>
        ))}
      </span>
      {overflow.length > 0 && (
        <details className="nc-triage-queue-card__badges-more">
          <summary className="nc-triage-queue-card__badges-more-trigger">
            +{overflow.length} more
          </summary>
          <div className="nc-triage-queue-card__badges-overflow">
            {overflow.map((item) => (
              <span key={item.key} className="nc-triage-queue-card__badge">
                {item.node}
              </span>
            ))}
          </div>
        </details>
      )}
    </span>
  );
}
