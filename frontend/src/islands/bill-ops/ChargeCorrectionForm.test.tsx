import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChargeCorrectionForm } from './ChargeCorrectionForm';

const fetchOptions = { ajaxUrl: '/ajax.php', csrfToken: 'token' };

const visitPayload = {
  visit: {
    id: 99,
    queue_number: 12,
    state: 'awaiting_payment',
    patient_name: 'Kwame Owusu',
    pubpid: 'MRN-42',
  },
  currency_symbol: 'GH₵',
  charges: [{ id: 1, code: 'CONS', description: 'Consultation', units: 1, unit_price: 50, amount: 50 }],
  charges_total: 50,
  paid_total: 20,
  balance_due: 30,
  fee_schedule: [],
  can_apply_discount: false,
};

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
}));

import { oeFetch } from '@core/oeFetch';

describe('ChargeCorrectionForm', () => {
  it('shows patient banner after visit loads', async () => {
    vi.mocked(oeFetch).mockResolvedValueOnce(visitPayload);

    render(
      <ChargeCorrectionForm
        fetchOptions={fetchOptions}
        visitId={null}
        showVisitLookup
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Visit id'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load visit' }));

    await waitFor(() => {
      expect(screen.getByText(/Kwame Owusu/)).toBeInTheDocument();
    });
    expect(screen.getByText('Q#12')).toBeInTheDocument();
    expect(screen.getByText('awaiting_payment')).toBeInTheDocument();
    expect(screen.getByText(/Due.*30\.00/)).toBeInTheDocument();
  });
});
