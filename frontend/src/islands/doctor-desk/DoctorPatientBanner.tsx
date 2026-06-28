/**
 * DoctorPatientBanner — active consult patient context strip.
 *
 * Mirrors renderBanner() from doctor.js (completion strip + consult metadata + e-sign chip).
 */

import type { ReactNode } from 'react';
import type { DoctorVisit, PatientPreview, RoutingChips } from '@core/types';
import { RoutingChips as RoutingChipsBadges } from '@components/RoutingChips';

export interface DoctorSignMeta {
  encounter_signed: boolean;
  require_esign_before_complete_consult: boolean;
  encounter_url?: string;
  routing_chips?: RoutingChips;
  supervisor_id?: number | null;
  supervisor_display_name?: string | null;
  supervisor_from_profile?: boolean;
}

interface DoctorPatientBannerProps {
  preview: PatientPreview;
  visit: DoctorVisit;
  signMeta: DoctorSignMeta;
}

export function DoctorPatientBanner({ preview, visit, signMeta }: DoctorPatientBannerProps) {
  const identity = preview.identity;
  const completion = preview.completion;
  const safety = preview.safety;
  const vitalsToday = preview.vitals_today;
  const severeAllergies = safety?.allergies_severe ?? [];

  const signed = signMeta.encounter_signed;
  const requireSign = signMeta.require_esign_before_complete_consult;

  let docChip: ReactNode;
  if (signed) {
    docChip = <span className="badge badge-success ml-2">Signed</span>;
  } else if (requireSign) {
    docChip = <span className="badge badge-danger ml-2">Unsigned — sign before complete</span>;
  } else {
    docChip = <span className="badge badge-warning ml-2">Unsigned — payment blocked</span>;
  }

  return (
    <>
      {completion.score < completion.billing_threshold && (
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

      <div className="nc-patient-context-banner mb-3 p-3 border rounded bg-light">
        <div className="d-flex justify-content-between flex-wrap">
          <div>
            <strong>{identity.display_name}</strong>
            {' · '}
            {identity.sex}
            {' '}
            {identity.age_years}
            {' · MRN '}
            {identity.pubpid}
          </div>
          <span className="badge badge-success">In consult #{visit.queue_number}</span>
        </div>

        {severeAllergies.length > 0 && (
          <div className="text-danger small mt-1">
            Allergy: {severeAllergies.join(', ')}
          </div>
        )}

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
          {docChip}
        </div>

        <div className="small mt-1">
          {vitalsToday?.summary
            ? <>Vitals today: {vitalsToday.summary}</>
            : <span className="text-warning">No vitals today</span>}
        </div>
      </div>
    </>
  );
}
