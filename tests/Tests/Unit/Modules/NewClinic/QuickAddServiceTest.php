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
use OpenEMR\Modules\NewClinic\Services\PatientCompletionService;
use OpenEMR\Modules\NewClinic\Services\PatientDuplicateService;
use OpenEMR\Modules\NewClinic\Services\PhoneNormalizer;
use OpenEMR\Modules\NewClinic\Services\QuickAddService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class QuickAddServiceTest extends TestCase
{
    private function makeService(
        ?PhoneNormalizer $normalizer = null,
        ?ClinicConfigService $config = null,
        ?PatientDuplicateService $dup = null,
    ): QuickAddService {
        return new QuickAddService(
            $normalizer ?? $this->createMock(PhoneNormalizer::class),
            $config ?? $this->createMock(ClinicConfigService::class),
            $dup ?? $this->createMock(PatientDuplicateService::class),
            $this->createMock(PatientCompletionService::class),
        );
    }

    public function testRequiresNameAndSex(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('First name, last name (min 2 chars), and sex are required');

        $this->makeService()->create(['fname' => 'Ama', 'lname' => 'K', 'sex' => 'F'], 7);
    }

    public function testRejectsUnknownSexCode(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('First name, last name (min 2 chars), and sex are required');

        $this->makeService()->create(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'X'], 7);
    }

    public function testRequiresDobOrEstimatedAge(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Date of birth or estimated age is required');

        $this->makeService()->create(['fname' => 'Ama', 'lname' => 'Mensah', 'sex' => 'F'], 7);
    }

    public function testEstimatedAgeDerivesMidYearDobForDupScoring(): void
    {
        $capturedProspect = null;
        $dup = $this->createMock(PatientDuplicateService::class);
        $dup->method('scoreProspect')->willReturnCallback(
            static function (array $prospect) use (&$capturedProspect): array {
                $capturedProspect = $prospect;

                // Blocking here stops the flow before any database write.
                return ['level' => 'block', 'candidates' => []];
            }
        );
        $normalizer = $this->createMock(PhoneNormalizer::class);
        $normalizer->method('normalize')->willReturn('');

        try {
            $this->makeService($normalizer, null, $dup)->create([
                'fname' => 'Ama',
                'lname' => 'Mensah',
                'sex' => 'F',
                'age_years' => 30,
            ], 7);
            $this->fail('Expected duplicate block');
        } catch (\InvalidArgumentException) {
            // expected — assert the derived estimated DOB below
        }

        $expectedYear = (int) date('Y') - 30;
        $this->assertSame(sprintf('%04d-07-01', $expectedYear), $capturedProspect['DOB']);
    }

    public function testRejectsPhoneFailingClinicPattern(): void
    {
        $normalizer = $this->createMock(PhoneNormalizer::class);
        $normalizer->method('normalize')->willReturn('12345');
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturn('^0[235]\d{8}$');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Phone format is invalid');

        $this->makeService($normalizer, $config)->create([
            'fname' => 'Ama',
            'lname' => 'Mensah',
            'sex' => 'F',
            'DOB' => '1996-01-15',
            'phone' => '12345',
        ], 7);
    }

    public function testLikelyDuplicateBlocksWithoutOverride(): void
    {
        $dup = $this->createMock(PatientDuplicateService::class);
        $dup->method('scoreProspect')->willReturn(['level' => 'block', 'candidates' => [['pid' => 3]]]);
        $normalizer = $this->createMock(PhoneNormalizer::class);
        $normalizer->method('normalize')->willReturn('');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Likely duplicate patient');

        $this->makeService($normalizer, null, $dup)->create([
            'fname' => 'Ama',
            'lname' => 'Mensah',
            'sex' => 'F',
            'DOB' => '1996-01-15',
        ], 7);
    }

    public function testPossibleDuplicateRequiresConfirmation(): void
    {
        $dup = $this->createMock(PatientDuplicateService::class);
        $dup->method('scoreProspect')->willReturn(['level' => 'warn', 'candidates' => [['pid' => 3]]]);
        $normalizer = $this->createMock(PhoneNormalizer::class);
        $normalizer->method('normalize')->willReturn('');

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Confirm this is a different patient');

        $this->makeService($normalizer, null, $dup)->create([
            'fname' => 'Ama',
            'lname' => 'Mensah',
            'sex' => 'F',
            'DOB' => '1996-01-15',
        ], 7);
    }

    public function testNormalizeSexMapsShortCodesAndRejectsUnknown(): void
    {
        $service = $this->makeService();
        $method = new ReflectionMethod(QuickAddService::class, 'normalizeSex');

        $this->assertSame('Male', $method->invoke($service, 'M'));
        $this->assertSame('Female', $method->invoke($service, 'F'));
        $this->assertSame('UNK', $method->invoke($service, 'O'));
        $this->assertSame('UNK', $method->invoke($service, 'Other'));
        $this->assertSame('', $method->invoke($service, 'banana'));
    }
}
