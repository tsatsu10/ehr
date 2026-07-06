import { describe, expect, it } from 'vitest';
import { emptySections, mergeSections } from './encounterConsultTypes';
import { validateEncounterNote } from './encounterNoteValidation';

const basePrefill = {
  chief_complaint: 'Headache',
  vitals: {
    latest: {},
    summary: null,
    warnings: [],
    abnormal: false,
    missing: true,
  },
  allergies: {
    items: ['Penicillin'],
    undocumented: false,
    nkda: false,
    summary: 'Penicillin',
    edit_url: null,
  },
  medications: {
    items: ['Paracetamol'],
    summary: 'Paracetamol',
    edit_url: null,
  },
  patient: { display_name: 'Jane Doe', queue_number: 12 },
};

describe('encounterConsultTypes', () => {
  it('prefills chief complaint when saved draft is empty', () => {
    const merged = mergeSections(emptySections(), basePrefill);
    expect(merged.cc.chief_complaint).toBe('Headache');
  });

  it('keeps saved chief complaint over prefill', () => {
    const merged = mergeSections(
      { cc: { chief_complaint: 'Saved CC' } },
      { ...basePrefill, chief_complaint: 'Prefill CC' },
    );
    expect(merged.cc.chief_complaint).toBe('Saved CC');
  });
});

describe('encounterNoteValidation', () => {
  it('requires core sections and context acknowledgments', () => {
    const result = validateEncounterNote(emptySections(), basePrefill);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.section === 'cc')).toBe(true);
    expect(result.errors.some((error) => error.field === 'allergies_acknowledged')).toBe(true);
    expect(result.errors.some((error) => error.field === 'meds_acknowledged')).toBe(true);
  });

  it('passes when required sections and acknowledgments are complete', () => {
    const sections = {
      ...emptySections(),
      cc: { chief_complaint: 'Headache' },
      hpi: {
        ...emptySections().hpi,
        narrative: 'Started yesterday',
      },
      pe: { general: 'Normal exam' },
      assessment: { narrative: 'Tension headache' },
      plan: { narrative: 'Rest and fluids' },
      context: {
        allergies_acknowledged: true,
        meds_acknowledged: true,
      },
    };

    expect(validateEncounterNote(sections, basePrefill).valid).toBe(true);
  });
});
