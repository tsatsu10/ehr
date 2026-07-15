import { render, screen, act, fireEvent, within } from '@testing-library/react';
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
    const row = screen.getByText('Amoxicillin 500mg').closest('tr') as HTMLElement;
    expect(within(row).getByText('40')).toBeInTheDocument(); // Suggested column
    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.inventory.reorder',
      expect.objectContaining({ params: expect.objectContaining({ window_days: 90 }) }),
    );
  });

  it('lets the pharmacist edit the order quantity and recomputes the estimated cost (INV-5)', async () => {
    mockFetch.mockResolvedValue({
      window_days: 90,
      target_days: 30,
      currency_symbol: 'GH₵',
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
          unit_cost: 2.5,
          estimated_cost: 100,
        },
      ],
    });

    render(<PharmOpsReorderReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    const qtyInput = screen.getByLabelText('Order quantity for Amoxicillin 500mg') as HTMLInputElement;
    expect(qtyInput.value).toBe('40'); // Prefilled from suggested_order_qty.

    fireEvent.change(qtyInput, { target: { value: '60' } });

    // 60 x GH₵2.50 = GH₵150.00, in both the row's Est. cost and the Total row.
    expect((await screen.findAllByText((t) => t.includes('150.00'))).length).toBeGreaterThanOrEqual(2);
  });

  it('exports a purchase-order CSV with the edited quantities', async () => {
    mockFetch.mockResolvedValue({
      window_days: 90,
      target_days: 30,
      currency_symbol: 'GH₵',
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
          unit_cost: 2.5,
          estimated_cost: 100,
        },
      ],
    });

    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<PharmOpsReorderReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
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
