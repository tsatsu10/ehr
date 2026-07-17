import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

const toastMock = vi.fn();
vi.mock('@components/deskToast', () => ({ showDeskToast: (...args: unknown[]) => toastMock(...args) }));

import { CertificateDrawer, clearCertificateCachesForTest } from './CertificateDrawer';

const types = {
  excuse_duty: 'Excuse duty',
  school_absence: 'School absence',
  fit_to_resume: 'Fit to resume work',
  attendance: 'Attendance only',
};

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  visitId: 72,
  patientLabel: 'Test Patient · PT-12',
  onSaved: vi.fn(),
};

describe('CertificateDrawer', () => {
  beforeEach(() => {
    oeFetchMock.mockReset();
    toastMock.mockReset();
    baseProps.onSaved = vi.fn();
    clearCertificateCachesForTest();
  });

  it('requires rest dates for excuse duty and validates the range', async () => {
    oeFetchMock.mockResolvedValueOnce({ enabled: true, visit_id: 72, types, certificate: null });
    render(<CertificateDrawer {...baseProps} />);
    await screen.findByText('Excuse duty');
    // No dates yet -> save disabled.
    expect(screen.getByRole('button', { name: /Save certificate/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Rest from'), { target: { value: '2026-07-18' } });
    fireEvent.change(screen.getByLabelText('Rest to'), { target: { value: '2026-07-17' } });
    expect(screen.getByText(/end date must not be before/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Rest to'), { target: { value: '2026-07-20' } });
    expect(screen.getByRole('button', { name: /Save certificate/i })).toBeEnabled();
  });

  it('hides rest dates for attendance-only and saves', async () => {
    oeFetchMock.mockResolvedValueOnce({ enabled: true, visit_id: 72, types, certificate: null });
    oeFetchMock.mockResolvedValueOnce({ saved: true, cert_no: 'MC-2026-00009', superseded: false });
    render(<CertificateDrawer {...baseProps} />);
    await screen.findByText('Attendance only');
    fireEvent.click(screen.getByLabelText('Attendance only'));
    expect(screen.queryByLabelText('Rest from')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save certificate/i }));
    await waitFor(() => expect(baseProps.onSaved).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith('Certificate MC-2026-00009 saved', 'success');
  });

  it('warns that saving after print issues a new number', async () => {
    oeFetchMock.mockResolvedValueOnce({
      enabled: true,
      visit_id: 72,
      types,
      certificate: {
        id: 5, cert_no: 'MC-2026-00005', cert_type: 'excuse_duty',
        rest_from: '2026-07-18', rest_to: '2026-07-20', remarks: '',
        include_diagnosis: 0, diagnosis_text: '', print_count: 2,
      },
    });
    render(<CertificateDrawer {...baseProps} />);
    expect(await screen.findByText('MC-2026-00005')).toBeInTheDocument();
    expect(screen.getByText(/issues a NEW number/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Issue new certificate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
  });
});
