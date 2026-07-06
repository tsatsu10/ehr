/**
 * DoctorPatientBanner — active consult patient context strip (slim when hero owns identity).
 */

import type { DoctorVisit, PatientPreview, RoutingChips, DocumentationStatus } from '@core/types';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { ChipCloud } from '@components/ChipCloud';
import { useConsultReadyBanner } from '@components/useConsultReadyBanner';
import { RoutingChips as RoutingChipsBadges } from '@components/RoutingChips';
import { BannerClinicalLink } from '@components/BannerClinicalLink';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { buildAllergyChips } from '@components/patientBannerUtils';
import { buildMrdClinicalDeepLink, MRD_CLINICAL_ANCHORS } from '@core/mrdBannerLinks';
import { cn } from '@/lib/utils';
import { badgeVariants } from '@components/ui/badge';
import { DocumentationStatusChip } from './DocumentationStatusChip';

export interface DoctorSignMeta {
  encounter_signed: boolean;
  require_esign_before_complete_consult: boolean;
  encounter_url?: string;
  routing_chips?: RoutingChips;
  supervisor_id?: number | null;
  supervisor_display_name?: string | null;
  supervisor_from_profile?: boolean;
  documentation_status?: DocumentationStatus | null;
}

interface DoctorPatientBannerProps {
  preview: PatientPreview;
  visit: DoctorVisit;
  signMeta: DoctorSignMeta;
  /** Hero header already shows name, queue #, visit type, and CC. */
  slim?: boolean;
}

export function DoctorPatientBanner({ preview, visit, signMeta, slim = false }: DoctorPatientBannerProps) {
  const vitalsToday = preview.vitals_today;
  const bannerProps = bannerPropsFromPreview(preview);
  const mrdEnabled = bannerProps.bannerMrdDeepLinks;
  const pid = preview.identity.pid;
  const chartOpenUrl = preview.completion.chart_open_url;
  const vitalsHref = buildMrdClinicalDeepLink(pid, MRD_CLINICAL_ANCHORS.vitals, chartOpenUrl);

  const signed = signMeta.encounter_signed;
  const requireSign = signMeta.require_esign_before_complete_consult;
  const bannerRef = useConsultReadyBanner();

  const allergyChips = buildAllergyChips(preview.safety, {
    mrdDeepLinks: mrdEnabled,
    pid,
    chartOpenUrl,
    showAllergyCountChip: bannerProps.showAllergyCountChip,
  });

  const metaBlock = (
    <dl className="nc-doctor-banner-meta">
      {signMeta.routing_chips && (
        <div className="nc-doctor-banner-meta__row">
          <dt className="nc-doctor-banner-meta__label">Routing</dt>
          <dd className="nc-doctor-banner-meta__value">
            <RoutingChipsBadges
              chips={signMeta.routing_chips}
              mrdDeepLinks={mrdEnabled}
              pid={pid}
              chartOpenUrl={chartOpenUrl}
            />
          </dd>
        </div>
      )}

      <div className="nc-doctor-banner-meta__row nc-doctor-banner-meta__row--inline">
        <dt className="nc-doctor-banner-meta__label">Visit</dt>
        <dd className="nc-doctor-banner-meta__value">
          Encounter #{visit.encounter}
          {vitalsToday?.vitals_abnormal_today && (
            <BannerClinicalLink
              enabled={mrdEnabled}
              href={vitalsHref}
              className={cn(badgeVariants({ variant: 'danger' }), 'ml-1')}
            >
              Vitals abnormal
            </BannerClinicalLink>
          )}
          <DocumentationStatusChip
            documentationStatus={signMeta.documentation_status}
            requireSign={requireSign}
            encounterSigned={signed}
          />
        </dd>
      </div>

      <div className="nc-doctor-banner-meta__row">
        <dt className="nc-doctor-banner-meta__label">Vitals today</dt>
        <dd className="nc-doctor-banner-meta__value">
          {vitalsToday?.summary ? (
            <BannerClinicalLink enabled={mrdEnabled} href={vitalsHref}>
              {vitalsToday.summary}
            </BannerClinicalLink>
          ) : (
            <BannerClinicalLink
              enabled={mrdEnabled}
              href={vitalsHref}
              className="text-[var(--color-oe-warning,#ea580c)]"
            >
              No vitals today
            </BannerClinicalLink>
          )}
        </dd>
      </div>
    </dl>
  );

  if (slim) {
    return (
      <div
        ref={bannerRef}
        id="nc-patient-context-banner"
        className="nc-doctor-patient-banner nc-doctor-patient-banner--slim"
      >
        <ChipCloud chips={allergyChips} />
        {metaBlock}
      </div>
    );
  }

  return (
    <div ref={bannerRef} id="nc-patient-context-banner" className="nc-doctor-patient-banner">
      <PatientContextBanner
        identity={preview.identity}
        layout="compact"
        completion={preview.completion}
        safety={preview.safety}
        chiefComplaint={visit.chief_complaint}
        {...bannerProps}
      >
        {metaBlock}
      </PatientContextBanner>
    </div>
  );
}
