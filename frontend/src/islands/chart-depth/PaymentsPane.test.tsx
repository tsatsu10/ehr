import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { PaymentsPane } from './PaymentsPane';

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
};

describe('PaymentsPane', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string, opts?: { params?: Record<string, unknown> }) => {
      if (action !== 'chart_depth.payments_list') {
        return Promise.resolve({});
      }

      const filter = opts?.params?.filter;
      return Promise.resolve({
        filter,
        date_from: opts?.params?.date_from ?? null,
        date_to: opts?.params?.date_to ?? null,
        rows: filter === 'date_range'
          ? [{
              type: 'adjustment',
              label: 'Write-off',
              occurred_at_label: 'Jun 27',
              amount: -10,
            }]
          : [{
              type: 'payment',
              label: 'MoMo · Ref: ABC',
              occurred_at_label: 'Jun 27',
              amount: 50,
              amount_paid: 50,
            }],
        currency_symbol: 'GH₵',
        has_more: false,
        next_offset: 1,
      });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('loads payment history on mount', async () => {
    render(<PaymentsPane {...baseProps} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'chart_depth.payments_list',
      expect.objectContaining({
        params: expect.objectContaining({ pid: 42, filter: 'all_visits' }),
      }),
    );
    expect(await screen.findByText('MoMo · Ref: ABC')).toBeInTheDocument();
  });

  it('sends date range params when date range filter is active', async () => {
    render(<PaymentsPane {...baseProps} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('MoMo · Ref: ABC')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Date range' }));
      await Promise.resolve();
    });

    const fromInput = await screen.findByLabelText('From');
    const toInput = screen.getByLabelText('To');

    await act(async () => {
      fireEvent.change(fromInput, { target: { value: '2026-06-01' } });
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.change(toInput, { target: { value: '2026-06-30' } });
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'chart_depth.payments_list',
      expect.objectContaining({
        params: expect.objectContaining({
          filter: 'date_range',
          date_from: '2026-06-01',
          date_to: '2026-06-30',
        }),
      }),
    );
    expect(await screen.findByText('Adjustment')).toBeInTheDocument();
    expect(screen.getByText('Write-off')).toBeInTheDocument();
  });

  it('defaults to this visit filter when visitId is provided', async () => {
    render(<PaymentsPane {...baseProps} visitId={99} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'chart_depth.payments_list',
      expect.objectContaining({
        params: expect.objectContaining({
          filter: 'this_visit',
          visit_id: 99,
        }),
      }),
    );
    expect(screen.getByRole('button', { name: 'This visit' })).toHaveClass('active');
  });
});
