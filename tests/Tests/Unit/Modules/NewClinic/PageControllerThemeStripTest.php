<?php

/**
 * PageController::stripCoreThemeStylesheet tests (GAP-D / D6 Step 3).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Controllers\PageController;
use PHPUnit\Framework\TestCase;

class PageControllerThemeStripTest extends TestCase
{
    private const HEADER = "\n"
        . '<link rel="stylesheet" href="/public/themes/style_light.css?v=81" type="text/css">' . "\n"
        . '<link rel="stylesheet" href="/interface/modules/custom_modules/oe-module-new-clinic/public/assets/css/shell.css?v=x" type="text/css">' . "\n"
        . '<script src="/library/js/utility.js"></script>' . "\n"
        . '<script src="/public/assets/bootstrap/dist/js/bootstrap.bundle.min.js"></script>' . "\n";

    public function testRemovesOnlyTheCoreThemeLink(): void
    {
        $out = PageController::stripCoreThemeStylesheet(self::HEADER, '/public/themes/style_light.css?v=81');

        // The Bootstrap theme stylesheet is gone...
        $this->assertStringNotContainsString('themes/style_light.css', $out);
        // ...but the module CSS and BOTH scripts (incl. Bootstrap JS) survive.
        $this->assertStringContainsString('oe-module-new-clinic/public/assets/css/shell.css', $out);
        $this->assertStringContainsString('utility.js', $out);
        $this->assertStringContainsString('bootstrap.bundle.min.js', $out);
    }

    public function testMatchesOnPathNotVersionQuery(): void
    {
        // css_header carries a different ?v= than the emitted link — path match wins.
        $out = PageController::stripCoreThemeStylesheet(self::HEADER, '/public/themes/style_light.css?v=999');
        $this->assertStringNotContainsString('themes/style_light.css', $out);
    }

    public function testEmptyCssHeaderLeavesHtmlUntouched(): void
    {
        $this->assertSame(self::HEADER, PageController::stripCoreThemeStylesheet(self::HEADER, ''));
    }

    public function testNonMatchingThemeLeavesHtmlUntouched(): void
    {
        // A theme file that isn't present in the header must not remove anything.
        $out = PageController::stripCoreThemeStylesheet(self::HEADER, '/public/themes/style_manila.css?v=1');
        $this->assertSame(self::HEADER, $out);
    }
}
