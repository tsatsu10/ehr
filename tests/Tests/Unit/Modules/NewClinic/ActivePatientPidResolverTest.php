<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Support\ActivePatientPidResolver;
use OpenEMR\Modules\NewClinic\Support\HistoryEditorWrapGate;
use PHPUnit\Framework\TestCase;

class ActivePatientPidResolverTest extends TestCase
{
    public function testResolveFromSetPidQueryParam(): void
    {
        unset($_SESSION['pid']);
        $_GET['set_pid'] = '42';

        $this->assertSame(42, ActivePatientPidResolver::resolve());
        $this->assertSame(42, (int) ($_SESSION['pid'] ?? 0));

        unset($_GET['set_pid'], $_SESSION['pid']);
    }

    public function testResolvePrefersSessionPid(): void
    {
        $_SESSION['pid'] = 9;
        $_GET['set_pid'] = '42';

        $this->assertSame(9, ActivePatientPidResolver::resolve());

        unset($_GET['set_pid'], $_SESSION['pid']);
    }
}
