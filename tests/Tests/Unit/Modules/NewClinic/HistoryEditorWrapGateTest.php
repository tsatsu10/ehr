<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Support\HistoryEditorWrapGate;
use PHPUnit\Framework\TestCase;

class HistoryEditorWrapGateTest extends TestCase
{
    public function testEditorSuffixMatchesHistoryFull(): void
    {
        $this->assertSame('/patient_file/history/history_full.php', HistoryEditorWrapGate::EDITOR_SUFFIX);
    }

    public function testRequestMatchesEditorForHistoryFullPath(): void
    {
        $_SERVER['SCRIPT_NAME'] = '/openemr/interface/patient_file/history/history_full.php';

        $this->assertTrue(HistoryEditorWrapGate::requestMatchesEditor());

        unset($_SERVER['SCRIPT_NAME']);
    }

    public function testRequestDoesNotMatchModulePaths(): void
    {
        $_SERVER['SCRIPT_NAME'] = '/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/ajax.php';

        $this->assertFalse(HistoryEditorWrapGate::requestMatchesEditor());

        unset($_SERVER['SCRIPT_NAME']);
    }
}
