import type {
  EncounterConsultSectionId,
  EncounterNotePrefill,
  EncounterNoteSections,
} from './encounterConsultTypes';

export interface EncounterValidationIssue {
  section: EncounterConsultSectionId | 'context';
  field: string;
  message: string;
}

export interface EncounterValidationResult {
  valid: boolean;
  errors: EncounterValidationIssue[];
}

function requiresAllergiesAck(prefill: EncounterNotePrefill): boolean {
  return prefill.allergies.undocumented
    || prefill.allergies.items.length > 0
    || prefill.allergies.nkda;
}

function requiresMedsAck(prefill: EncounterNotePrefill): boolean {
  return prefill.medications.items.length > 0;
}

export function validateEncounterNote(
  sections: EncounterNoteSections,
  prefill: EncounterNotePrefill,
): EncounterValidationResult {
  const errors: EncounterValidationIssue[] = [];

  if (!sections.cc.chief_complaint.trim()) {
    errors.push({
      section: 'cc',
      field: 'chief_complaint',
      message: 'Chief complaint is required',
    });
  }

  if (!sections.hpi.narrative.trim()) {
    errors.push({
      section: 'hpi',
      field: 'narrative',
      message: 'History of present illness is required',
    });
  }

  if (!sections.pe.general.trim()) {
    errors.push({
      section: 'pe',
      field: 'general',
      message: 'Physical examination is required',
    });
  }

  if (!sections.assessment.narrative.trim()) {
    errors.push({
      section: 'assessment',
      field: 'narrative',
      message: 'Assessment is required',
    });
  }

  if (!sections.plan.narrative.trim()) {
    errors.push({
      section: 'plan',
      field: 'plan',
      message: 'Plan is required',
    });
  }

  if (requiresAllergiesAck(prefill) && !sections.context.allergies_acknowledged) {
    errors.push({
      section: 'context',
      field: 'allergies_acknowledged',
      message: 'Review and acknowledge allergies before signing',
    });
  }

  if (requiresMedsAck(prefill) && !sections.context.meds_acknowledged) {
    errors.push({
      section: 'context',
      field: 'meds_acknowledged',
      message: 'Review and acknowledge medications before signing',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
