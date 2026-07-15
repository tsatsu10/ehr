import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsActivityReport } from './PharmOpsActivityReport';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('PharmOpsActivityReport', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders per-product movement totals and on-hand', async () => {
    mockFetch.mockResolvedValue({
      from: '2026-06-15',
      to: '2026-07-15',
      generated_at: '',
      items: [
        {
          drug_id: 6,
          drug_name: 'Ibuprofen',
          sales: -40,
          distributions: 0,
          purchases: 100,
          transfers: 0,
          adjustments: -5,
          on_hand: 55,
        },
      ],
    });

    render(<PharmOpsActivityReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Ibuprofen')).toBeInTheDocument();
    expect(screen.getByText('-40')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
  });

  it('shows the empty state when nothing moved', async () => {
    mockFetch.mockResolvedValue({ from: '2026-06-15', to: '2026-07-15', generated_at: '', items: [] });

    render(<PharmOpsActivityReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('No stock movement')).toBeInTheDocument();
  });

  it('surfaces load errors', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));

    render(<PharmOpsActivityReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
