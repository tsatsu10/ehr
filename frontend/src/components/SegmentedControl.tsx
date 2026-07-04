import { cn } from '@/lib/utils';

export interface SegmentedControlItem {
  id: string;
  label: string;
  count?: number;
}

interface SegmentedControlProps {
  segments: SegmentedControlItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

const segmentBase =
  'oe-nc-segmented-control__segment min-h-11 cursor-pointer rounded border-none bg-transparent px-2.5 py-1.5 text-[0.8125rem] font-medium leading-tight text-[var(--oe-nc-text-muted)] hover:bg-white hover:text-[var(--oe-nc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oe-nc-primary)]';

const segmentSelected =
  'oe-nc-segmented-control__segment--selected bg-white font-semibold text-[var(--oe-nc-primary)] shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))]';

export function SegmentedControl({
  segments,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        'oe-nc-segmented-control inline-flex flex-wrap gap-1 rounded-md border border-[var(--oe-nc-border)] bg-slate-50 p-0.5',
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {segments.map((segment) => {
        const selected = segment.id === value;
        const countLabel =
          segment.count != null ? ` (${segment.count > 99 ? '99+' : segment.count})` : '';

        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            className={cn(segmentBase, selected && segmentSelected)}
            aria-selected={selected}
            onClick={() => onChange(segment.id)}
          >
            {segment.label}
            {countLabel}
          </button>
        );
      })}
    </div>
  );
}
