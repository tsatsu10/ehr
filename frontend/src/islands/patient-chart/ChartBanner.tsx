import { Badge } from '@components/ui/badge';
import { PatientContextBanner, CompletionScorePill } from '@components/PatientContextBanner';
import type { ChartPreview } from './patientChartTypes';

interface ChartBannerProps {
  preview: ChartPreview;
}

export function ChartBanner({ preview }: ChartBannerProps) {
  const identity = preview.identity;
  const completion = preview.completion;
  const active = preview.active_visit;

  return (
    <div className="nc-chart-banner overflow-hidden rounded-xl border border-[var(--oe-nc-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--oe-nc-primary)_7%,white)_0%,var(--oe-nc-surface,#fff)_100%)] shadow-[var(--oe-nc-shadow-sm)]">
      <PatientContextBanner
        identity={identity}
        layout="full"
        completion={completion}
        safety={preview.safety}
        aside={<CompletionScorePill score={completion.score} threshold={completion.billing_threshold} />}
      >
        {active && active.encounter_signed === false && (
          <div className="mt-2">
            <Badge variant={active.require_esign_before_complete_consult ? 'danger' : 'warning'}>
              {active.require_esign_before_complete_consult
                ? 'Unsigned — sign before complete'
                : 'Unsigned — payment blocked'}
            </Badge>
          </div>
        )}
      </PatientContextBanner>
    </div>
  );
}
