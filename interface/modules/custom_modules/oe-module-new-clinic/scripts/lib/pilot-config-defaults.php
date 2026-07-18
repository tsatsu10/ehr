<?php

/**
 * Default values for config keys touched by pilot-enable-* slice scripts.
 *
 * Used by pilot-reset-facility-config.php to restore facility 0 + clinic defaults
 * after E2E / smoke runs (avoids polluting PHPUnit that reads live DB).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

/**
 * @return array<string, string>
 */
function pilotSliceConfigDefaults(): array
{
    return [
        'enable_legacy_patient_context_overlay' => '0',
        'enable_faster_queue_interrupts' => '0',
        'faster_queue_interrupt_poll_seconds' => '10',
        'enable_similar_surname_queue_warning' => '0',
        'enable_momo_payment' => '0',
        'enable_pinned_reception_preview' => '0',
        'enable_pregnancy_banner_chip' => '0',
        'enable_l3b_background_completion' => '0',
        'enable_lab_results_toast' => '0',
        'enable_visit_board_kiosk_chrome' => '0',
        'enable_banner_mrd_deep_links' => '0',
        'enable_allergy_count_chip' => '0',
        'enable_in_chart_patient_search' => '0',
        'enable_scheduling_full_analytics' => '0',
        'enable_ancillary_services' => '0',
        'enable_lab_role' => '0',
        'enable_pharmacy_role' => '0',
        'enable_react_patient_registry' => '1',
        'registry_redirect_global_search' => '0',
        'enable_bill_ops' => '0',
        'enable_bill_ops_outstanding' => '0',
        'enable_react_bill_ops' => '1',
        'enable_insurance' => '0',
        'enable_queue_bridge' => '0',
        'enable_admin_hub' => '0',
        'enable_report_hub' => '0',
    ];
}
