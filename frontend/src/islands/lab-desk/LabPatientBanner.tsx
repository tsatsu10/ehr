import type { LabSelectData } from '@core/types';
import { ChipCloud } from '@components/ChipCloud';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { buildAllergyChips } from '@components/patientBannerUtils';
import { AncillaryVisitBadges } from '@components/AncillaryVisitBadges';
import { Badge } from '@components/ui/badge';
import { deskCalloutClass } from '@components/deskCalloutStyles';

interface LabPatientBannerProps {
  data: LabSelectData;
  slim?: boolean;
}

export function LabPatientBanner({ data, slim = false }: LabPatientBannerProps) {
  const { preview, visit } = data;
  const bannerProps = bannerPropsFromPreview(preview);
  const allergyChips = buildAllergyChips(preview.safety, {
    mrdDeepLinks: bannerProps.bannerMrdDeepLinks,
    pid: preview.identity.pid,
    chartOpenUrl: preview.completion?.chart_open_url,
    showAllergyCountChip: bannerProps.showAllergyCountChip,
  });

  const stateLabel = visit.state === 'in_lab' ? 'In lab' : 'Ready for lab';

  return (
    <div className="nc-lab-patient-banner">
      <ChipCloud chips={allergyChips} />
      {!slim && (
        <div className="nc-lab-patient-banner__strip">
          <span className="nc-lab-patient-banner__name">{preview.identity.display_name}</span>
          <Badge variant="neutral">{stateLabel}</Badge>
        </div>
      )}
      <dl className="nc-lab-banner-meta">
        <div className="nc-lab-banner-meta__row">
          <dt className="nc-lab-banner-meta__label">Visit</dt>
          <dd className="nc-lab-banner-meta__value">
            Encounter #{visit.encounter ?? '—'}
            {' · '}
            {visit.visit_type_label || 'Visit'}
            <AncillaryVisitBadges badges={visit.ancillary_badges} className="ml-1" />
          </dd>
        </div>
      </dl>
      {data.critical_unreleased && (
        <div className={deskCalloutClass('error', 'mt-2 text-sm')} role="alert">
          Critical result saved but not released. Release from Enter results.
        </div>
      )}
    </div>
  );
}
