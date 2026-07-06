import { describe, expect, it } from 'vitest';
import type { ClinicalDocCard } from './clinicalDocTypes';
import { consultCardPreviewLine, consultCardStatusChip } from './clinicalDocCardPreview';

describe('clinicalDocCardPreview', () => {
  it('builds preview line from cc and problem counts', () => {
    expect(
      consultCardPreviewLine({
        native_enabled: true,
        cc_preview: 'Chest pain',
        problem_count: 2,
        incomplete_problem_count: 1,
      }),
    ).toBe('Chest pain · 2 problems · 1 incomplete');
  });

  it('shows ready-to-sign chip when validate_ready', () => {
    const card: ClinicalDocCard = {
      id: 'consult',
      lens: 'consult',
      formdir: 'nc_encounter_consult',
      kind: 'form',
      title: 'Consultation note',
      description: 'Structured consult',
      started: true,
      signed: false,
      note_preview: {
        native_enabled: true,
        started: true,
        validate_ready: true,
        problem_count: 1,
      },
    };

    expect(consultCardStatusChip(card)).toEqual({
      label: 'Ready to sign',
      variant: 'warning',
    });
  });
});
