<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use PHPUnit\Framework\TestCase;

class FacilityScopeServiceTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $savedGlobals = [];
    /** @var array<string, mixed> */
    private array $savedSession = [];

    protected function setUp(): void
    {
        foreach (['login_into_facility', 'pt_restrict_field'] as $key) {
            $this->savedGlobals[$key] = $GLOBALS[$key] ?? null;
            unset($GLOBALS[$key]);
        }
        foreach (['facilityId', 'authUserID'] as $key) {
            $this->savedSession[$key] = $_SESSION[$key] ?? null;
            unset($_SESSION[$key]);
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->savedGlobals as $key => $value) {
            if ($value === null) {
                unset($GLOBALS[$key]);
            } else {
                $GLOBALS[$key] = $value;
            }
        }
        foreach ($this->savedSession as $key => $value) {
            if ($value === null) {
                unset($_SESSION[$key]);
            } else {
                $_SESSION[$key] = $value;
            }
        }
    }

    private function makeScopedService(): FacilityScopeService
    {
        $GLOBALS['login_into_facility'] = '1';
        // search_all_facilities_for_admin off short-circuits before any ACL lookup.
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);

        return new FacilityScopeService($config);
    }

    public function testNoFilteringWhenLoginIntoFacilityDisabled(): void
    {
        $service = new FacilityScopeService($this->createMock(ClinicConfigService::class));

        $this->assertFalse($service->shouldFilterByFacility());
        $this->assertSame(['sql' => '', 'bind' => []], $service->getPatientFilterClause());
        $this->assertSame(['sql' => '', 'bind' => []], $service->getVisitFacilityFilterClause());
    }

    public function testPatientClauseScopesToSessionFacility(): void
    {
        $service = $this->makeScopedService();
        $_SESSION['facilityId'] = 3;

        $clause = $service->getPatientFilterClause('pd');

        $this->assertSame([3], $clause['bind']);
        $this->assertStringContainsString('pd.facility_id IN (?)', $clause['sql']);
        $this->assertStringContainsString("pd.facility_id IS NULL", $clause['sql']);
    }

    public function testPatientClauseDeniesAllWhenActorHasNoFacility(): void
    {
        $service = $this->makeScopedService();

        $clause = $service->getPatientFilterClause('pd');

        $this->assertSame(' AND 1 = 0', $clause['sql']);
        $this->assertSame([], $clause['bind']);
    }

    public function testRestrictFieldNameIsSanitizedAgainstInjection(): void
    {
        $service = $this->makeScopedService();
        $_SESSION['facilityId'] = 3;
        $GLOBALS['pt_restrict_field'] = 'facility_id; DROP TABLE x--';

        $clause = $service->getPatientFilterClause('pd');

        $this->assertStringNotContainsString(';', $clause['sql']);
        $this->assertStringNotContainsString('--', $clause['sql']);
        $this->assertStringContainsString('pd.facility_idDROPTABLEx IN (?)', $clause['sql']);
    }

    public function testVisitClauseIncludesUnscopedFacilityZero(): void
    {
        $service = $this->makeScopedService();
        $_SESSION['facilityId'] = 4;

        $clause = $service->getVisitFacilityFilterClause('v');

        $this->assertSame([4], $clause['bind']);
        $this->assertStringContainsString('v.facility_id IN (?)', $clause['sql']);
        $this->assertStringContainsString('v.facility_id = 0', $clause['sql']);
    }

    public function testAssertEncounterRejectsInvalidIdsBeforeAnyLookup(): void
    {
        $service = new FacilityScopeService($this->createMock(ClinicConfigService::class));

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Encounter not found');

        $service->assertEncounterAtDeskFacility(0, 10, 1);
    }

    public function testAssertEncounterSkipsCheckWhenDeskFacilityUnknown(): void
    {
        $service = new FacilityScopeService($this->createMock(ClinicConfigService::class));

        $service->assertEncounterAtDeskFacility(55, 10, 0);

        $this->addToAssertionCount(1);
    }
}
