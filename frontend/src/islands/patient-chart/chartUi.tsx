import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function ChartShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('nc-chart-shell space-y-4', className)}>
      {children}
    </div>
  );
}

export function ChartShellHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="nc-chart-shell-header flex flex-wrap items-start justify-between gap-3 border-b border-[var(--oe-nc-border)] pb-4">
      <div className="min-w-0">
        <h1 className="nc-chart-shell-title mb-0 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--oe-nc-text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="nc-chart-shell-subtitle mb-0 mt-1 text-sm text-[var(--oe-nc-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ChartStickyTabs({ children }: { children: ReactNode }) {
  return (
    <div className="nc-chart-tabs-sticky sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function ChartTabPanel({
  tabId,
  active,
  children,
}: {
  tabId: string;
  active: boolean;
  children: ReactNode;
}) {
  if (!active) {
    return null;
  }

  return (
    <div
      className="nc-chart-tab-panel nc-chart-tab-enter"
      id={`nc-chart-tab-${tabId}`}
      role="tabpanel"
      aria-labelledby={`nc-chart-tab-trigger-${tabId}`}
    >
      {children}
    </div>
  );
}

export function ChartSection({
  id,
  title,
  description,
  icon,
  action,
  variant = 'default',
  bodyClassName,
  className,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: 'default' | 'accent' | 'muted' | 'alert';
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'nc-chart-section overflow-hidden rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] transition-[box-shadow,border-color] duration-200',
        variant === 'accent' && 'nc-chart-section--accent border-[color-mix(in_srgb,var(--oe-nc-primary)_24%,var(--oe-nc-border))]',
        variant === 'muted' && 'nc-chart-section--muted bg-[var(--oe-nc-bg-tint,#f8fafc)]',
        variant === 'alert' && 'nc-chart-section--alert border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_35%,var(--oe-nc-border))]',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--oe-nc-border)]/80 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="nc-chart-section__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--oe-nc-primary)_10%,white)] text-[var(--oe-nc-primary)]">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="mb-0 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--oe-nc-text)]">
              {title}
            </h2>
            {description && (
              <p className="mb-0 mt-1 text-sm text-[var(--oe-nc-text-muted)]">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('px-4 py-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function ChartMetricTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div
      className={cn(
        'nc-chart-metric rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-3 py-2.5',
        tone === 'success' && 'border-[color-mix(in_srgb,var(--color-oe-cta,#047857)_30%,var(--oe-nc-border))]',
        tone === 'warning' && 'border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_30%,var(--oe-nc-border))]',
        tone === 'danger' && 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_30%,var(--oe-nc-border))]',
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--oe-nc-text)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--oe-nc-text-muted)]">{hint}</div>}
    </div>
  );
}

export function ChartLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="nc-chart-loading flex items-center gap-2 rounded-lg border border-dashed border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-4 py-8 text-sm text-[var(--oe-nc-text-muted)]">
      <Loader2 className="h-4 w-4 animate-spin text-[var(--oe-nc-primary)]" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ChartEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="nc-chart-empty rounded-lg border border-dashed border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-4 py-6 text-center">
      <p className="mb-0 font-medium text-[var(--oe-nc-text)]">{title}</p>
      {description && (
        <p className="mb-0 mt-1 text-sm text-[var(--oe-nc-text-muted)]">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ChartStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('nc-chart-stack flex flex-col gap-3', className)}>{children}</div>;
}
