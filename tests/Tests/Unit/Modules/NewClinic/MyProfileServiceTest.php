<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\MyProfileService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class MyProfileServiceTest extends TestCase
{
    private mixed $savedAuthUserId = null;

    protected function setUp(): void
    {
        $this->savedAuthUserId = $_SESSION['authUserID'] ?? null;
    }

    protected function tearDown(): void
    {
        if ($this->savedAuthUserId === null) {
            unset($_SESSION['authUserID']);
        } else {
            $_SESSION['authUserID'] = $this->savedAuthUserId;
        }
    }

    public function testProfileIsSelfServiceOnly(): void
    {
        $_SESSION['authUserID'] = 7;
        $service = new MyProfileService();

        try {
            $service->getProfile(8);
            $this->fail('Expected RuntimeException');
        } catch (\RuntimeException $e) {
            $this->assertSame(403, $e->getCode());
        }
    }

    public function testUpdateRejectedWithoutAuthenticatedSession(): void
    {
        unset($_SESSION['authUserID']);
        $service = new MyProfileService();

        $this->expectException(\RuntimeException::class);

        $service->updateProfile(7, ['fname' => 'Ama', 'lname' => 'Mensah']);
    }

    public function testChangePasswordIsSelfServiceOnly(): void
    {
        $_SESSION['authUserID'] = 7;
        $service = new MyProfileService();

        $this->expectException(\RuntimeException::class);

        $service->changePassword(9, 'old-secret', 'new-secret-123');
    }

    public function testInitialsFallBackToQuestionMark(): void
    {
        $service = new MyProfileService();
        $initials = new ReflectionMethod(MyProfileService::class, 'initials');

        $this->assertSame('AM', $initials->invoke($service, 'Ama', 'Mensah'));
        $this->assertSame('A', $initials->invoke($service, 'Ama', ''));
        $this->assertSame('?', $initials->invoke($service, '', '  '));
    }
}
