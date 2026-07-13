export interface MyProfileRole {
  aco: string;
  label: string;
  desk_label: string;
  accent: string;
  is_active?: boolean;
}

export interface MyProfileGroup {
  value: string;
  label: string;
}

export interface MyProfileData {
  id: number;
  username: string;
  fname: string;
  lname: string;
  mname: string;
  email: string;
  display_name: string;
  initials: string;
  active: boolean;
  authorized: boolean;
  facility_id: number;
  facility_name: string;
  groups: MyProfileGroup[];
  role_template: string | null;
  role_template_label: string | null;
  desks: string[];
  active_role: MyProfileRole;
  available_roles: MyProfileRole[];
  can_change_password: boolean;
  secure_password: boolean;
}

export interface MyProfileProps {
  ajaxUrl: string;
  csrfToken: string;
  webroot?: string;
  /** SEC-5: set when the shell redirected here to force a temporary-password change. */
  forcePasswordChange?: boolean;
}

/** A6 — TOTP MFA enrollment status (profile.mfa.status). */
export interface MfaStatus {
  totp_enabled: boolean;
  /** Directory-managed accounts can't self-enroll app TOTP here. */
  ad_managed: boolean;
}

/** profile.mfa.enroll_start payload — QR data-URI + base32 secret for manual entry. */
export interface MfaEnrollStart {
  qr: string;
  secret: string;
}
