import { Button } from '@components/ui/button';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EncounterConsultSectionId, EncounterSectionPhase } from './encounterConsultTypes';
import { ENCOUNTER_SECTION_PHASES } from './encounterConsultTypes';
import { ENCOUNTER_SECTION_ICONS } from './encounterSectionIcons';

export interface EncounterNavSection {
  id: EncounterConsultSectionId;
  label: string;
  shortLabel: string;
  phase: EncounterSectionPhase;
  step: number;
  complete?: boolean;
}

interface EncounterSectionNavProps {
  sections: EncounterNavSection[];
  activeId: EncounterConsultSectionId;
  onSelect: (id: EncounterConsultSectionId) => void;
  warningIds?: EncounterConsultSectionId[];
  chipMode?: boolean;
}

function sectionStatus(
  section: EncounterNavSection,
  activeId: EncounterConsultSectionId,
  hasWarning: boolean,
) {
  if (hasWarning) {
    return 'warning';
  }
  if (section.id === activeId) {
    return 'active';
  }
  if (section.complete) {
    return 'complete';
  }
  return 'default';
}

export function EncounterSectionNav({
  sections,
  activeId,
  onSelect,
  warningIds = [],
  chipMode = false,
}: EncounterSectionNavProps) {
  if (chipMode) {
    return (
      <ul className="nc-encounter-section-nav nc-encounter-section-nav--chips m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1" role="list">
        {sections.map((section) => {
          const Icon = ENCOUNTER_SECTION_ICONS[section.id];
          const status = sectionStatus(section, activeId, warningIds.includes(section.id));

          return (
            <li key={section.id} className="shrink-0">
              <button
                type="button"
                className={cn(
                  'nc-encounter-section-link nc-encounter-section-link--chip flex min-h-11 min-w-[9rem] cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-left text-sm transition-colors duration-200',
                  status === 'active' && 'border-[var(--color-oe-primary,#0891b2)] bg-[color-mix(in_srgb,var(--color-oe-primary,#0891b2)_10%,white)] font-semibold text-[var(--oe-nc-text)] shadow-sm',
                  status === 'complete' && 'border-[color-mix(in_srgb,var(--color-oe-cta,#059669)_35%,var(--oe-nc-border))] text-[var(--oe-nc-text)]',
                  status === 'warning' && 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_40%,var(--oe-nc-border))]',
                  status === 'default' && 'border-[var(--oe-nc-border)] text-[var(--oe-nc-text-muted)] hover:border-[var(--color-oe-primary,#0891b2)] hover:bg-[var(--oe-nc-bg-tint,#f0fdfa)]',
                )}
                aria-current={section.id === activeId ? 'step' : undefined}
                onClick={() => onSelect(section.id)}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--oe-nc-bg-tint,#ecfeff)] text-[var(--color-oe-primary,#0891b2)]">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="truncate">{section.shortLabel}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const phases = [...new Set(sections.map((section) => section.phase))];

  return (
    <div className="nc-encounter-section-nav space-y-4">
      {phases.map((phase) => {
        const phaseSections = sections.filter((section) => section.phase === phase);
        const phaseMeta = ENCOUNTER_SECTION_PHASES[phase];

        return (
          <div key={phase} className="nc-encounter-nav-phase">
            <div className="mb-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-oe-primary,#0891b2)]">
                {phaseMeta.label}
              </p>
              <p className="text-xs text-[var(--oe-nc-text-muted)]">{phaseMeta.hint}</p>
            </div>
            <ul className="m-0 list-none space-y-1 p-0" role="list">
              {phaseSections.map((section) => {
                const Icon = ENCOUNTER_SECTION_ICONS[section.id];
                const status = sectionStatus(section, activeId, warningIds.includes(section.id));

                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      className={cn(
                        'nc-encounter-section-link flex w-full min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all duration-200',
                        status === 'active' && 'border-[color-mix(in_srgb,var(--color-oe-primary,#0891b2)_35%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-primary,#0891b2)_8%,white)] font-semibold text-[var(--oe-nc-text)] shadow-[0_1px_2px_rgba(8,145,178,0.08)]',
                        status === 'complete' && 'border-transparent text-[var(--oe-nc-text)] hover:bg-[var(--oe-nc-bg-tint,#f0fdfa)]',
                        status === 'warning' && 'border-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_35%,var(--oe-nc-border))] bg-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_4%,white)]',
                        status === 'default' && 'border-transparent text-[var(--oe-nc-text-muted)] hover:border-[var(--oe-nc-border)] hover:bg-[var(--oe-nc-bg-tint,#f0fdfa)] hover:text-[var(--oe-nc-text)]',
                      )}
                      aria-current={section.id === activeId ? 'step' : undefined}
                      onClick={() => onSelect(section.id)}
                    >
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                          status === 'active' && 'bg-[var(--color-oe-primary,#0891b2)] text-white',
                          status === 'complete' && 'bg-[color-mix(in_srgb,var(--color-oe-cta,#059669)_12%,white)] text-[var(--color-oe-cta,#059669)]',
                          status === 'warning' && 'bg-[color-mix(in_srgb,var(--color-oe-danger,#b91c1c)_12%,white)] text-[var(--color-oe-danger,#b91c1c)]',
                          status === 'default' && 'bg-[var(--oe-nc-bg-tint,#ecfeff)] text-[var(--color-oe-primary,#0891b2)]',
                        )}
                      >
                        {status === 'complete' ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          section.step
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{section.label}</span>
                      </span>
                      <Icon className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

interface EncounterSectionPagerProps {
  activeIndex: number;
  total: number;
  activeLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

export function EncounterSectionPager({
  activeIndex,
  total,
  activeLabel,
  onPrevious,
  onNext,
  className,
}: EncounterSectionPagerProps) {
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= total - 1;

  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] px-3 py-2', className)}>
      <Button type="button" variant="outline" size="sm" disabled={atStart} onClick={onPrevious}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </Button>
      <p className="hidden text-center text-sm text-[var(--oe-nc-text-muted)] sm:block">
        <span className="font-medium text-[var(--oe-nc-text)]">{activeLabel}</span>
      </p>
      <Button type="button" variant="outline" size="sm" disabled={atEnd} onClick={onNext}>
        Next
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
