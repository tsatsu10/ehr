import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import { DailyReports } from './DailyReports';

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

const reportPayload = {
  visit_date: '2026-06-27',
  facility_id: 1,
  visits: { started: 5, completed: 3, still_open: 2, cancelled: 0, by_state: { waiting: 2 } },
  cash: { total_collected: 120.5, receipt_count: 3 },
  open_visits: [],
  eod_open: {},
  unsigned_alerts: { with_doctor: 0, ready_for_payment: 0 },
  unpaid_visits: [],
  data_quality: {
    patients_registered_today: 1,
    dup_overrides_today: 0,
    billing_threshold: 70,
    completion_buckets: { under_40: 0, from_40_to_69: 0, from_70_to_99: 1, complete_100: 0 },
    stale_incomplete: [],
  },
  unsigned_visits: [],
  queue_bypass: [],
  last_updated: '2026-06-27T12:00:00+00:00',
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  visitBoardUrl: '/visit-board',
  canCancelVisit: false,
  canMarkUnpaid: false,
};

describe('DailyReports', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue(reportPayload);
    document.body.innerHTML =
      '<input id="nc-reports-date" type="date" />' +
      '<button id="nc-reports-refresh"></button>' +
      '<span id="nc-reports-updated"></span>';
  });

  afterEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
  });

  it('loads and shows visit summary', async () => {
    render(<DailyReports {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'reports.daily',
      expect.objectContaining({
        params: expect.objectContaining({ visit_date: expect.any(String) }),
      })
    );
    expect(await screen.findByText('Started')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('switches to cash tab', async () => {
    render(<DailyReports {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Cash/i }));
    });

    expect(await screen.findByText('Total collected')).toBeInTheDocument();
    expect(screen.getByText('120.50')).toBeInTheDocument();
  });
});
