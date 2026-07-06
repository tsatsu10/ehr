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
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class EncounterNoteServiceTest extends TestCase
{
    public function testEffectiveConsultFormdirUsesNativeWhenEngineEnabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturnCallback(
            static function (string $key, $default = null): string {
                return match ($key) {
                    'encounter_note_engine' => EncounterNoteService::ENGINE_NATIVE,
                    'consult_note_formdir' => 'soap',
                    default => (string) $default,
                };
            }
        );

        $service = new EncounterNoteService(config: $config);

        $this->assertTrue($service->isNativeEngineEnabled(0));
        $this->assertSame(EncounterNoteService::NATIVE_FORMDIR, $service->effectiveConsultFormdir(0));
    }

    public function testShouldOpenNativeFormForConfiguredLegacyPrimary(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturnCallback(
            static function (string $key, $default = null): string {
                return match ($key) {
                    'encounter_note_engine' => EncounterNoteService::ENGINE_NATIVE,
                    'consult_note_formdir' => 'soap',
                    default => (string) $default,
                };
            }
        );

        $service = new EncounterNoteService(config: $config);

        $this->assertTrue($service->shouldOpenNativeForm('soap', 0));
        $this->assertTrue($service->shouldOpenNativeForm(EncounterNoteService::NATIVE_FORMDIR, 0));
        $this->assertFalse($service->shouldOpenNativeForm('vitals', 0));
    }

    public function testLegacyEngineKeepsConfiguredConsultFormdir(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturnCallback(
            static function (string $key, $default = null): string {
                return match ($key) {
                    'encounter_note_engine' => EncounterNoteService::ENGINE_LEGACY,
                    'consult_note_formdir' => 'ghana_opd_consult',
                    default => (string) $default,
                };
            }
        );

        $service = new EncounterNoteService(config: $config);

        $this->assertFalse($service->isNativeEngineEnabled(0));
        $this->assertSame('ghana_opd_consult', $service->effectiveConsultFormdir(0));
        $this->assertFalse($service->shouldOpenNativeForm('soap', 0));
    }

    public function testNormalizeVariantFallsBackToGeneralOpd(): void
    {
        $service = new EncounterNoteService();
        $method = (new ReflectionClass($service))->getMethod('normalizeVariant');
        $method->setAccessible(true);

        $this->assertSame('general_opd', $method->invoke($service, 'unknown_variant'));
        $this->assertSame('referral_consult', $method->invoke($service, 'referral_consult'));
    }

    public function testVisibleSectionsForReferralConsultIncludesReferralHeader(): void
    {
        $service = new EncounterNoteService();
        $method = (new ReflectionClass($service))->getMethod('visibleSectionsForVariant');
        $method->setAccessible(true);

        $sections = $method->invoke($service, 'referral_consult');
        $this->assertContains('referral', $sections);
        $this->assertContains('problems', $sections);
        $this->assertContains('ros', $sections);
        $this->assertContains('data_reviewed', $sections);
        $this->assertContains('background', $sections);
        $this->assertContains('follow_up', $sections);
    }

    public function testBuildNotePreviewReturnsDisabledPayloadWhenNativeEngineOff(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturnCallback(
            static function (string $key, $default = null): string {
                return match ($key) {
                    'encounter_note_engine' => EncounterNoteService::ENGINE_LEGACY,
                    default => (string) $default,
                };
            }
        );

        $service = new EncounterNoteService(config: $config);
        $preview = $service->buildNotePreview(99, 0);

        $this->assertFalse($preview['native_enabled']);
        $this->assertSame(0, $preview['problem_count']);
    }

    public function testVariantDisplayLabelForReferralConsult(): void
    {
        $service = new EncounterNoteService();

        $this->assertSame('Referral consult', $service->variantDisplayLabel('referral_consult'));
    }

    public function testMapReferralRiskToUrgency(): void
    {
        $service = new EncounterNoteService();
        $method = (new ReflectionClass($service))->getMethod('mapReferralRiskToUrgency');
        $method->setAccessible(true);

        $this->assertSame('urgent', $method->invoke($service, 'high'));
        $this->assertSame('emergent', $method->invoke($service, 'critical'));
        $this->assertSame('routine', $method->invoke($service, 'low'));
        $this->assertSame('', $method->invoke($service, ''));
    }

    public function testDecodeSectionsForExportUsesStoredPayload(): void
    {
        $service = new EncounterNoteService();
        $payload = json_encode([
            'sections' => [
                'cc' => ['chief_complaint' => 'Headache'],
                'referral' => [
                    'requesting_clinician' => 'Dr A',
                    'requesting_service' => 'Medicine',
                    'clinical_question' => 'Second opinion',
                    'urgency' => 'routine',
                ],
            ],
        ], JSON_THROW_ON_ERROR);

        $sections = $service->decodeSectionsForExport($payload);

        $this->assertSame('Headache', $sections['cc']['chief_complaint']);
        $this->assertSame('Dr A', $sections['referral']['requesting_clinician']);
    }

    public function testSaveGuardsSignedNotes(): void
    {
        $source = (string) file_get_contents(
            __DIR__ . '/../../../../../interface/modules/custom_modules/oe-module-new-clinic/src/Services/EncounterNoteService.php'
        );

        $this->assertStringContainsString('assertNoteWritable($existing)', $source);
        $this->assertStringContainsString('Consult note is signed and cannot be modified', $source);
    }

    public function testSignChecksLockBeforeOptionalSave(): void
    {
        $source = (string) file_get_contents(
            __DIR__ . '/../../../../../interface/modules/custom_modules/oe-module-new-clinic/src/Services/EncounterNoteService.php'
        );

        $signStart = strpos($source, 'public function sign(');
        $this->assertNotFalse($signStart);
        $signBody = substr($source, $signStart, 3500);
        $lockPos = strpos($signBody, 'already_signed');
        $savePos = strpos($signBody, '$this->save([');
        $this->assertNotFalse($lockPos);
        $this->assertNotFalse($savePos);
        $this->assertLessThan($savePos, $lockPos, 'sign() must detect an existing lock before optional save()');
    }

    public function testBuildNotePreviewUsesSupervisorMeta(): void
    {
        $source = (string) file_get_contents(
            __DIR__ . '/../../../../../interface/modules/custom_modules/oe-module-new-clinic/src/Services/EncounterNoteService.php'
        );

        $previewStart = strpos($source, 'public function buildNotePreview(');
        $this->assertNotFalse($previewStart);
        $previewBody = substr($source, $previewStart, 2200);
        $this->assertStringContainsString('getSupervisorMeta', $previewBody);
        $this->assertStringNotContainsString(
            '$facilityId,
                []',
            $previewBody
        );
    }

    public function testEncounterNoteEndpointsRequireNativeEngineAndConsultLens(): void
    {
        $source = (string) file_get_contents(
            __DIR__ . '/../../../../../interface/modules/custom_modules/oe-module-new-clinic/src/Services/EncounterNoteService.php'
        );

        $this->assertStringContainsString("assertLensAccess('consult')", $source);
        $this->assertStringContainsString('assertEncounterNoteAccess($facilityId)', $source);
    }

    public function testFirstSaveUsesDatabaseTransaction(): void
    {
        $source = (string) file_get_contents(
            __DIR__ . '/../../../../../interface/modules/custom_modules/oe-module-new-clinic/src/Services/EncounterNoteService.php'
        );

        $saveStart = strpos($source, 'public function save(');
        $this->assertNotFalse($saveStart);
        $saveBody = substr($source, $saveStart, 4500);
        $this->assertStringContainsString('sqlBeginTrans()', $saveBody);
        $this->assertStringContainsString('sqlCommitTrans()', $saveBody);
        $this->assertStringContainsString('sqlRollbackTrans()', $saveBody);
    }
}
