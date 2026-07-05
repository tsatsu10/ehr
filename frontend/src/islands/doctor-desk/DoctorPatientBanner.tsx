/**
 * DoctorPatientBanner — active consult patient context strip.
 */

import type { DoctorVisit, PatientPreview, RoutingChips, DocumentationStatus } from '@core/types';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { Badge, badgeVariants } from '@components/ui/badge';
import { useConsultReadyBanner } from '@components/useConsultReadyBanner';
import { RoutingChips as RoutingChipsBadges } from '@components/RoutingChips';
import { BannerClinicalLink } from '@components/BannerClinicalLink';
import { bannerPropsFromPreview } from '@components/bannerPreviewProps';
import { buildMrdClinicalDeepLink, MRD_CLINICAL_ANCHORS } from '@core/mrdBannerLinks';
import { cn } from '@/lib/utils';
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
}

export function DoctorPatientBanner({ preview, visit, signMeta }: DoctorPatientBannerProps) {
  const vitalsToday = preview.vitals_today;
  const bannerProps = bannerPropsFromPreview(preview);
  const mrdEnabled = bannerProps.bannerMrdDeepLinks;
  const pid = preview.identity.pid;
  const chartOpenUrl = preview.completion.chart_open_url;
  const vitalsHref = buildMrdClinicalDeepLink(pid, MRD_CLINICAL_ANCHORS.vitals, chartOpenUrl);

  const signed = signMeta.encounter_signed;
  const requireSign = signMeta.require_esign_before_complete_consult;
  const bannerRef = useConsultReadyBanner();

  return (
    <div ref={bannerRef} id="nc-patient-context-banner" className="mb-3">
      <PatientContextBanner
        identity={preview.identity}
        layout="compact"
        completion={preview.completion}
        safety={preview.safety}
        chiefComplaint={visit.chief_complaint}
        {...bannerProps}
        aside={<Badge variant="success">In consult #{visit.queue_number}</Badge>}
      >
      {signMeta.routing_chips && (
        <div className="text-sm mt-1">
          <RoutingChipsBadges
            chips={signMeta.routing_chips}
            mrdDeepLinks={mrdEnabled}
            pid={pid}
            chartOpenUrl={chartOpenUrl}
          />
        </div>
      )}

      <div className="text-sm mt-1">
        Encounter #{visit.encounter}
        {' · '}
        {visit.visit_type_label || 'Visit'}
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
      </div>

      <div className="text-sm mt-1">
        {vitalsToday?.summary ? (
          <>
            Vitals today:{' '}
            <BannerClinicalLink enabled={mrdEnabled} href={vitalsHref}>
              {vitalsToday.summary}
            </BannerClinicalLink>
          </>
        ) : (
          <BannerClinicalLink
            enabled={mrdEnabled}
            href={vitalsHref}
            className="text-[var(--color-oe-warning,#ea580c)]"
          >
            No vitals today
          </BannerClinicalLink>
        )}
      </div>
    </PatientContextBanner>
    </div>
  );
}
