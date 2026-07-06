import { oeFetch } from '@core/oeFetch';
import type { EncounterNotePayload, EncounterNotePrefill, EncounterNoteSections } from './encounterConsultTypes';

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
