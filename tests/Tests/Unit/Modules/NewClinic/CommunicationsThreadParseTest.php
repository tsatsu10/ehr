<?php

/**
 * Unit tests for the chat-turn parser (pure; no DB).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\CommunicationsHubService;
use PHPUnit\Framework\TestCase;

class CommunicationsThreadParseTest extends TestCase
{
    /** @return list<array<string, mixed>> */
    private function parse(string $body, string $owner, string $authUser): array
    {
        $service = new CommunicationsHubService();
        $method = new \ReflectionMethod($service, 'parseThreadTurns');
        $method->setAccessible(true);

        return $method->invoke($service, $body, $owner, $authUser);
    }

    public function testSplitsBodyIntoTurnsAlignedBySender(): void
    {
        $body = "2026-07-16 10:00 (doctor_user) Lab results are back.\n"
            . "2026-07-16 10:05 (reception_user) Thanks, I'll book a follow-up.";

        $turns = $this->parse($body, 'doctor_user', 'reception_user');

        $this->assertCount(2, $turns);
        $this->assertSame('Lab results are back.', $turns[0]['text']);
        $this->assertFalse($turns[0]['is_self']); // authored by doctor, viewer is reception
        $this->assertTrue($turns[1]['is_self']);  // authored by reception (the viewer)
    }

    public function testTakesSenderBeforeToInAssignedTurns(): void
    {
        $turns = $this->parse('2026-07-16 09:00 (doctor_user to reception_user) Please call.', 'doctor_user', 'doctor_user');

        $this->assertCount(1, $turns);
        $this->assertTrue($turns[0]['is_self']);
        $this->assertSame('Please call.', $turns[0]['text']);
    }

    public function testPlainLegacyBodyBecomesOneTurn(): void
    {
        $turns = $this->parse('Just a plain note with no timestamp prefix.', 'nurse_user', 'nurse_user');

        $this->assertCount(1, $turns);
        $this->assertSame('Just a plain note with no timestamp prefix.', $turns[0]['text']);
        $this->assertTrue($turns[0]['is_self']);
    }

    public function testKeepsUnstampedOriginalWhenReplyAppended(): void
    {
        // Original message has no stamp; a reply is appended with one.
        $body = "Lab results are back, please review.\n"
            . '2026-07-16 15:40 (reception_user to doctor_user) Thanks, booked.';

        $turns = $this->parse($body, 'doctor_user', 'reception_user');

        $this->assertCount(2, $turns);
        $this->assertSame('Lab results are back, please review.', $turns[0]['text']);
        $this->assertFalse($turns[0]['is_self']);       // original by doctor
        $this->assertSame('', $turns[0]['time_label']); // unstamped preamble
        $this->assertSame('Thanks, booked.', $turns[1]['text']);
        $this->assertTrue($turns[1]['is_self']);        // reply by viewer
    }

    public function testEmptyBodyIsNoTurns(): void
    {
        $this->assertSame([], $this->parse('   ', 'x', 'x'));
    }

    public function testDropsStampWithNoFollowingText(): void
    {
        $body = "Original message.\n2026-07-16 10:05 (reception_user to doctor_user) ";

        $turns = $this->parse($body, 'doctor_user', 'doctor_user');

        // Only the original survives; the trailing empty stamp is skipped.
        $this->assertCount(1, $turns);
        $this->assertSame('Original message.', $turns[0]['text']);
    }

    private function preview(string $body): string
    {
        $service = new CommunicationsHubService();
        $method = new \ReflectionMethod($service, 'buildPreview');
        $method->setAccessible(true);

        return $method->invoke($service, $body);
    }

    public function testPreviewShowsNewestTurnNotOldest(): void
    {
        $body = "Original short note.\n"
            . '2026-07-16 10:05 (reception_user to doctor_user) Latest reply here.';

        $this->assertSame('Latest reply here.', $this->preview($body));
    }

    public function testPreviewOfPlainBodyIsTheBody(): void
    {
        $this->assertSame('Just a plain note.', $this->preview('Just a plain note.'));
    }
}
