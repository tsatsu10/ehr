import { describe, expect, it } from 'vitest';
import { cardKindBadgeVariant, cardKindLabel } from './reportHubLensMeta';
import type { ReportHubCard } from './reportHubTypes';

describe('reportHubLensMeta', () => {
  it('maps card kinds to labels and badge variants', () => {
    const kinds: ReportHubCard['kind'][] = ['native', 'stock', 'module', 'placeholder'];
    expect(kinds.map(cardKindLabel)).toEqual([
      'Built-in',
      'Legacy',
      'Module',
      'Coming soon',
    ]);
    expect(kinds.map(cardKindBadgeVariant)).toEqual([
      'default',
      'neutral',
      'info',
      'outline',
    ]);
  });
});
