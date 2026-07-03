<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicalDocLbfWizardService;
use PHPUnit\Framework\TestCase;

class ClinicalDocLbfWizardServiceTest extends TestCase
{
    public function testPackStatusShapeWhenNotInstalled(): void
    {
        $service = new ClinicalDocLbfWizardService();
        $status = $service->getPackStatus(0);

        $this->assertSame('ghana_opd_consult', $status['pack_key']);
        $this->assertSame('LBFghana_opd_consult', $status['form_id']);
        $this->assertIsBool($status['installed']);
    }
}
