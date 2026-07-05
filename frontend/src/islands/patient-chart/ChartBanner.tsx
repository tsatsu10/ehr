import type { ChartPreview } from './patientChartTypes';
import { PatientContextBanner, CompletionScorePill } from '@components/PatientContextBanner';
import { Badge } from '@components/ui/badge';

interface ChartBannerProps {
  preview: ChartPreview;
}

export function ChartBanner({ preview }: ChartBannerProps) {
  const identity = preview.identity;
  const completion = preview.completion;
  const active = preview.active_visit;

  return (
    <PatientContextBanner
      identity={identity}
      layout="full"
      completion={completion}
      safety={preview.safety}
      aside={<CompletionScorePill score={completion.score} threshold={completion.billing_threshold} />}
    >
      {active && active.encounter_signed === false && (
        <div className="mt-2 mb-3">
          <Badge variant={active.require_esign_before_complete_consult ? 'danger' : 'warning'}>
            {active.require_esign_before_complete_consult
              ? 'Unsigned — sign before complete'
              : 'Unsigned — payment blocked'}
          </Badge>
        </div>
      )}
    </PatientContextBanner>
  );
}
