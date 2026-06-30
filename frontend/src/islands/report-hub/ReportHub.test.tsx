import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportHubLensPane } from './ReportHubLensPane';
import { allowedLenses, firstAllowedLens } from './useReportHubPageHeading';
import type { ReportHubCard } from './reportHubTypes';

const baseProps = {
  canToday: true,
  canClinical: true,
  canPharmacy: false,
  canFinancial: false,
  canPublicHealth: false,
  canAudit: false,
};

describe('report hub lens helpers', () => {
  it('allowedLenses respects capability flags', () => {
    expect(allowedLenses(baseProps)).toEqual(['today', 'clinical']);
  });

  it('firstAllowedLens falls back when initial tab is denied', () => {
    expect(firstAllowedLens('pharmacy', allowedLenses(baseProps))).toBe('today');
    expect(firstAllowedLens('clinical', allowedLenses(baseProps))).toBe('clinical');
  });
});

describe('ReportHubLensPane', () => {
  const cards: ReportHubCard[] = [
    {
      id: 'clinical_immunizations',
      lens: 'clinical',
      title: 'Immunizations given',
      blurb: 'Vaccines',
      url: '',
      kind: 'native',
    },
    {
      id: 'pharm_destroyed',
      lens: 'pharmacy',
      title: 'Destroyed medicines',
      blurb: 'Lots',
      url: '/interface/reports/destroyed_drugs_report.php',
      kind: 'stock',
    },
  ];

  it('filters catalog cards to the active lens', () => {
    render(
      <ReportHubLensPane
        lens="clinical"
        cards={cards}
        loading={false}
        error={null}
        reportsUrl="/reports.php?embed=1"
        webroot="/openemr"
        ajaxUrl="/ajax.php"
        csrfToken="token"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Immunizations given' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Destroyed medicines' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });
});
