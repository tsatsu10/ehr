export type EncounterConsultSectionId = 'cc' | 'hpi' | 'vitals' | 'pe' | 'assessment' | 'plan';

export interface EncounterNoteHpiSection {
  narrative: string;
  onset: string;
  duration: string;
  severity: string;
  aggravating: string;
  relieving: string;
}

export interface EncounterNoteContextSection {
  allergies_acknowledged: boolean;
  meds_acknowledged: boolean;
}

export interface EncounterNoteSections {
  cc: { chief_complaint: string };
  hpi: EncounterNoteHpiSection;
  pe: { general: string };
  assessment: { narrative: string };
  plan: { narrative: string };
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
  patient: {
    display_name: string;
    queue_number: number;
  };
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
  prefill: EncounterNotePrefill;
  return_url: string;
}

export interface EncounterConsultProps {
  ajaxUrl: string;
  csrfToken: string;
  moduleUrl: string;
  visitId: number;
  returnUrl: string;
  returnTo?: string;
  returnTab?: string;
  webroot?: string;
}

export const HPI_PROMPTS: Array<{ key: keyof EncounterNoteHpiSection; label: string; placeholder: string }> = [
  { key: 'onset', label: 'Onset', placeholder: 'When did it start?' },
  { key: 'duration', label: 'Duration', placeholder: 'How long?' },
  { key: 'severity', label: 'Severity', placeholder: 'Mild / moderate / severe' },
  { key: 'aggravating', label: 'Aggravating', placeholder: 'What makes it worse?' },
  { key: 'relieving', label: 'Relieving', placeholder: 'What helps?' },
];

export const ENCOUNTER_SECTIONS: Array<{
  id: EncounterConsultSectionId;
  label: string;
  description: string;
}> = [
  { id: 'cc', label: 'Chief complaint', description: 'One-line reason for visit' },
  { id: 'hpi', label: 'History of present illness', description: 'OLDCARTS prompts + narrative' },
  { id: 'vitals', label: 'Vitals', description: 'Prefilled from triage — read only' },
  { id: 'pe', label: 'Physical examination', description: 'Exam findings' },
  { id: 'assessment', label: 'Assessment', description: 'Clinical impression and diagnoses' },
  { id: 'plan', label: 'Plan', description: 'Treatment and follow-up actions' },
];

export function emptySections(): EncounterNoteSections {
  return {
    cc: { chief_complaint: '' },
    hpi: {
      narrative: '',
      onset: '',
      duration: '',
      severity: '',
      aggravating: '',
      relieving: '',
    },
    pe: { general: '' },
    assessment: { narrative: '' },
    plan: { narrative: '' },
    context: {
      allergies_acknowledged: false,
      meds_acknowledged: false,
    },
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

  return {
    cc: { chief_complaint: cc ?? '' },
    hpi: {
      narrative: saved?.hpi?.narrative ?? '',
      onset: saved?.hpi?.onset ?? '',
      duration: saved?.hpi?.duration ?? '',
      severity: saved?.hpi?.severity ?? '',
      aggravating: saved?.hpi?.aggravating ?? '',
      relieving: saved?.hpi?.relieving ?? '',
    },
    pe: { general: saved?.pe?.general ?? '' },
    assessment: { narrative: saved?.assessment?.narrative ?? '' },
    plan: { narrative: saved?.plan?.narrative ?? '' },
    context: {
      allergies_acknowledged: saved?.context?.allergies_acknowledged ?? false,
      meds_acknowledged: saved?.context?.meds_acknowledged ?? false,
    },
  };
}
