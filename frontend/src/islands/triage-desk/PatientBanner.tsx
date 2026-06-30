/**
 * PatientBanner — patient context strip rendered at the top of the active triage pane.
 */

import type { PatientPreview, TriageVisit } from '@core/types';
import { PatientContextBanner } from '@components/PatientContextBanner';

interface PatientBannerProps {
  preview: PatientPreview;
  visit: TriageVisit;
}

export function PatientBanner({ preview, visit }: PatientBannerProps) {
  const completion = preview.completion;
  const vitalsToday = preview.vitals_today;
  const completionBlocked = completion.score < completion.billing_threshold;
  const missing = completion.missing_labels ?? [];

  return (
    <PatientContextBanner
      identity={preview.identity}
      layout="compact"
      completion={completion}
      safety={preview.safety}
      aside={(
        <>
          <span className={`badge badge-${completionBlocked ? 'warning' : 'light border'} mr-1`}>
            Completion {completion.score}%
          </span>
          {completionBlocked && completion.chart_url && (
            <a href={completion.chart_url} className="small">
              Complete profile
            </a>
          )}
        </>
      )}
    >
      {missing.length > 0 && completionBlocked && (
        <div className="small text-muted mt-1">
          Missing: {missing.slice(0, 2).join(', ')}{missing.length > 2 ? '…' : ''}
        </div>
      )}

      <div className="small mt-1 text-muted">
        Visit #{visit.queue_number}
        {' · '}
        {visit.state}
        {visit.visit_type_label ? ` · ${visit.visit_type_label}` : ''}
        {vitalsToday?.vitals_abnormal_today && (
          <span className="badge badge-danger ml-1">Vitals abnormal</span>
        )}
      </div>

      <div className="small mt-1">
        {vitalsToday?.summary
          ? <>Vitals today: {vitalsToday.summary}</>
          : <span className="text-warning">No vitals today</span>}
      </div>
    </PatientContextBanner>
  );
}
