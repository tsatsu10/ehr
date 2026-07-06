/**
 * VisitBoardColumn — one column of the visit board Kanban.
 */

import type { ColumnKey, VisitCard } from '@core/types';
import { cn } from '@/lib/utils';
import { QueueCard } from '@components/QueueCard';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  visitBoardLaneClass,
  visitBoardColumnClass,
  visitBoardColumnHeaderClass,
  visitBoardColumnLabelClass,
  visitBoardColumnCountClass,
  visitBoardColumnBodyClass,
} from '@components/visitBoardStyles';
import { COLUMN_LABELS } from './visitBoardUtils';

export interface VisitBoardColumnProps {
  columnKey: ColumnKey;
  cards: VisitCard[];
  privacyMode?: boolean;
  urgentOnly?: boolean;
  hideHeader?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCardClick?: (card: VisitCard) => void;
  selectedVisitId?: number | null;
  queueBridgeBadges?: Record<string, { code: string; label: string; hub_url: string }>;
}

export function VisitBoardColumn({
  columnKey,
  cards,
  privacyMode = false,
  urgentOnly = false,
  hideHeader = false,
  collapsed = false,
  onToggleCollapse,
  onCardClick,
  selectedVisitId = null,
  queueBridgeBadges = {},
}: VisitBoardColumnProps) {
  const label = COLUMN_LABELS[columnKey];
  const columnId = `nc-vb-col-${columnKey}`;

  return (
    <div className={visitBoardLaneClass} id={columnId}>
      <div className={cn('nc-vb-column-shell', collapsed && 'nc-vb-column-shell--collapsed', visitBoardColumnClass)}>
        {!hideHeader && (
          <div className={visitBoardColumnHeaderClass}>
            <span className={visitBoardColumnLabelClass}>{label}</span>
            <div className="nc-vb-column-header-actions">
              <Badge variant="outline" className={visitBoardColumnCountClass}>
                {cards.length}
              </Badge>
              {onToggleCollapse ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="nc-vb-column-toggle h-7 w-7 p-0"
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? `Expand ${label} column` : `Collapse ${label} column`}
                  onClick={onToggleCollapse}
                >
                  {collapsed ? (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {!collapsed && (
          <div className={visitBoardColumnBodyClass} role="list" aria-label={`${label} queue`}>
            {cards.length === 0 ? (
              <div className="nc-vb-column-empty" role="listitem">
                <p className="mb-0 text-sm text-[var(--oe-nc-text-muted)] text-center">No patients</p>
              </div>
            ) : (
              cards.map((card) => {
                const badge = queueBridgeBadges[String(card.id)];
                const enriched = badge ? { ...card, queue_bridge_badge: badge } : card;
                const muted = urgentOnly && !card.is_urgent;
                return (
                  <div key={card.id} role="listitem">
                    <QueueCard
                      card={enriched}
                      privacyMode={privacyMode}
                      muted={muted}
                      onClick={onCardClick}
                      selected={card.id === selectedVisitId}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
