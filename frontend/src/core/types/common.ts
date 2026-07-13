/**
 * Mount contract and shared FSM / UI primitives.
 */

export type IslandProps = Record<string, unknown>;

export interface NcPageContext {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: string | null;
  queuePollMs: number;
  /** Two-letter core language code for the session user ('en' default). */
  langCode: string;
  /** Locale dictionary URL — empty for English or when no dictionary ships. */
  i18nUrl: string;
}

/** @deprecated Use {@link NcPageContext} */
export type OeNcPageContext = NcPageContext;

export function readPageContext(root: HTMLElement = document.body): NcPageContext | null {
  const shell = root.querySelector<HTMLElement>('#nc-t1');
  if (shell === null) return null;
  return {
    ajaxUrl: shell.dataset.ajaxUrl ?? '',
    csrfToken: shell.dataset.csrfToken ?? '',
    facilityId: shell.dataset.facilityId ?? null,
    queuePollMs: Number.parseInt(shell.dataset.queuePollMs ?? '30000', 10),
    langCode: shell.dataset.langCode?.trim() || 'en',
    i18nUrl: shell.dataset.i18nUrl?.trim() ?? '',
  };
}

export type VisitState =
  | 'waiting'
  | 'in_triage'
  | 'ready_for_doctor'
  | 'with_doctor'
  | 'ready_for_lab'
  | 'in_lab'
  | 'lab_complete'
  | 'ready_for_pharmacy'
  | 'in_pharmacy'
  | 'pharmacy_complete'
  | 'ready_for_payment'
  | 'completed'
  | 'closed_unpaid'
  | 'cancelled';

export type PillVariant = 'success' | 'info' | 'warning' | 'danger' | 'neutral';
