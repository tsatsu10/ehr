<?php

/**
 * Integration tests for Pharmacy Operations worklist (requires local DB).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 * @group     new-clinic-integration
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsFormularyImportService;
use OpenEMR\Modules\NewClinic\Services\PharmOpsWorklistService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class PharmOpsWorklistServiceIntegrationTest extends TestCase
{
    private static bool $bootstrapped = false;
    private static int $actorUserId = 0;
    private int $facilityId = 0;

    public static function setUpBeforeClass(): void
    {
        if (!self::$bootstrapped) {
            $_GET['site'] = 'default';
            $ignoreAuth = true;
            require_once dirname(__DIR__, 5) . '/interface/globals.php';
            require_once dirname(__DIR__, 5)
                . '/interface/modules/custom_modules/oe-module-new-clinic/scripts/lib/pharm-ops-pilot-seed.php';
            self::$bootstrapped = true;
        }

        $config = new ClinicConfigService();
        $facilityIds = pharmOpsPilotFacilityIds();
        pharmOpsPilotEnablePharmacyRole($config, $facilityIds);
        pharmOpsPilotEnsureInhousePharmacyGlobal();
        pharmOpsPilotEnsureHubConfig($config, $facilityIds);

        self::$actorUserId = pharmOpsPilotResolveActorUserId();
        $_SESSION['authUser'] = 'pharmacy_user';
        $_SESSION['authUserID'] = self::$actorUserId;
    }

    protected function setUp(): void
    {
        $this->facilityId = (new VisitScopeService())->resolveDefaultFacilityId();
        if ($this->facilityId <= 0) {
            $this->markTestSkipped('No service-location facility configured');
        }

        $_SESSION['facilityId'] = $this->facilityId;
        $_SESSION['authUser'] = 'pharmacy_user';
        $_SESSION['authUserID'] = self::$actorUserId;
        global $GLOBALS;
        $GLOBALS['inhouse_pharmacy'] = '1';
    }

    protected function tearDown(): void
    {
        unset($_SESSION['facilityId']);
    }

    public function testFormularyImportProducesDispensableCatalog(): void
    {
        $path = PharmOpsFormularyImportService::starterCsvPath();
        if (!is_readable($path)) {
            $this->markTestSkipped('Starter formulary CSV not available');
        }

        $import = new PharmOpsFormularyImportService();
        $result = $import->importCsvContent((string) file_get_contents($path), self::$actorUserId);

        $this->assertGreaterThanOrEqual(10, (int) ($result['drug_count'] ?? 0));

        $row = QueryUtils::querySingleRow(
            "SELECT drug_id FROM drugs WHERE name = 'Paracetamol' AND active = 1 AND dispensable = 1 LIMIT 1"
        );
        $this->assertIsArray($row);
        $this->assertGreaterThan(0, (int) ($row['drug_id'] ?? 0));
    }

    public function testWorklistPendingDispenseReturnsExpectedEnvelope(): void
    {
        $service = new PharmOpsWorklistService();
        $payload = $service->worklist([
            'date' => date('Y-m-d'),
            'tab' => PharmOpsWorklistService::TAB_PENDING_DISPENSE,
            'facility_id' => $this->facilityId,
            'urgent_first' => true,
        ], self::$actorUserId);

        $this->assertSame(PharmOpsWorklistService::TAB_PENDING_DISPENSE, $payload['tab'] ?? null);
        $this->assertIsArray($payload['rows'] ?? null);
        $this->assertIsArray($payload['counts'] ?? null);
        $this->assertArrayHasKey('pending_dispense', $payload['counts']);
        $this->assertArrayHasKey('low_stock', $payload['counts']);
        $this->assertArrayHasKey('write_off', $payload['counts']);
    }

    public function testWorklistLowStockTabRunsWithoutSqlError(): void
    {
        $service = new PharmOpsWorklistService();
        $payload = $service->worklist([
            'date' => date('Y-m-d'),
            'tab' => PharmOpsWorklistService::TAB_LOW_STOCK,
            'facility_id' => $this->facilityId,
        ], self::$actorUserId);

        $this->assertSame(PharmOpsWorklistService::TAB_LOW_STOCK, $payload['tab'] ?? null);
        $this->assertIsArray($payload['rows'] ?? null);
    }
}
