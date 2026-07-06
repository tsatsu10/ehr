import { describe, expect, it } from 'vitest';
import { emptySections, mergeSections } from './encounterConsultTypes';

describe('encounterConsultTypes', () => {
  it('prefills chief complaint when saved draft is empty', () => {
    const merged = mergeSections(emptySections(), {
      chief_complaint: 'Headache',
      vitals: {
        latest: {},
        summary: null,
        warnings: [],
        abnormal: false,
        missing: true,
      },
      patient: { display_name: 'Jane Doe', queue_number: 12 },
    });

    expect(merged.cc.chief_complaint).toBe('Headache');
  });

  it('keeps saved chief complaint over prefill', () => {
    const merged = mergeSections(
      {
        cc: { chief_complaint: 'Saved CC' },
      },
      {
        chief_complaint: 'Prefill CC',
        vitals: {
          latest: {},
          summary: null,
          warnings: [],
          abnormal: false,
          missing: true,
        },
        patient: { display_name: 'Jane Doe', queue_number: 12 },
      },
    );

    expect(merged.cc.chief_complaint).toBe('Saved CC');
  });
});
