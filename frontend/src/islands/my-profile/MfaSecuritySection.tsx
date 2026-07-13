import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { ConfirmModal } from '@components/ConfirmModal';
import { t } from '@core/i18n';
import { oeFetch } from '@core/oeFetch';
import { AdminSection } from '@islands/admin-hub/adminUi';
import { ShieldCheck } from 'lucide-react';
import type { MfaEnrollStart, MfaStatus } from './myProfileTypes';

interface MfaSecuritySectionProps {
  ajaxUrl: string;
  csrfToken: string;
}

type EnrollStep = 'idle' | 'password' | 'verify';

/**
 * A6 (G11) — self-service TOTP MFA. Enroll is stepped: confirm password →
 * scan QR → prove a 6-digit code before it is saved (stricter than the legacy
 * screen, which saved on display). Remove requires the account password.
 */
export function MfaSecuritySection({ ajaxUrl, csrfToken }: MfaSecuritySectionProps) {
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [step, setStep] = useState<EnrollStep>('idle');
  const [password, setPassword] = useState('');
  const [enroll, setEnroll] = useState<MfaEnrollStart | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removePassword, setRemovePassword] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await oeFetch<MfaStatus>('profile.mfa.status', fetchOptions);
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const resetEnroll = useCallback(() => {
    setStep('idle');
    setPassword('');
    setEnroll(null);
    setCode('');
    setFlowError(null);
    setBusy(false);
  }, []);

  const submitPassword = async () => {
    setFlowError(null);
    setBusy(true);
    try {
      const data = await oeFetch<MfaEnrollStart>('profile.mfa.enroll_start', {
        ...fetchOptions,
        method: 'POST',
        json: { password },
      });
      setEnroll(data);
      setPassword('');
      setStep('verify');
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : t('Could not start setup.'));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setFlowError(null);
    setBusy(true);
    try {
      await oeFetch('profile.mfa.enroll_verify', {
        ...fetchOptions,
        method: 'POST',
        json: { code },
      });
      resetEnroll();
      setStatus({ totp_enabled: true, ad_managed: false });
      setMessage(t('Authenticator app is on.'));
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : t('Could not verify the code.'));
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    setRemoveError(null);
    setRemoving(true);
    try {
      await oeFetch('profile.mfa.remove', {
        ...fetchOptions,
        method: 'POST',
        json: { password: removePassword },
      });
      setRemoveOpen(false);
      setRemovePassword('');
      setStatus({ totp_enabled: false, ad_managed: false });
      setMessage(t('Authenticator app removed.'));
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : t('Could not remove.'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AdminSection
      title={t('Security')}
      description={t('Add a second step at sign-in with an authenticator app.')}
      icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
      variant="muted"
    >
      {loading ? (
        <p className="nc-my-profile-hint mb-0">{t('Loading…')}</p>
      ) : status?.ad_managed ? (
        <p className="nc-my-profile-hint mb-0">
          {t('Sign-in security is managed by your organization directory.')}
        </p>
      ) : (
        <div className="space-y-3" data-testid="nc-mfa-security">
          {step === 'idle' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[var(--oe-nc-text)]">{t('Authenticator app')}</span>
              {status?.totp_enabled ? (
                <Badge variant="success">{t('On')}</Badge>
              ) : (
                <Badge variant="neutral">{t('Off')}</Badge>
              )}
              <div className="ml-auto">
                {status?.totp_enabled ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    id="nc-mfa-remove"
                    onClick={() => { setRemoveError(null); setRemovePassword(''); setRemoveOpen(true); }}
                  >
                    {t('Remove')}
                  </Button>
                ) : (
                  <Button type="button" size="sm" id="nc-mfa-setup" onClick={() => { setMessage(null); setStep('password'); }}>
                    {t('Set up')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-2">
              <Label htmlFor="nc-mfa-password">{t('Confirm your password to continue')}</Label>
              <Input
                id="nc-mfa-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={busy || password === ''} onClick={() => { void submitPassword(); }}>
                  {busy ? t('Checking…') : t('Continue')}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={resetEnroll}>{t('Cancel')}</Button>
              </div>
            </div>
          )}

          {step === 'verify' && enroll && (
            <div className="space-y-2">
              <p className="nc-my-profile-hint mb-0">
                {t('Scan this with your authenticator app, then enter the 6-digit code it shows.')}
              </p>
              <img
                src={enroll.qr}
                alt={t('Authenticator setup QR code')}
                className="my-1"
                style={{ height: '160px', width: '160px' }}
              />
              <p className="nc-my-profile-hint mb-0">
                {t('Can’t scan? Enter this key:')} <code className="font-mono">{enroll.secret}</code>
              </p>
              <Label htmlFor="nc-mfa-code">{t('6-digit code')}</Label>
              <Input
                id="nc-mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={busy || code.length !== 6} onClick={() => { void submitCode(); }}>
                  {busy ? t('Verifying…') : t('Turn on')}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={resetEnroll}>{t('Cancel')}</Button>
              </div>
            </div>
          )}

          {flowError && (
            <p className="nc-my-profile-message nc-my-profile-message--error" role="alert">{flowError}</p>
          )}
          {message && step === 'idle' && (
            <p className="nc-my-profile-message nc-my-profile-message--ok">{message}</p>
          )}
        </div>
      )}

      <ConfirmModal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title={t('Remove authenticator app?')}
        titleId="nc-mfa-remove-title"
        modalId="nc-mfa-remove-modal"
        confirmLabel={t('Remove')}
        confirmVariant="danger"
        submitting={removing}
        submittingLabel={t('Removing…')}
        confirmDisabled={removePassword === ''}
        onConfirm={() => { void confirmRemove(); }}
      >
        <p className="mb-2">
          {t('You’ll sign in with just your password until you set it up again.')}
        </p>
        <Label htmlFor="nc-mfa-remove-password">{t('Confirm your password')}</Label>
        <Input
          id="nc-mfa-remove-password"
          type="password"
          autoComplete="current-password"
          value={removePassword}
          onChange={(e) => setRemovePassword(e.target.value)}
        />
        {removeError && (
          <p className="nc-my-profile-message nc-my-profile-message--error mt-2" role="alert">{removeError}</p>
        )}
      </ConfirmModal>
    </AdminSection>
  );
}
