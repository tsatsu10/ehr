export type AdminScope = 'facility' | 'global';

export type AdminTabId = 'queue' | 'roles' | 'completion' | 'clinic' | 'types' | 'fees';

export const ADMIN_TABS: { id: AdminTabId; label: string }[] = [
  { id: 'queue', label: 'Queue & roles' },
  { id: 'roles', label: 'Roles & ACL' },
  { id: 'completion', label: 'Completion' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'types', label: 'Visit types' },
  { id: 'fees', label: 'Fees' },
];

export interface AdminHubProps {
  ajaxUrl: string;
  csrfToken: string;
  webroot: string;
  clinicFacilityId: number;
}

export interface CalendarCategory {
  pc_catid: number | string;
  name: string;
}

export interface VisitTypeRow {
  id: number;
  label: string;
  pc_catid: number;
  service_profile: string;
  referral_required: boolean;
  is_default: boolean;
  is_active: boolean;
  scope_label?: string;
  cashier_fee_hint_ids?: number[];
}

export interface FeeScheduleRow {
  id: number;
  code: string;
  name: string;
  category: string;
  category_label?: string;
  price_amount: number | string;
  code_type: string;
  billing_code: string;
  sort_order: number;
  is_active: boolean;
  scope_label?: string;
}

export interface FeeCategoryOption {
  value: string;
  label: string;
}

export interface FeeTemplate {
  id: string;
  label: string;
  code?: string;
  name?: string;
  category?: string;
  price_amount?: number;
  sort_order?: number;
  code_type?: string;
  billing_code?: string;
  hint?: string;
}

export interface BillingCodeType {
  ct_key: string;
  label: string;
}

export interface BillingCode {
  code: string;
  name?: string;
  fee?: number | string;
}

export interface RoleGroupMember {
  display_name?: string;
  username: string;
  active: boolean;
}

export interface RoleGroup {
  group_title: string;
  member_count: number | string;
  members?: RoleGroupMember[];
}

export interface SensitivePermission {
  aco_key: string;
  aco_title: string;
  granted_groups?: string[];
  note?: string;
}

export interface AclInventoryRow {
  aco_key: string;
  aco_title: string;
  granted_groups?: string[];
}

export interface RolesPayload {
  role_groups?: RoleGroup[];
  sensitive_permissions?: SensitivePermission[];
  acl_inventory?: AclInventoryRow[];
}

export interface ReconciliationRun {
  run_date?: string;
  status?: string;
  delta_amount?: number | string;
}

export interface AdminConfigPayload {
  facility_id: number;
  scope: AdminScope;
  scope_label?: string;
  clinic_facility_id?: number;
  clinic_facility_label?: string;
  settings: Record<string, unknown>;
  visit_types?: VisitTypeRow[];
  calendar_categories?: CalendarCategory[];
  fee_schedule?: FeeScheduleRow[];
  categories?: FeeCategoryOption[];
  templates?: FeeTemplate[];
  billing_code_types?: BillingCodeType[];
  default_code_type?: string;
  roles?: RolesPayload;
}

export interface FeeImportSummary {
  imported?: number;
  skipped?: number;
}
