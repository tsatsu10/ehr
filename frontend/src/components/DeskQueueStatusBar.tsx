import { Fragment } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@components/ui/button';
import { cn } from '@/lib/utils';

export interface DeskStatusItem {
  label: string;
  value: number | string;
  href?: string;
  icon?: React.ReactNode;
}

export interface DeskQueueStatusBarProps {
  id?: string;
  ariaLabel: string;
  items: DeskStatusItem[];
  loading?: boolean;
  /** Omit when the Twig page heading already provides a refresh control. */
  onRefresh?: () => void;
  compact?: boolean;
  trailing?: React.ReactNode;
}

/**
 * DeskQueueStatusBar - Clinical redesign Phase 5
 * Updated 2026-07-05: Larger stat cards, clinical colors, improved spacing
 */
export function DeskQueueStatusBar({
  id,
  ariaLabel,
  items,
  loading = false,
  onRefresh,
  compact = false,
  trailing,
}: DeskQueueStatusBarProps) {
  const hasActions = Boolean(trailing || onRefresh);

  return (
    <div
      className={cn(
        'mb-4 grid items-center gap-x-4 gap-y-2 rounded-xl',
        hasActions ? 'grid-cols-[1fr_auto]' : 'grid-cols-1',
        'border border-[var(--oe-clinical-border)] bg-[var(--oe-clinical-surface)]',
        'px-5 py-3.5 text-sm shadow-[var(--oe-clinical-shadow-sm)]',
        compact && '[&_.nc-desk-stat-group]:gap-x-3.5 [&_.nc-desk-stat-group]:text-[var(--oe-clinical-text-xs)]',
      )}
      role="status"
      aria-label={ariaLabel}
      id={id}
    >
      <div className="nc-desk-stat-group flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <span
                className="hidden h-4 w-px shrink-0 bg-[var(--oe-clinical-border)] sm:inline-block"
                aria-hidden="true"
              />
            )}
            <StatusItem {...item} />
          </Fragment>
        ))}
      </div>

      {hasActions && (
        <div className="flex shrink-0 items-center gap-1">
          {trailing}
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Refresh status"
              title="Refresh"
            >
              <RefreshCw className={cn(
                'h-4 w-4 text-[var(--oe-clinical-text-muted)]',
                loading && 'animate-spin',
              )} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusItem({ label, value, href, icon }: DeskStatusItem) {
  const inner = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap leading-none">
      {icon}
      <span className="font-semibold tabular-nums text-[var(--oe-clinical-text)] text-base">{value}</span>
      <span className="text-[var(--oe-clinical-text-muted)] font-medium">{label}</span>
    </span>
  );
  if (href) {
    return (
      <a href={href} target="_top" className="group text-inherit no-underline hover:opacity-90 transition-opacity">
        <span className="inline-flex items-center gap-2 whitespace-nowrap leading-none">
          {icon}
          <span className="font-semibold tabular-nums text-[var(--oe-clinical-primary)] text-base group-hover:text-[var(--oe-clinical-primary-hover)]">{value}</span>
          <span className="text-[var(--oe-clinical-text-muted)] font-medium">{label}</span>
        </span>
      </a>
    );
  }
  return inner;
}
