<?php

/**
 * Unit tests for clinic admin settings normalization
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use PHPUnit\Framework\TestCase;

class ClinicAdminServiceTest extends TestCase
{
    public function testSaveRejectsOutOfRangeBillingThreshold(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $service->saveSettings('global', ['completion_required_for_billing' => 150], 1);
    }

    public function testGlobalMigrationDefaultsIncludesSafetyAndLegacyStripKeys(): void
    {
        $defaults = ClinicAdminService::globalMigrationDefaults();

        $this->assertSame('0', $defaults['enable_shared_device_session_warning']);
        $this->assertSame('0', $defaults['enable_legacy_patient_context_overlay']);
        $this->assertSame('0', $defaults['enable_legacy_strip_clinical_chips']);
        $this->assertSame('1', $defaults['enable_legacy_strip_desk_return']);
        $this->assertSame('0', $defaults['enable_faster_queue_interrupts']);
        $this->assertSame('10', $defaults['faster_queue_interrupt_poll_seconds']);
        $this->assertSame('0', $defaults['enable_similar_surname_queue_warning']);
        $this->assertSame('0', $defaults['enable_pinned_reception_preview']);
    }
}
