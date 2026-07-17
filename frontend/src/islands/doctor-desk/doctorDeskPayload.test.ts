import { describe, expect, it, vi } from 'vitest';
import { applyConsultPayload, payloadToSignMeta } from './doctorDeskPayload';
import type { DoctorConsultPayload } from '@core/types';

function payload(overrides: Partial<DoctorConsultPayload> = {}): DoctorConsultPayload {
  return {
    visit: {
      id: 7,
      pid: 12,
      encounter: 99,
      queue_number: '3',
      state: 'with_doctor',
      row_version: 3,
    },
    preview: {
      identity: { pid: 12, pubpid: 'MRN012', display_name: 'Kwame Mensah', sex: 'M', age_years: '45' },
      completion: { score: 90, billing_threshold: 70 },
    },
    routing_preview: { detected_lab: false, detected_rx: false, lab_count: 0, rx_count: 0 },
    encounter_signed: false,
    require_esign_before_complete_consult: false,
    ...overrides,
  } as DoctorConsultPayload;
}

describe('payloadToSignMeta', () => {
  it('maps sign, routing, supervisor, and documentation fields onto a flat sign meta', () => {
    const data = payload({
      encounter_signed: true,
      require_esign_before_complete_consult: true,
      encounter_url: '/encounter/7',
      supervisor_id: 4,
      supervisor_display_name: 'Dr. Owusu',
      supervisor_from_profile: true,
      documentation_status: { unsigned_required: [], hub_enabled: true } as never,
    });

    expect(payloadToSignMeta(data)).toEqual({
      encounter_signed: true,
      require_esign_before_complete_consult: true,
      encounter_url: '/encounter/7',
      routing_chips: undefined,
      supervisor_id: 4,
      supervisor_display_name: 'Dr. Owusu',
      supervisor_from_profile: true,
      documentation_status: { unsigned_required: [], hub_enabled: true },
    });
  });

  it('coerces missing sign flags to false and missing documentation status to null', () => {
    const data = payload({ encounter_signed: undefined as never, require_esign_before_complete_consult: undefined as never });
    const meta = payloadToSignMeta(data);
    expect(meta.encounter_signed).toBe(false);
    expect(meta.require_esign_before_complete_consult).toBe(false);
    expect(meta.documentation_status).toBeNull();
  });
});

describe('applyConsultPayload', () => {
  it('fans the payload out to every setter and the active-visit ref', () => {
    const data = payload({
      pharm_ops_enabled: true,
      rx_print_enabled: true,
      can_print_rx: true,
      prescriptions: [{ id: 1, drug: 'Paracetamol', sig: '1 tab', quantity: '10', status: 'to_dispense' }],
      rx_list_url: '/rx-history.php?pid=12',
    });

    const setActiveVisit = vi.fn();
    const setActivePreview = vi.fn();
    const setRoutingPreview = vi.fn();
    const setSignMeta = vi.fn();
    const setActiveVisitId = vi.fn();
    const setPharmOpsConsult = vi.fn();
    const activeVisitRef = { current: null } as { current: DoctorConsultPayload['visit'] | null };

    applyConsultPayload(
      data,
      setActiveVisit,
      setActivePreview,
      setRoutingPreview,
      setSignMeta,
      setActiveVisitId,
      setPharmOpsConsult,
      activeVisitRef,
    );

    expect(setActiveVisit).toHaveBeenCalledWith(data.visit);
    expect(activeVisitRef.current).toBe(data.visit);
    expect(setActivePreview).toHaveBeenCalledWith(data.preview);
    expect(setRoutingPreview).toHaveBeenCalledWith(data.routing_preview);
    expect(setActiveVisitId).toHaveBeenCalledWith(7);
    expect(setPharmOpsConsult).toHaveBeenCalledWith({
      pharm_ops_enabled: true,
      rx_print_enabled: true,
      can_print_rx: true,
      prescriptions: data.prescriptions,
      rx_list_url: '/rx-history.php?pid=12',
    });
  });

  it('defaults routing preview to null when the payload omits it', () => {
    const data = payload({ routing_preview: undefined as never });
    const setRoutingPreview = vi.fn();

    applyConsultPayload(
      data,
      vi.fn(),
      vi.fn(),
      setRoutingPreview,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    expect(setRoutingPreview).toHaveBeenCalledWith(null);
  });

  it('works without an activeVisitRef (optional argument)', () => {
    const data = payload();
    expect(() =>
      applyConsultPayload(data, vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()),
    ).not.toThrow();
  });
});
