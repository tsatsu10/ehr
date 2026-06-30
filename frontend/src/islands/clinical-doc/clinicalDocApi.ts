import { oeFetch } from '@core/oeFetch';
import type { ClinicalDocCard, ClinicalDocLens } from './clinicalDocTypes';

export interface ClinicalDocFavoritesPayload {
  visit_id: number;
  favorites: ClinicalDocCard[];
  documentation_hub_url?: string;
}

export async function fetchClinicalDocFavorites(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
): Promise<ClinicalDocFavoritesPayload> {
  return oeFetch<ClinicalDocFavoritesPayload>('clinical_doc.favorites', {
    ajaxUrl,
    csrfToken,
    params: { visit_id: visitId },
  });
}

export async function openClinicalDocForm(
  ajaxUrl: string,
  csrfToken: string,
  visitId: number,
  card: ClinicalDocCard,
  options?: { lens?: ClinicalDocLens; returnTo?: 'doctor' | 'hub' },
): Promise<void> {
  const lens = options?.lens ?? card.source_lens ?? card.lens ?? 'visit';
  const data = await oeFetch<{ redirect_url: string }>('clinical_doc.open_form', {
    ajaxUrl,
    csrfToken,
    method: 'POST',
    json: {
      visit_id: visitId,
      formdir: card.formdir,
      lens,
      action: card.started && card.form_id ? 'edit' : 'new',
      form_id: card.form_id ?? undefined,
      return_to: options?.returnTo ?? 'hub',
    },
  });
  window.location.assign(data.redirect_url);
}
