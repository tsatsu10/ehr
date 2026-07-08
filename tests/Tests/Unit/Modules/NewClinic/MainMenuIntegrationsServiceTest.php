<?php

/**
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\MainMenuIntegrationsService;
use OpenEMR\Modules\NewClinic\Services\MainMenuRestrictService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class MainMenuIntegrationsServiceTest extends TestCase
{
    /**
     * @param array<string, bool> $flags
     */
    private function makeService(array $flags, bool $hideFinder): MainMenuIntegrationsService
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('isEnabled')->willReturnCallback(
            static fn (string $key): bool => $flags[$key] ?? false
        );
        $visitScope = $this->createMock(VisitScopeService::class);
        $visitScope->method('resolveDefaultFacilityId')->willReturn(1);
        $menuRestrict = $this->createMock(MainMenuRestrictService::class);
        $menuRestrict->method('shouldHideFinderForCurrentUser')->willReturn($hideFinder);

        return new MainMenuIntegrationsService($config, $visitScope, $menuRestrict);
    }

    public function testGlobalSearchRedirectsWhenRegistryAndRedirectOnForReceptionUser(): void
    {
        $service = $this->makeService([
            'registry_redirect_global_search' => true,
            'enable_patient_registry' => true,
        ], true);

        $result = $service->globalSearchRedirectConfig(1);

        $this->assertTrue($result['redirect']);
        $this->assertStringContainsString('top-redirect.php?dest=front-desk.php', $result['front_desk_url']);
    }

    public function testNoRedirectWhenRegistryDisabled(): void
    {
        $service = $this->makeService([
            'registry_redirect_global_search' => true,
            'enable_patient_registry' => false,
        ], true);

        $this->assertFalse($service->globalSearchRedirectConfig(1)['redirect']);
    }

    public function testNoRedirectWhenFinderStaysVisibleForUser(): void
    {
        $service = $this->makeService([
            'registry_redirect_global_search' => true,
            'enable_patient_registry' => true,
        ], false);

        $this->assertFalse($service->globalSearchRedirectConfig(1)['redirect']);
    }

    public function testRewriteMenuUrlByIdReachesNestedChildren(): void
    {
        $service = $this->makeService([], false);
        $method = new ReflectionMethod(MainMenuIntegrationsService::class, 'rewriteMenuUrlById');

        $child = new \stdClass();
        $child->menu_id = 'msg0';
        $child->url = '/old/messages';
        $child->children = [];

        $sibling = new \stdClass();
        $sibling->menu_id = 'rep0';
        $sibling->url = '/reports';
        $sibling->children = [];

        $parent = new \stdClass();
        $parent->menu_id = 'top';
        $parent->url = '/top';
        $parent->children = [$child, $sibling];

        $menu = [$parent];
        $method->invokeArgs($service, [&$menu, 'msg0', '/new/hub']);

        $this->assertSame('/new/hub', $child->url);
        $this->assertSame('/reports', $sibling->url);
        $this->assertSame('/top', $parent->url);
    }
}
