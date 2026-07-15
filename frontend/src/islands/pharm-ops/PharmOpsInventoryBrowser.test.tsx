import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsInventoryBrowser } from './PharmOpsInventoryBrowser';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const summary = { sku_count: 12, expiring: 3, expired: 1, out_of_stock: 2, at_reorder: 4 };

function lot(id: number, over: Record<string, unknown> = {}) {
  return {
    inventory_id: id,
    drug_id: 6,
    drug_name: 'Ibuprofen',
    lot_number: `LOT-${id}`,
    on_hand: 200,
    expiration: '2026-08-01',
    expiry_status: 'expiring',
    ...over,
  };
}

// INV-3: lots are collapsed under a per-drug row; expand the group to see individual lots.
async function expandDrug() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Ibuprofen/i }));
  });
}

describe('PharmOpsInventoryBrowser', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the summary strip and lots with an expiry badge', async () => {
    mockFetch.mockResolvedValue({ offset: 0, has_more: false, summary, generated_at: '', items: [lot(1)] });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    await expandDrug();
    expect(await screen.findByText('LOT-1')).toBeInTheDocument();
    // "Expiring" now shows on both the drug rollup badge and the lot badge.
    expect(screen.getAllByText('Expiring').length).toBeGreaterThan(0);
    expect(screen.getByText('In-stock SKUs')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows the near-expiry triage tiers and filters to that horizon on click (INV-6)', async () => {
    mockFetch.mockResolvedValue({
      offset: 0,
      has_more: false,
      summary: {
        ...summary,
        expiring_30: 2,
        expiring_60: 5,
        value_expiring_30: 40,
        value_expiring_60: 90,
      },
      currency_symbol: 'GH₵',
      generated_at: '',
      items: [lot(1)],
    });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Near-expiry triage')).toBeInTheDocument();
    expect(screen.getByText('≤ 30 days')).toBeInTheDocument();
    expect(screen.getByText('≤ 60 days')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('≤ 30 days').closest('button') as HTMLElement);
    });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].params.expiry).toBe('30');
  });

  it('groups lots under a per-drug row and expands on click (INV-3)', async () => {
    mockFetch.mockResolvedValue({
      offset: 0,
      has_more: false,
      summary,
      currency_symbol: 'GH₵',
      generated_at: '',
      items: [
        lot(1, { lot_number: 'LOT-A', on_hand: 30, value: 90 }),
        lot(2, { lot_number: 'LOT-B', on_hand: 20, value: 60 }),
      ],
    });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    // One drug rollup row for the two lots; the lots are hidden until expanded.
    expect(screen.getByRole('button', { name: /Ibuprofen.*2 lots/i })).toBeInTheDocument();
    expect(screen.queryByText('LOT-A')).toBeNull();

    await expandDrug();
    expect(screen.getByText('LOT-A')).toBeInTheDocument();
    expect(screen.getByText('LOT-B')).toBeInTheDocument();
  });

  it('shows days-of-supply per drug from consumption velocity (INV-4)', async () => {
    mockFetch.mockResolvedValue({
      offset: 0,
      has_more: false,
      summary,
      currency_symbol: 'GH₵',
      generated_at: '',
      items: [lot(1, { on_hand: 100, avg_per_day: 5 })], // 100 / 5 = 20 days
    });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    // Days-left shows on the drug rollup row (visible without expanding).
    expect(screen.getByText('20d')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Days left' })).toBeInTheDocument();
  });

  it('shows lot value and stock-value totals (INV-1)', async () => {
    mockFetch.mockResolvedValue({
      offset: 0,
      has_more: false,
      summary: { ...summary, total_value: 5000, value_expiring: 200, value_expired: 100, wastage_rate_pct: 2 },
      currency_symbol: 'GH₵',
      generated_at: '',
      items: [lot(1, { unit_cost: 3, value: 600 })],
    });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Stock value')).toBeInTheDocument();
    expect(screen.getByText('Wastage rate')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeInTheDocument();
    // Both the total and the lot value render as formatted money.
    expect(screen.getAllByText((t) => t.includes('GH₵')).length).toBeGreaterThan(0);
  });

  it('filters to expired lots when the Expired tile is clicked (INV-2)', async () => {
    mockFetch.mockResolvedValue({
      offset: 0,
      has_more: false,
      summary: { ...summary, expired: 3, value_expired: 100, total_value: 5000 },
      currency_symbol: 'GH₵',
      generated_at: '',
      items: [lot(1)],
    });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Expired lots/i }));
    });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].params.expiry).toBe('expired');
  });

  it('pages with Load more', async () => {
    mockFetch
      .mockResolvedValueOnce({ offset: 0, has_more: true, summary, generated_at: '', items: [lot(1)] })
      .mockResolvedValueOnce({
        offset: 1,
        has_more: false,
        summary: null,
        generated_at: '',
        items: [lot(2, { lot_number: 'LOT-NEXT' })],
      });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Load more/i }));
    });

    await expandDrug();
    expect(await screen.findByText('LOT-NEXT')).toBeInTheDocument();
  });

  it('adjusts a lot via the Adjust action when the user can receive', async () => {
    mockFetch
      .mockResolvedValueOnce({ offset: 0, has_more: false, summary, generated_at: '', items: [lot(1, { on_hand: 50 })] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ offset: 0, has_more: false, summary, generated_at: '', items: [lot(1, { on_hand: 40 })] });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" canReceive />);
    await act(async () => {
      await Promise.resolve();
    });

    await expandDrug();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Adjust$/i }));
    });
    fireEvent.change(screen.getByLabelText('Counted on hand'), { target: { value: '40' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Apply$/i }));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.inventory.adjust',
      expect.objectContaining({
        method: 'POST',
        json: expect.objectContaining({ inventory_id: 1, counted_on_hand: 40 }),
      }),
    );
  });

  it('asks for confirmation on a large adjustment and sends expected_on_hand', async () => {
    mockFetch
      .mockResolvedValueOnce({ offset: 0, has_more: false, summary, generated_at: '', items: [lot(1, { on_hand: 200 })] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ offset: 0, has_more: false, summary, generated_at: '', items: [lot(1, { on_hand: 40 })] });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" canReceive />);
    await act(async () => {
      await Promise.resolve();
    });

    await expandDrug();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Adjust$/i }));
    });
    fireEvent.change(screen.getByLabelText('Counted on hand'), { target: { value: '40' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Apply$/i }));
    });

    // A 200 → 40 swing is large, so the write is gated behind a confirm modal.
    expect(await screen.findByText('Large stock change')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith('pharm_ops.inventory.adjust', expect.anything());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply adjustment/i }));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.inventory.adjust',
      expect.objectContaining({
        method: 'POST',
        json: expect.objectContaining({ inventory_id: 1, counted_on_hand: 40, expected_on_hand: 200 }),
      }),
    );
  });

  it('runs a stock-take: counts a lot and applies the adjustment', async () => {
    mockFetch
      .mockResolvedValueOnce({
        offset: 0,
        has_more: false,
        summary,
        generated_at: '',
        items: [lot(1, { on_hand: 50 }), lot(2, { lot_number: 'LOT-2', on_hand: 20 })],
      })
      .mockResolvedValue({});

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" canReceive />);
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Start stock-take/i }));
    });
    fireEvent.change(screen.getByLabelText(/Counted Ibuprofen LOT-1/i), { target: { value: '45' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Apply counts/i }));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'pharm_ops.inventory.adjust',
      expect.objectContaining({
        json: expect.objectContaining({ inventory_id: 1, counted_on_hand: 45, reason: 'Stock-take' }),
      }),
    );
  });

  it('shows the empty state', async () => {
    mockFetch.mockResolvedValue({ offset: 0, has_more: false, summary, generated_at: '', items: [] });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('No stock')).toBeInTheDocument();
  });

  it('surfaces load errors', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
