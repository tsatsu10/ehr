import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AdminHub } from './AdminHub';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn(),
  OeFetchError: class OeFetchError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { oeFetch } from '@core/oeFetch';
const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

const configPayload = {
  facility_id: 1,
  scope: 'facility',
  scope_label: 'Main Clinic',
  clinic_facility_id: 1,
  clinic_facility_label: 'Main Clinic',
  settings: {
    enable_triage: true,
    enable_scheduled_integration: true,
    enable_lab_role: false,
    enable_lab_ops: false,
    enable_pharmacy_role: false,
    enable_pharm_ops: false,
    allow_multiple_visits_per_day: true,
    enable_multi_doctor_filters: false,
    enable_aggressive_orphan_facility_repair: false,
    auto_dismiss_product_registration: true,
    enable_chart_depth: false,
    enable_chart_depth_finance: false,
    enable_chart_depth_referral: false,
    enable_chart_depth_export: false,
    communications_hub_enable: false,
    enable_patient_registry: false,
    registry_redirect_global_search: false,
    enable_shared_device_session_warning: false,
    enable_legacy_patient_context_overlay: false,
    enable_legacy_strip_clinical_chips: false,
    enable_legacy_strip_desk_return: true,
    enable_faster_queue_interrupts: false,
    faster_queue_interrupt_poll_seconds: 10,
    enable_similar_surname_queue_warning: false,
    enable_pinned_reception_preview: false,
    enable_react_visit_board: false,
    enable_react_triage_desk: false,
    enable_react_doctor_desk: false,
    enable_react_cashier_desk: false,
    enable_react_lab_desk: false,
    enable_react_pharmacy_desk: false,
    enable_react_front_desk: false,
    enable_react_patient_registry: false,
    enable_react_daily_reports: false,
    enable_react_communications_hub: false,
    enable_admin_hub: true,
    enable_react_admin_hub: false,
    enable_react_patient_chart: false,
    enable_react_lab_ops: false,
    enable_react_chart_depth: false,
    enable_bill_ops: false,
    enable_bill_ops_outstanding: false,
    bill_ops_reopen_on_correction: false,
    enable_react_bill_ops: false,
    enable_insurance: false,
    completion_required_for_billing: 70,
    enforce_completion_on_revisit: true,
    allow_billing_completion_override: true,
    require_esign_before_complete_consult: false,
    pediatric_exact_dob_age: 5,
    print_queue_slip_on_start_visit: true,
    print_queue_number_on_receipt: true,
    queue_slip_instruction_text: 'Please wait',
    reconciliation_enabled: true,
    reconciliation_tolerance: '0.01',
    reconciliation_cron_time: '23:55',
    currency_code: 'GHS',
    currency_symbol: 'GH₵',
    currency_decimals: 2,
    currency_symbol_position: 'before',
  },
  visit_types: [],
  calendar_categories: [{ pc_catid: 1, name: 'Office Visit' }],
  fee_schedule: [],
  categories: [{ value: 'consult', label: 'Consultation' }],
  templates: [],
  billing_code_types: [{ ct_key: 'CPT4', label: 'CPT4' }],
  default_code_type: 'CPT4',
  roles: { role_groups: [], sensitive_permissions: [], acl_inventory: [] },
  form_bundle_board: {
    rows: [],
    esign_globally_enabled: true,
    missing_count: 0,
    esign_issue_count: 0,
    forms_admin_url: '/forms',
    layout_editor_url: '/layout',
    doctor_desk_url: '/doctor',
    clinical_doc_hub_enabled: false,
    clinical_doc_hub_url: '/clinical-doc',
    test_esign_help: 'test',
  },
  forms_catalog: {
    items: [],
    can_edit: false,
    forms_admin_url: '/forms',
    layout_editor_url: '/layout',
    list_editor_url: '/list',
    bundle_formdirs: [],
  },
  system_health: {
    overall_status: 'ok',
    checked_at: '2026-06-30T12:00:00Z',
    chips: [],
    meta: { openemr_version: '8.0.0', module_version: 'test', errors_24h: 0 },
    can_run_backup: false,
    backup_blocked_reason: 'Backup requires administrator access',
    backup_running: false,
    backup_url: '/backup',
    logview_url: '/logs',
    backup_php_url: '/backup',
    xampp_backup_hint: 'hint',
  },
  runbooks: {
    source: 'test',
    cards: [
      {
        id: 'RB-01',
        when: 'Day 2',
        task: 'Verify backup ran',
        lens: 'System',
        summary: 'Confirm backup',
        deep_link: '/admin?tab=system',
        search_text: 'rb-01 backup',
      },
    ],
  },
  setup_progress: {
    setup_complete: false,
    score_percent: 40,
    can_mark_complete: false,
    items: [
      {
        key: 'cash_profile',
        label: 'Cash clinic profile applied',
        weight: 10,
        completed: true,
        manual: false,
        hint: 'Clinic tab',
      },
    ],
  },
  config_export: {
    can_export: true,
    blocked_reason: null,
    export_format: 'new_clinic_m6_config',
    export_version: 1,
    can_import: true,
    import_blocked_reason: null,
    import_format: 'new_clinic_m6_config',
    import_version: 1,
  },
  completion_field_weights: {
    items: [
      {
        field_key: 'fname',
        level: 1,
        level_label: 'Basic info',
        label: 'First name',
        weight: 15,
        is_active: true,
      },
    ],
    active_total: 15,
    target_total: 100,
  },
};

const props = {
  ajaxUrl: '/mock/ajax',
  csrfToken: 'test-token',
  webroot: '/openemr',
  clinicFacilityId: 1,
};

describe('AdminHub', () => {
  beforeEach(() => {
    mockFetch.mockImplementation((action: string) => {
      if (action === 'admin.config') {
        return Promise.resolve(configPayload);
      }
      if (action === 'reports.reconciliation') {
        return Promise.resolve({ latest_run: null });
      }
      if (action === 'admin.config.save') {
        return Promise.resolve(configPayload);
      }
      return Promise.resolve({});
    });

    document.body.innerHTML =
      '<button id="nc-admin-save" disabled></button>' +
      '<span id="nc-admin-status"></span>';
  });

  afterEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
  });

  it('loads and shows queue settings', async () => {
    render(<AdminHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'admin.config',
      expect.objectContaining({ params: { scope: 'facility' } })
    );
    expect(await screen.findByLabelText(/Enable triage desk/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Enable React Visit Board/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Enable React Front Desk/i)).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/Enable Billing Back Office hub/i)).toBeInTheDocument();
  });

  it('saves settings when save is clicked', async () => {
    render(<AdminHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    const triageCheckbox = await screen.findByLabelText(/Enable triage desk/i);
    await act(async () => {
      fireEvent.click(triageCheckbox);
    });

    const saveBtn = document.getElementById('nc-admin-save') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'admin.config.save',
      expect.objectContaining({
        json: expect.objectContaining({
          scope: 'facility',
          facility_id: 1,
          settings: expect.objectContaining({ enable_triage: false }),
        }),
      })
    );
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
  });

  it('shows system health tab with backup blocked help', async () => {
    render(<AdminHub {...props} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'System' }));
    });

    expect(await screen.findByText(/System health/i)).toBeInTheDocument();
    expect(screen.getByText(/Day-2 runbooks/i)).toBeInTheDocument();
    expect(screen.getByText(/Setup checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Backup requires administrator access/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download M6 config JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose M6 config JSON/i })).toBeInTheDocument();
  });
});
