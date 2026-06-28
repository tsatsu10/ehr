<?php

/**
 * Unit tests for encounter session desk ACL contract
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class EncounterSessionServiceTest extends TestCase
{
    /**
     * @return array<string, string>
     */
    private function stateDeskAclMap(): array
    {
        $reflection = new ReflectionClass(EncounterSessionService::class);
        $constant = $reflection->getReflectionConstant('STATE_DESK_ACL');
        $property = $constant ? $constant->getValue() : [];

        return is_array($property) ? $property : [];
    }

    public function testActiveLabAndPharmacyStatesMapToDeskAcls(): void
    {
        $map = $this->stateDeskAclMap();

        $this->assertSame('new_lab', $map['in_lab'] ?? null);
        $this->assertSame('new_pharmacy', $map['in_pharmacy'] ?? null);
        $this->assertSame('new_lab', $map['ready_for_lab'] ?? null);
        $this->assertSame('new_pharmacy', $map['ready_for_pharmacy'] ?? null);
    }
}
