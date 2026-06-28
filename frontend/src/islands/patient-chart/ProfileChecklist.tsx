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
        <span className="text-muted small">
          ({score}% · {threshold}% for billing)
        </span>
      </h5>
      <div className="row">
        {levels.map((level) => (
          <div key={level.label} className="col-md-6 col-lg-3 mb-2">
            <div className={`border rounded p-2 h-100${level.complete ? ' bg-light' : ''}`}>
              <strong>
                {level.complete ? '✓' : '○'} {level.label}
              </strong>
              <ul className="list-unstyled mb-0 mt-1 pl-2">
                {(level.fields ?? []).map((field) => (
                  <li
                    key={field.label}
                    className={`small ${field.complete ? 'text-success' : 'text-muted'}`}
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
