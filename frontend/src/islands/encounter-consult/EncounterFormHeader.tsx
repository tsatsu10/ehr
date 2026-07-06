import type { ReactNode } from 'react';
import { Badge } from '@components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { EncounterPhaseLegend, EncounterProgressBar } from './EncounterProgressBar';
import type { EncounterSectionPhase } from './encounterConsultTypes';
import type { EncounterStatusTone } from './useEncounterConsultForm';

interface EncounterFormHeaderProps {
  title?: string;
  variantLabel: string;
  statusMessage: ReactNode;
  statusTone: EncounterStatusTone;
  saving: boolean;
  completedCount: number;
  totalSections: number;
  activeIndex: number;
  phases: EncounterSectionPhase[];
  showPhaseLegend?: boolean;
  className?: string;
}

export function EncounterFormHeader({
  title = 'Consultation note',
  variantLabel,
  statusMessage,
  statusTone,
  saving,
  completedCount,
  totalSections,
  activeIndex,
  phases,
  showPhaseLegend = false,
  className,
}: EncounterFormHeaderProps) {
  return (
    <header className={cn('nc-encounter-form-header space-y-3 rounded-2xl border border-[var(--oe-nc-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-oe-primary,#0891b2)_5%,white),white)] p-4 shadow-[var(--oe-nc-shadow-sm,0_1px_2px_rgba(0,0,0,0.05))]', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--oe-nc-text)]">{title}</h1>
            <Badge variant="neutral">{variantLabel}</Badge>
          </div>
          {showPhaseLegend && <EncounterPhaseLegend phases={phases} />}
        </div>
        <div
          className={cn(
            'inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
            statusTone === 'success' && 'border-[color-mix(in_srgb,var(--color-oe-cta,#059669)_30%,var(--oe-nc-border))] text-[var(--color-oe-cta,#059669)]',
            statusTone === 'danger' && 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_30%,var(--oe-nc-border))] text-[var(--color-oe-danger,#b91c1c)]',
            statusTone === 'default' && 'border-[var(--oe-nc-border)] text-[var(--oe-nc-text-muted)]',
          )}
          role="status"
          aria-live="polite"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          <span>{statusMessage}</span>
        </div>
      </div>
      <EncounterProgressBar
        completedCount={completedCount}
        totalCount={totalSections}
        activeIndex={activeIndex}
      />
    </header>
  );
}
