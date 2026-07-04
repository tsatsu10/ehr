import type { ReactNode } from 'react';
import { Card, CardContent } from './ui/card';
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
    <Card className={cn('oe-nc-stat-card', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none text-[var(--oe-nc-text-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums leading-none text-[var(--oe-nc-text)]">
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
      </CardContent>
    </Card>
  );
}
