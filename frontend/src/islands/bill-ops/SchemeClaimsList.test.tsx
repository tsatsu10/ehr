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
  scheme_name: 'NHIS',
  membership_number: 'M-123',
  scheme_owed: 40,
  patient_pay: 60,
  status: 'to_submit',
  created_at: '2026-07-15',
};

describe('SchemeClaimsList', () => {
  beforeEach(() => vi.resetAllMocks());

  it('renders claims and a status action when enabled', async () => {
    mockFetch.mockResolvedValue({ enabled: true, status: 'to_submit', rows: [claim] });
    render(<SchemeClaimsList ajaxUrl="/ajax" csrfToken="t" />);

    await waitFor(() => expect(screen.getByText('NHIS')).toBeInTheDocument());
    expect(screen.getByText('Ama Boateng')).toBeInTheDocument();
    expect(screen.getByText('M-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark submitted/i })).toBeInTheDocument();
  });

  it('renders nothing when the scheme feature is off', async () => {
    mockFetch.mockResolvedValue({ enabled: false, status: 'to_submit', rows: [] });
    const { container } = render(<SchemeClaimsList ajaxUrl="/ajax" csrfToken="t" />);
    await waitFor(() => expect(container.querySelector('.nc-billops-scheme-claims')).toBeNull());
  });

  it('posts a status transition when Mark submitted is clicked', async () => {
    mockFetch.mockResolvedValue({ enabled: true, status: 'to_submit', rows: [claim] });
    render(<SchemeClaimsList ajaxUrl="/ajax" csrfToken="t" />);

    await waitFor(() => screen.getByRole('button', { name: /Mark submitted/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mark submitted/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'bill_ops.scheme_claim_status',
        expect.objectContaining({ json: { claim_id: 5, status: 'submitted' } }),
      );
    });
  });
});
