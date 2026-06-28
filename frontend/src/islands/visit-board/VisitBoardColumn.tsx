/**
 * VisitBoardColumn — one column of the visit board Kanban.
 *
 * Renders a header with count + card list. Uses existing oe-nc-* CSS classes.
 */

import type { ColumnKey, VisitCard } from '@core/types';
import { QueueCard } from '@components/QueueCard';
import { COLUMN_LABELS } from './VisitBoard';

export interface VisitBoardColumnProps {
  columnKey: ColumnKey;
  cards: VisitCard[];
  privacyMode?: boolean;
  onCardClick?: (card: VisitCard) => void;
  selectedVisitId?: number | null;
}

export function VisitBoardColumn({
  columnKey,
  cards,
  privacyMode = false,
  onCardClick,
  selectedVisitId = null,
}: VisitBoardColumnProps) {
  const label = COLUMN_LABELS[columnKey];

  return (
    <div className="col-sm-6 col-md-4 col-lg-3 mb-3">
      <div className="oe-nc-vb-column">
        {/* Column header */}
        <div className="oe-nc-vb-column__header">
          <span className="oe-nc-vb-column__label">{label}</span>
          <span className="oe-nc-vb-column__count badge badge-light border">
            {cards.length}
          </span>
        </div>

        {/* Card list */}
        <div className="oe-nc-vb-column__body" role="list" aria-label={`${label} queue`}>
          {cards.length === 0 ? (
            <div className="oe-nc-empty-state py-3" role="listitem">
              <p className="mb-0 small text-muted text-center">No patients</p>
            </div>
          ) : (
            cards.map((card) => (
              <div key={card.id} role="listitem">
                <QueueCard
                  card={card}
                  privacyMode={privacyMode}
                  onClick={onCardClick}
                  selected={card.id === selectedVisitId}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
