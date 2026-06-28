<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use PHPUnit\Framework\TestCase;

class MainMenuRestrictLabOpsTest extends TestCase
{
    public function testFilterMainMenuByUrlRemovesPendingOrders(): void
    {
        $service = new MainMenuRestrictService();
        $child = (object) [
            'label' => 'Pending Res',
            'url' => '/interface/orders/pending_orders.php',
            'children' => [],
        ];
        $parent = (object) [
            'label' => 'Reports',
            'children' => [$child],
        ];

        $filtered = $service->filterMainMenuByUrl([$parent], [
            '/interface/orders/pending_orders.php',
        ]);

        $this->assertCount(1, $filtered);
        $this->assertSame([], $filtered[0]->children);
    }
}
