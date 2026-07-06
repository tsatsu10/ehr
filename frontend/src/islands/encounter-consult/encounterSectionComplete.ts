import type { EncounterConsultSectionId, EncounterNoteSections } from './encounterConsultTypes';
import type { EncounterNoteVariant } from './encounterVariants';

export function isEncounterSectionComplete(
  id: EncounterConsultSectionId,
  sections: EncounterNoteSections,
  variant: EncounterNoteVariant,
): boolean {
  switch (id) {
    case 'referral':
      return sections.referral.clinical_question.trim().length > 0
        && sections.referral.requesting_clinician.trim().length > 0
        && sections.referral.requesting_service.trim().length > 0;
    case 'source':
      return sections.source.sources.length > 0 || sections.source.narrative.trim().length > 0;
    case 'cc':
      return sections.cc.chief_complaint.trim().length > 0;
    case 'hpi':
      return sections.hpi.narrative.trim().length > 0;
    case 'ros':
      return sections.ros.systems.some((row) => row.status !== 'not_reviewed')
        || sections.ros.narrative.trim().length > 0;
    case 'background':
      return true;
    case 'vitals':
      return true;
    case 'data_reviewed':
      return sections.data_reviewed.lab_ids.length > 0
        || sections.data_reviewed.imaging_narrative.trim().length > 0
        || sections.data_reviewed.outside_records.trim().length > 0
        || sections.data_reviewed.narrative.trim().length > 0;
    case 'pe':
      return sections.pe.general.trim().length > 0;
    case 'problems':
      return sections.problems.items.some((problem) => (
        problem.problem_label.trim().length > 0
        && problem.plan_items.some((item) => item.text.trim().length > 0)
      ));
    case 'follow_up':
      return sections.follow_up.instructions.trim().length > 0;
    case 'attestation':
      return !variant || sections.attestation.supervisor_attested;
    default: {
      const never: never = id;
      return Boolean(never);
    }
  }
}
