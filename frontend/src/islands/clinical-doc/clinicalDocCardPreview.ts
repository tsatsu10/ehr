import type { ClinicalDocCard, EncounterNotePreview } from './clinicalDocTypes';

export function consultCardPreviewLine(preview?: EncounterNotePreview | null): string | null {
  if (!preview?.native_enabled) {
    return null;
  }

  const parts: string[] = [];
  if (preview.cc_preview) {
    parts.push(preview.cc_preview);
  }
  if ((preview.problem_count ?? 0) > 0) {
    const count = preview.problem_count ?? 0;
    parts.push(`${count} problem${count === 1 ? '' : 's'}`);
  }
  if ((preview.incomplete_problem_count ?? 0) > 0 && !preview.signed) {
    const incomplete = preview.incomplete_problem_count ?? 0;
    parts.push(`${incomplete} incomplete`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function consultCardStatusChip(card: ClinicalDocCard): {
  label: string;
  variant: 'success' | 'warning' | 'neutral' | 'danger';
} {
  const preview = card.note_preview;
  if (card.signed || preview?.signed) {
    return { label: 'Signed', variant: 'success' };
  }
  if (card.started || preview?.started) {
    if (preview?.validate_ready) {
      return { label: 'Ready to sign', variant: 'warning' };
    }
    return { label: 'Draft', variant: 'neutral' };
  }
  if (card.primary) {
    const variantLabel = preview?.variant_label;
    return {
      label: variantLabel ? `Required · ${variantLabel}` : 'Required · Not started',
      variant: 'danger',
    };
  }
  return { label: 'Not started', variant: 'neutral' };
}

export function appendFocusSign(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}focus=sign`;
}
