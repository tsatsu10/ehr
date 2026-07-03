<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\AdminFormBundleService;
use PHPUnit\Framework\TestCase;

class AdminFormBundleServiceTest extends TestCase
{
    public function testBoardReturnsFourRequiredForms(): void
    {
        $service = new AdminFormBundleService();
        $board = $service->getBoard(0);

        $this->assertArrayHasKey('rows', $board);
        $this->assertCount(4, $board['rows']);
        $keys = array_column($board['rows'], 'key');
        $this->assertSame(
            ['consult_note', 'vitals', 'lab_intake', 'pharmacy_service'],
            $keys
        );
    }

    public function testBoardRowShape(): void
    {
        $service = new AdminFormBundleService();
        $row = $service->getBoard(0)['rows'][0];

        $this->assertArrayHasKey('formdir', $row);
        $this->assertArrayHasKey('installed', $row);
        $this->assertArrayHasKey('esign_ok', $row);
        $this->assertArrayHasKey('esign_detail', $row);
        $this->assertArrayHasKey('status_label', $row);
        $this->assertArrayHasKey('required_for', $row);
    }

    public function testGetFormHealthForVitals(): void
    {
        $service = new AdminFormBundleService();
        $health = $service->getFormHealth('vitals', 0);

        $this->assertIsArray($health);
        $this->assertArrayHasKey('installed', $health);
        $this->assertArrayHasKey('esign_ok', $health);
        $this->assertArrayHasKey('esign_detail', $health);
    }
}
