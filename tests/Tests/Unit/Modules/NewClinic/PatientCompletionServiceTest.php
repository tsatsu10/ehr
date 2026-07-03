<?php

/**
 * Unit tests for patient profile completion scoring (M1c)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientCompletionService;
use PHPUnit\Framework\TestCase;

class PatientCompletionServiceTest extends TestCase
{
    private PatientCompletionService $service;

    /** @var array<int, array{field_key: string, weight: int}> */
    private array $weights;

    protected function setUp(): void
    {
        $this->service = new PatientCompletionService();
        $this->weights = [
            ['field_key' => 'fname', 'weight' => 25],
            ['field_key' => 'lname', 'weight' => 25],
            ['field_key' => 'DOB', 'weight' => 25],
            ['field_key' => 'sex', 'weight' => 25],
        ];
    }

    public function testCompleteCoreFieldsScore100(): void
    {
        $result = $this->service->computeScore(
            $this->weights,
            [
                'fname' => 'Sam',
                'lname' => 'Smith',
                'DOB' => '1980-01-01',
                'sex' => 'Male',
            ],
            0,
            0
        );

        $this->assertSame(100, $result['score']);
        $this->assertSame('complete', $result['status']);
        $this->assertEmpty($result['missing']);
    }

    public function testMissingPhoneLowersScore(): void
    {
        $weights = array_merge($this->weights, [
            ['field_key' => 'phone_cell', 'weight' => 20],
        ]);

        $result = $this->service->computeScore(
            $weights,
            [
                'fname' => 'Sam',
                'lname' => 'Smith',
                'DOB' => '1980-01-01',
                'sex' => 'Male',
            ],
            0,
            0
        );

        $this->assertSame(83, $result['score']);
        $this->assertContains('phone_cell', $result['missing']);
        $this->assertContains('Phone number', $result['missing_labels']);
    }

    public function testEstimatedDobFailsDobField(): void
    {
        $result = $this->service->computeScore(
            $this->weights,
            [
                'fname' => 'Sam',
                'lname' => 'Smith',
                'DOB' => '1980-01-01',
                'sex' => 'Male',
            ],
            1,
            0
        );

        $this->assertSame(75, $result['score']);
        $this->assertContains('DOB', $result['missing']);
    }

    public function testHomePhoneCountsForPhoneField(): void
    {
        $weights = [
            ['field_key' => 'fname', 'weight' => 50],
            ['field_key' => 'phone_cell', 'weight' => 50],
        ];

        $result = $this->service->computeScore(
            $weights,
            [
                'fname' => 'Sam',
                'phone_home' => '555-0100',
            ],
            0,
            0
        );

        $this->assertSame(100, $result['score']);
    }

    public function testStatusIncompleteBelow70(): void
    {
        $weights = [
            ['field_key' => 'fname', 'weight' => 50],
            ['field_key' => 'lname', 'weight' => 50],
        ];

        $result = $this->service->computeScore(
            $weights,
            ['fname' => 'Sam'],
            0,
            0
        );

        $this->assertSame(50, $result['score']);
        $this->assertSame('incomplete', $result['status']);
    }

    public function testNkdaTitleDocumentsAllergies(): void
    {
        $this->assertTrue(PatientCompletionService::isDocumentedAllergyTitle('NKDA'));
        $this->assertTrue(PatientCompletionService::isDocumentedAllergyTitle('No known allergies'));
        $this->assertTrue(PatientCompletionService::isDocumentedAllergyTitle('Penicillin'));
    }

    public function testNkdaOnlyTitleDetection(): void
    {
        $this->assertTrue(PatientCompletionService::isNkdaOnlyTitle('NKDA'));
        $this->assertTrue(PatientCompletionService::isNkdaOnlyTitle('no known drug allergies'));
        $this->assertFalse(PatientCompletionService::isNkdaOnlyTitle('Penicillin'));
        $this->assertFalse(PatientCompletionService::isNkdaOnlyTitle('Penicillin and no known allergies'));
        $this->assertFalse(PatientCompletionService::isDocumentedAllergyTitle(''));
    }

    public function testExpiredNhisDoesNotRequireNhisNumber(): void
    {
        $weights = [
            ['field_key' => 'nhis_number', 'weight' => 100],
        ];

        $result = $this->service->computeScore(
            $weights,
            [],
            0,
            0,
            [
                'insurance_type' => 'nhis',
                'nhis_number' => '',
                'nhis_expiry' => '2020-01-01',
            ]
        );

        $this->assertSame(100, $result['score']);
        $this->assertEmpty($result['missing']);
    }

    public function testReachContactPhoneCountsForPhoneField(): void
    {
        $weights = [
            ['field_key' => 'fname', 'weight' => 50],
            ['field_key' => 'phone_cell', 'weight' => 50],
        ];

        $result = $this->service->computeScore(
            $weights,
            ['fname' => 'Sam'],
            0,
            0,
            ['reach_contact_phone' => '0244123456']
        );

        $this->assertSame(100, $result['score']);
        $this->assertNotContains('phone_cell', $result['missing']);
    }

    public function testAllergiesUnknownTitleIsDocumented(): void
    {
        $this->assertTrue(PatientCompletionService::isAllergiesUnknownTitle('Allergies unknown'));
        $this->assertFalse(PatientCompletionService::isAllergiesUnknownTitle('Penicillin'));
    }

    public function testChartUrlPointsToModuleChart(): void
    {
        $GLOBALS['webroot'] = '/openemr';
        $url = PatientCompletionService::chartUrl(42, 'profile');

        $this->assertStringContainsString('patient-chart.php', $url);
        $this->assertStringContainsString('pid=42', $url);
        $this->assertStringContainsString('tab=profile', $url);
    }

    public function testBackgroundHistoryCompleteWhenFamilyDocumented(): void
    {
        $this->assertTrue(PatientCompletionService::isBackgroundHistoryRowComplete([
            'history_mother' => 'Hypertension',
        ]));
    }

    public function testBackgroundHistoryCompleteWhenSocialDocumented(): void
    {
        $this->assertTrue(PatientCompletionService::isBackgroundHistoryRowComplete([
            'tobacco' => 'Never smoker',
        ]));
    }

    public function testBackgroundHistoryIncompleteWhenEmpty(): void
    {
        $this->assertFalse(PatientCompletionService::isBackgroundHistoryRowComplete([]));
        $this->assertFalse(PatientCompletionService::isBackgroundHistoryRowComplete(null));
    }
}
