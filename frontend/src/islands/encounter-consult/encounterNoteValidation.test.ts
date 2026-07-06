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
  patient: { display_name: 'Jane Doe', queue_number: 12 },
};

const completeProblemSections = () => {
  const sections = emptySections();
  sections.cc.chief_complaint = 'Headache';
  sections.hpi.narrative = 'Started yesterday';
  sections.pe.general = 'Normal exam';
  sections.problems.items = [{
    id: 'p1',
    problem_label: 'Tension headache',
    icd10_code: 'G44.2',
    icd10_label: 'Tension-type headache',
    status: 'new',
    assessment_narrative: 'Likely tension headache',
    differential: 'Migraine',
    plan_items: [{ id: 'plan1', type: 'education', text: 'Rest and fluids' }],
  }];
  return sections;
};

describe('encounterConsultTypes', () => {
  it('prefills chief complaint when saved draft is empty', () => {
    const merged = mergeSections(emptySections(), basePrefill);
    expect(merged.cc.chief_complaint).toBe('Headache');
  });

  it('migrates legacy assessment/plan into a problem row', () => {
    const merged = mergeSections({
      assessment: { narrative: 'HTN' },
      plan: { narrative: 'Start amlodipine' },
    }, basePrefill);
    expect(merged.problems.items[0]?.assessment_narrative).toBe('HTN');
    expect(merged.problems.items[0]?.plan_items[0]?.text).toBe('Start amlodipine');
  });
});

describe('encounterNoteValidation', () => {
  it('requires referral clinical question for referral_consult variant', () => {
    const sections = completeProblemSections();
    const result = validateEncounterNote(sections, {
      variant: 'referral_consult',
      config: { require_icd: false, supervisor_required: false },
      prefill: basePrefill,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field === 'clinical_question')).toBe(true);
  });

  it('passes referral consult when referral header and problems are complete', () => {
    const sections = completeProblemSections();
    sections.referral = {
      requesting_clinician: 'Dr Smith',
      requesting_service: 'Cardiology',
      clinical_question: 'Evaluate chest pain',
      urgency: 'routine',
    };
    sections.source = { sources: ['Patient'], narrative: '' };

    const result = validateEncounterNote(sections, {
      variant: 'referral_consult',
      config: { require_icd: false, supervisor_required: false },
      prefill: basePrefill,
    });
    expect(result.valid).toBe(true);
  });

  it('requires plan item per active problem', () => {
    const sections = completeProblemSections();
    sections.problems.items[0].plan_items = [];

    const result = validateEncounterNote(sections, {
      variant: 'general_opd',
      config: { require_icd: false, supervisor_required: false },
      prefill: basePrefill,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.field.includes('plan_items'))).toBe(true);
  });
});
