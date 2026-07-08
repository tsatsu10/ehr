<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use PHPUnit\Framework\TestCase;

class ScriptHygieneTest extends TestCase
{
    /** @var array<int, string> */
    private const REMOVED_SCRIPTS = [
        'scripts/pilot-enable-scheduling-redesign.php',
        'scripts/e2e-reset-doctor-consults.php',
        'scripts/pilot-enable-queue-bridge.php',
        'scripts/pilot-enable-clinical-doc.php',
        'scripts/pilot-enable-admin-hub.php',
        'scripts/pilot-enable-report-hub.php',
        'tools/migrate_registration.php',
    ];

    public function testDeprecatedScriptWrappersRemoved(): void
    {
        $moduleRoot = dirname(__DIR__, 5)
            . '/interface/modules/custom_modules/oe-module-new-clinic';

        foreach (self::REMOVED_SCRIPTS as $relativePath) {
            $this->assertFileDoesNotExist(
                $moduleRoot . '/' . $relativePath,
                $relativePath . ' should be removed (AUDIT-12)'
            );
        }
    }
}
