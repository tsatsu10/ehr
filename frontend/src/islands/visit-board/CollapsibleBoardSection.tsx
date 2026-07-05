import { useState, type ReactNode } from 'react';
import { Button } from '@components/ui/button';

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
      <Button
        variant="link"
        className="h-auto p-0"
        type="button"
        id={toggleId}
        {...(dataToggleAttr ? { [dataToggleAttr]: true } : {})}
        aria-expanded={expanded}
        aria-controls={sectionId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {title} ({count})
      </Button>
      <div
        className={expanded ? 'mt-2' : 'hidden'}
        id={sectionId}
        aria-labelledby={toggleId}
      >
        <div id={listId} className="text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
