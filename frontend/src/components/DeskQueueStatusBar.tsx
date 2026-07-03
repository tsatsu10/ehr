import { Fragment } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@components/ui/button';
import './DeskQueueStatusBar.css';

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
      className={`oe-nc-desk-status-bar${compact ? ' oe-nc-desk-status-bar--compact' : ''}`}
      role="status"
      aria-label={ariaLabel}
      id={id}
    >
      <div className="oe-nc-desk-status-bar__stats">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <span className="oe-nc-desk-status-bar__divider" aria-hidden="true" />}
            <StatusItem {...item} />
          </Fragment>
        ))}
      </div>

      <div className="oe-nc-desk-status-bar__actions">
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
    <span className="inline-flex items-center gap-1.5 leading-none whitespace-nowrap">
      {icon}
      <span className="oe-nc-desk-status-bar__value">{value}</span>
      <span className="oe-nc-desk-status-bar__label">{label}</span>
    </span>
  );
  if (href) {
    return <a href={href} target="_top">{inner}</a>;
  }
  return inner;
}
