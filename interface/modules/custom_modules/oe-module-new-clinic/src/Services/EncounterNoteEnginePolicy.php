<?php

/**
 * Encounter note engine configuration — facility flags and formdir resolution.
 *
 * Kept separate from EncounterNoteService so catalog/export services can read
 * native-engine policy without pulling in the full note workflow graph.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class EncounterNoteEnginePolicy
{
    public const NATIVE_FORMDIR = 'nc_encounter_consult';
    public const ENGINE_LEGACY = 'legacy';
    public const ENGINE_NATIVE = 'native';

    private ?ClinicConfigService $config = null;
    private ?VisitScopeService $visitScope = null;

    public function __construct(
        ?ClinicConfigService $config = null,
        ?VisitScopeService $visitScope = null,
    ) {
        $this->config = $config;
        $this->visitScope = $visitScope;
    }

    private function getConfig(): ClinicConfigService
    {
        if ($this->config === null) {
            $this->config = new ClinicConfigService();
        }

        return $this->config;
    }

    private function getVisitScope(): VisitScopeService
    {
        if ($this->visitScope === null) {
            $this->visitScope = new VisitScopeService();
        }

        return $this->visitScope;
    }

    /**
     * The native engine is the permanent engine since 2026-07-18 — the
     * `encounter_note_engine` setting was retired (PRD §5.6 amendment). Kept as
     * a method because a dozen call sites read the policy.
     */
    public function isNativeEngineEnabled(?int $facilityId = null): bool
    {
        return true;
    }

    public function effectiveConsultFormdir(?int $facilityId = null): string
    {
        return self::NATIVE_FORMDIR;
    }

    public function isNativeFormdir(string $formdir): bool
    {
        return strcasecmp(trim($formdir), self::NATIVE_FORMDIR) === 0;
    }

    /**
     * The native note page also owns the legacy consult formdir
     * (`consult_note_formdir`, default soap) so pre-flip consult notes keep
     * opening natively instead of falling to the bridge.
     */
    public function shouldOpenNativeForm(string $formdir, ?int $facilityId = null): bool
    {
        $formdir = strtolower(trim($formdir));

        return $formdir === self::NATIVE_FORMDIR
            || $formdir === strtolower(trim((string) ($this->getConfig()->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));
    }
}
