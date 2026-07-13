import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MfaSecuritySection } from './MfaSecuritySection';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');

const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

function statusOnce(status: { totp_enabled: boolean; ad_managed: boolean }) {
  mockedFetch.mockImplementation(async (action: string) => {
    if (action === 'profile.mfa.status') return status as never;
    return {} as never;
  });
}

describe('MfaSecuritySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('walks the enroll flow: setup → password → QR + code → on', async () => {
    mockedFetch.mockImplementation(async (action: string) => {
      if (action === 'profile.mfa.status') return { totp_enabled: false, ad_managed: false } as never;
      if (action === 'profile.mfa.enroll_start') return { qr: 'data:image/svg+xml,x', secret: 'ABCDEF' } as never;
      if (action === 'profile.mfa.enroll_verify') return { totp_enabled: true } as never;
      return {} as never;
    });

    render(<MfaSecuritySection ajaxUrl="/ajax.php" csrfToken="tok" />);

    await waitFor(() => expect(screen.getByText('Off')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Set up' }));
    fireEvent.change(screen.getByLabelText('Confirm your password to continue'), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByAltText('Authenticator setup QR code')).toBeInTheDocument());
    expect(screen.getByText('ABCDEF')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    await waitFor(() => expect(screen.getByText('Authenticator app is on.')).toBeInTheDocument());
    expect(screen.getByText('On')).toBeInTheDocument();

    const verifyCall = mockedFetch.mock.calls.find((c) => c[0] === 'profile.mfa.enroll_verify');
    expect(verifyCall?.[1]).toMatchObject({ method: 'POST', json: { code: '123456' } });
  });

  it('strips non-digits from the code field', async () => {
    mockedFetch.mockImplementation(async (action: string) => {
      if (action === 'profile.mfa.status') return { totp_enabled: false, ad_managed: false } as never;
      if (action === 'profile.mfa.enroll_start') return { qr: 'data:image/svg+xml,x', secret: 'S' } as never;
      return {} as never;
    });
    render(<MfaSecuritySection ajaxUrl="/ajax.php" csrfToken="tok" />);
    await waitFor(() => screen.getByRole('button', { name: 'Set up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set up' }));
    fireEvent.change(screen.getByLabelText('Confirm your password to continue'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => screen.getByLabelText('6-digit code'));

    const codeInput = screen.getByLabelText('6-digit code') as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: '12ab34' } });
    expect(codeInput.value).toBe('1234');
  });

  it('shows a remove button when enabled and requires a password to confirm', async () => {
    mockedFetch.mockImplementation(async (action: string) => {
      if (action === 'profile.mfa.status') return { totp_enabled: true, ad_managed: false } as never;
      if (action === 'profile.mfa.remove') return { totp_enabled: false } as never;
      return {} as never;
    });
    render(<MfaSecuritySection ajaxUrl="/ajax.php" csrfToken="tok" />);
    await waitFor(() => expect(screen.getByText('On')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Confirm your password'), { target: { value: 'pw' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(mockedFetch.mock.calls.some((c) => c[0] === 'profile.mfa.remove')).toBe(true)
    );
    await waitFor(() => expect(screen.getByText('Authenticator app removed.')).toBeInTheDocument());
  });

  it('shows a directory note for AD-managed accounts', async () => {
    statusOnce({ totp_enabled: false, ad_managed: true });
    render(<MfaSecuritySection ajaxUrl="/ajax.php" csrfToken="tok" />);
    await waitFor(() =>
      expect(screen.getByText(/managed by your organization directory/i)).toBeInTheDocument()
    );
  });
});
