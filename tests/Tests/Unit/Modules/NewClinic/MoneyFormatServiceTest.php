<?php

/**
 * Unit tests for clinic currency validation (M6-F27)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicAdminService;
use PHPUnit\Framework\TestCase;

class MoneyFormatServiceTest extends TestCase
{
    public function testSaveRejectsInvalidCurrencyCode(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $service->saveSettings('global', ['currency_code' => 'GH'], 1);
    }

    public function testSaveRejectsInvalidCurrencyPosition(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $service->saveSettings('global', ['currency_symbol_position' => 'middle'], 1);
    }

    public function testSaveRejectsEmptyCurrencySymbol(): void
    {
        $service = new ClinicAdminService();
        $this->expectException(\InvalidArgumentException::class);
        $service->saveSettings('global', ['currency_symbol' => '   '], 1);
    }
}
