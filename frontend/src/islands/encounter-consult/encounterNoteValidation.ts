import type {
  EncounterConsultSectionId,
  EncounterNotePrefill,
  EncounterNoteSections,
  EncounterProblemRow,
  EncounterSupervisorMeta,
} from './encounterConsultTypes';
import type { EncounterNoteConfig, EncounterNoteVariant } from './encounterVariants';
import { isEncounterNoteVariant, visibleSectionIds } from './encounterVariants';

export interface EncounterValidationIssue {
  section: EncounterConsultSectionId | 'context';
  field: string;
  message: string;
}

export interface EncounterValidationResult {
  valid: boolean;
  errors: EncounterValidationIssue[];
}

export interface EncounterValidationContext {
  variant: EncounterNoteVariant;
  config: EncounterNoteConfig;
  prefill: EncounterNotePrefill;
  supervisor?: EncounterSupervisorMeta;
}

function requiresAllergiesAck(prefill: EncounterNotePrefill): boolean {
  return prefill.allergies.undocumented
    || prefill.allergies.items.length > 0
    || prefill.allergies.nkda;
}

function requiresMedsAck(prefill: EncounterNotePrefill): boolean {
  return prefill.medications.items.length > 0;
}

function activeProblems(problems: EncounterProblemRow[]): EncounterProblemRow[] {
  return problems.filter((problem) => problem.status !== 'resolved');
}

function hasLegacyAssessmentPlan(sections: EncounterNoteSections): boolean {
  return sections.assessment.narrative.trim().length > 0
    && sections.plan.narrative.trim().length > 0;
}

function validateProblems(
  sections: EncounterNoteSections,
  variant: EncounterNoteVariant,
  config: EncounterNoteConfig,
  errors: EncounterValidationIssue[],
): void {
  const problems = sections.problems.items ?? [];
  const active = activeProblems(problems);

  if (active.length === 0 && !hasLegacyAssessmentPlan(sections)) {
    errors.push({
      section: 'problems',
      field: 'items',
      message: 'Add at least one active problem with assessment and plan',
    });
    return;
  }

  if (active.length === 0) {
    return;
  }

  active.forEach((problem, index) => {
    const label = problem.problem_label.trim();
    if (label === '') {
      errors.push({
        section: 'problems',
        field: `problem_${index}_label`,
        message: `Problem ${index + 1}: label is required`,
      });
    }

    if (config.require_icd && problem.icd10_code.trim() === '') {
      errors.push({
        section: 'problems',
        field: `problem_${index}_icd10_code`,
        message: `Problem ${index + 1}: ICD-10 code is required`,
      });
    }

    if (variant === 'referral_consult' && problem.differential.trim() === '') {
      errors.push({
        section: 'problems',
        field: `problem_${index}_differential`,
        message: `Problem ${index + 1}: differential diagnosis is required for referral consults`,
      });
    }

    const planItems = problem.plan_items.filter((item) => item.text.trim() !== '');
    if (planItems.length === 0) {
      errors.push({
        section: 'problems',
        field: `problem_${index}_plan_items`,
        message: `Problem ${index + 1}: add at least one plan item`,
      });
    }
  });

  if (variant === 'pre_procedure') {
    const hasClearance = active.some((problem) => problem.plan_items.some((item) => {
      const text = item.text.toLowerCase();
      return text.includes('clearance') || text.includes('cleared');
    }));
    if (!hasClearance) {
      errors.push({
        section: 'problems',
        field: 'clearance',
        message: 'Pre-procedure visit requires a clearance statement in the plan',
      });
    }
  }
}

export function validateEncounterNote(
  sections: EncounterNoteSections,
  context: EncounterValidationContext,
): EncounterValidationResult {
  const errors: EncounterValidationIssue[] = [];
  const variant = isEncounterNoteVariant(context.variant) ? context.variant : 'general_opd';
  const visible = new Set(visibleSectionIds(variant));

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
      message: variant === 'follow_up'
        ? 'Interval history is required for follow-up visits'
        : 'History of present illness is required',
    });
  }

  if (!sections.pe.general.trim()) {
    errors.push({
      section: 'pe',
      field: 'general',
      message: 'Physical examination is required',
    });
  }

  if (visible.has('ros')) {
    const reviewed = sections.ros.systems.some((row) => row.status !== 'not_reviewed');
    if (!reviewed && !sections.ros.narrative.trim()) {
      errors.push({
        section: 'ros',
        field: 'systems',
        message: variant === 'referral_consult'
          ? 'Review at least one system or add a ROS narrative for referral consults'
          : 'Review at least one system or add a ROS narrative',
      });
    }
  }

  if (visible.has('referral')) {
    if (!sections.referral.requesting_clinician.trim()) {
      errors.push({
        section: 'referral',
        field: 'requesting_clinician',
        message: 'Requesting clinician is required',
      });
    }
    if (!sections.referral.requesting_service.trim()) {
      errors.push({
        section: 'referral',
        field: 'requesting_service',
        message: 'Requesting service is required',
      });
    }
    if (!sections.referral.clinical_question.trim()) {
      errors.push({
        section: 'referral',
        field: 'clinical_question',
        message: 'Clinical question is required for referral consults',
      });
    }
  }

  if (visible.has('source')) {
    if (sections.source.sources.length === 0 && !sections.source.narrative.trim()) {
      errors.push({
        section: 'source',
        field: 'sources',
        message: 'Select at least one source of information or add a narrative',
      });
    }
  }

  validateProblems(sections, variant, context.config, errors);

  if (visible.has('attestation') && context.config.supervisor_required) {
    if (!context.supervisor?.supervisor_id) {
      errors.push({
        section: 'attestation',
        field: 'supervisor_id',
        message: 'Select a supervising provider before signing',
      });
    }
    if (!sections.attestation.supervisor_attested) {
      errors.push({
        section: 'attestation',
        field: 'supervisor_attested',
        message: 'Supervisor attestation is required before signing',
      });
    }
  }

  if (requiresAllergiesAck(context.prefill) && !sections.context.allergies_acknowledged) {
    errors.push({
      section: 'context',
      field: 'allergies_acknowledged',
      message: 'Review and acknowledge allergies before signing',
    });
  }

  if (requiresMedsAck(context.prefill) && !sections.context.meds_acknowledged) {
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
