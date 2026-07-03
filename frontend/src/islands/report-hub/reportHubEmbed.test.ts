import { describe, expect, it } from 'vitest';
import { resolveHubEmbedTarget } from './reportHubEmbed';
import type { ReportHubCard } from './reportHubTypes';

const webroot = '/openemr';

function card(overrides: Partial<ReportHubCard> & Pick<ReportHubCard, 'id' | 'kind' | 'url'>): ReportHubCard {
  return {
    lens: 'clinical',
    title: 'Test',
    blurb: 'Test blurb',
    ...overrides,
  };
}

describe('resolveHubEmbedTarget', () => {
  it('maps module Daily Reports tabs to native embed', () => {
    const target = resolveHubEmbedTarget(
      card({
        id: 'audit_m7_quality',
        kind: 'module',
        url: '/interface/modules/custom_modules/oe-module-new-clinic/public/reports.php?tab=quality',
      }),
      webroot,
    );
    expect(target).toEqual({ kind: 'daily_reports', initialTab: 'quality' });
  });

  it('maps bill ops module cards to native embed', () => {
    const target = resolveHubEmbedTarget(
      card({
        id: 'fin_bill_ops_outstanding',
        kind: 'module',
        lens: 'financial',
        url: '/interface/modules/custom_modules/oe-module-new-clinic/public/bill-ops/index.php?tab=outstanding',
      }),
      webroot,
    );
    expect(target).toEqual({ kind: 'bill_ops', initialTab: 'outstanding' });
  });

  it('maps patient registry to native embed', () => {
    const target = resolveHubEmbedTarget(
      card({
        id: 'clinical_patient_registry',
        kind: 'module',
        url: '/interface/modules/custom_modules/oe-module-new-clinic/public/patient-registry.php',
      }),
      webroot,
    );
    expect(target).toEqual({ kind: 'patient_registry' });
  });

  it('keeps stock reports on iframe embed', () => {
    const target = resolveHubEmbedTarget(
      card({
        id: 'clinical_prescriptions',
        kind: 'stock',
        url: '/interface/reports/prescriptions_report.php',
      }),
      webroot,
    );
    expect(target).toEqual({
      kind: 'stock_iframe',
      url: '/openemr/interface/reports/prescriptions_report.php',
    });
  });
});
