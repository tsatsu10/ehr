<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AppointmentTodayService;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\FacilityScopeService;
use OpenEMR\Modules\NewClinic\Services\PatientSearchService;
use OpenEMR\Modules\NewClinic\Services\PhoneNormalizer;
use OpenEMR\Modules\NewClinic\Services\RecallDueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PatientSearchServiceTest extends TestCase
{
    private function makeService(): PatientSearchService
    {
        return new PatientSearchService(
            $this->createMock(PhoneNormalizer::class),
            $this->createMock(FacilityScopeService::class),
            $this->createMock(ClinicConfigService::class),
            $this->createMock(AppointmentTodayService::class),
            $this->createMock(RecallDueService::class),
            $this->createMock(VisitScopeService::class),
        );
    }

    public function testNormalizeQueryCollapsesWhitespace(): void
    {
        $service = $this->makeService();

        $this->assertSame('ama mensah', $service->normalizeQuery("  ama \t mensah \n"));
        $this->assertSame('', $service->normalizeQuery('   '));
    }

    public function testSearchRejectsQueriesShorterThanTwoCharacters(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Query must be at least 2 characters');

        $this->makeService()->search('a');
    }

    public function testSurnameMatchRanksAboveFirstNameMatchAboveNoMatch(): void
    {
        $service = $this->makeService();
        $score = new ReflectionMethod(PatientSearchService::class, 'scoreRow');

        $surnameHit = $score->invoke($service, ['fname' => 'Kofi', 'lname' => 'Mensah'], 'mensah');
        $firstNameHit = $score->invoke($service, ['fname' => 'Mensah', 'lname' => 'Owusu'], 'mensah');
        $noHit = $score->invoke($service, ['fname' => 'Adjoa', 'lname' => 'Boateng'], 'mensah');

        $this->assertGreaterThan($firstNameHit, $surnameHit);
        $this->assertGreaterThan($noHit, $firstNameHit);
        $this->assertSame(0, $noHit);
    }

    public function testAgeYearsHandlesMissingAndSentinelDob(): void
    {
        $service = $this->makeService();
        $age = new ReflectionMethod(PatientSearchService::class, 'ageYears');

        $this->assertNull($age->invoke($service, null));
        $this->assertNull($age->invoke($service, '0000-00-00'));
        $this->assertSame(30, $age->invoke($service, date('Y-m-d', strtotime('-30 years'))));
    }

    public function testFormatVisitDateUsesShortDayMonth(): void
    {
        $service = $this->makeService();
        $format = new ReflectionMethod(PatientSearchService::class, 'formatVisitDate');

        $this->assertSame('1 Jul', $format->invoke($service, '2026-07-01'));
        $this->assertNull($format->invoke($service, null));
        $this->assertNull($format->invoke($service, '0000-00-00'));
    }
}
