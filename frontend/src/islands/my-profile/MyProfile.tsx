import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { t } from '@core/i18n';
import { oeFetch } from '@core/oeFetch';
import { AdminEmptyState, AdminLoadingState, AdminSection } from '@islands/admin-hub/adminUi';
import { KeyRound, Shield, UserRound } from 'lucide-react';
import type { MyProfileData, MyProfileProps } from './myProfileTypes';
import { MfaSecuritySection } from './MfaSecuritySection';
import { profileAccentClass } from './myProfileUi';

function PasswordFields({
  profile,
  currentPassword,
  newPassword,
  confirmPassword,
  savingPassword,
  passwordMessage,
  passwordError,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSave,
}: {
  profile: MyProfileData;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  savingPassword: boolean;
  passwordMessage: string | null;
  passwordError: string | null;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSave: () => void;
}) {
  if (!profile.can_change_password) {
    return (
      <div className="nc-my-profile-password-block">
        <h3 className="nc-my-profile-subheading">{t('Password')}</h3>
        <p className="nc-my-profile-hint mb-0">
          {t('Your organization manages sign-in through Active Directory. Contact IT if you need to reset your directory password.')}
        </p>
      </div>
    );
  }

  return (
    <div className="nc-my-profile-password-block">
      <h3 className="nc-my-profile-subheading">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {t('Password')}
      </h3>
      <p className="nc-my-profile-hint">
        {profile.secure_password
          ? t('Strong password required by clinic policy.')
          : t('Update your sign-in password.')}
      </p>
      <div className="nc-my-profile-form-grid mt-3">
        <div className="nc-my-profile-span-2">
          <Label htmlFor="profile-cur-pass">{t('Current password')}</Label>
          <Input
            id="profile-cur-pass"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => onCurrentPasswordChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="profile-new-pass">{t('New password')}</Label>
          <Input
            id="profile-new-pass"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="profile-confirm-pass">{t('Confirm new password')}</Label>
          <Input
            id="profile-confirm-pass"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
          />
        </div>
      </div>
      <div className="nc-my-profile-actions mt-4">
        <Button type="button" size="sm" disabled={savingPassword} onClick={onSave}>
          {savingPassword ? t('Updating…') : t('Update password')}
        </Button>
        {passwordMessage && (
          <p className="nc-my-profile-message nc-my-profile-message--ok">{passwordMessage}</p>
        )}
        {passwordError && (
          <p className="nc-my-profile-message nc-my-profile-message--error">{passwordError}</p>
        )}
      </div>
    </div>
  );
}

export function MyProfile({ ajaxUrl, csrfToken, forcePasswordChange }: MyProfileProps) {
  const [profile, setProfile] = useState<MyProfileData | null>(null);
  const [form, setForm] = useState({ fname: '', lname: '', mname: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await oeFetch<MyProfileData>('profile.get', fetchOptions);
      setProfile(data);
      setForm({
        fname: data.fname,
        lname: data.lname,
        mname: data.mname,
        email: data.email,
      });
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : t('Could not load profile'));
    } finally {
      setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveDetails = async () => {
    setDetailsError(null);
    setDetailsMessage(null);
    setSavingDetails(true);
    try {
      const data = await oeFetch<MyProfileData>('profile.update', {
        ...fetchOptions,
        json: form,
      });
      setProfile(data);
      setDetailsMessage(t('Profile saved'));
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : t('Save failed'));
    } finally {
      setSavingDetails(false);
    }
  };

  const savePassword = async () => {
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordError(t('New password and confirmation do not match'));
      return;
    }
    setSavingPassword(true);
    try {
      await oeFetch('profile.change_password', {
        ...fetchOptions,
        json: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });
      setPasswordMessage(t('Password updated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('Password change failed'));
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label={t('Loading your profile…')} />;
  }

  if (!profile) {
    return (
      <AdminEmptyState
        title={t('Profile unavailable')}
        description={detailsError ?? t('Try refreshing the page.')}
      />
    );
  }

  const accentClass = profileAccentClass(profile.active_role.accent);

  return (
    <div className="nc-my-profile space-y-4">
      {forcePasswordChange && (
        <div className="nc-my-profile-message nc-my-profile-message--error" role="alert">
          {t('You’re using a temporary password. Set a new password below before you can open the clinic desks.')}
        </div>
      )}
      <header className={`nc-my-profile-hero ${accentClass}`}>
        <span className="nc-my-profile-avatar" aria-hidden="true">
          {profile.initials}
        </span>
        <div className="nc-my-profile-hero-main">
          <h2 className="nc-my-profile-hero-name">{profile.display_name || profile.username}</h2>
          <p className="nc-my-profile-hero-meta">
            @{profile.username}
            {profile.facility_name ? ` · ${profile.facility_name}` : ''}
          </p>
        </div>
        <span className={`nc-my-profile-role-pill ${accentClass}`}>
          {profile.active_role.desk_label}
        </span>
      </header>

      <div className="nc-my-profile-grid">
        <AdminSection
          title={t('Account details')}
          description={t('Name and contact shown on charts, receipts, and audit trails.')}
          icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
        >
          <div className="nc-my-profile-form-grid">
            <div>
              <Label htmlFor="profile-fname">{t('First name')}</Label>
              <Input
                id="profile-fname"
                value={form.fname}
                onChange={(e) => setForm((f) => ({ ...f, fname: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="profile-lname">{t('Last name')}</Label>
              <Input
                id="profile-lname"
                value={form.lname}
                onChange={(e) => setForm((f) => ({ ...f, lname: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="profile-mname">{t('Middle name')}</Label>
              <Input
                id="profile-mname"
                value={form.mname}
                onChange={(e) => setForm((f) => ({ ...f, mname: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="profile-email">{t('Email')}</Label>
              <Input
                id="profile-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="nc-my-profile-span-2">
              <Label htmlFor="profile-username">{t('Username')}</Label>
              <Input id="profile-username" value={profile.username} disabled readOnly />
              <p className="nc-my-profile-hint mt-1">{t('Username changes require an administrator.')}</p>
            </div>
          </div>
          <div className="nc-my-profile-actions mt-4">
            <Button type="button" disabled={savingDetails} onClick={() => { void saveDetails(); }}>
              {savingDetails ? t('Saving…') : t('Save details')}
            </Button>
            {detailsMessage && (
              <p className="nc-my-profile-message nc-my-profile-message--ok">{detailsMessage}</p>
            )}
            {detailsError && (
              <p className="nc-my-profile-message nc-my-profile-message--error">{detailsError}</p>
            )}
          </div>

          <PasswordFields
            profile={profile}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            savingPassword={savingPassword}
            passwordMessage={passwordMessage}
            passwordError={passwordError}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSave={() => { void savePassword(); }}
          />
        </AdminSection>

        <div className="nc-my-profile-grid__side space-y-4">
          <AdminSection
            title={t('Session & access')}
            description={t('Your active desk and clinic permissions.')}
            icon={<Shield className="h-4 w-4" aria-hidden="true" />}
            variant="muted"
          >
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                  {t('Active desk')}
                </p>
                <p className="mb-0 text-sm font-medium text-[var(--oe-nc-text)]">
                  {profile.active_role.desk_label}
                </p>
                <p className="nc-my-profile-hint mt-1">
                  {t('Switch desks from the profile menu in the sidebar on shared devices.')}
                </p>
              </div>

              {profile.role_template_label && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                    {t('Role template')}
                  </p>
                  <Badge variant="neutral">{profile.role_template_label}</Badge>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                  {t('Access groups')}
                </p>
                <div className="nc-my-profile-chip-list">
                  {profile.groups.length > 0 ? (
                    profile.groups.map((group) => (
                      <span key={group.value} className="nc-my-profile-chip">
                        {group.label}
                      </span>
                    ))
                  ) : (
                    <span className="nc-my-profile-hint">{t('No groups assigned')}</span>
                  )}
                </div>
              </div>

              {profile.available_roles.length > 1 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                    {t('Your desks')}
                  </p>
                  <div className="nc-my-profile-role-list">
                    {profile.available_roles.map((role) => (
                      <div
                        key={role.aco}
                        className={`nc-my-profile-role-row ${profileAccentClass(role.accent)}${role.is_active ? ' is-active' : ''}`}
                      >
                        <span className="text-sm font-medium">{role.desk_label}</span>
                        {role.is_active ? <Badge>{t('Active')}</Badge> : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AdminSection>

          <MfaSecuritySection ajaxUrl={ajaxUrl} csrfToken={csrfToken} />
        </div>
      </div>
    </div>
  );
}
