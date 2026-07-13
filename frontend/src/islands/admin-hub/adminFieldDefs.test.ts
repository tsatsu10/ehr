import { describe, expect, it } from 'vitest';
import {
  ADMIN_SETTING_KEYS,
  REACT_KILL_SWITCH_KEYS,
  visibleQueueFieldKeys,
} from './adminFieldDefs';

describe('adminFieldDefs', () => {
  it('keeps React kill-switch keys on save payload but off the queue tab', () => {
    for (const key of REACT_KILL_SWITCH_KEYS) {
      expect(ADMIN_SETTING_KEYS).toContain(key);
      expect(visibleQueueFieldKeys()).not.toContain(key);
    }
  });

  it('shows billing back office product flags on the queue tab', () => {
    const visible = visibleQueueFieldKeys();
    expect(visible).toContain('enable_bill_ops');
    expect(visible).toContain('enable_bill_ops_outstanding');
    expect(visible).not.toContain('enable_react_bill_ops');
  });

  /**
   * Regression guard for the 2026-07-11 "dont assume check and fix" audit: these six
   * keys were already writable server-side (ClinicAdminService::EDITABLE_SETTINGS) but
   * had no save-payload entry and no rendered field, making them unreachable except by
   * direct DB edit. clinical_doc_specialty_pack in particular defaults to '[]', so the
   * "Show specialty lens" toggle was permanently a no-op without this.
   */
  it('exposes settings that were previously writable but unreachable in the UI', () => {
    const previouslyOrphaned = [
      'report_hub_async_export_threshold',
      'lab_intake_formdir',
      'pharmacy_service_formdir',
      'pharmacy_refer_to_opd_terminal_state',
      'pharmacy_declined_terminal_state',
      'clinical_doc_specialty_pack',
    ];
    const visible = visibleQueueFieldKeys();
    for (const key of previouslyOrphaned) {
      expect(ADMIN_SETTING_KEYS).toContain(key);
      expect(visible).toContain(key);
    }
  });

  it('exposes the GAP-A A4 letters & labels flag (three-place wiring)', () => {
    expect(ADMIN_SETTING_KEYS).toContain('enable_letters_labels');
    expect(visibleQueueFieldKeys()).toContain('enable_letters_labels');
  });

  /**
   * Second batch (2026-07-11 full codebase sweep): keys consumed by real services
   * (duplicate detection, phone validation, lab auto-billing, MoH pack, registration
   * mode, timezone, rate limits, branding) that had no admin UI and no write path at
   * all — only a direct DB edit could change them.
   */
  it('exposes the second batch of previously write-path-less settings', () => {
    const previouslyOrphaned = [
      'registration_mode',
      'dup_warn_threshold',
      'dup_block_threshold',
      'phone_validation_regex',
      'country_code',
      'clinic_tz',
      'clinic_logo_path',
      'mrd_activity_feed_days',
      'search_all_facilities_for_admin',
      'rate_limit_patients_search',
      'rate_limit_dup_check',
      'lab_auto_bill_on_order',
      'report_hub_moh_pack',
    ];
    const visible = visibleQueueFieldKeys();
    for (const key of previouslyOrphaned) {
      expect(ADMIN_SETTING_KEYS).toContain(key);
      expect(visible).toContain(key);
    }
  });
});
