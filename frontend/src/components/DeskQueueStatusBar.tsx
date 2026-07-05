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
  onRefresh: () => void;
  compact?: boolean;
  trailing?: React.ReactNode;
}

export function DeskQueueStatusBar({
  id,
  ariaLabel,
  items,
  loading = false,
  onRefresh,
  compact = false,
  trailing,
}: DeskQueueStatusBarProps) {
  return (
    <div
      className={cn(
        'mb-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm',
        compact && '[&_.nc-desk-stat-group]:gap-x-3.5 [&_.nc-desk-stat-group]:text-[0.8125rem]',
      )}
      role="status"
      aria-label={ariaLabel}
      id={id}
    >
      <div className="nc-desk-stat-group flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <span
                className="hidden h-3.5 w-px shrink-0 bg-gray-200 sm:inline-block"
                aria-hidden="true"
              />
            )}
            <StatusItem {...item} />
          </Fragment>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {trailing}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh status"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}

function StatusItem({ label, value, href, icon }: DeskStatusItem) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap leading-none">
      {icon}
      <span className="font-semibold tabular-nums text-gray-900">{value}</span>
      <span className="text-gray-500">{label}</span>
    </span>
  );
  if (href) {
    return (
      <a href={href} target="_top" className="group text-inherit no-underline">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap leading-none">
          {icon}
          <span className="font-semibold tabular-nums text-gray-900 group-hover:text-[var(--oe-nc-primary,#2563eb)]">{value}</span>
          <span className="text-gray-500">{label}</span>
        </span>
      </a>
    );
  }
  return inner;
}
