<?php

/**
 * EmailOutreachGateway + factory tests (GAP-B B1 — email delivery adapter).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\Outreach\EmailOutreachGateway;
use OpenEMR\Modules\NewClinic\Services\Outreach\NullOutreachGateway;
use OpenEMR\Modules\NewClinic\Services\Outreach\OutreachGatewayFactory;
use OpenEMR\Modules\NewClinic\Services\Outreach\OutreachGatewayPort;
use PHPUnit\Framework\TestCase;

class EmailOutreachGatewayTest extends TestCase
{
    /** @var mixed */
    private $savedSender;
    private bool $hadSender = false;

    protected function setUp(): void
    {
        $this->hadSender = array_key_exists('patient_reminder_sender_email', $GLOBALS);
        $this->savedSender = $GLOBALS['patient_reminder_sender_email'] ?? null;
    }

    protected function tearDown(): void
    {
        if ($this->hadSender) {
            $GLOBALS['patient_reminder_sender_email'] = $this->savedSender;
        } else {
            unset($GLOBALS['patient_reminder_sender_email']);
        }
    }

    public function testSmsChannelIsStubbedNeverSent(): void
    {
        // Channel guard runs before any mail call — deterministic regardless of
        // mail config: the email adapter never sends SMS.
        $result = (new EmailOutreachGateway())->send('sms', 'Subject', 'Body', [
            ['pid' => 1, 'contact' => '0244000000'],
        ]);

        $this->assertSame('stubbed', $result['status']);
        $this->assertSame(0, $result['sent']);
        $this->assertStringContainsStringIgnoringCase('sms', $result['note']);
    }

    public function testEmailIsStubbedWhenNoSenderConfigured(): void
    {
        // No clinic sender email → not available → recorded but not sent (no
        // real SMTP attempt), matching the honest-stub contract.
        $GLOBALS['patient_reminder_sender_email'] = '';
        $this->assertFalse(EmailOutreachGateway::isAvailable());

        $result = (new EmailOutreachGateway())->send('email', 'Subject', 'Body', [
            ['pid' => 1, 'contact' => 'patient@example.test'],
        ]);
        $this->assertSame('stubbed', $result['status']);
        $this->assertSame(0, $result['sent']);
    }

    public function testAvailabilityRequiresSenderEmail(): void
    {
        $GLOBALS['patient_reminder_sender_email'] = '';
        $this->assertFalse(
            EmailOutreachGateway::isAvailable(),
            'A blank clinic sender email must keep email delivery unavailable.'
        );
    }

    public function testFactoryFallsBackToStubWhenEmailUnavailable(): void
    {
        // No sender email → factory returns the pure stub (preserves the prior
        // "nothing sent" behavior on an unconfigured box).
        $GLOBALS['patient_reminder_sender_email'] = '';
        $gateway = OutreachGatewayFactory::create();

        $this->assertInstanceOf(OutreachGatewayPort::class, $gateway);
        $this->assertInstanceOf(NullOutreachGateway::class, $gateway);
    }
}
