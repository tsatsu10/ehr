import type { ReactNode } from 'react';
import type { ColumnKey, VisitCard } from '@core/types';
import { LayoutGrid, Search } from 'lucide-react';
import { COLUMN_LABELS } from './visitBoardUtils';
import { VisitBoardColumn } from './VisitBoardColumn';
import {
  visitBoardLaneClass,
  visitBoardLanesClass,
  visitBoardRootClass,
  visitBoardSkeletonCardClass,
  visitBoardSkeletonClass,
  visitBoardColumnClass,
  visitBoardColumnHeaderClass,
} from '@components/visitBoardStyles';

export function VisitBoardLayout({
  alerts,
  controls,
  floor,
  footer,
}: {
  alerts?: ReactNode;
  controls?: ReactNode;
  floor: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="nc-vb-layout">
      {alerts ? <div className="nc-vb-layout__alerts">{alerts}</div> : null}
      {controls ? <section className="nc-vb-layout__controls" aria-label="Board controls">{controls}</section> : null}
      <section className="nc-vb-layout__floor" aria-label="Visit board floor">
        {floor}
      </section>
      {footer ? <div className="nc-vb-layout__footer">{footer}</div> : null}
    </div>
  );
}

export function VisitBoardControlsPanel({
  statusBar,
  toolbar,
}: {
  statusBar: ReactNode;
  toolbar: ReactNode;
}) {
  return (
    <div className="nc-vb-controls-panel">
      <header className="nc-vb-controls-panel__header">
        <div className="nc-vb-controls-panel__heading">
          <div className="nc-vb-controls-panel__icon" aria-hidden="true">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h2 className="nc-vb-controls-panel__title">Floor overview</h2>
            <p className="nc-vb-controls-panel__sub">Live queue by stage — click a count to jump to that column.</p>
          </div>
        </div>
      </header>
      <div className="nc-vb-controls-panel__body">
        {statusBar}
        <div className="nc-vb-controls-panel__toolbar">{toolbar}</div>
      </div>
    </div>
  );
}

export function VisitBoardSearchField({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="nc-vb-search-field">
      <Search className="nc-vb-search-field__icon" aria-hidden="true" />
      <input
        type="search"
        className="nc-vb-search-field__input"
        placeholder="Search name, MRN, queue #"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search patients"
      />
      {value ? (
        <button
          type="button"
          className="nc-vb-search-field__clear"
          aria-label="Clear search"
          onClick={onClear}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function VisitBoardSkeleton({ isKiosk, profile }: { isKiosk: boolean; profile: string }) {
  return (
    <div className={visitBoardRootClass(isKiosk)} data-profile={profile} aria-busy="true">
      <div className={visitBoardLanesClass} aria-busy="true">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className={visitBoardLaneClass}>
            <div className={visitBoardColumnClass}>
              <div className={`${visitBoardColumnHeaderClass} ${visitBoardSkeletonClass}`} aria-hidden="true" />
              <div className={visitBoardSkeletonCardClass} aria-hidden="true" />
              <div className={visitBoardSkeletonCardClass} aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VisitBoardMobileAccordion({
  columns,
  privacyMode,
  urgentOnly,
  onCardClick,
  selectedVisitId,
  queueBridgeBadges,
}: {
  columns: { key: ColumnKey; cards: VisitCard[] }[];
  privacyMode: boolean;
  urgentOnly: boolean;
  onCardClick?: (card: VisitCard) => void;
  selectedVisitId?: number | null;
  queueBridgeBadges?: Record<string, { code: string; label: string; hub_url: string }>;
}) {
  return (
    <div className="nc-vb-mobile-accordion" id="nc-board-columns-mobile">
      {columns.map(({ key, cards }) => (
        <details
          key={key}
          className="nc-vb-mobile-accordion__section"
          id={`nc-vb-col-${key}`}
          open={cards.length > 0 && key !== 'done'}
        >
          <summary className="nc-vb-mobile-accordion__summary">
            <span>{COLUMN_LABELS[key]}</span>
            <span className="nc-vb-mobile-accordion__count">{cards.length}</span>
          </summary>
          <div className="nc-vb-mobile-accordion__body">
            <VisitBoardColumn
              columnKey={key}
              cards={cards}
              privacyMode={privacyMode}
              urgentOnly={urgentOnly}
              hideHeader
              onCardClick={onCardClick}
              selectedVisitId={selectedVisitId}
              queueBridgeBadges={queueBridgeBadges}
            />
          </div>
        </details>
      ))}
    </div>
  );
}
