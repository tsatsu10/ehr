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
}
