export type PeopleSubTabId = 'staff' | 'access' | 'facilities' | 'help';

export const PEOPLE_SUB_TABS: { id: PeopleSubTabId; label: string }[] = [
  { id: 'staff', label: 'Staff' },
  { id: 'access', label: 'Access & ACL' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'help', label: 'Help' },
];

export interface StaffRow {
  id: number;
  username: string;
  display_name: string;
  active: boolean;
  facility_id: number;
  role_template: string | null;
  role_template_label: string | null;
  desks: string[];
  groups: string[];
}

export interface StaffListPayload {
  rows: StaffRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface RoleTemplate {
  id: string;
  label: string;
  desk_app: string;
  desks: string[];
  supports_lead: boolean;
  warnings?: string[];
}

export interface TemplateReviewItem {
  kind: string;
  text: string;
  allowed: boolean;
}

export interface StaffAccessSummary {
  user_id: number;
  username: string;
  display_name: string;
  active: boolean;
  groups: string[];
  role_template: { id: string | null; label: string | null; desks: string[] };
  desk_apps: string[];
  sensitive_acos: string[];
  warnings: string[];
}

export interface FacilityMatrixPayload {
  users: { id: number; username: string; display_name: string }[];
  facilities: { id: number; name: string }[];
  has_facusr_fields: boolean;
  field_count: number;
}

export interface FacilityUserField {
  field_id: string;
  title: string;
  data_type: string;
  uor: number;
  list_id?: string;
}

export interface FacilityUserPayload {
  user_id: number;
  facility_id: number;
  fields: FacilityUserField[];
  values: Record<string, string>;
}

export interface FacilityMatrixGridPayload {
  fields: { field_id: string; title: string }[];
  facilities: { id: number; name: string }[];
  rows: {
    user_id: number;
    username: string;
    display_name: string;
    facility_id: number;
    facility_name: string;
    cells: Record<string, string>;
  }[];
  has_facusr_fields: boolean;
}

export interface AclUserListPayload {
  users: {
    id: number;
    username: string;
    display_name: string;
    no_membership: boolean;
  }[];
}

export interface AclGroupOption {
  value: string;
  label: string;
}

export interface AclMembershipPayload {
  username: string;
  active: AclGroupOption[];
  inactive: AclGroupOption[];
  warnings?: string[];
}

export interface AclGroupListPayload {
  groups: {
    value: string;
    title: string;
    return_value: string;
    return_title: string;
    note: string;
  }[];
}

export interface AclGroupPermissionsPayload {
  group: string;
  return_value: string;
  active: { name: string; acos: { id: string; title: string }[] }[];
  inactive: { name: string; acos: { id: string; title: string }[] }[];
  warnings?: string[];
}

export interface AclReturnValuesPayload {
  return_values: { return_value: string; title: string }[];
}

export interface StaffUserDetail {
  id: number;
  username: string;
  fname: string;
  lname: string;
  mname: string;
  active: boolean;
  facility_id: number;
  email: string;
  authorized: boolean;
  groups: string[];
  active_groups: AclGroupOption[];
  inactive_groups: AclGroupOption[];
  facilities: { id: number; name: string }[];
}

export interface PeopleLegacyAction {
  id: string;
  title: string;
  description: string;
  view: string;
  sub: PeopleSubTabId;
  advanced?: boolean;
}
