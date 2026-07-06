import type { PharmacySelectData } from '@core/types';
import { ChipCloud } from '@components/ChipCloud';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { buildAllergyChips } from '@components/patientBannerUtils';
import { deskCalloutClass } from '@components/deskCalloutStyles';

interface PharmacyPatientBannerProps {
  data: PharmacySelectData;
}

export function PharmacyPatientBanner({ data }: PharmacyPatientBannerProps) {
  const { preview, visit } = data;
  const bannerProps = bannerPropsFromPreview(preview);
  const allergyChips = buildAllergyChips(preview.safety, {
    mrdDeepLinks: bannerProps.bannerMrdDeepLinks,
    pid: preview.identity.pid,
    chartOpenUrl: preview.completion?.chart_open_url,
    showAllergyCountChip: bannerProps.showAllergyCountChip,
  });

  return (
    <div className="nc-pharmacy-patient-banner">
      <ChipCloud chips={allergyChips} />
      <dl className="nc-pharmacy-banner-meta">
        <div className="nc-pharmacy-banner-meta__row">
          <dt className="nc-pharmacy-banner-meta__label">Visit</dt>
          <dd className="nc-pharmacy-banner-meta__value">
            Encounter #{visit.encounter ?? '—'}
            {' · '}
            {visit.visit_type_label || 'Visit'}
          </dd>
        </div>
      </dl>
      {(data.undispensed_rx_count ?? 0) > 0 && (
        <div className={deskCalloutClass('warn', 'mt-2 text-sm')} role="alert">
          <strong>
            {data.undispensed_rx_count === 1
              ? '1 Rx undispensed'
              : `${data.undispensed_rx_count} Rx undispensed`}
          </strong>
          {' '}
          — complete is blocked until dispensed, skipped, or overridden.
        </div>
      )}
    </div>
  );
}
