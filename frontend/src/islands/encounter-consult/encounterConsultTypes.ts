export type EncounterConsultSectionId = 'cc' | 'hpi' | 'vitals' | 'pe' | 'assessment' | 'plan';

export interface EncounterNoteSections {
  cc: { chief_complaint: string };
  hpi: { narrative: string };
  pe: { general: string };
  assessment: { narrative: string };
  plan: { narrative: string };
}

export interface EncounterVitalsPrefill {
  latest: Record<string, string | number | null>;
  summary: string | null;
  warnings: string[];
  abnormal: boolean;
  missing: boolean;
}

export interface EncounterNotePrefill {
  chief_complaint: string;
  vitals: EncounterVitalsPrefill;
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

export const ENCOUNTER_SECTIONS: Array<{
  id: EncounterConsultSectionId;
  label: string;
  description: string;
}> = [
  { id: 'cc', label: 'Chief complaint', description: 'One-line reason for visit' },
  { id: 'hpi', label: 'History of present illness', description: 'Interval history and narrative' },
  { id: 'vitals', label: 'Vitals', description: 'Prefilled from triage — read only' },
  { id: 'pe', label: 'Physical examination', description: 'Exam findings' },
  { id: 'assessment', label: 'Assessment', description: 'Clinical impression and diagnoses' },
  { id: 'plan', label: 'Plan', description: 'Treatment and follow-up actions' },
];

export function emptySections(): EncounterNoteSections {
  return {
    cc: { chief_complaint: '' },
    hpi: { narrative: '' },
    pe: { general: '' },
    assessment: { narrative: '' },
    plan: { narrative: '' },
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
    hpi: { narrative: saved?.hpi?.narrative ?? '' },
    pe: { general: saved?.pe?.general ?? '' },
    assessment: { narrative: saved?.assessment?.narrative ?? '' },
    plan: { narrative: saved?.plan?.narrative ?? '' },
  };
}
