<?php

/**
 * AjaxController must import every Services class used in constructor defaults.
 * Missing `use` resolves under Controllers\ and fatals all ajax.php requests (500).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use PHPUnit\Framework\TestCase;

class AjaxControllerConstructorImportsTest extends TestCase
{
    use MandatoryTestHelpers;

    public function testConstructorServicesHaveUseImports(): void
    {
        $source = $this->readModuleSource('src/Controllers/AjaxController.php');

        preg_match_all(
            '/private readonly (\w+) \$/',
            $source,
            $matches
        );
        $constructorServices = array_unique($matches[1] ?? []);

        preg_match_all(
            '/^use OpenEMR\\\\Modules\\\\NewClinic\\\\Services\\\\(\w+);/m',
            $source,
            $importMatches
        );
        $imported = array_flip($importMatches[1] ?? []);

        $missing = [];
        foreach ($constructorServices as $service) {
            if (!isset($imported[$service])) {
                $missing[] = $service;
            }
        }

        $this->assertSame(
            [],
            $missing,
            'AjaxController constructor references Services without a use import: '
            . implode(', ', $missing)
        );
    }
}
