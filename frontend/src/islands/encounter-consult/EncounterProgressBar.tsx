import { cn } from '@/lib/utils';
import type { EncounterSectionPhase } from './encounterConsultTypes';
import { ENCOUNTER_SECTION_PHASES } from './encounterConsultTypes';

interface EncounterProgressBarProps {
  completedCount: number;
  totalCount: number;
  activeIndex: number;
  className?: string;
}

export function EncounterProgressBar({
  completedCount,
  totalCount,
  activeIndex,
  className,
}: EncounterProgressBarProps) {
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={cn('nc-encounter-progress', className)}>
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 text-xs text-[var(--oe-nc-text-muted)]">
        <span className="font-medium text-[var(--oe-nc-text)]">
          Section {Math.min(activeIndex + 1, totalCount)} of {totalCount}
        </span>
        <span className="shrink-0">{percent}% complete</span>
      </div>
      <div
        className="nc-encounter-progress-track mt-2 h-2 overflow-hidden rounded-full bg-[var(--oe-nc-border)]"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Consult note completion"
      >
        <div
          className="nc-encounter-progress-fill h-full rounded-full bg-[var(--color-oe-primary,#0891b2)] transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

interface EncounterPhaseLegendProps {
  phases: EncounterSectionPhase[];
  className?: string;
}

export function EncounterPhaseLegend({ phases, className }: EncounterPhaseLegendProps) {
  if (phases.length <= 1) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2', className)} role="list" aria-label="SOAP phases">
      {phases.map((phase) => (
        <span
          key={phase}
          className="inline-flex items-center rounded-full border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f0fdfa)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--oe-nc-text-muted)]"
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-oe-primary,#0891b2)]" aria-hidden="true" />
          {ENCOUNTER_SECTION_PHASES[phase].label}
        </span>
      ))}
    </div>
  );
}
