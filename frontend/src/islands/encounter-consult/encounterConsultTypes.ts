import type { PlanItemType, ProblemStatus } from './encounterVariants';
import type { RosFindingStatus, RosSystemName } from './encounterRosSystems';
import { newProblemId } from './encounterVariants';

export type EncounterConsultSectionId =
  | 'referral'
  | 'source'
  | 'cc'
  | 'hpi'
  | 'ros'
  | 'background'
  | 'vitals'
  | 'pe'
  | 'data_reviewed'
  | 'problems'
  | 'follow_up'
  | 'attestation';

export interface EncounterNoteHpiSection {
  narrative: string;
  onset: string;
  duration: string;
  severity: string;
  aggravating: string;
  relieving: string;
}

export interface EncounterNoteReferralSection {
  requesting_clinician: string;
  requesting_service: string;
  clinical_question: string;
  urgency: '' | 'routine' | 'urgent' | 'emergent';
}

export interface EncounterReferralPrefill {
  requesting_clinician: string;
  requesting_service: string;
  clinical_question: string;
  urgency: '' | 'routine' | 'urgent' | 'emergent';
  has_referral_record?: boolean;
  referral_document_id?: number | null;
  referral_document_url?: string | null;
  source?: string | null;
}

export interface EncounterNoteSourceSection {
  sources: string[];
  narrative: string;
}

export interface EncounterNoteRosSystemRow {
  system: RosSystemName | string;
  status: RosFindingStatus;
  notes: string;
}

export interface EncounterNoteRosSection {
  systems: EncounterNoteRosSystemRow[];
  narrative: string;
}

export interface EncounterBackgroundLine {
  label: string;
  value: string;
}

export interface EncounterBackgroundPrefill {
  problems: EncounterBackgroundLine[];
  social: EncounterBackgroundLine[];
  edit_urls: {
    problems?: string | null;
    allergies?: string | null;
    medications?: string | null;
    history?: string | null;
  };
}

export interface EncounterLabResultPrefillItem {
  id: string;
  label: string;
  date: string | null;
  abnormal?: boolean;
}

export interface EncounterNoteDataReviewedSection {
  lab_ids: string[];
  imaging_narrative: string;
  outside_records: string;
  narrative: string;
}

export interface EncounterSpecialtyPeOverlay {
  id: string;
  label: string;
}

export interface EncounterNotePeSection {
  general: string;
  specialty: Record<string, string>;
}

export interface EncounterPlanItem {
  id: string;
  type: PlanItemType;
  text: string;
}

export interface EncounterProblemRow {
  id: string;
  problem_label: string;
  icd10_code: string;
  icd10_label: string;
  status: ProblemStatus;
  assessment_narrative: string;
  differential: string;
  plan_items: EncounterPlanItem[];
}

export interface EncounterNoteProblemsSection {
  items: EncounterProblemRow[];
}

export interface EncounterNoteAttestationSection {
  supervisor_attested: boolean;
}

export interface EncounterNoteFollowUpSection {
  return_visit: string;
  callback_contact: string;
  availability: string;
  instructions: string;
}

export interface EncounterSignMeta {
  author_user_id: number | null;
  author_display_name: string | null;
  author_role: string | null;
  signed_at: string | null;
  amendment?: string | null;
}

export interface EncounterNoteContextSection {
  allergies_acknowledged: boolean;
  meds_acknowledged: boolean;
}

export interface EncounterNoteSections {
  referral: EncounterNoteReferralSection;
  source: EncounterNoteSourceSection;
  cc: { chief_complaint: string };
  hpi: EncounterNoteHpiSection;
  ros: EncounterNoteRosSection;
  data_reviewed: EncounterNoteDataReviewedSection;
  pe: EncounterNotePeSection;
  problems: EncounterNoteProblemsSection;
  follow_up: EncounterNoteFollowUpSection;
  assessment: { narrative: string };
  plan: { narrative: string };
  attestation: EncounterNoteAttestationSection;
  context: EncounterNoteContextSection;
}

export interface EncounterVitalsPrefill {
  latest: Record<string, string | number | null>;
  summary: string | null;
  warnings: string[];
  abnormal: boolean;
  missing: boolean;
}

export interface EncounterAllergiesPrefill {
  items: string[];
  undocumented: boolean;
  nkda: boolean;
  summary: string | null;
  edit_url: string | null;
}

export interface EncounterMedicationsPrefill {
  items: string[];
  summary: string | null;
  edit_url: string | null;
}

export interface EncounterNotePrefill {
  chief_complaint: string;
  vitals: EncounterVitalsPrefill;
  allergies: EncounterAllergiesPrefill;
  medications: EncounterMedicationsPrefill;
  background: EncounterBackgroundPrefill;
  recent_labs: EncounterLabResultPrefillItem[];
  referral: EncounterReferralPrefill;
  patient: {
    display_name: string;
    pubpid?: string;
    sex?: string;
    age_years?: number | null;
    queue_number: number;
  };
}

export interface EncounterSupervisorMeta {
  supervisor_id: number | null;
  supervisor_display_name: string | null;
  supervisor_from_profile?: boolean;
}

export interface EncounterNoteConfig {
  require_icd: boolean;
  supervisor_required: boolean;
  specialty_pe_overlays?: EncounterSpecialtyPeOverlay[];
}

export interface EncounterNotePayload {
  visit_id: number;
  encounter: number;
  pid: number;
  variant: string;
  sections: EncounterNoteSections;
  forms_row_id: number | null;
  form_id: number | null;
  updated_at: string | null;
  signed: boolean;
  sign_meta?: EncounterSignMeta | null;
  prefill: EncounterNotePrefill;
  return_url: string;
  note_config?: EncounterNoteConfig;
  supervisor?: EncounterSupervisorMeta;
  can_unlock_for_correction?: boolean;
}

export interface EncounterConsultProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  visitId: number;
  facilityId: number;
  returnUrl: string;
  returnTo?: string;
  returnTab?: string;
  initialFocus?: string;
  webroot?: string;
}

export const HPI_PROMPTS: Array<{ key: keyof EncounterNoteHpiSection; label: string; placeholder: string }> = [
  { key: 'onset', label: 'Onset', placeholder: 'When did it start?' },
  { key: 'duration', label: 'Duration', placeholder: 'How long?' },
  { key: 'severity', label: 'Severity', placeholder: 'Mild / moderate / severe' },
  { key: 'aggravating', label: 'Aggravating', placeholder: 'What makes it worse?' },
  { key: 'relieving', label: 'Relieving', placeholder: 'What helps?' },
];

export type EncounterSectionPhase = 'subjective' | 'objective' | 'assessment';

export const ENCOUNTER_SECTION_PHASES: Record<
  EncounterSectionPhase,
  { label: string; hint: string }
> = {
  subjective: { label: 'Subjective', hint: 'History & symptoms' },
  objective: { label: 'Objective', hint: 'Exam & data' },
  assessment: { label: 'Assessment & plan', hint: 'Diagnosis & next steps' },
};

export const ENCOUNTER_SECTIONS: Array<{
  id: EncounterConsultSectionId;
  label: string;
  shortLabel: string;
  description: string;
  phase: EncounterSectionPhase;
}> = [
  { id: 'referral', label: 'Referral', shortLabel: 'Referral', description: 'Requesting clinician, service, and clinical question', phase: 'subjective' },
  { id: 'source', label: 'Source of information', shortLabel: 'Source', description: 'Who provided the history for this visit', phase: 'subjective' },
  { id: 'cc', label: 'Chief complaint', shortLabel: 'Complaint', description: 'One-line reason for visit', phase: 'subjective' },
  { id: 'hpi', label: 'History of present illness', shortLabel: 'HPI', description: 'Guided symptom prompts and narrative', phase: 'subjective' },
  { id: 'ros', label: 'Review of systems', shortLabel: 'ROS', description: 'Pertinent systems checklist and negatives', phase: 'subjective' },
  { id: 'background', label: 'Background', shortLabel: 'Background', description: 'PMH, meds, allergies, and social history from chart', phase: 'subjective' },
  { id: 'vitals', label: 'Vitals', shortLabel: 'Vitals', description: 'Prefilled from triage — read only', phase: 'objective' },
  { id: 'pe', label: 'Physical examination', shortLabel: 'Exam', description: 'General exam and specialty overlays', phase: 'objective' },
  { id: 'data_reviewed', label: 'Data reviewed', shortLabel: 'Data', description: 'Recent labs, imaging, and outside records', phase: 'objective' },
  { id: 'problems', label: 'Assessment & plan', shortLabel: 'A&P', description: 'Problem-oriented diagnoses and linked actions', phase: 'assessment' },
  { id: 'follow_up', label: 'Follow-up', shortLabel: 'Follow-up', description: 'Return visit, callbacks, and communication plan', phase: 'assessment' },
  { id: 'attestation', label: 'Attestation', shortLabel: 'Sign', description: 'Author, supervisor review, and sign record', phase: 'assessment' },
];

export function emptyProblemRow(): EncounterProblemRow {
  return {
    id: newProblemId(),
    problem_label: '',
    icd10_code: '',
    icd10_label: '',
    status: 'new',
    assessment_narrative: '',
    differential: '',
    plan_items: [],
  };
}

export function emptyRosSection(): EncounterNoteRosSection {
  return { systems: [], narrative: '' };
}

export function emptyDataReviewedSection(): EncounterNoteDataReviewedSection {
  return {
    lab_ids: [],
    imaging_narrative: '',
    outside_records: '',
    narrative: '',
  };
}

export function emptyPeSection(): EncounterNotePeSection {
  return { general: '', specialty: {} };
}

export function emptyBackgroundPrefill(): EncounterBackgroundPrefill {
  return {
    problems: [],
    social: [],
    edit_urls: {},
  };
}

export function emptyFollowUpSection(): EncounterNoteFollowUpSection {
  return {
    return_visit: '',
    callback_contact: '',
    availability: '',
    instructions: '',
  };
}

export function emptySections(): EncounterNoteSections {
  return {
    referral: {
      requesting_clinician: '',
      requesting_service: '',
      clinical_question: '',
      urgency: '',
    },
    source: {
      sources: [],
      narrative: '',
    },
    cc: { chief_complaint: '' },
    hpi: {
      narrative: '',
      onset: '',
      duration: '',
      severity: '',
      aggravating: '',
      relieving: '',
    },
    ros: emptyRosSection(),
    data_reviewed: emptyDataReviewedSection(),
    pe: emptyPeSection(),
    problems: { items: [] },
    follow_up: emptyFollowUpSection(),
    assessment: { narrative: '' },
    plan: { narrative: '' },
    attestation: {
      supervisor_attested: false,
    },
    context: {
      allergies_acknowledged: false,
      meds_acknowledged: false,
    },
  };
}

function normalizeProblemRow(raw: Partial<EncounterProblemRow> | undefined): EncounterProblemRow {
  const base = emptyProblemRow();
  if (!raw) {
    return base;
  }

  return {
    id: raw.id?.trim() ? raw.id : base.id,
    problem_label: raw.problem_label ?? '',
    icd10_code: raw.icd10_code ?? '',
    icd10_label: raw.icd10_label ?? '',
    status: raw.status ?? 'new',
    assessment_narrative: raw.assessment_narrative ?? '',
    differential: raw.differential ?? '',
    plan_items: Array.isArray(raw.plan_items)
      ? raw.plan_items.map((item) => ({
          id: item.id?.trim() ? item.id : `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: item.type ?? 'education',
          text: item.text ?? '',
        }))
      : [],
  };
}

export function mergeSections(
  saved: Partial<EncounterNoteSections> | undefined,
  prefill: EncounterNotePrefill,
): EncounterNoteSections {
  const base = emptySections();
  const cc = saved?.cc?.chief_complaint?.trim()
    ? saved.cc.chief_complaint
    : prefill.chief_complaint;

  const problems = Array.isArray(saved?.problems?.items) && saved.problems.items.length > 0
    ? saved.problems.items.map((row) => normalizeProblemRow(row))
    : (
      saved?.assessment?.narrative?.trim() || saved?.plan?.narrative?.trim()
        ? [{
            ...emptyProblemRow(),
            problem_label: saved?.assessment?.narrative?.trim() ? 'Primary problem' : 'Problem 1',
            assessment_narrative: saved?.assessment?.narrative ?? '',
            plan_items: saved?.plan?.narrative?.trim()
              ? [{ id: `plan-${Date.now()}`, type: 'education' as const, text: saved.plan.narrative }]
              : [],
          }]
        : [emptyProblemRow()]
    );

  return {
    referral: {
      requesting_clinician: saved?.referral?.requesting_clinician
        ?? prefill.referral?.requesting_clinician
        ?? '',
      requesting_service: saved?.referral?.requesting_service
        ?? prefill.referral?.requesting_service
        ?? '',
      clinical_question: saved?.referral?.clinical_question
        ?? prefill.referral?.clinical_question
        ?? '',
      urgency: saved?.referral?.urgency
        ?? prefill.referral?.urgency
        ?? '',
    },
    source: {
      sources: saved?.source?.sources ?? [],
      narrative: saved?.source?.narrative ?? '',
    },
    cc: { chief_complaint: cc ?? '' },
    hpi: {
      narrative: saved?.hpi?.narrative ?? '',
      onset: saved?.hpi?.onset ?? '',
      duration: saved?.hpi?.duration ?? '',
      severity: saved?.hpi?.severity ?? '',
      aggravating: saved?.hpi?.aggravating ?? '',
      relieving: saved?.hpi?.relieving ?? '',
    },
    ros: {
      systems: Array.isArray(saved?.ros?.systems) ? saved.ros.systems : [],
      narrative: saved?.ros?.narrative ?? '',
    },
    data_reviewed: {
      lab_ids: Array.isArray(saved?.data_reviewed?.lab_ids) ? saved.data_reviewed.lab_ids : [],
      imaging_narrative: saved?.data_reviewed?.imaging_narrative ?? '',
      outside_records: saved?.data_reviewed?.outside_records ?? '',
      narrative: saved?.data_reviewed?.narrative ?? '',
    },
    pe: {
      general: saved?.pe?.general ?? '',
      specialty: saved?.pe?.specialty ?? {},
    },
    problems: { items: problems },
    follow_up: {
      return_visit: saved?.follow_up?.return_visit ?? '',
      callback_contact: saved?.follow_up?.callback_contact ?? '',
      availability: saved?.follow_up?.availability ?? '',
      instructions: saved?.follow_up?.instructions ?? '',
    },
    assessment: { narrative: saved?.assessment?.narrative ?? '' },
    plan: { narrative: saved?.plan?.narrative ?? '' },
    attestation: {
      supervisor_attested: saved?.attestation?.supervisor_attested ?? false,
    },
    context: {
      allergies_acknowledged: saved?.context?.allergies_acknowledged ?? false,
      meds_acknowledged: saved?.context?.meds_acknowledged ?? false,
    },
  };
}
