import type { ChartPreview } from './patientChartTypes';
import { completionVariant, initialsFromName } from './patientChartUtils';

interface ChartBannerProps {
  preview: ChartPreview;
}

function CompletionPill({ score, threshold }: { score: number; threshold: number }) {
  const variant = completionVariant(score, threshold);
  const cls =
    variant === 'success' ? 'badge-success' : variant === 'warn' ? 'badge-warning' : 'badge-danger';
  return <span className={`badge ${cls}`}>{score}% complete</span>;
}

export function ChartBanner({ preview }: ChartBannerProps) {
  const identity = preview.identity;
  const completion = preview.completion;
  const safety = preview.safety ?? {};
  const active = preview.active_visit;

  const metaLine = [
    identity.sex || '—',
    identity.age_years || '—',
    `MRN ${identity.pubpid || '—'}`,
    identity.phone_masked ? identity.phone_masked : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const completionBlocked = completion.score < completion.billing_threshold;

  return (
    <>
      {completionBlocked && completion.chart_url && (
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

      <div className="oe-nc-patient-banner nc-patient-context-banner">
        <div className="oe-nc-patient-banner__header d-flex flex-wrap align-items-start">
          <div className="oe-nc-patient-banner__avatar mr-3" aria-hidden="true">
            {initialsFromName(identity.display_name)}
          </div>
          <div className="oe-nc-patient-banner__identity flex-grow-1">
            <h3 className="oe-nc-patient-banner__name mb-1">{identity.display_name}</h3>
            <div className="oe-nc-patient-banner__meta text-muted">{metaLine}</div>
          </div>
          <div className="oe-nc-patient-banner__aside text-right">
            <CompletionPill score={completion.score} threshold={completion.billing_threshold} />
          </div>
        </div>

        {safety.allergies_undocumented && (
          <div className="oe-nc-patient-banner__section mt-2">
            <span className="badge badge-warning">Allergies undocumented</span>
          </div>
        )}

        {active && active.encounter_signed === false && (
          <div className="oe-nc-patient-banner__section mt-2">
            <span
              className={`badge badge-${active.require_esign_before_complete_consult ? 'danger' : 'warning'}`}
            >
              {active.require_esign_before_complete_consult
                ? 'Unsigned — sign before complete'
                : 'Unsigned — payment blocked'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
