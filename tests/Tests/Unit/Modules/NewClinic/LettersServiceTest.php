<?php

/**
 * Unit tests for GAP-A A4 letters + labels service.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\LettersService;
use PHPUnit\Framework\TestCase;

class LettersServiceTest extends TestCase
{
    public function testFillTokensReplacesRawTokenForm(): void
    {
        $service = new LettersService();
        $body = "Dear {TO_TITLE} {TO_LNAME},\nRe: {PT_FNAME} {PT_LNAME} (DOB {PT_DOB})";

        $filled = $service->fillTokens($body, [
            'TO_TITLE' => 'Dr.',
            'TO_LNAME' => 'Mensah',
            'PT_FNAME' => 'Ama',
            'PT_LNAME' => 'Boateng',
            'PT_DOB' => '01/02/1998',
        ]);

        $this->assertSame("Dear Dr. Mensah,\nRe: Ama Boateng (DOB 01/02/1998)", $filled);
    }

    public function testFillTokensLeavesUnknownTokensAlone(): void
    {
        $service = new LettersService();

        $filled = $service->fillTokens('Hello {NOT_A_TOKEN}', ['PT_FNAME' => 'Ama']);

        $this->assertSame('Hello {NOT_A_TOKEN}', $filled);
    }

    public function testListTemplatesExcludesAutosavedAndDotfilesAndSorts(): void
    {
        $dir = rtrim((string) ($GLOBALS['OE_SITE_DIR'] ?? ''), '/\\') . '/documents/letter_templates';
        if (!is_dir($dir)) {
            $this->markTestSkipped('letter_templates directory does not exist on this box');
        }

        $created = [];
        foreach (['zz_test_letter_b', 'aa_test_letter_a', 'autosaved', '.hidden_test'] as $name) {
            $path = $dir . '/' . $name;
            if (!file_exists($path)) {
                file_put_contents($path, 'test body {PT_FNAME}');
                $created[] = $path;
            }
        }

        try {
            $names = array_column((new LettersService())->listTemplates(), 'name');

            $this->assertContains('aa_test_letter_a', $names);
            $this->assertContains('zz_test_letter_b', $names);
            $this->assertNotContains('autosaved', $names);
            $this->assertNotContains('.hidden_test', $names);
            $this->assertLessThan(
                array_search('zz_test_letter_b', $names, true),
                array_search('aa_test_letter_a', $names, true),
                'templates must be sorted case-insensitively by name'
            );
        } finally {
            foreach ($created as $path) {
                @unlink($path);
            }
        }
    }

    /**
     * The template name reaches file_get_contents, so traversal and the
     * stock autosaved scratch file must be rejected up front.
     */
    public function testSanitizeTemplateNameRejectsTraversalAndReservedNames(): void
    {
        $this->assertSame('referral_letter', LettersService::sanitizeTemplateName('referral_letter'));

        foreach (['', '  ', 'autosaved', '.hidden', '..', '../../etc/passwd', 'sub/dir'] as $bad) {
            try {
                LettersService::sanitizeTemplateName($bad);
                $this->fail("Expected InvalidArgumentException for template name: '$bad'");
            } catch (\InvalidArgumentException $e) {
                $this->assertSame('Template name is invalid', $e->getMessage());
            }
        }
    }

    public function testLabelTypesAreTheThreePlannedOnes(): void
    {
        $this->assertSame(['chart', 'address', 'barcode'], LettersService::LABEL_TYPES);
    }
}
