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

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    public function isNativeEngineEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        $engine = strtolower(trim((string) ($this->config->get(
            'encounter_note_engine',
            self::ENGINE_LEGACY,
            $facilityId
        ) ?? self::ENGINE_LEGACY)));

        return $engine === self::ENGINE_NATIVE;
    }

    public function effectiveConsultFormdir(?int $facilityId = null): string
    {
        if ($this->isNativeEngineEnabled($facilityId)) {
            return self::NATIVE_FORMDIR;
        }

        $formdir = strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));

        return $formdir !== '' ? $formdir : 'soap';
    }

    public function isNativeFormdir(string $formdir): bool
    {
        return strcasecmp(trim($formdir), self::NATIVE_FORMDIR) === 0;
    }

    public function shouldOpenNativeForm(string $formdir, ?int $facilityId = null): bool
    {
        if (!$this->isNativeEngineEnabled($facilityId)) {
            return false;
        }

        $formdir = strtolower(trim($formdir));

        return $formdir === self::NATIVE_FORMDIR
            || $formdir === strtolower(trim((string) ($this->config->get('consult_note_formdir', 'soap', $facilityId) ?? 'soap')));
    }
}
