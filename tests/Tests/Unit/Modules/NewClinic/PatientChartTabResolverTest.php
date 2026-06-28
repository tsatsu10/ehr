<?php

/**
 * Unit tests for patient chart default tab resolution (D-MRD-13)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientChartTabResolver;
use PHPUnit\Framework\TestCase;

class PatientChartTabResolverTest extends TestCase
{
    private PatientChartTabResolver $resolver;

    protected function setUp(): void
    {
        $this->resolver = new PatientChartTabResolver();
    }

    public function testExplicitTabWins(): void
    {
        $this->assertSame('visits', $this->resolver->resolve('visits', 'new_doctor'));
    }

    public function testReceptionDefaultsToProfile(): void
    {
        $this->assertSame('profile', $this->resolver->resolve(null, 'new_reception'));
        $this->assertSame('profile', $this->resolver->resolve('', 'new_cashier'));
    }

    public function testDoctorDefaultsToOverview(): void
    {
        $this->assertSame('overview', $this->resolver->resolve(null, 'new_doctor'));
        $this->assertSame('overview', $this->resolver->resolve(null, 'new_nurse'));
    }

    public function testLabAndPharmacyDefaultToClinical(): void
    {
        $this->assertSame('clinical', $this->resolver->resolve(null, 'new_lab'));
        $this->assertSame('clinical', $this->resolver->resolve(null, 'new_pharmacy'));
    }

    public function testClinicalAnchorForLabAndPharmacy(): void
    {
        $this->assertSame(
            'clinical-labs',
            $this->resolver->resolveClinicalAnchor(null, 'new_lab', 'clinical')
        );
        $this->assertSame(
            'clinical-meds',
            $this->resolver->resolveClinicalAnchor(null, 'new_pharmacy', 'clinical')
        );
        $this->assertNull($this->resolver->resolveClinicalAnchor(null, 'new_doctor', 'clinical'));
    }

    public function testInvalidTabFallsBackToRoleDefault(): void
    {
        $this->assertSame('overview', $this->resolver->resolve('ledger', 'new_doctor'));
        $this->assertSame('profile', $this->resolver->resolve('ledger', 'new_reception'));
        $this->assertSame('clinical', $this->resolver->resolve('ledger', 'new_lab'));
    }

    public function testExplicitClinicalAnchorWins(): void
    {
        $this->assertSame(
            'clinical-immunizations',
            $this->resolver->resolveClinicalAnchor('clinical-immunizations', 'new_doctor', 'clinical')
        );
        $this->assertSame(
            'clinical-encounter-forms',
            $this->resolver->resolveClinicalAnchor('clinical-encounter-forms', 'new_nurse', 'clinical')
        );
    }

    public function testExplicitClinicalTabWins(): void
    {
        $this->assertSame('clinical', $this->resolver->resolve('clinical', 'new_doctor'));
    }

    public function testMessagesTabAllowed(): void
    {
        $this->assertSame('messages', $this->resolver->resolve('messages', 'new_doctor'));
        $this->assertSame('overview', $this->resolver->resolve(null, 'new_doctor'));
    }
}
