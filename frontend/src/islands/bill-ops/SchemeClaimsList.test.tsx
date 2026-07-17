import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SchemeClaimsList } from './SchemeClaimsList';

vi.mock('@core/oeFetch', () => ({ oeFetch: vi.fn() }));
import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const claim = {
  id: 5,
  visit_id: 9,
  display_name: 'Ama Boateng',
  pubpid: 'MRN003',
  insurance_company_id: 1,
  scheme_name: 'NHIS',
  membership_number: 'M-123',
  scheme_owed: 40,
  patient_pay: 60,
  status: 'to_submit',
  rejection_note: '',
  created_at: '2026-07-15',
  age_days: 2,
  age_bucket: '0_7',
};

describe('SchemeClaimsList', () => {
  beforeEach(() => vi.resetAllMocks());

  it('renders claims and a status action when enabled', async () => {
    mockFetch.mockResolvedValue({ enabled: true, status: 'to_submit', schemes: [{ id: 1, name: 'NHIS' }], rows: [claim] });
    render(<SchemeClaimsList ajaxUrl="/ajax" csrfToken="t" />);

    await waitFor(() => expect(screen.getByText('NHIS')).toBeInTheDocument());
    expect(screen.getByText('Ama Boateng')).toBeInTheDocument();
    expect(screen.getByText('M-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark submitted/i })).toBeInTheDocument();
  });

  it('explains why the tab is empty when the scheme feature is off, instead of showing nothing', async () => {
    mockFetch.mockResolvedValue({ enabled: false, status: 'to_submit', schemes: [], rows: [] });
    render(<SchemeClaimsList ajaxUrl="/ajax" csrfToken="t" />);
    await waitFor(() => expect(screen.getByText(/not turned on for this clinic/i)).toBeInTheDocument());
  });

  it('posts a status transition when Mark submitted is clicked', async () => {
    mockFetch.mockResolvedValue({ enabled: true, status: 'to_submit', schemes: [], rows: [claim] });
    render(<SchemeClaimsList ajaxUrl="/ajax" csrfToken="t" />);

    await waitFor(() => screen.getByRole('button', { name: /Mark submitted/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mark submitted/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'bill_ops.scheme_claim_status',
        expect.objectContaining({ json: { claim_id: 5, status: 'submitted', rejection_note: '' } }),
      );
    });
  });

  it('requires a reason and posts it when rejecting a submitted claim', async () => {
    const submittedClaim = { ...claim, status: 'submitted' };
    mockFetch.mockResolvedValue({ enabled: true, status: 'submitted', schemes: [], rows: [submittedClaim] });
    render(<SchemeClaimsList ajaxUrl="/ajax" csrfToken="t" />);

    await waitFor(() => screen.getByRole('button', { name: /^Reject$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Reject$/i }));

    // Confirming with an empty reason should not call the API.
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    expect(mockFetch).not.toHaveBeenCalledWith('bill_ops.scheme_claim_status', expect.anything());

    fireEvent.change(screen.getByLabelText(/Rejection reason/i), { target: { value: 'Member expired' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'bill_ops.scheme_claim_status',
        expect.objectContaining({ json: { claim_id: 5, status: 'rejected', rejection_note: 'Member expired' } }),
      );
    });
  });
});
