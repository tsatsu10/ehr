import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsDestroyedReport } from './PharmOpsDestroyedReport';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('PharmOpsDestroyedReport', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders destroyed lots with a regional (DD/MM/YYYY) date', async () => {
    mockFetch.mockResolvedValue({
      from: '2025-07-15',
      to: '2026-07-15',
      generated_at: '',
      items: [
        {
          inventory_id: 7,
          drug_id: 3,
          drug_name: 'Artemether-Lumefantrine',
          lot_number: 'LOT-9',
          quantity: 30,
          destroy_date: '2026-06-01',
          method: 'Incineration',
          witness: 'K. Mensah',
          notes: 'Expired',
        },
      ],
    });

    render(<PharmOpsDestroyedReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Artemether-Lumefantrine')).toBeInTheDocument();
    expect(screen.getByText('01/06/2026')).toBeInTheDocument();
    expect(screen.getByText('Incineration')).toBeInTheDocument();
  });

  it('shows the empty state when nothing was destroyed', async () => {
    mockFetch.mockResolvedValue({ from: '2025-07-15', to: '2026-07-15', generated_at: '', items: [] });

    render(<PharmOpsDestroyedReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('No destroyed lots')).toBeInTheDocument();
  });

  it('surfaces load errors', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));

    render(<PharmOpsDestroyedReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
