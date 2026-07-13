<?php

/**
 * ShellLocaleService tests (GAP-D D1, i18n foundation).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\ModuleAssetVersion;
use OpenEMR\Modules\NewClinic\Services\ShellLocaleService;
use PHPUnit\Framework\TestCase;

class ShellLocaleServiceTest extends TestCase
{
    /** @var mixed */
    private $savedLanguageChoice;
    private bool $hadLanguageChoice = false;

    protected function setUp(): void
    {
        $this->hadLanguageChoice = array_key_exists('language_choice', $_SESSION ?? []);
        $this->savedLanguageChoice = $_SESSION['language_choice'] ?? null;
    }

    protected function tearDown(): void
    {
        if ($this->hadLanguageChoice) {
            $_SESSION['language_choice'] = $this->savedLanguageChoice;
        } else {
            unset($_SESSION['language_choice']);
        }
    }

    public function testDefaultsToEnglishWithoutSessionChoice(): void
    {
        unset($_SESSION['language_choice']);
        $this->assertSame('en', (new ShellLocaleService())->getLangCode());
    }

    public function testLangIdOneIsEnglish(): void
    {
        $_SESSION['language_choice'] = 1;
        $this->assertSame('en', (new ShellLocaleService())->getLangCode());
    }

    public function testUnknownLangIdFallsBackToEnglish(): void
    {
        $_SESSION['language_choice'] = 999999;
        $this->assertSame('en', (new ShellLocaleService())->getLangCode());
    }

    public function testResolvesRealNonEnglishLangCode(): void
    {
        // Pick any seeded non-English language dynamically — no hardcoded ids.
        $rows = QueryUtils::fetchRecords(
            "SELECT lang_id, lang_code FROM lang_languages
             WHERE lang_id > 1 AND lang_code REGEXP '^[a-z]{2}$'
             ORDER BY lang_id LIMIT 1",
            []
        ) ?: [];
        if ($rows === []) {
            $this->markTestSkipped('No non-English language seeded in lang_languages.');
        }

        $_SESSION['language_choice'] = (int) $rows[0]['lang_id'];
        $this->assertSame($rows[0]['lang_code'], (new ShellLocaleService())->getLangCode());
    }

    public function testEnglishNeverGetsADictionaryUrl(): void
    {
        $this->assertSame('', (new ShellLocaleService())->getDictionaryUrl('en'));
    }

    public function testMalformedCodeGetsNoDictionaryUrl(): void
    {
        $service = new ShellLocaleService();
        $this->assertSame('', $service->getDictionaryUrl('../etc'));
        $this->assertSame('', $service->getDictionaryUrl('FRA'));
        $this->assertSame('', $service->getDictionaryUrl(''));
    }

    public function testMissingDictionaryFileGetsNoUrl(): void
    {
        $dir = sys_get_temp_dir() . '/nc-i18n-test-' . uniqid();
        mkdir($dir . '/i18n', 0777, true);
        try {
            $this->assertSame('', (new ShellLocaleService())->getDictionaryUrl('fr', $dir));
        } finally {
            rmdir($dir . '/i18n');
            rmdir($dir);
        }
    }

    public function testExistingDictionaryFileYieldsVersionedUrl(): void
    {
        $dir = sys_get_temp_dir() . '/nc-i18n-test-' . uniqid();
        mkdir($dir . '/i18n', 0777, true);
        file_put_contents($dir . '/i18n/fr.json', "{}\n");
        try {
            $url = (new ShellLocaleService())->getDictionaryUrl('fr', $dir);
            $this->assertStringContainsString(
                '/interface/modules/custom_modules/oe-module-new-clinic/public/assets/i18n/fr.json',
                $url
            );
            $this->assertStringContainsString('?v=' . ModuleAssetVersion::VERSION, $url);
        } finally {
            unlink($dir . '/i18n/fr.json');
            rmdir($dir . '/i18n');
            rmdir($dir);
        }
    }
}
