/**
 * PatientBanner — patient context strip rendered at the top of the active pane.
 *
 * Mirrors renderBanner() + renderCompletionBanner() from triage.js.
 * Shows: name · sex · age · MRN · completion% · missing fields · allergy · vitals summary
 */

import type { PatientPreview, TriageVisit } from '@core/types';

interface PatientBannerProps {
  preview: PatientPreview;
  visit: TriageVisit;
}

export function PatientBanner({ preview, visit }: PatientBannerProps) {
  const identity = preview.identity;
  const completion = preview.completion;
  const safety = preview.safety;
  const vitalsToday = preview.vitals_today;

  const completionBlocked = completion.score < completion.billing_threshold;
  const severeAllergies = safety?.allergies_severe ?? [];
  const missing = completion.missing_labels ?? [];

  return (
    <div className="nc-patient-context-banner mb-3 p-3 border rounded bg-light">
      {/* Completion progress bar strip */}
      {completionBlocked && (
        <div className="oe-nc-completion-bar mb-2">
          <div
            className="oe-nc-completion-bar__fill"
            style={{ width: `${Math.min(completion.score, 100)}%` }}
            role="progressbar"
            aria-valuenow={completion.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          />
        </div>
      )}

      {/* Identity row */}
      <div className="d-flex justify-content-between flex-wrap align-items-start">
        <div>
          <strong>{identity.display_name}</strong>
          {' · '}
          {identity.sex}
          {' '}
          {identity.age_years}
          {' · MRN '}
          {identity.pubpid}
        </div>
        <div className="d-flex align-items-center">
          <span className={`badge badge-${completionBlocked ? 'warning' : 'light border'} mr-1`}>
            Completion {completion.score}%
          </span>
          {completionBlocked && completion.chart_url && (
            <a href={completion.chart_url} className="small">
              Complete profile
            </a>
          )}
        </div>
      </div>

      {/* Missing fields */}
      {missing.length > 0 && completionBlocked && (
        <div className="small text-muted mt-1">
          Missing: {missing.slice(0, 2).join(', ')}{missing.length > 2 ? '…' : ''}
        </div>
      )}

      {/* Allergies */}
      {severeAllergies.length > 0 && (
        <div className="text-danger small mt-1">
          <i className="fa fa-exclamation-circle mr-1" aria-hidden="true" />
          Allergy: {severeAllergies.join(', ')}
        </div>
      )}

      {/* Active visit metadata */}
      <div className="small mt-1 text-muted">
        Visit #{visit.queue_number}
        {' · '}
        {visit.state}
        {visit.visit_type_label ? ` · ${visit.visit_type_label}` : ''}
        {vitalsToday?.vitals_abnormal_today && (
          <span className="badge badge-danger ml-1">Vitals abnormal</span>
        )}
      </div>

      {/* Vitals summary */}
      <div className="small mt-1">
        {vitalsToday?.summary
          ? <>Vitals today: {vitalsToday.summary}</>
          : <span className="text-warning">No vitals today</span>}
      </div>
    </div>
  );
}
