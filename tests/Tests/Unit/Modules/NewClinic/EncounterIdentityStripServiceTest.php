<?php

/**
 * Unit tests for encounter identity strip (T1-F17)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\EncounterIdentityStripService;
use PHPUnit\Framework\TestCase;

class EncounterIdentityStripServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        unset($_SESSION[EncounterIdentityStripService::SESSION_KEY], $_SESSION['new_clinic_visit_id']);
        parent::tearDown();
    }

    public function testShortcutShowsStripOnlyForAllowlistedShortcuts(): void
    {
        $service = new EncounterIdentityStripService();

        $this->assertTrue($service->shortcutShowsStrip('doctor', 'encounter'));
        $this->assertTrue($service->shortcutShowsStrip('doctor', 'lab'));
        $this->assertFalse($service->shortcutShowsStrip('doctor', 'chart'));
        $this->assertTrue($service->shortcutShowsStrip('lab', 'orders'));
        $this->assertTrue($service->shortcutShowsStrip('pharmacy', 'dispense'));
        $this->assertFalse($service->shortcutShowsStrip('pharmacy', 'rx_list'));
    }

    public function testMarkFromShortcutClearsContextForHiddenShortcuts(): void
    {
        $service = new EncounterIdentityStripService();
        $_SESSION[EncounterIdentityStripService::SESSION_KEY] = ['visit_id' => 9];

        $service->markFromShortcut(9, 'doctor', 'chart');

        $this->assertArrayNotHasKey(EncounterIdentityStripService::SESSION_KEY, $_SESSION);
    }

    public function testMarkFromShortcutStoresDeskContext(): void
    {
        global $GLOBALS;
        $GLOBALS['webroot'] = '';

        $service = new EncounterIdentityStripService();
        $service->markFromShortcut(14, 'lab', 'orders');

        $this->assertSame(14, $_SESSION[EncounterIdentityStripService::SESSION_KEY]['visit_id']);
        $this->assertSame('lab', $_SESSION[EncounterIdentityStripService::SESSION_KEY]['desk']);
        $this->assertStringEndsWith('lab.php', $_SESSION[EncounterIdentityStripService::SESSION_KEY]['back_url']);
    }

    public function testInjectIntoHtmlPrependsAfterBodyTag(): void
    {
        $service = new EncounterIdentityStripService();
        $html = '<html><body class="m-0"><div>Form</div></body></html>';
        $strip = '<div id="encounter-identity-strip">strip</div>';

        $out = $service->injectIntoHtml($html, $strip);

        $this->assertStringContainsString('<body class="m-0"><div id="encounter-identity-strip">strip</div>', $out);
    }

    public function testInjectIntoHtmlSkipsDuplicateStrip(): void
    {
        $service = new EncounterIdentityStripService();
        $html = '<body><div id="encounter-identity-strip"></div></body>';
        $strip = '<div id="encounter-identity-strip">new</div>';

        $this->assertSame($html, $service->injectIntoHtml($html, $strip));
    }
}
