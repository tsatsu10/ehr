<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\Ajax\Handlers\ProfileActionHandler;
use OpenEMR\Modules\NewClinic\Controllers\AjaxController;
use PHPUnit\Framework\TestCase;

class ProfileActionHandlerTest extends TestCase
{
    public function testSupportsProfileAndSwitchRoleActionsOnly(): void
    {
        $handler = new ProfileActionHandler(new AjaxController());

        $this->assertTrue($handler->supports('profile.get'));
        $this->assertTrue($handler->supports('profile.update'));
        $this->assertTrue($handler->supports('profile.change_password'));
        $this->assertTrue($handler->supports('switch_role'));
        $this->assertFalse($handler->supports('admin.config'));
        $this->assertFalse($handler->supports('reports.daily'));
    }
}
