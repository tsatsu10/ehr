<?php

/**
 * Per-field accept/reject cases for the shared identity-input validator
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\InputValidationException;
use OpenEMR\Modules\NewClinic\Services\InputValidator;
use PHPUnit\Framework\TestCase;

class InputValidatorTest extends TestCase
{
    public function testNameAcceptsRealisticNames(): void
    {
        $v = new InputValidator();
        $this->assertSame('Akua', $v->name('fname', ' Akua ', true));
        $v->name('lname', "N'Guessan-Mensah Jr.", true);
        $v->name('mname', 'Kofî');
        $v->name('optional', '');
        $this->assertTrue($v->isValid());
    }

    public function testNameRejectsMarkupDigitsAndOverlong(): void
    {
        $v = new InputValidator();
        $v->name('fname', '<script>alert(1)</script>', true);
        $v->name('lname', 'Mensah2', true);
        $v->name('mname', str_repeat('a', InputValidator::NAME_MAX + 1));
        $v->name('missing', '', true);
        $errors = $v->errors();
        $this->assertArrayHasKey('fname', $errors);
        $this->assertArrayHasKey('lname', $errors);
        $this->assertArrayHasKey('mname', $errors);
        $this->assertSame('This field is required', $errors['missing']);
    }

    public function testFreeTextRejectsHtmlButAcceptsAddresses(): void
    {
        $v = new InputValidator();
        $v->freeText('street', '12 High St, Flat 3 (rear)');
        $v->freeText('landmark', 'Opposite the market — blue gate');
        $this->assertTrue($v->isValid());

        $v->freeText('bad', 'nice <b>house</b>');
        $v->freeText('worse', '<img src=x onerror=alert(1)>');
        $v->freeText('long', str_repeat('x', InputValidator::FREE_TEXT_MAX + 1));
        $this->assertArrayHasKey('bad', $v->errors());
        $this->assertArrayHasKey('worse', $v->errors());
        $this->assertArrayHasKey('long', $v->errors());
    }

    public function testPhoneShapes(): void
    {
        $v = new InputValidator();
        $v->phone('a', '024 455 9921');
        $v->phone('b', '+233244559921');
        $v->phone('c', '(030) 274-5000');
        $v->phone('optional', '');
        $this->assertTrue($v->isValid());

        $v->phone('letters', 'call me');
        $v->phone('markup', '<b>1</b>');
        $v->phone('too_long', str_repeat('9', 40));
        $v->phone('required_missing', '', true);
        $this->assertCount(4, $v->errors());
    }

    public function testEmailShapes(): void
    {
        $v = new InputValidator();
        $v->email('ok', 'akua.mensah@example.com');
        $v->email('optional', '');
        $this->assertTrue($v->isValid());

        $v->email('bad', 'not-an-email');
        $v->email('long', str_repeat('a', InputValidator::EMAIL_MAX) . '@example.com');
        $this->assertCount(2, $v->errors());
    }

    public function testUsernameShapes(): void
    {
        $v = new InputValidator();
        $v->username('ok', 'akua.mensah-2');
        $this->assertTrue($v->isValid());

        $v->username('short', 'ab');
        $v->username('spaces', 'akua mensah');
        $v->username('markup', '<script>');
        $v->username('missing', '');
        $this->assertCount(4, $v->errors());
    }

    public function testNationalIdAndDobAndAge(): void
    {
        $v = new InputValidator();
        $v->nationalId('ok', 'GHA-123456789-0');
        $v->nationalId('optional', '');
        $v->dob('dob_ok', '1985-05-05');
        $v->dob('dob_optional', '');
        $this->assertNull($v->ageYears('age_null', null));
        $this->assertSame(34, $v->ageYears('age_ok', '34'));
        $this->assertTrue($v->isValid());

        $v->nationalId('bad', '<x>');
        $v->dob('dob_future', date('Y-m-d', strtotime('+2 days')));
        $v->dob('dob_junk', '31-01-1985');
        $v->dob('dob_impossible', '2001-02-30');
        $v->dob('dob_ancient', '1850-01-01');
        $v->ageYears('age_bad', 500);
        $this->assertCount(6, $v->errors());
    }

    public function testThrowCarriesFieldErrors(): void
    {
        $v = new InputValidator();
        $v->name('fname', '<b>x</b>', true);
        try {
            $v->throwIfInvalid();
            $this->fail('Expected InputValidationException');
        } catch (InputValidationException $e) {
            $this->assertArrayHasKey('fname', $e->getFieldErrors());
            $this->assertInstanceOf(\InvalidArgumentException::class, $e);
        }

        // No errors → no throw.
        (new InputValidator())->throwIfInvalid();
    }
}
