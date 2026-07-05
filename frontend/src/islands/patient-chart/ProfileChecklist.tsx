import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChartSection } from './chartUi';
import type { PatientCompletion } from '@core/types';
import type { ChecklistLevel } from './patientChartTypes';

interface ProfileChecklistProps {
  levels: ChecklistLevel[];
  completion: PatientCompletion;
}

export function ProfileChecklist({ levels, completion }: ProfileChecklistProps) {
  if (!levels.length) return null;

  const threshold = completion.billing_threshold ?? 70;
  const score = completion.score ?? 0;

  return (
    <ChartSection
      title="Profile completion"
      description={`${score}% complete · ${threshold}% required for billing`}
      variant="muted"
    >
      <div className="grid grid-cols-12 gap-3">
        {levels.map((level) => (
          <div key={level.label} className="col-span-12 md:col-span-6 lg:col-span-3">
            <div
              className={cn(
                'nc-profile-checklist-card h-full p-3',
                level.complete && 'nc-profile-checklist-card--complete',
              )}
            >
              <div className="flex items-center gap-2">
                {level.complete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-oe-cta,#047857)]" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-[var(--oe-nc-text-muted)]" aria-hidden />
                )}
                <strong className="text-sm">{level.label}</strong>
              </div>
              <ul className="m-0 mt-2 list-none space-y-1 p-0 pl-1">
                {(level.fields ?? []).map((field) => (
                  <li
                    key={field.label}
                    className={cn(
                      'flex items-start gap-1.5 text-sm',
                      field.complete ? 'text-[var(--color-oe-cta,#047857)]' : 'text-[var(--oe-nc-text-muted)]',
                    )}
                  >
                    {field.complete ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    ) : (
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    <span>{field.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </ChartSection>
  );
}
