/**
 * DoctorPatientBanner — active consult patient context strip.
 */

import type { DoctorVisit, PatientPreview, RoutingChips, DocumentationStatus } from '@core/types';
import { PatientContextBanner } from '@components/PatientContextBanner';
import { RoutingChips as RoutingChipsBadges } from '@components/RoutingChips';
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

  const signed = signMeta.encounter_signed;
  const requireSign = signMeta.require_esign_before_complete_consult;

  return (
    <PatientContextBanner
      identity={preview.identity}
      layout="compact"
      completion={preview.completion}
      safety={preview.safety}
      aside={<span className="badge badge-success">In consult #{visit.queue_number}</span>}
    >
      {visit.chief_complaint && (
        <div className="small mt-1">CC: {visit.chief_complaint}</div>
      )}

      {signMeta.routing_chips && (
        <div className="small mt-1">
          <RoutingChipsBadges chips={signMeta.routing_chips} />
        </div>
      )}

      <div className="small mt-1">
        Encounter #{visit.encounter}
        {' · '}
        {visit.visit_type_label || 'Visit'}
        {vitalsToday?.vitals_abnormal_today && (
          <span className="badge badge-danger ml-1">Vitals abnormal</span>
        )}
        <DocumentationStatusChip
          documentationStatus={signMeta.documentation_status}
          requireSign={requireSign}
          encounterSigned={signed}
        />
      </div>

      <div className="small mt-1">
        {vitalsToday?.summary
          ? <>Vitals today: {vitalsToday.summary}</>
          : <span className="text-warning">No vitals today</span>}
      </div>
    </PatientContextBanner>
  );
}
