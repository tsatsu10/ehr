import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { OtherPaymentModal } from './OtherPaymentModal';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));
vi.mock('./PatientSearchPanel', () => ({
  PatientSearchPanel: ({ onSelectPatient }: { onSelectPatient: (pid: number) => void }) => (
    <button type="button" onClick={() => onSelectPatient(7)}>mock-pick-patient</button>
  ),
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const context = {
  pid: 7,
  patient_label: 'Smith, Sam · MRN 7',
  payable_visits: [
    { visit_id: 41, visit_date: '2026-07-10', queue_number: 12, state: 'closed_unpaid', owed: 80 },
  ],
  momo_enabled: true,
  currency_symbol: 'GH₵',
};

describe('OtherPaymentModal', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  async function openWithPatient() {
    mockFetch.mockResolvedValueOnce(context);
    render(<OtherPaymentModal open onClose={() => {}} ajaxUrl="/mock/ajax" csrfToken="t" />);
    await act(async () => {
      fireEvent.click(screen.getByText('mock-pick-patient'));
    });
  }

  it('defaults to the owed visit and records a balance payment', async () => {
    await openWithPatient();
    mockFetch.mockResolvedValueOnce({ receipt_number: '3-20260715-0005', type: 'visit', amount: 80, method: 'cash' });

    expect(screen.getByText('Smith, Sam · MRN 7')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '80' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Record payment/i }));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'cashier.other_payment.post',
      expect.objectContaining({
        method: 'POST',
        json: expect.objectContaining({ pid: 7, type: 'visit', visit_id: 41, amount: 80, method: 'cash' }),
      }),
    );
    expect(await screen.findByText(/Receipt/)).toBeInTheDocument();
    expect(screen.getByText('3-20260715-0005')).toBeInTheDocument();
  });

  it('blocks paying more than the visit owes and points to a deposit', async () => {
    await openWithPatient();

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });

    expect(screen.getByText(/only owes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record payment/i })).toBeDisabled();
  });

  it('requires a MoMo reference for deposits paid by MoMo', async () => {
    await openWithPatient();

    fireEvent.change(screen.getByLabelText('What is this money for?'), { target: { value: 'deposit' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'momo' } });

    expect(screen.getByText('Required for MoMo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record payment/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('MoMo reference'), { target: { value: 'MM123' } });
    expect(screen.getByRole('button', { name: /Record payment/i })).toBeEnabled();
  });
});
