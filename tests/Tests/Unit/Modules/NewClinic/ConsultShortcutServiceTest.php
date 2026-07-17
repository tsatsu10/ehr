<?php

/**
 * Unit tests for doctor consult shortcut preflight (M4-F18–F20)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Exceptions\AllergiesUndocumentedException;
use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\ConsultShortcutService;
use OpenEMR\Modules\NewClinic\Services\EncounterIdentityStripService;
use OpenEMR\Modules\NewClinic\Services\EncounterSessionService;
use OpenEMR\Modules\NewClinic\Services\PatientCompletionService;
use OpenEMR\Modules\NewClinic\Services\ProcedureOrderDeepLinkService;
use OpenEMR\Modules\NewClinic\Services\VisitQueueService;
use OpenEMR\Modules\NewClinic\Services\VisitScopeService;
use PHPUnit\Framework\TestCase;

class ConsultShortcutServiceTest extends TestCase
{
    /**
     * @return array<string, mixed>
     */
    private function visitFixture(int $pid = 10, int $providerId = 5): array
    {
        return [
            'state' => 'with_doctor',
            'assigned_provider_id' => $providerId,
            'pid' => $pid,
            'encounter' => 100,
            'facility_id' => 1,
        ];
    }

    private function makeService(
        ClinicConfigService $config,
        PatientCompletionService $completion,
        VisitQueueService $queue,
    ): ConsultShortcutService {
        $encounterSession = $this->createMock(EncounterSessionService::class);
        $encounterSession->method('bindForVisit');
        $encounterSession->method('assertBound');

        $visitScope = $this->createMock(VisitScopeService::class);
        $visitScope->method('resolveDeskFacilityId')->willReturn(1);

        $identityStrip = $this->createMock(EncounterIdentityStripService::class);
        $identityStrip->method('markFromShortcut');

        return new ConsultShortcutService(
            $encounterSession,
            $queue,
            new ProcedureOrderDeepLinkService(),
            $identityStrip,
            $config,
            $completion,
            $visitScope,
        );
    }

    public function testRxShortcutBlockedWhenAllergiesRequiredAndUndocumented(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')
            ->willReturnCallback(function (string $key, int $default, int $facilityId): int {
                if ($key === 'require_allergies_for_rx') {
                    return 1;
                }

                return $default;
            });

        $completion = $this->createMock(PatientCompletionService::class);
        $completion->method('hasAllergyDocumentationForPatient')->with(10)->willReturn(false);

        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->with(99)->willReturn($this->visitFixture());

        $service = $this->makeService($config, $completion, $queue);

        $this->expectException(AllergiesUndocumentedException::class);
        $this->expectExceptionMessage('Document allergies');

        $service->preflight(99, 'rx', 5);
    }

    public function testRxShortcutAllowedWhenAllergiesDocumented(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')
            ->willReturnCallback(function (string $key, int $default, int $facilityId): int {
                if ($key === 'require_allergies_for_rx') {
                    return 1;
                }

                return $default;
            });

        $completion = $this->createMock(PatientCompletionService::class);
        $completion->method('hasAllergyDocumentationForPatient')->with(10)->willReturn(true);

        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->with(99)->willReturn($this->visitFixture());

        $service = $this->makeService($config, $completion, $queue);
        $result = $service->preflight(99, 'rx', 5);

        $this->assertSame('rx', $result['shortcut']);
        $this->assertStringContainsString('prescription', $result['redirect_url']);
        $this->assertStringContainsString('pid=10', $result['redirect_url']);
    }

    public function testRxShortcutAllowedWhenAllergyGateDisabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);

        $completion = $this->createMock(PatientCompletionService::class);
        $completion->expects($this->never())->method('hasAllergyDocumentationForPatient');

        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->with(99)->willReturn($this->visitFixture());

        $service = $this->makeService($config, $completion, $queue);
        $result = $service->preflight(99, 'rx', 5);

        $this->assertSame('rx', $result['shortcut']);
    }

    public function testRxShortcutRoutesToNativeFormWhenEnabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')
            ->willReturnCallback(function (string $key, int $default, int $facilityId): int {
                return $key === 'enable_native_rx_edit' ? 1 : $default;
            });

        $completion = $this->createMock(PatientCompletionService::class);
        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->with(99)->willReturn($this->visitFixture());

        $service = $this->makeService($config, $completion, $queue);
        $result = $service->preflight(99, 'rx', 5);

        $this->assertStringContainsString('rx-edit.php', $result['redirect_url']);
        $this->assertStringContainsString('return_to=doctor', $result['redirect_url']);
        $this->assertStringNotContainsString('controller.php', $result['redirect_url']);
    }

    public function testLabShortcutRoutesToNativeFormWhenEnabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')
            ->willReturnCallback(function (string $key, int $default, int $facilityId): int {
                return in_array($key, ['enable_lab_ops', 'enable_native_proc_order'], true) ? 1 : $default;
            });

        $completion = $this->createMock(PatientCompletionService::class);
        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->with(99)->willReturn($this->visitFixture());

        $service = $this->makeService($config, $completion, $queue);
        $result = $service->preflight(99, 'lab', 5);

        $this->assertStringContainsString('proc-order.php', $result['redirect_url']);
        $this->assertStringContainsString('return_to=doctor', $result['redirect_url']);
        $this->assertStringNotContainsString('clinical-form-bridge', $result['redirect_url']);
    }

    public function testLabShortcutUsesStockBridgeWhenNativeDisabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('getInt')->willReturn(0);

        $completion = $this->createMock(PatientCompletionService::class);
        $queue = $this->createMock(VisitQueueService::class);
        $queue->method('getVisitForActor')->with(99)->willReturn($this->visitFixture());

        $service = $this->makeService($config, $completion, $queue);
        $result = $service->preflight(99, 'lab', 5);

        $this->assertStringContainsString('clinical-form-bridge.php', $result['redirect_url']);
        $this->assertStringNotContainsString('proc-order.php', $result['redirect_url']);
    }

    public function testRxAllergyOverrideAuditEventIsRecordedInService(): void
    {
        $body = $this->methodBody(ConsultShortcutService::class, 'assertRxAllergyOverrideAllowed');

        $this->assertStringContainsString('rx_undocumented_allergy_override', $body);
        $this->assertStringContainsString('new_rx_undocumented_allergy_override', $body);
    }

    /**
     * @param class-string $class
     */
    private function methodBody(string $class, string $method): string
    {
        $reflection = new \ReflectionMethod($class, $method);
        $source = file_get_contents($reflection->getFileName());
        $lines = explode("\n", $source);

        return implode("\n", array_slice(
            $lines,
            $reflection->getStartLine() - 1,
            $reflection->getEndLine() - $reflection->getStartLine() + 1
        ));
    }
}
