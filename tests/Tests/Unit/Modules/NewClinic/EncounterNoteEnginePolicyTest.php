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
use OpenEMR\Modules\NewClinic\Services\EncounterNoteEnginePolicy;
use OpenEMR\Modules\NewClinic\Services\EncounterNoteService;
use PHPUnit\Framework\TestCase;

class EncounterNoteEnginePolicyTest extends TestCase
{
    public function testEffectiveConsultFormdirUsesNativeWhenEngineEnabled(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturnCallback(
            static function (string $key, $default = null): string {
                return match ($key) {
                    'encounter_note_engine' => EncounterNoteEnginePolicy::ENGINE_NATIVE,
                    'consult_note_formdir' => 'soap',
                    default => (string) $default,
                };
            }
        );

        $policy = new EncounterNoteEnginePolicy(config: $config);

        $this->assertTrue($policy->isNativeEngineEnabled(0));
        $this->assertSame(EncounterNoteEnginePolicy::NATIVE_FORMDIR, $policy->effectiveConsultFormdir(0));
    }

    public function testShouldOpenNativeFormForConfiguredLegacyPrimary(): void
    {
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturnCallback(
            static function (string $key, $default = null): string {
                return match ($key) {
                    'encounter_note_engine' => EncounterNoteEnginePolicy::ENGINE_NATIVE,
                    'consult_note_formdir' => 'soap',
                    default => (string) $default,
                };
            }
        );

        $policy = new EncounterNoteEnginePolicy(config: $config);

        $this->assertTrue($policy->shouldOpenNativeForm('soap', 0));
        $this->assertTrue($policy->shouldOpenNativeForm(EncounterNoteEnginePolicy::NATIVE_FORMDIR, 0));
        $this->assertFalse($policy->shouldOpenNativeForm('vitals', 0));
    }

    public function testEngineIsPermanentlyNativeSinceFlagRetirement(): void
    {
        // 2026-07-18 flip (PRD §5.6 amendment): the legacy engine option was removed
        // from code — the policy ignores any stale `encounter_note_engine` config row.
        $config = $this->createMock(ClinicConfigService::class);
        $config->method('get')->willReturnCallback(
            static function (string $key, $default = null): string {
                return match ($key) {
                    'encounter_note_engine' => EncounterNoteEnginePolicy::ENGINE_LEGACY,
                    'consult_note_formdir' => 'ghana_opd_consult',
                    default => (string) $default,
                };
            }
        );

        $policy = new EncounterNoteEnginePolicy(config: $config);

        $this->assertTrue($policy->isNativeEngineEnabled(0));
        $this->assertSame(EncounterNoteEnginePolicy::NATIVE_FORMDIR, $policy->effectiveConsultFormdir(0));
        // The configured legacy consult formdir still opens natively (pre-flip notes).
        $this->assertTrue($policy->shouldOpenNativeForm('ghana_opd_consult', 0));
    }

    public function testNativeFormdirConstantMatchesEncounterNoteService(): void
    {
        $this->assertSame(
            EncounterNoteService::NATIVE_FORMDIR,
            EncounterNoteEnginePolicy::NATIVE_FORMDIR
        );
    }
}
