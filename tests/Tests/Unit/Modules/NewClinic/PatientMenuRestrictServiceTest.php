<?php

/**
 * Unit tests for patient menu restrictions (M11-F09 / T1-F06)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PatientMenuRestrictService;
use PHPUnit\Framework\TestCase;

class PatientMenuRestrictServiceTest extends TestCase
{
    public function testFilterPatientMenuRemovesLedgerAndReport(): void
    {
        $hidden = ['dashboard', 'history', 'sdoc', 'ledger', 'report', 'transactions'];
        $menu = [
            (object) ['menu_id' => 'dashboard', 'label' => 'Dashboard'],
            (object) ['menu_id' => 'ledger', 'label' => 'Ledger'],
            (object) ['menu_id' => 'report', 'label' => 'Report'],
            (object) ['menu_id' => 'documents', 'label' => 'Documents'],
        ];

        $filtered = (new PatientMenuRestrictService())->filterPatientMenu($menu, $hidden);

        $this->assertCount(1, $filtered);
        $this->assertSame('documents', $filtered[0]->menu_id);
    }

    public function testFilterPatientMenuRemovesNestedAssessmentMenu(): void
    {
        $child = (object) ['menu_id' => 'sdoc1', 'label' => 'SDOH'];
        $parent = (object) ['menu_id' => 'sdoc', 'label' => 'Assessments', 'children' => [$child]];
        $documents = (object) ['menu_id' => 'documents', 'label' => 'Documents'];

        $filtered = (new PatientMenuRestrictService())->filterPatientMenu(
            [$parent, $documents],
            ['sdoc']
        );

        $this->assertCount(1, $filtered);
        $this->assertSame('documents', $filtered[0]->menu_id);
    }
}
