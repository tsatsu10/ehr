import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportHubLensPane } from './ReportHubLensPane';
import { allowedLenses, firstAllowedLens } from './useReportHubPageHeading';
import type { ReportHubCard, ReportHubEmbedContext } from './reportHubTypes';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock('@islands/daily-reports/DailyReports', () => ({
  DailyReports: ({ initialTab }: { initialTab?: string }) => (
    <div id="nc-reports-desk">Daily reports embed — {initialTab ?? 'visits'}</div>
  ),
}));

vi.mock('./ReportHubEmbedView', () => ({
  ReportHubEmbedView: ({ title }: { title: string }) => (
    <div data-testid="hub-embed-view">{title}</div>
  ),
}));

const embedContext: ReportHubEmbedContext = {
  ajaxUrl: '/ajax.php',
  csrfToken: 'token',
  webroot: '/openemr',
  facilityId: 1,
  visitBoardUrl: '/visit-board.php',
  frontDeskUrl: '/front-desk.php',
  moduleUrl: '/module',
  cashierUrl: '/cashier.php',
  reportsUrl: '/reports.php',
  chartUrlBase: '/chart.php',
  billingThreshold: 70,
  visitDate: '2026-07-02',
  canCancelVisit: false,
  canMarkUnpaid: false,
  canRunReconciliation: false,
  scheduledIntegrationEnabled: false,
  canStartVisit: false,
  billOps: {
    canCorrect: false,
    canPayment: false,
    canClose: true,
    canOutstanding: true,
    canInsurance: false,
    canPayerBilling: false,
    reopenOnCorrection: false,
  },
};

const lensPaneBaseProps = {
  summary: null,
  summaryError: null,
  embedContext,
  webroot: '/openemr',
  ajaxUrl: '/ajax.php',
  csrfToken: 'token',
};

const baseProps = {
  canToday: true,
  canClinical: true,
  canPharmacy: false,
  canFinancial: false,
  canPublicHealth: false,
  canAudit: false,
  canUnfiledDocuments: false,
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
      id: 'audit_m7_quality',
      lens: 'audit',
      title: 'Data quality',
      blurb: 'M7 quality tab',
      url: '/interface/modules/custom_modules/oe-module-new-clinic/public/reports.php?tab=quality',
      kind: 'module',
    },
    {
      id: 'pharm_inventory_transactions',
      lens: 'pharmacy',
      title: 'Inventory transactions',
      blurb: 'Lots',
      url: '',
      kind: 'native',
    },
  ];

  it('renders native Daily Reports on the today lens', () => {
    render(
      <ReportHubLensPane
        lens="today"
        cards={[]}
        loading={false}
        error={null}
        {...lensPaneBaseProps}
        summary={{
          visit_date: '2026-07-02',
          visits_started: 12,
          cash_total: 450,
          receipt_count: 8,
          currency_symbol: 'GH₵',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('Cash collected')).toBeInTheDocument();
    expect(screen.getByText('Daily reports embed — visits')).toBeInTheDocument();
  });

  it('filters catalog cards to the active lens', () => {
    render(
      <ReportHubLensPane
        lens="clinical"
        cards={cards}
        loading={false}
        error={null}
        {...lensPaneBaseProps}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Immunizations given' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Destroyed medicines' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('opens module Daily Reports tabs in hub', () => {
    render(
      <ReportHubLensPane
        lens="audit"
        cards={cards}
        loading={false}
        error={null}
        {...lensPaneBaseProps}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open in hub' }));
    expect(screen.getByTestId('hub-embed-view')).toHaveTextContent('Data quality');
  });

  it('shows native pharmacy reports inline in catalog', () => {
    render(
      <ReportHubLensPane
        lens="pharmacy"
        cards={cards}
        loading={false}
        error={null}
        {...lensPaneBaseProps}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Inventory transactions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run report' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open in hub' })).not.toBeInTheDocument();
  });
});
