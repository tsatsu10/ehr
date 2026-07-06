import { oeFetch } from '@core/oeFetch';
import type {
  EncounterNotePayload,
  EncounterNotePrefill,
  EncounterNoteSections,
  EncounterSignMeta,
} from './encounterConsultTypes';
import type { EncounterValidationResult } from './encounterNoteValidation';

export async function fetchEncounterNote(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
): Promise<EncounterNotePayload> {
  return oeFetch<EncounterNotePayload>('encounter_note.get', {
    ajaxUrl,
    csrfToken,
    params: { visit_id: visitId },
  });
}

export async function saveEncounterNote(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  variant: string,
  sections: EncounterNoteSections,
): Promise<{ saved: boolean; updated_at: string | null }> {
  return oeFetch<{ saved: boolean; updated_at: string | null }>('encounter_note.save', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      visit_id: visitId,
      variant,
      sections,
    },
  });
}

export async function validateEncounterNote(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  variant: string,
  sections: EncounterNoteSections,
): Promise<EncounterValidationResult> {
  return oeFetch<EncounterValidationResult>('encounter_note.validate', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      visit_id: visitId,
      variant,
      sections,
    },
  });
}

export async function signEncounterNote(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  variant: string,
  sections: EncounterNoteSections,
  password: string,
  amendment = '',
): Promise<{ signed: boolean; already_signed?: boolean; sign_meta?: EncounterSignMeta | null }> {
  return oeFetch<{ signed: boolean; already_signed?: boolean; sign_meta?: EncounterSignMeta | null }>('encounter_note.sign', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      visit_id: visitId,
      variant,
      sections,
      password,
      amendment: amendment.trim() !== '' ? amendment.trim() : undefined,
    },
  });
}

export async function unlockEncounterNote(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  reason: string,
  password: string,
): Promise<{ unlocked: boolean; already_unlocked?: boolean; signed: boolean }> {
  return oeFetch<{ unlocked: boolean; already_unlocked?: boolean; signed: boolean }>('encounter_note.unlock', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      visit_id: visitId,
      reason,
      password,
    },
  });
}

export async function fetchEncounterPrefill(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
): Promise<EncounterNotePrefill> {
  return oeFetch<EncounterNotePrefill>('encounter_note.prefill', {
    ajaxUrl,
    csrfToken,
    params: { visit_id: visitId },
  });
}
