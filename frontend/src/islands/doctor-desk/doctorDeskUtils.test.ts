import { describe, expect, it } from 'vitest';
import type { DoctorConsultPayload } from '@core/types';
import { rxReturnNotice } from './doctorDeskUtils';

function payload(overrides: Partial<DoctorConsultPayload> = {}): DoctorConsultPayload {
  return {
    visit: {
      id: 1,
      pid: 2,
      encounter: 3,
      state: 'with_doctor',
      queue_number: '4',
      row_version: 1,
    },
    preview: {
      identity: {
        pid: 2,
        pubpid: '001',
        display_name: 'Test Patient',
        sex: 'Male',
        age_years: '30',
      },
      completion: {
        score: 0,
        billing_threshold: 70,
      },
    },
    encounter_signed: false,
    require_esign_before_complete_consult: false,
    pharm_ops_enabled: true,
    prescriptions: [],
    ...overrides,
  };
}

describe('rxReturnNotice', () => {
  it('returns null when pharm ops disabled', () => {
    expect(rxReturnNotice(payload({ pharm_ops_enabled: false }))).toBeNull();
  });

  it('returns info when no prescriptions', () => {
    const notice = rxReturnNotice(payload());
    expect(notice?.variant).toBe('info');
    expect(notice?.message).toMatch(/No prescriptions/);
  });

  it('returns success when prescriptions present', () => {
    const notice = rxReturnNotice(payload({
      prescriptions: [
        {
          id: 1,
          drug: 'Amoxicillin',
          sig: 'TID',
          quantity: '21',
          status: 'to_dispense',
          stock_status: 'in_stock',
        },
      ],
    }));
    expect(notice?.variant).toBe('success');
    expect(notice?.message).toMatch(/stock badges/);
  });
});
