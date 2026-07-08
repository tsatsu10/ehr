<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PersonalizedDeskLabelService;
use PHPUnit\Framework\TestCase;

class PersonalizedDeskLabelServiceTest extends TestCase
{
    public function testOwnerDisplayNamePrefersFirstNameThenUsername(): void
    {
        $service = new PersonalizedDeskLabelService();

        $this->assertSame('Ama', $service->ownerDisplayName('Ama', 'amensah'));
        $this->assertSame('amensah', $service->ownerDisplayName('   ', 'amensah'));
        $this->assertSame('', $service->ownerDisplayName('', ''));
    }

    public function testOwnedDeskLabelFallsBackToRoleWhenOwnerMissing(): void
    {
        $service = new PersonalizedDeskLabelService();

        $this->assertSame('Reception', $service->ownedDeskLabel('Reception', ''));
        $this->assertStringContainsString('Ama', $service->ownedDeskLabel('Reception', 'Ama'));
        $this->assertStringContainsString('Reception', $service->ownedDeskLabel('Reception', 'Ama'));
    }

    public function testUnknownNavIdYieldsEmptyLabel(): void
    {
        $service = new PersonalizedDeskLabelService();

        $this->assertSame('', $service->ownedDeskLabelForNavId('not-a-nav', 'Ama', 'amensah'));
        $this->assertStringContainsString('Nurse', $service->ownedDeskLabelForNavId('clinictg', 'Ama', 'amensah'));
    }
}
