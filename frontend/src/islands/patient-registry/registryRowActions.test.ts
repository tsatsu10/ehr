import { describe, expect, it } from 'vitest';
import {
  buildRegistryRowActions,
  frontDeskUrlForPatient,
  visitBoardUrlForPatient,
} from './registryRowActions';
import type { RegistryRow } from './registryTypes';

const baseRow: RegistryRow = {
  pid: 42,
  name: 'Jane Doe',
  age_today: 32,
  sex: 'Female',
  mrn: 'MRN001',
  completion_pct: 85,
  has_active_visit_today: false,
};

const baseContext = {
  chartUrlBase: '/module/patient-chart.php',
  visitBoardUrl: '/module/visit-board.php',
  frontDeskUrl: '/module/front-desk.php',
  moduleUrl: '/module',
  facilityId: 3,
  visitDate: '2026-07-06',
  scheduledIntegrationEnabled: true,
  canStartVisit: true,
};

describe('registryRowActions', () => {
  it('builds chart, visit board, recall, and start visit actions', () => {
    const items = buildRegistryRowActions(baseRow, baseContext);

    expect(items.map((item) => item.id)).toEqual([
      'chart',
      'visit-board',
      'recalls',
      'start-visit',
    ]);
    expect(items[0]?.href).toContain('pid=42');
    expect(items[1]?.href).toContain('visit-board.php?pid=42');
    expect(items[2]?.href).toContain('lens=recalls');
    expect(items[2]?.href).toContain('pid=42');
    expect(items[3]?.href).toContain('front-desk.php?pid=42');
  });

  it('omits start visit when patient is already in clinic', () => {
    const items = buildRegistryRowActions(
      { ...baseRow, has_active_visit_today: true },
      baseContext,
    );

    expect(items.some((item) => item.id === 'start-visit')).toBe(false);
  });

  it('omits recall action when scheduling integration is disabled', () => {
    const items = buildRegistryRowActions(baseRow, {
      ...baseContext,
      scheduledIntegrationEnabled: false,
    });

    expect(items.some((item) => item.id === 'recalls')).toBe(false);
  });

  it('builds deep-link urls with query params', () => {
    expect(visitBoardUrlForPatient('/module/visit-board.php', 7)).toBe('/module/visit-board.php?pid=7');
    expect(frontDeskUrlForPatient('/module/front-desk.php', 7)).toBe('/module/front-desk.php?pid=7');
  });
});
