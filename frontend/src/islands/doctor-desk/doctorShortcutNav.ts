import { oeFetch, OeFetchError } from '@core/oeFetch';
import { setDeskActiveVisitId } from '@core/deskSessionStorage';

export type ShortcutKind = 'encounter' | 'encounter_hub' | 'lab' | 'rx' | 'chart';

export const DOCTOR_LEFT_VIA_KEY = 'doctor_desk_left_via';

const STORAGE_KEY = 'doctor_desk_active_visit_id';

export const ALLERGIES_UNDOCUMENTED_CODE = 'allergies_undocumented';

export function isAllergiesUndocumentedError(err: unknown): boolean {
  return err instanceof OeFetchError && err.code === ALLERGIES_UNDOCUMENTED_CODE;
}

export async function doctorShortcutPreflight(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  shortcut: ShortcutKind,
  options?: { rxUndocumentedAllergyOverrideReason?: string },
): Promise<{ redirect_url: string }> {
  return oeFetch<{ redirect_url: string }>('doctor.shortcut_preflight', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      visit_id: visitId,
      shortcut,
      ...(options?.rxUndocumentedAllergyOverrideReason
        ? { rx_undocumented_allergy_override_reason: options.rxUndocumentedAllergyOverrideReason }
        : {}),
    },
  });
}

export function navigateDoctorShortcut(visitId: number, shortcut: ShortcutKind, redirectUrl: string): void {
  if (shortcut === 'chart') {
    window.open(redirectUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  setDeskActiveVisitId(STORAGE_KEY, visitId);
  window.sessionStorage.setItem(DOCTOR_LEFT_VIA_KEY, shortcut);
  window.location.assign(redirectUrl);
}
