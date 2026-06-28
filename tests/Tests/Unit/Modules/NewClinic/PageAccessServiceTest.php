<?php

/**
 * Unit tests for chart-depth page ACL / shell context resolution
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\PageAccessService;
use OpenEMR\Modules\NewClinic\Services\SessionRoleService;
use PHPUnit\Framework\TestCase;

class PageAccessServiceTest extends TestCase
{
    public function testResolveShellAcoReturnsDeskRoleWhenFeatureIsDeskRole(): void
    {
        $service = new PageAccessService();

        $this->assertSame('new_admin', $service->resolveShellAco('new_admin'));
        $this->assertSame('new_cashier', $service->resolveShellAco('new_cashier'));
    }

    public function testResolveShellAcoReturnsFeatureWhenNotDeskRoleAndNoActiveSession(): void
    {
        $roleStub = new class extends SessionRoleService {
            public function getActiveRole(?string $pageAco = null): string
            {
                return '';
            }
        };

        $service = new PageAccessService($roleStub);

        $this->assertSame('new_chart_depth_finance', $service->resolveShellAco('new_chart_depth_finance'));
    }

    public function testResolveShellAcoPrefersActiveDeskRoleForFeatureAcl(): void
    {
        $roleStub = new class extends SessionRoleService {
            public function getActiveRole(?string $pageAco = null): string
            {
                return 'new_cashier';
            }
        };
        $aclStub = static function (string $section, string $aco): bool {
            return $section === 'new_clinic' && $aco === 'new_cashier';
        };

        $service = new PageAccessService($roleStub, $aclStub);

        $this->assertSame('new_cashier', $service->resolveShellAco('new_chart_depth_finance'));
    }

    public function testResolveFirstGrantedAcoReturnsFirstMatch(): void
    {
        $aclStub = static function (string $section, string $aco): bool {
            return $section === 'new_clinic' && $aco === 'new_chart_depth_export';
        };

        $service = new PageAccessService(null, $aclStub);

        $this->assertSame(
            'new_chart_depth_export',
            $service->resolveFirstGrantedAco([
                'new_chart_depth_export_full',
                'new_chart_depth_export',
                'new_admin',
            ])
        );
    }

    public function testResolveFirstGrantedAcoReturnsNullWhenNoneGranted(): void
    {
        $service = new PageAccessService(null, static fn (): bool => false);

        $this->assertNull($service->resolveFirstGrantedAco(['new_chart_depth_export']));
    }
}
