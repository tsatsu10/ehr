import { describe, expect, it } from 'vitest';
import {
  emptyBackgroundPrefill,
  mergeSections,
} from './encounterConsultTypes';

describe('mergeSections referral prefill', () => {
  it('applies referral header prefill when saved referral fields are empty', () => {
    const sections = mergeSections({}, {
      chief_complaint: 'Chest pain',
      vitals: {
        latest: {},
        summary: null,
        warnings: [],
        abnormal: false,
        missing: false,
      },
      allergies: {
        items: [],
        undocumented: false,
        nkda: false,
        summary: null,
        edit_url: null,
      },
      medications: {
        items: [],
        summary: null,
        edit_url: null,
      },
      background: emptyBackgroundPrefill(),
      recent_labs: [],
      referral: {
        requesting_clinician: 'Dr Mensah',
        requesting_service: 'Regional Hospital — Medicine',
        clinical_question: 'Evaluate new murmur',
        urgency: 'urgent',
        has_referral_record: true,
      },
      patient: {
        display_name: 'Jane Doe',
        queue_number: 12,
      },
    });

    expect(sections.referral).toEqual({
      requesting_clinician: 'Dr Mensah',
      requesting_service: 'Regional Hospital — Medicine',
      clinical_question: 'Evaluate new murmur',
      urgency: 'urgent',
    });
  });

  it('keeps saved referral values over prefill', () => {
    const sections = mergeSections({
      referral: {
        requesting_clinician: 'Saved clinician',
        requesting_service: 'Saved service',
        clinical_question: 'Saved question',
        urgency: 'routine',
      },
    }, {
      chief_complaint: '',
      vitals: {
        latest: {},
        summary: null,
        warnings: [],
        abnormal: false,
        missing: false,
      },
      allergies: {
        items: [],
        undocumented: false,
        nkda: false,
        summary: null,
        edit_url: null,
      },
      medications: {
        items: [],
        summary: null,
        edit_url: null,
      },
      background: emptyBackgroundPrefill(),
      recent_labs: [],
      referral: {
        requesting_clinician: 'Prefill clinician',
        requesting_service: 'Prefill service',
        clinical_question: 'Prefill question',
        urgency: 'urgent',
      },
      patient: {
        display_name: 'Jane Doe',
        queue_number: 1,
      },
    });

    expect(sections.referral.requesting_clinician).toBe('Saved clinician');
    expect(sections.referral.clinical_question).toBe('Saved question');
  });
});
