import { describe, expect, it } from 'vitest';
import { cardKindBadgeClass, cardKindLabel } from './reportHubLensMeta';
import type { ReportHubCard } from './reportHubTypes';

describe('reportHubLensMeta', () => {
  it('maps card kinds to labels and badge classes', () => {
    const kinds: ReportHubCard['kind'][] = ['native', 'stock', 'module', 'placeholder'];
    expect(kinds.map(cardKindLabel)).toEqual([
      'Built-in',
      'Legacy',
      'Module',
      'Coming soon',
    ]);
    expect(kinds.map(cardKindBadgeClass)).toEqual([
      'badge-primary',
      'badge-secondary',
      'badge-info',
      'badge-light text-muted border',
    ]);
  });
});
