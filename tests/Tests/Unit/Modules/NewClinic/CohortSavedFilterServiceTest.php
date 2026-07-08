<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CohortSavedFilterService;
use PHPUnit\Framework\TestCase;

class CohortSavedFilterServiceTest extends TestCase
{
    private function makeServiceBypassingRegistryGate(): CohortSavedFilterService
    {
        return $this->createPartialMock(CohortSavedFilterService::class, ['assertRegistryAccess']);
    }

    public function testSaveRejectsAnonymousUser(): void
    {
        $service = $this->makeServiceBypassingRegistryGate();

        try {
            $service->save(0, ['name' => 'Diabetics', 'filters' => []]);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }

    public function testSaveRequiresFilterName(): void
    {
        $service = $this->makeServiceBypassingRegistryGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Filter name is required');

        $service->save(7, ['name' => '   ', 'filters' => []]);
    }

    public function testSaveRejectsNonArrayFilters(): void
    {
        $service = $this->makeServiceBypassingRegistryGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid filters payload');

        $service->save(7, ['name' => 'Diabetics', 'filters' => 'age>40']);
    }

    public function testDeleteRejectsInvalidId(): void
    {
        $service = $this->makeServiceBypassingRegistryGate();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid saved filter id');

        $service->delete(7, 0);
    }

    public function testListForUserReturnsEmptyForAnonymousUser(): void
    {
        $service = new CohortSavedFilterService();

        $this->assertSame([], $service->listForUser(0));
    }
}
