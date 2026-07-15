import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsInventoryBrowser } from './PharmOpsInventoryBrowser';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('PharmOpsInventoryBrowser', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders lots with on-hand and an expiry status badge', async () => {
    mockFetch.mockResolvedValue({
      generated_at: '',
      items: [
        {
          inventory_id: 1,
          drug_id: 6,
          drug_name: 'Ibuprofen',
          lot_number: 'LOT-A',
          on_hand: 200,
          expiration: '2026-08-01',
          expiry_status: 'expiring',
        },
        {
          inventory_id: 2,
          drug_id: 6,
          drug_name: 'Ibuprofen',
          lot_number: 'LOT-B',
          on_hand: 0,
          expiration: '',
          expiry_status: 'ok',
        },
      ],
    });

    render(<PharmOpsInventoryBrowser ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('LOT-A')).toBeInTheDocument();
    expect(screen.getByText('Expiring')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    mockFetch.mockResolvedValue({ generated_at: '', items: [] });

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
