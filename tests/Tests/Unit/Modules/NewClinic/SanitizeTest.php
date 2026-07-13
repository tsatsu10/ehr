<?php

/**
 * Tests for the shared ajax-boundary sanitizers (SCALE-4.1)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Support\Sanitize;
use PHPUnit\Framework\TestCase;

class SanitizeTest extends TestCase
{
    // ---- searchToken -------------------------------------------------------

    public function testSearchTokenCapsLengthAt64ByDefault(): void
    {
        $long = str_repeat('a', 10_000);
        $this->assertSame(str_repeat('a', 64), Sanitize::searchToken($long));
        $this->assertSame(str_repeat('a', 10), Sanitize::searchToken($long, 10));
    }

    public function testSearchTokenStripsControlCharsAndTrims(): void
    {
        $this->assertSame('kofi mensah', Sanitize::searchToken("  kofi\x00 mensah\n "));
        $this->assertSame('', Sanitize::searchToken(null));
        $this->assertSame('', Sanitize::searchToken("\x01\x02\x1F"));
    }

    public function testSearchTokenKeepsSpacesAndMultibyte(): void
    {
        // Multi-word queries tokenize downstream; spaces must survive.
        $this->assertSame('adjoa serwaa', Sanitize::searchToken('adjoa serwaa'));
        // mb-substr, not substr: no broken UTF-8 at the cap boundary.
        $capped = Sanitize::searchToken(str_repeat('é', 100), 64);
        $this->assertSame(64, mb_strlen($capped));
        $this->assertSame(str_repeat('é', 64), $capped);
    }

    public function testSearchTokenDoesNotEscapeLikeMetachars(): void
    {
        // Deliberate: escaping would change matching semantics (see docblock).
        $this->assertSame('50%', Sanitize::searchToken('50%'));
    }

    // ---- dayOrDefault / dayOrNull -----------------------------------------

    public function testValidDayPassesThrough(): void
    {
        $this->assertSame('2026-07-13', Sanitize::dayOrDefault('2026-07-13', 'x'));
        $this->assertSame('2026-07-13', Sanitize::dayOrNull('2026-07-13'));
    }

    public function testEmptyDayFallsBackToDefault(): void
    {
        $this->assertSame('2026-01-01', Sanitize::dayOrDefault('', '2026-01-01'));
        $this->assertSame('2026-01-01', Sanitize::dayOrDefault(null, '2026-01-01'));
        $this->assertNull(Sanitize::dayOrNull(''));
        $this->assertNull(Sanitize::dayOrNull(null));
    }

    public function testMalformedDayIsRejectedWith400Semantics(): void
    {
        // Surrounding whitespace is trimmed before validation (old trim() semantics).
        $this->assertSame('2026-07-13', Sanitize::dayOrDefault("2026-07-13\n", 'x'));

        foreach (['13/07/2026', '2026-7-3', 'DROP TABLE', '2026-02-31', "2026-07\n-13"] as $bad) {
            try {
                Sanitize::dayOrDefault($bad, 'x');
                $this->fail("'$bad' should have been rejected");
            } catch (\InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
        $this->expectException(\InvalidArgumentException::class);
        Sanitize::dayOrNull('not-a-date');
    }
}
