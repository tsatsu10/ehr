import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { ChartDepthPage } from './ChartDepthPage';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
  OeFetchError: class OeFetchError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const baseProps = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  pid: 42,
  chartUrl: '/chart?pid=42',
  visitBoardUrl: '/visit-board',
};

describe('ChartDepthPage', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'patients.preview') {
        return Promise.resolve({
          identity: { pid: 42, display_name: 'Jane Doe', pubpid: 'MRN1', sex: 'F', age_years: '30' },
          completion: { score: 80, billing_threshold: 70 },
        });
      }
      if (action === 'chart_depth.payments_list') {
        return Promise.resolve({
          filter: 'all_visits',
          rows: [{
            type: 'payment',
            label: 'Cash payment',
            receipt_number: 'R-1',
            occurred_at_label: 'Today',
            amount: 50,
            amount_paid: 50,
            cashier: 'Cashier',
          }],
          currency_symbol: 'GH₵',
          has_more: false,
          next_offset: 1,
        });
      }
      if (action === 'chart_depth.export_builder') {
        return Promise.resolve({
          patient: { name: 'Jane Doe', pubpid: 'MRN1' },
          presets: [{ key: 'visit_summary', label: 'Visit summary' }],
          selected_preset: 'visit_summary',
          can_generate: true,
          has_pat_rep_acl: true,
          confirm_label: 'Export visit summary',
        });
      }
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads payment history', async () => {
    render(<ChartDepthPage {...baseProps} mode="payments" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'chart_depth.payments_list',
      expect.objectContaining({ params: expect.objectContaining({ pid: 42 }) })
    );
    expect(await screen.findByText('Cash payment')).toBeInTheDocument();
  });

  it('loads export builder', async () => {
    render(<ChartDepthPage {...baseProps} mode="export" />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'chart_depth.export_builder',
      expect.objectContaining({ params: expect.objectContaining({ pid: 42 }) })
    );
    expect(await screen.findByText('Generate PDF')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe', { selector: 'h3' })).toBeInTheDocument();
  });
});
