import { describe, expect, it } from 'vitest';
import { deskActionForState, computeNowServing } from './visitBoardUtils';
import type { VisitCard } from '@core/types';

const deskUrls = {
  front_desk: '/front-desk',
  triage: '/triage',
  doctor: '/doctor',
  lab: '/lab',
  pharmacy: '/pharmacy',
  cashier: '/cashier',
};

describe('deskActionForState', () => {
  it('maps waiting to front desk', () => {
    expect(deskActionForState('waiting', deskUrls)).toEqual({
      label: 'Open Front Desk',
      url: '/front-desk',
    });
  });

  it('maps ready_for_doctor to doctor desk', () => {
    expect(deskActionForState('ready_for_doctor', deskUrls)).toEqual({
      label: 'Open Doctor Desk',
      url: '/doctor',
    });
  });

  it('returns null when desk URL is missing', () => {
    expect(deskActionForState('waiting', {})).toBeNull();
  });

  it('returns null for completed visits', () => {
    expect(deskActionForState('completed', deskUrls)).toBeNull();
  });
});

describe('computeNowServing', () => {
  const baseCard = (overrides: Partial<VisitCard>): VisitCard => ({
    id: 1,
    queue_number: '1',
    display_name: 'Test',
    pid: 1,
    pubpid: 'MRN1',
    state: 'waiting',
    sex: 'M',
    age_years: '30',
    wait_minutes: 5,
    wait_label: '5m',
    visit_date: '2099-06-27',
    visit_type_label: 'OPD',
    chief_complaint: '',
    is_urgent: 0,
    skipped_triage: false,
    similar_surname_today: false,
    claim_lost: false,
    ...overrides,
  });

  it('prefers with_doctor over waiting', () => {
    const result = computeNowServing({
      doctor: [baseCard({ id: 2, queue_number: '5', state: 'with_doctor' })],
      waiting: [baseCard({ id: 1, queue_number: '1', state: 'waiting' })],
    });
    expect(result?.queue_number).toBe('5');
  });

  it('returns lowest queue number within same priority state', () => {
    const result = computeNowServing({
      waiting: [
        baseCard({ id: 2, queue_number: '8', state: 'waiting' }),
        baseCard({ id: 1, queue_number: '2', state: 'waiting' }),
      ],
    });
    expect(result?.queue_number).toBe('2');
  });
});
