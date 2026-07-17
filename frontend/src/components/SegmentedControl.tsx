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
  'min-h-11 cursor-pointer rounded-[9px] border-none bg-transparent px-4 py-1.5 text-[0.8125rem] font-semibold leading-tight text-[var(--oe-nc-text-muted)] hover:text-[var(--oe-nc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oe-nc-primary)]';

const segmentSelected =
  'bg-[var(--oe-nc-surface)] text-[var(--oe-nc-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]';

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
        'nc-segmented-control inline-flex flex-wrap gap-0.5 rounded-xl bg-[var(--oe-nc-bg-muted)] p-[3px]',
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
