<?php

/**
 * Wiring tests: identity/profile write services reject malformed input with
 * field-level errors BEFORE touching the database
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\InputValidationException;
use OpenEMR\Modules\NewClinic\Services\PatientRegistrationService;
use OpenEMR\Modules\NewClinic\Services\StaffAdminService;
use PHPUnit\Framework\TestCase;

class IdentityWriteValidationTest extends TestCase
{
    public function testRegistrationSectionOneRejectsMarkupNameWithFieldKeys(): void
    {
        $service = new PatientRegistrationService();

        try {
            $service->saveSection(1, [
                'fname' => '<script>alert(1)</script>',
                'lname' => 'Mensah',
                'sex' => 'Female',
                'phone' => 'not a phone',
                'DOB' => '2099-01-01',
            ], null, 1);
            $this->fail('Expected InputValidationException');
        } catch (InputValidationException $e) {
            $errors = $e->getFieldErrors();
            $this->assertArrayHasKey('fname', $errors);
            $this->assertArrayHasKey('phone', $errors);
            $this->assertArrayHasKey('DOB', $errors);
            $this->assertArrayNotHasKey('lname', $errors);
        }
    }

    public function testStaffCreateRejectsBadUsernameBeforeAnyDbWork(): void
    {
        $service = new class extends StaffAdminService {
            public function assertCanManageStaff(): void
            {
                // ACL gate bypassed — this test targets input validation only.
            }
        };

        try {
            $service->createFromTemplate([
                'username' => 'bad user <name>',
                'password' => 'short',
                'fname' => 'Akua',
                'lname' => 'Mensah2',
                'template_id' => 'reception',
            ], 1);
            $this->fail('Expected InputValidationException');
        } catch (InputValidationException $e) {
            $errors = $e->getFieldErrors();
            $this->assertArrayHasKey('username', $errors);
            $this->assertArrayHasKey('password', $errors);
            $this->assertArrayHasKey('lname', $errors);
            $this->assertArrayNotHasKey('fname', $errors);
        }
    }

    public function testValidationExceptionIsCaughtAsInvalidArgument(): void
    {
        // The AjaxController envelope contract: InputValidationException must
        // remain an InvalidArgumentException so untouched catch blocks still
        // map it to HTTP 400 / code=validation.
        $e = new InputValidationException(['fname' => 'bad']);
        $this->assertInstanceOf(\InvalidArgumentException::class, $e);
        $this->assertSame(['fname' => 'bad'], $e->getFieldErrors());
        $this->assertSame('Please correct the highlighted fields', $e->getMessage());
    }
}
