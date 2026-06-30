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

export function SegmentedControl({
  segments,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      className={`oe-nc-segmented-control${className ? ` ${className}` : ''}`}
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
            className={`oe-nc-segmented-control__segment${selected ? ' oe-nc-segmented-control__segment--selected' : ''}`}
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
