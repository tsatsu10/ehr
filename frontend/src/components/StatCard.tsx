import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendPill } from './TrendPill';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  /** Optional signed % change vs prior period. */
  trend?: number;
  className?: string;
}

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'oe-nc-stat-card rounded-xl border border-[var(--oe-nc-border)] bg-white p-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--oe-nc-text-muted)] leading-none">{label}</p>
          <p className="oe-nc-stat-card__value text-2xl font-bold text-[var(--oe-nc-text)] tabular-nums mt-2 leading-none">
            {value}
          </p>
          {trend != null && (
            <div className="mt-2">
              <TrendPill value={trend} />
            </div>
          )}
        </div>
        {icon != null && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--oe-nc-bg-muted,#f3f4f6)] text-[var(--oe-nc-text-muted)]">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
