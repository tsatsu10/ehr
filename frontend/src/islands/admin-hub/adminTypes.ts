export type AdminScope = 'facility' | 'global';

export type AdminTabId = 'queue' | 'roles' | 'completion' | 'clinic' | 'forms' | 'system' | 'types' | 'fees';

export const ADMIN_TABS: { id: AdminTabId; label: string }[] = [
  { id: 'queue', label: 'Queue & roles' },
  { id: 'roles', label: 'Roles & ACL' },
  { id: 'completion', label: 'Completion' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'forms', label: 'Forms' },
  { id: 'system', label: 'System' },
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

export interface CashProfileStatus {
  last_applied_at?: string | null;
  applied?: boolean;
}

export interface GhanaLbfPackStatus {
  pack_key?: string;
  form_id?: string;
  installed?: boolean;
  consult_note_formdir?: string;
  is_primary_consult_note?: boolean;
}

export interface ReferralHospitalLbfPackStatus {
  pack_key?: string;
  form_id?: string;
  installed?: boolean;
  consult_note_formdir?: string;
  is_primary_consult_note?: boolean;
}

export interface AncillaryLbfPackStatus {
  pack_key: string;
  form_id: string;
  title: string;
  installed: boolean;
}

export interface FormBundleBoardRow {
  key: string;
  title: string;
  formdir: string;
  configured_formdir: string;
  required_for: string;
  installed: boolean;
  esign_ok: boolean;
  esign_detail?: string;
  status_label: string;
  pack_key: string | null;
  can_import: boolean;
  import_hint: string | null;
}

export interface FormBundleBoardPayload {
  rows: FormBundleBoardRow[];
  esign_globally_enabled: boolean;
  missing_count: number;
  esign_issue_count: number;
  forms_admin_url: string;
  layout_editor_url: string;
  doctor_desk_url: string;
  clinical_doc_hub_enabled: boolean;
  clinical_doc_hub_url: string;
  test_esign_help: string;
}

export interface FormsCatalogItem {
  id: number;
  name: string;
  directory: string;
  category: string;
  priority: number;
  nickname: string;
  enabled: boolean;
  sql_run: boolean;
  bundle_required: boolean;
  disable_blocked: boolean;
  disable_block_reason: string | null;
  enable_warning: string | null;
}

export interface FormsCatalogPayload {
  items: FormsCatalogItem[];
  can_edit: boolean;
  forms_admin_url: string;
  layout_editor_url: string;
  list_editor_url: string;
  bundle_formdirs: string[];
}

export type SystemHealthChipStatus = 'ok' | 'warning' | 'error' | 'unknown';

export interface SystemHealthChip {
  key: string;
  label: string;
  status: SystemHealthChipStatus;
  summary: string;
  detail: string;
  action_label: string | null;
  action_available: boolean;
  overall_impact?: 'none' | 'warn' | 'critical';
}

export interface SystemHealthPayload {
  overall_status: 'ok' | 'warning' | 'critical';
  checked_at: string;
  chips: SystemHealthChip[];
  meta: {
    openemr_version: string;
    module_version: string;
    errors_24h: number;
    backup_retention_days?: number;
  };
  can_run_backup: boolean;
  backup_blocked_reason: string | null;
  backup_running?: boolean;
  backup_run_id?: number | null;
  backup_url: string;
  logview_url: string;
  backup_php_url: string;
  xampp_backup_hint: string;
}

export interface RunbookCard {
  id: string;
  when: string;
  task: string;
  lens: string;
  summary: string;
  deep_link: string | null;
  search_text: string;
}

export interface RunbooksPayload {
  cards: RunbookCard[];
  source: string;
}

export interface SetupProgressItem {
  key: string;
  label: string;
  weight: number;
  completed: boolean;
  manual: boolean;
  hint: string;
}

export interface SetupProgressPayload {
  setup_complete: boolean;
  score_percent: number;
  items: SetupProgressItem[];
  can_mark_complete: boolean;
}

export interface ConfigExportMeta {
  can_export: boolean;
  blocked_reason?: string | null;
  export_format: string;
  export_version: number;
  can_import?: boolean;
  import_blocked_reason?: string | null;
  import_format?: string;
  import_version?: number;
}

export interface ConfigImportSummary {
  fees_imported?: number;
  fees_skipped?: number;
  fees_planned?: number;
  visit_types_imported?: number;
  visit_types_skipped?: number;
  visit_types_planned?: number;
  settings_planned?: number;
  settings_imported?: number;
  dry_run?: boolean;
}

export interface ConfigImportResult {
  dry_run: boolean;
  summary: ConfigImportSummary;
  warnings?: string[];
  errors?: string[];
  fee_errors?: string[];
  visit_type_errors?: string[];
}

export interface CompletionFieldWeightRow {
  field_key: string;
  level: number;
  level_label: string;
  label: string;
  weight: number;
  is_active: boolean;
}

export interface CompletionFieldWeightPayload {
  items: CompletionFieldWeightRow[];
  active_total: number;
  target_total: number;
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
  cash_profile?: CashProfileStatus;
  ghana_lbf_pack?: GhanaLbfPackStatus;
  referral_hospital_lbf_pack?: ReferralHospitalLbfPackStatus;
  ancillary_lbf_packs?: AncillaryLbfPackStatus[];
  form_bundle_board?: FormBundleBoardPayload;
  forms_catalog?: FormsCatalogPayload;
  forms_catalog_result?: {
    warning?: string | null;
  };
  system_health?: SystemHealthPayload;
  runbooks?: RunbooksPayload;
  setup_progress?: SetupProgressPayload;
  config_export?: ConfigExportMeta;
  config_export_snapshot?: Record<string, unknown>;
  config_import_result?: ConfigImportResult;
  completion_field_weights?: CompletionFieldWeightPayload;
  backup_run_result?: {
    run_id: number;
    started_at: string;
    status: string;
    backup_url: string;
  };
}

export interface FeeImportSummary {
  imported?: number;
  skipped?: number;
}
