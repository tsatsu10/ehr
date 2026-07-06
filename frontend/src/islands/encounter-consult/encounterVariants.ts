import type { EncounterConsultSectionId } from './encounterConsultTypes';

export const ENCOUNTER_NOTE_VARIANTS = [
  'general_opd',
  'referral_consult',
  'follow_up',
  'pre_procedure',
] as const;

export type EncounterNoteVariant = (typeof ENCOUNTER_NOTE_VARIANTS)[number];

export const SOURCE_OF_INFORMATION_OPTIONS = [
  'Patient',
  'Family / caregiver',
  'Referring clinician',
  'Chart review',
  'Nursing staff',
  'Other',
] as const;

export const PROBLEM_STATUSES = ['new', 'stable', 'worsening', 'resolved'] as const;
export type ProblemStatus = (typeof PROBLEM_STATUSES)[number];

export const PLAN_ITEM_TYPES = ['order', 'rx', 'referral', 'education', 'follow_up'] as const;
export type PlanItemType = (typeof PLAN_ITEM_TYPES)[number];

export const URGENCY_OPTIONS = ['routine', 'urgent', 'emergent'] as const;

export interface EncounterNoteConfig {
  require_icd: boolean;
  supervisor_required: boolean;
}

export function isEncounterNoteVariant(value: string): value is EncounterNoteVariant {
  return (ENCOUNTER_NOTE_VARIANTS as readonly string[]).includes(value);
}

export function variantLabel(variant: EncounterNoteVariant): string {
  switch (variant) {
    case 'general_opd':
      return 'General OPD';
    case 'referral_consult':
      return 'Referral consult';
    case 'follow_up':
      return 'Follow-up';
    case 'pre_procedure':
      return 'Pre-procedure';
    default: {
      const never: never = variant;
      return never;
    }
  }
}

export function visibleSectionIds(variant: EncounterNoteVariant): EncounterConsultSectionId[] {
  const base: EncounterConsultSectionId[] = ['cc', 'hpi', 'vitals', 'pe', 'problems'];

  switch (variant) {
    case 'general_opd':
      return base;
    case 'referral_consult':
      return ['referral', 'source', ...base, 'attestation'];
    case 'follow_up':
      return base;
    case 'pre_procedure':
      return ['source', ...base, 'attestation'];
    default: {
      const never: never = variant;
      return never;
    }
  }
}

export function newProblemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `problem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newPlanItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
