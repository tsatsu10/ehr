import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function AdminShell({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('nc-admin-hub nc-admin-shell space-y-4', className)}>
      {children}
    </div>
  );
}

export function AdminScopeBar({
  scopeControl,
  hint,
  metrics,
}: {
  scopeControl: ReactNode;
  hint: ReactNode;
  metrics?: ReactNode;
}) {
  return (
    <div className="nc-admin-scope-bar flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] px-4 py-3 shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))]">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {scopeControl}
        <span className="text-sm text-[var(--oe-nc-text-muted)]" id="nc-admin-scope-hint">
          {hint}
        </span>
      </div>
      {metrics && <div className="flex flex-wrap gap-2">{metrics}</div>}
    </div>
  );
}

export function AdminMetricChip({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div
      className={cn(
        'nc-admin-metric-chip rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-3 py-1.5 text-sm',
        tone === 'success' && 'border-[color-mix(in_srgb,var(--color-oe-cta,#047857)_30%,var(--oe-nc-border))]',
        tone === 'warning' && 'border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_30%,var(--oe-nc-border))]',
        tone === 'danger' && 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_30%,var(--oe-nc-border))]',
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
        {label}
      </span>
      <span className="ml-2 font-semibold text-[var(--oe-nc-text)]">{value}</span>
    </div>
  );
}

export function AdminStickyTabs({ children }: { children: ReactNode }) {
  return (
    <div className="nc-admin-tabs-sticky sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur-sm">
      {children}
    </div>
  );
}

export function AdminTabPanel({
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
      className="nc-admin-tab-panel nc-admin-tab-enter"
      id={`nc-admin-tab-${tabId}`}
      role="tabpanel"
    >
      {children}
    </div>
  );
}

export function AdminSection({
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
  variant?: 'default' | 'accent' | 'muted' | 'alert' | 'success';
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        'nc-admin-section overflow-hidden rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-surface,#fff)] shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))] transition-[box-shadow,border-color] duration-200',
        variant === 'accent' && 'nc-admin-section--accent border-[color-mix(in_srgb,var(--oe-nc-primary)_24%,var(--oe-nc-border))]',
        variant === 'muted' && 'nc-admin-section--muted bg-[var(--oe-nc-bg-tint,#f8fafc)]',
        variant === 'alert' && 'nc-admin-section--alert border-[color-mix(in_srgb,var(--color-oe-warning,#d97706)_35%,var(--oe-nc-border))]',
        variant === 'success' && 'nc-admin-section--success border-[color-mix(in_srgb,var(--color-oe-cta,#047857)_35%,var(--oe-nc-border))]',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--oe-nc-border)]/80 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && (
            <div className="nc-admin-section__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--oe-nc-primary)_10%,white)] text-[var(--oe-nc-primary)]">
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

export function AdminInsetPanel({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        'nc-admin-inset rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] p-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminLoadingState({ label = 'Loading settings…' }: { label?: string }) {
  return (
    <div className="nc-admin-loading flex items-center gap-2 rounded-lg border border-dashed border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-4 py-8 text-sm text-[var(--oe-nc-text-muted)]">
      <Loader2 className="h-4 w-4 animate-spin text-[var(--oe-nc-primary)]" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="nc-admin-empty rounded-lg border border-dashed border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-4 py-6 text-center">
      <p className="mb-0 font-medium text-[var(--oe-nc-text)]">{title}</p>
      {description && (
        <p className="mb-0 mt-1 text-sm text-[var(--oe-nc-text-muted)]">{description}</p>
      )}
    </div>
  );
}

export function AdminStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('nc-admin-stack flex flex-col gap-3', className)}>{children}</div>;
}
