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
    <div className="nc-profile-checklist mb-3">
      <h5 className="mb-2">
        Profile completion{' '}
        <span className="text-[var(--oe-nc-text-muted)] text-sm">
          ({score}% · {threshold}% for billing)
        </span>
      </h5>
      <div className="grid grid-cols-12 gap-3">
        {levels.map((level) => (
          <div key={level.label} className="col-span-12 md:col-span-6 lg:col-span-3 mb-2">
            <div className={`border rounded p-2 h-full${level.complete ? ' bg-[var(--oe-nc-bg-tint)]' : ''}`}>
              <strong>
                {level.complete ? '✓' : '○'} {level.label}
              </strong>
              <ul className="list-none m-0 p-0 mb-0 mt-1 pl-2">
                {(level.fields ?? []).map((field) => (
                  <li
                    key={field.label}
                    className={`text-sm ${field.complete ? 'text-green-600' : 'text-[var(--oe-nc-text-muted)]'}`}
                  >
                    {field.complete ? '✓' : '○'} {field.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
