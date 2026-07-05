/**
 * VisitBoardColumn — one column of the visit board Kanban.
 */

import type { ColumnKey, VisitCard } from '@core/types';
import { QueueCard } from '@components/QueueCard';
import { Badge } from '@components/ui/badge';
import {
  visitBoardLaneClass,
  visitBoardColumnClass,
  visitBoardColumnHeaderClass,
  visitBoardColumnLabelClass,
  visitBoardColumnCountClass,
  visitBoardColumnBodyClass,
} from '@components/visitBoardStyles';
import { COLUMN_LABELS } from './VisitBoard';

export interface VisitBoardColumnProps {
  columnKey: ColumnKey;
  cards: VisitCard[];
  privacyMode?: boolean;
  onCardClick?: (card: VisitCard) => void;
  selectedVisitId?: number | null;
  queueBridgeBadges?: Record<string, { code: string; label: string; hub_url: string }>;
}

export function VisitBoardColumn({
  columnKey,
  cards,
  privacyMode = false,
  onCardClick,
  selectedVisitId = null,
  queueBridgeBadges = {},
}: VisitBoardColumnProps) {
  const label = COLUMN_LABELS[columnKey];

  return (
    <div className={visitBoardLaneClass}>
      <div className={visitBoardColumnClass}>
        <div className={visitBoardColumnHeaderClass}>
          <span className={visitBoardColumnLabelClass}>{label}</span>
          <Badge variant="outline" className={visitBoardColumnCountClass}>
            {cards.length}
          </Badge>
        </div>

        <div className={visitBoardColumnBodyClass} role="list" aria-label={`${label} queue`}>
          {cards.length === 0 ? (
            <div className="py-3" role="listitem">
              <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)] text-center">No patients</p>
            </div>
          ) : (
            cards.map((card) => {
              const badge = queueBridgeBadges[String(card.id)];
              const enriched = badge ? { ...card, queue_bridge_badge: badge } : card;
              return (
              <div key={card.id} role="listitem">
                <QueueCard
                  card={enriched}
                  privacyMode={privacyMode}
                  onClick={onCardClick}
                  selected={card.id === selectedVisitId}
                />
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
