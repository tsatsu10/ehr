import type { CashierSelectData } from '@core/types';
import { ChipCloud } from '@components/ChipCloud';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { buildAllergyChips } from '@components/patientBannerUtils';

interface CashierPatientBannerProps {
  data: CashierSelectData;
}

export function CashierPatientBanner({ data }: CashierPatientBannerProps) {
  const { preview, visit } = data;
  const bannerProps = bannerPropsFromPreview(preview);
  const allergyChips = buildAllergyChips(preview.safety, {
    mrdDeepLinks: bannerProps.bannerMrdDeepLinks,
    pid: preview.identity.pid,
    chartOpenUrl: preview.completion?.chart_open_url,
    showAllergyCountChip: bannerProps.showAllergyCountChip,
  });

  return (
    <div className="nc-cashier-patient-banner">
      <ChipCloud chips={allergyChips} />
      <dl className="nc-cashier-banner-meta">
        <div className="nc-cashier-banner-meta__row">
          <dt className="nc-cashier-banner-meta__label">Visit</dt>
          <dd className="nc-cashier-banner-meta__value">
            Encounter #{visit.encounter ?? '—'}
            {' · '}
            {visit.visit_type_label || 'Payment checkout'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
