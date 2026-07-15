import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PharmOpsPrescriptionsReport } from './PharmOpsPrescriptionsReport';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('PharmOpsPrescriptionsReport', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders prescribed vs dispensed with a fulfilment status', async () => {
    mockFetch.mockResolvedValue({
      from: '2026-04-16',
      to: '2026-07-15',
      generated_at: '',
      items: [
        {
          prescription_id: 3,
          date: '2026-07-01',
          patient_name: 'Owusu, Ama',
          pubpid: 'MRN-42',
          drug_name: 'Amoxicillin 500mg',
          prescribed_qty: 21,
          dispensed_qty: 21,
          status: 'dispensed',
          status_label: 'Dispensed',
        },
        {
          prescription_id: 4,
          date: '2026-07-02',
          patient_name: 'Boateng, John',
          pubpid: 'MRN-9',
          drug_name: 'Metformin',
          prescribed_qty: 60,
          dispensed_qty: 0,
          status: 'not_dispensed',
          status_label: 'Not dispensed',
        },
      ],
    });

    render(<PharmOpsPrescriptionsReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('Amoxicillin 500mg')).toBeInTheDocument();
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    // "Not dispensed" is a status badge unique to the second row.
    expect(screen.getByText('Not dispensed')).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    mockFetch.mockResolvedValue({ from: '2026-04-16', to: '2026-07-15', generated_at: '', items: [] });

    render(<PharmOpsPrescriptionsReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('No prescriptions')).toBeInTheDocument();
  });

  it('surfaces load errors', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));

    render(<PharmOpsPrescriptionsReport ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
