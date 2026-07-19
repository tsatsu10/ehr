import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

import { VerifyCertificateDialog } from './VerifyCertificateDialog';

const baseProps = {
  open: true,
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  onClose: vi.fn(),
};

async function check(serial: string) {
  fireEvent.change(screen.getByLabelText('Certificate number'), { target: { value: serial } });
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
}

describe('VerifyCertificateDialog', () => {
  beforeEach(() => {
    oeFetchMock.mockReset();
    baseProps.onClose = vi.fn();
  });

  it('confirms a genuine certificate with comparison details', async () => {
    oeFetchMock.mockResolvedValueOnce({
      found: true,
      cert_no: 'MC-2026-00042',
      status: 'valid',
      cert_type: 'Excuse duty',
      issued_on: '19/07/2026',
      rest_from: '19/07/2026',
      rest_to: '21/07/2026',
      patient_name: 'Ama Mensah',
      pubpid: '523',
      clinician: 'Dr Boateng',
      ever_printed: true,
    });
    render(<VerifyCertificateDialog {...baseProps} />);
    await check('MC-2026-00042');

    expect(await screen.findByText(/is a genuine certificate/)).toBeInTheDocument();
    expect(screen.getByText(/Ama Mensah/)).toBeInTheDocument();
    expect(screen.getByText(/Rest period: 19\/07\/2026/)).toBeInTheDocument();
    const call = oeFetchMock.mock.calls.at(-1);
    expect(call?.[0]).toBe('front_desk.verify_certificate');
    expect((call?.[1] as { params: { serial: string } }).params.serial).toBe('MC-2026-00042');
  });

  it('warns when the certificate was replaced by a newer one', async () => {
    oeFetchMock.mockResolvedValueOnce({
      found: true,
      cert_no: 'MC-2026-00042',
      status: 'superseded',
      superseded_by_no: 'MC-2026-00050',
      cert_type: 'Excuse duty',
      patient_name: 'Ama Mensah',
    });
    render(<VerifyCertificateDialog {...baseProps} />);
    await check('MC-2026-00042');

    expect(await screen.findByText(/REPLACED by MC-2026-00050/)).toBeInTheDocument();
  });

  it('reads not-found plainly and surfaces validation errors', async () => {
    oeFetchMock.mockResolvedValueOnce({ found: false, cert_no: 'MC-2026-99999' });
    render(<VerifyCertificateDialog {...baseProps} />);
    await check('MC-2026-99999');
    expect(await screen.findByText(/No certificate with the number MC-2026-99999/)).toBeInTheDocument();

    oeFetchMock.mockRejectedValueOnce(new Error('Enter a certificate number like MC-2026-00042'));
    await check('nonsense');
    expect(await screen.findByText('Enter a certificate number like MC-2026-00042')).toBeInTheDocument();
  });
});
