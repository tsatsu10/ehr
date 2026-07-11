<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\AclVersion;
use PHPUnit\Framework\TestCase;

class AclVersionTest extends TestCase
{
    use MandatoryTestHelpers;

    public function testCanonicalAclVersionIsRecordedByInstallPaths(): void
    {
        $this->assertSame('0.2.8', AclVersion::VERSION);
        $this->assertTrue(AclVersion::isSatisfiedBy('0.2.8'));
        $this->assertTrue(AclVersion::isSatisfiedBy('0.3.0'));
        $this->assertFalse(AclVersion::isSatisfiedBy('0.2.0'));
        $this->assertFalse(AclVersion::isSatisfiedBy(''));

        foreach ([
            'bin/install_acl.php',
            'ModuleManagerListener.php',
            'acl/install_and_grant.php',
        ] as $relativePath) {
            $source = $this->readModuleSource($relativePath);
            $this->assertStringContainsString(
                'AclVersion::VERSION',
                $source,
                $relativePath . ' must use AclVersion::VERSION'
            );
            $this->assertStringNotContainsString(
                "'0.2.0'",
                $source,
                $relativePath . ' must not hardcode stale acl_version 0.2.0'
            );
            $this->assertStringNotContainsString(
                "'0.1.0'",
                $source,
                $relativePath . ' must not hardcode stale acl_version 0.1.0'
            );
        }
    }
}
