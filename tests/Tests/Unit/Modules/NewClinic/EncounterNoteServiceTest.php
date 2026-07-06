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
}
