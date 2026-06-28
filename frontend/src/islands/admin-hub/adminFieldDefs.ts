export type AdminFieldType = 'bool' | 'int' | 'string';

export interface AdminFieldDef {
  key: string;
  type: AdminFieldType;
  label: string;
  hint?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  indent?: number;
}

export interface AdminFieldSection {
  title?: string;
  fields: AdminFieldDef[];
}

/** All editable keys collected on save (matches legacy nc-admin-field set + admin hub flag). */
export const ADMIN_SETTING_KEYS: string[] = [
  'enable_triage',
  'enable_scheduled_integration',
  'enable_lab_role',
  'enable_lab_ops',
  'enable_pharmacy_role',
  'enable_pharm_ops',
  'allow_multiple_visits_per_day',
  'enable_multi_doctor_filters',
  'enable_aggressive_orphan_facility_repair',
  'auto_dismiss_product_registration',
  'enable_chart_depth',
  'enable_chart_depth_finance',
  'enable_chart_depth_referral',
  'enable_chart_depth_export',
  'communications_hub_enable',
  'enable_patient_registry',
  'registry_redirect_global_search',
  'enable_shared_device_session_warning',
  'enable_legacy_patient_context_overlay',
  'enable_legacy_strip_clinical_chips',
  'enable_legacy_strip_desk_return',
  'enable_faster_queue_interrupts',
  'faster_queue_interrupt_poll_seconds',
  'enable_similar_surname_queue_warning',
  'enable_pinned_reception_preview',
  'enable_react_islands_dev',
  'enable_react_visit_board',
  'enable_react_triage_desk',
  'enable_react_doctor_desk',
  'enable_react_cashier_desk',
  'enable_react_lab_desk',
  'enable_react_pharmacy_desk',
  'enable_react_front_desk',
  'enable_react_patient_registry',
  'enable_react_daily_reports',
  'enable_react_communications_hub',
  'enable_react_admin_hub',
  'enable_react_patient_chart',
  'enable_react_lab_ops',
  'enable_react_chart_depth',
  'enable_bill_ops',
  'enable_bill_ops_outstanding',
  'bill_ops_reopen_on_correction',
  'enable_insurance',
  'enable_react_bill_ops',
  'completion_required_for_billing',
  'enforce_completion_on_revisit',
  'allow_billing_completion_override',
  'require_esign_before_complete_consult',
  'pediatric_exact_dob_age',
  'print_queue_slip_on_start_visit',
  'print_queue_number_on_receipt',
  'queue_slip_instruction_text',
  'reconciliation_enabled',
  'reconciliation_tolerance',
  'reconciliation_cron_time',
];

export const QUEUE_FIELD_SECTIONS: AdminFieldSection[] = [
  {
    fields: [
      { key: 'enable_triage', type: 'bool', label: 'Enable triage desk' },
      {
        key: 'enable_scheduled_integration',
        type: 'bool',
        label: 'Link Front Desk to OpenEMR calendar (appointment check-in)',
        hint: 'When on, patients with an appointment today show an Appointment today chip and Start visit & check in on Front Desk. Book appointments in Calendar first.',
      },
      { key: 'enable_lab_role', type: 'bool', label: 'Enable lab desk' },
      {
        key: 'enable_lab_ops',
        type: 'bool',
        label: 'Enable lab ops strip on patient chart Clinical (M12)',
        indent: 1,
      },
      { key: 'enable_pharmacy_role', type: 'bool', label: 'Enable pharmacy desk' },
      {
        key: 'enable_pharm_ops',
        type: 'bool',
        label: 'Enable pharmacy ops strip on patient chart Clinical (M13)',
        indent: 1,
      },
      {
        key: 'allow_multiple_visits_per_day',
        type: 'bool',
        label: 'Allow multiple visits per patient per day',
      },
      {
        key: 'enable_multi_doctor_filters',
        type: 'bool',
        label: 'Enable doctor queue Me/All filters',
      },
      {
        key: 'enable_aggressive_orphan_facility_repair',
        type: 'bool',
        label: 'Claim zero-facility visits to this desk (multi-site only)',
      },
      {
        key: 'auto_dismiss_product_registration',
        type: 'bool',
        label: 'Auto-dismiss OpenEMR product registration prompt',
        hint: 'Runs once per session when enabled. Disable to keep the stock OpenEMR registration modal.',
      },
      {
        key: 'enable_chart_depth',
        type: 'bool',
        label: 'Enable chart depth (M11 master)',
        hint: 'Required for payment history, referrals, and export. Sub-flags below auto-enable this when saved.',
      },
      {
        key: 'enable_chart_depth_finance',
        type: 'bool',
        label: 'Enable payment history strip on patient chart Profile',
        indent: 1,
        hint: 'Turning this on also enables the chart depth master flag for this scope.',
      },
      {
        key: 'enable_chart_depth_referral',
        type: 'bool',
        label: 'Enable referrals strip on patient chart Clinical',
        indent: 1,
      },
      {
        key: 'enable_chart_depth_export',
        type: 'bool',
        label: 'Enable clinical export builder and visit summary export (CDc)',
        indent: 1,
      },
      {
        key: 'communications_hub_enable',
        type: 'bool',
        label: 'Enable Communications Hub (staff messages + reminders)',
      },
      {
        key: 'enable_patient_registry',
        type: 'bool',
        label: 'Enable Patient Registry cohort search (M10)',
      },
      {
        key: 'registry_redirect_global_search',
        type: 'bool',
        label: 'Redirect global search (#anySearchBox) to Front Desk when registry is on (reception)',
        indent: 1,
      },
    ],
  },
  {
    title: 'Safety & chart integration',
    fields: [
      {
        key: 'enable_shared_device_session_warning',
        type: 'bool',
        label: 'Shared-device session warning on desks (T1-F19)',
        hint: 'Shows a banner when another user may still be logged in on a shared PC. Blocks save actions until acknowledged or session is cleared.',
      },
      {
        key: 'enable_legacy_patient_context_overlay',
        type: 'bool',
        label: 'Legacy patient context strip on stock chart pages (T1-F18)',
        hint: 'Injects identity + visit state banner on core OpenEMR patient_file pages when staff open legacy chart screens.',
      },
      {
        key: 'enable_legacy_strip_clinical_chips',
        type: 'bool',
        label: 'Show severe allergy chips on legacy strip',
        indent: 1,
      },
      {
        key: 'enable_legacy_strip_desk_return',
        type: 'bool',
        label: 'Show return-to-desk link on legacy strip',
        indent: 1,
      },
    ],
  },
  {
    title: 'Ops polish (V1.1-OPS)',
    fields: [
      {
        key: 'enable_faster_queue_interrupts',
        type: 'bool',
        label: 'Faster queue interrupts (10–30s poll)',
        hint: 'Polls role desks every 10s when the tab is visible; immediate poll when returning to the tab.',
      },
      {
        key: 'faster_queue_interrupt_poll_seconds',
        type: 'int',
        label: 'Queue poll interval (seconds)',
        min: 10,
        max: 30,
        indent: 1,
      },
      {
        key: 'enable_similar_surname_queue_warning',
        type: 'bool',
        label: 'Similar surname warning on queue cards',
        hint: "Amber Same surname today chip when another patient in today's queue shares the normalized last name.",
      },
      {
        key: 'enable_pinned_reception_preview',
        type: 'bool',
        label: 'Pinned reception preview (Front Desk)',
        hint: 'Keeps the patient banner visible while Register patient or Edit profile is open.',
      },
    ],
  },
  {
    title: 'Frontend modernization (Phase 0)',
    fields: [
      {
        key: 'enable_react_islands_dev',
        type: 'bool',
        label: 'Enable React hello-world badge (Phase 0)',
        hint: 'Renders the Vite + React proof-of-concept badge on the Visit Board. Default OFF.',
      },
      {
        key: 'enable_react_visit_board',
        type: 'bool',
        label: 'Enable React Visit Board (Phase 1)',
        hint: 'Replaces the jQuery queue board with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_triage_desk',
        type: 'bool',
        label: 'Enable React Triage Desk (Phase 2A)',
        hint: 'Replaces the jQuery triage desk with a React island (queue, vitals, Find patient drawer). Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_doctor_desk',
        type: 'bool',
        label: 'Enable React Doctor Desk (Phase 3A)',
        hint: 'Replaces the jQuery doctor desk with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_cashier_desk',
        type: 'bool',
        label: 'Enable React Cashier Desk (Phase 4A)',
        hint: 'Replaces the jQuery cashier desk with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_lab_desk',
        type: 'bool',
        label: 'Enable React Lab Desk (Phase 5A)',
        hint: 'Replaces the jQuery lab desk with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_pharmacy_desk',
        type: 'bool',
        label: 'Enable React Pharmacy Desk (Phase 6A)',
        hint: 'Replaces the jQuery pharmacy desk with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_front_desk',
        type: 'bool',
        label: 'Enable React Front Desk (Phase 7A)',
        hint: 'Replaces the jQuery front desk with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_patient_registry',
        type: 'bool',
        label: 'Enable React Patient Registry (Phase 8A)',
        hint: 'Replaces the jQuery patient registry with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_daily_reports',
        type: 'bool',
        label: 'Enable React Daily Reports (Phase 9A)',
        hint: 'Replaces the jQuery daily reports page with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_communications_hub',
        type: 'bool',
        label: 'Enable React Communications Hub (Phase 10A)',
        hint: 'Replaces the jQuery communications hub with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_admin_hub',
        type: 'bool',
        label: 'Enable React Admin Hub (Phase 11A)',
        hint: 'Replaces the jQuery clinic setup page with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_patient_chart',
        type: 'bool',
        label: 'Enable React Patient Chart (Phase 12A)',
        hint: 'Replaces the jQuery patient chart/MRD page with a React island. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_lab_ops',
        type: 'bool',
        label: 'Enable React Lab Operations Hub (Phase 13A)',
        hint: 'Replaces the jQuery lab operations hub with a React island. Requires enable_lab_ops. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_react_chart_depth',
        type: 'bool',
        label: 'Enable React Chart Depth (Phase 14A)',
        hint: 'Replaces jQuery chart depth pages (payments, referrals, export) with a React island. Requires enable_chart_depth sub-flags. Default OFF. Requires frontend build.',
      },
      {
        key: 'enable_bill_ops',
        type: 'bool',
        label: 'Enable Billing Back Office hub (M14)',
        hint: 'Post-pilot billing corrections, payment search, and close-of-day. Default OFF.',
      },
      {
        key: 'enable_bill_ops_outstanding',
        type: 'bool',
        label: 'Enable outstanding balances tab (M14-F04)',
        hint: 'Optional credit list in Billing Back Office. Requires enable_bill_ops.',
        indent: 1,
      },
      {
        key: 'bill_ops_reopen_on_correction',
        type: 'bool',
        label: 'Reopen visit to payment queue after correction or reversal',
        hint: 'When off, completed visits stay completed even if balance remains.',
        indent: 1,
      },
      {
        key: 'enable_insurance',
        type: 'bool',
        label: 'Enable insurance / legacy US billing tools (non-default)',
        hint: 'Shows M14 Insurance vault tab and legacy billing gateways. Cash clinics leave OFF.',
        indent: 1,
      },
      {
        key: 'enable_react_bill_ops',
        type: 'bool',
        label: 'Enable React Billing Back Office (Phase 15A)',
        hint: 'React island for M14 hub tabs. Requires enable_bill_ops. Default OFF. Requires frontend build.',
      },
    ],
  },
];

export const COMPLETION_FIELDS: AdminFieldDef[] = [
  {
    key: 'completion_required_for_billing',
    type: 'int',
    label: 'Completion required for billing (%)',
    min: 0,
    max: 100,
  },
  {
    key: 'enforce_completion_on_revisit',
    type: 'bool',
    label: 'Enforce completion on revisit',
  },
  {
    key: 'allow_billing_completion_override',
    type: 'bool',
    label: 'Allow billing completion override',
  },
  {
    key: 'require_esign_before_complete_consult',
    type: 'bool',
    label: 'Require E-Sign before Complete consult',
    hint: 'When off, doctors may hand off unsigned; payment is still blocked until signed.',
  },
  {
    key: 'pediatric_exact_dob_age',
    type: 'int',
    label: 'Pediatric exact DOB age (years)',
    min: 0,
    max: 18,
  },
];

export const CLINIC_PRINT_FIELDS: AdminFieldDef[] = [
  {
    key: 'print_queue_slip_on_start_visit',
    type: 'bool',
    label: 'Offer queue slip print after Start visit',
  },
  {
    key: 'print_queue_number_on_receipt',
    type: 'bool',
    label: 'Show queue number on cashier receipt',
  },
  {
    key: 'queue_slip_instruction_text',
    type: 'string',
    label: 'Queue slip instruction text',
    maxLength: 255,
  },
];

export const CLINIC_RECONCILIATION_FIELDS: AdminFieldDef[] = [
  {
    key: 'reconciliation_enabled',
    type: 'bool',
    label: 'Enable scheduled reconciliation',
  },
  {
    key: 'reconciliation_tolerance',
    type: 'string',
    label: 'Warning tolerance (clinic currency)',
  },
  {
    key: 'reconciliation_cron_time',
    type: 'string',
    label: 'Scheduled run time (HH:MM)',
  },
];

export function collectAdminSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ADMIN_SETTING_KEYS) {
    out[key] = settings[key];
  }
  return out;
}
