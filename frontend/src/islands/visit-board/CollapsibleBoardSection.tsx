import { useState, type ReactNode } from 'react';

export interface CollapsibleBoardSectionProps {
  toggleId: string;
  sectionId: string;
  listId: string;
  title: string;
  count: number;
  dataToggleAttr?: string;
  children: ReactNode;
}

export function CollapsibleBoardSection({
  toggleId,
  sectionId,
  listId,
  title,
  count,
  dataToggleAttr,
  children,
}: CollapsibleBoardSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-4">
      <button
        className="btn btn-link p-0"
        type="button"
        id={toggleId}
        {...(dataToggleAttr ? { [dataToggleAttr]: true } : {})}
        aria-expanded={expanded}
        aria-controls={sectionId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {title} ({count})
      </button>
      <div
        className={expanded ? 'mt-2' : 'd-none'}
        id={sectionId}
        aria-labelledby={toggleId}
      >
        <div id={listId} className="small">
          {children}
        </div>
      </div>
    </div>
  );
}
