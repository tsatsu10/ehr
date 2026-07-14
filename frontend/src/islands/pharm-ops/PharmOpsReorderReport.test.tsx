import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsReorderReport } from './PharmOpsReorderReport';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('PharmOpsReorderReport', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders reorder rows with status and suggested quantity', async () => {
    mockFetch.mockResolvedValue({
      window_days: 90,
      target_days: 30,
      generated_at: '',
      items: [
        {
          drug_id: 1,
          drug_name: 'Amoxicillin 500mg',
          on_hand: 20,
          reorder_point: 50,
          sold_qty: 180,
          avg_per_day: 2,
          days_of_supply: 10,
          suggested_order_qty: 40,
          stock_status: 'low',
          status_label: 'Low stock',
        },
      ],
    });

    render(<PharmOpsReorderReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Amoxicillin 500mg')).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.inventory.reorder',
      expect.objectContaining({ params: expect.objectContaining({ window_days: 90 }) }),
    );
  });

  it('shows the healthy empty state when nothing needs reorder', async () => {
    mockFetch.mockResolvedValue({ window_days: 90, target_days: 30, generated_at: '', items: [] });

    render(<PharmOpsReorderReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('All stock healthy')).toBeInTheDocument();
  });

  it('surfaces load errors', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));

    render(<PharmOpsReorderReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
