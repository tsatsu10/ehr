import type { MutableRefObject } from 'react';
import type {
  DoctorConsultPayload,
  PharmacyPrescriptionLine,
  RoutingPreview,
} from '@core/types';
import type { DoctorSignMeta } from './DoctorPatientBanner';

export function payloadToSignMeta(data: DoctorConsultPayload): DoctorSignMeta {
  return {
    encounter_signed: !!data.encounter_signed,
    require_esign_before_complete_consult: !!data.require_esign_before_complete_consult,
    encounter_url: data.encounter_url,
    routing_chips: data.routing_chips,
    supervisor_id: data.supervisor_id,
    supervisor_display_name: data.supervisor_display_name,
    supervisor_from_profile: data.supervisor_from_profile,
    documentation_status: data.documentation_status ?? null,
  };
}

export function applyConsultPayload(
  data: DoctorConsultPayload,
  setActiveVisit: (v: DoctorConsultPayload['visit']) => void,
  setActivePreview: (p: DoctorConsultPayload['preview']) => void,
  setRoutingPreview: (r: RoutingPreview | null) => void,
  setSignMeta: (s: DoctorSignMeta) => void,
  setActiveVisitId: (id: number) => void,
  setPharmOpsConsult: (value: {
    pharm_ops_enabled?: boolean;
    rx_print_enabled?: boolean;
    can_print_rx?: boolean;
    prescriptions?: PharmacyPrescriptionLine[];
    rx_list_url?: string;
  }) => void,
  activeVisitRef?: MutableRefObject<DoctorConsultPayload['visit'] | null>,
) {
  setActiveVisit(data.visit);
  if (activeVisitRef) {
    activeVisitRef.current = data.visit;
  }
  setActivePreview(data.preview);
  setRoutingPreview(data.routing_preview ?? null);
  setSignMeta(payloadToSignMeta(data));
  setActiveVisitId(data.visit.id);
  setPharmOpsConsult({
    pharm_ops_enabled: data.pharm_ops_enabled,
    rx_print_enabled: data.rx_print_enabled,
    can_print_rx: data.can_print_rx,
    prescriptions: data.prescriptions,
    rx_list_url: data.rx_list_url,
  });
}
