<?php

/**
 * Native patient-wide Prescription History policy (closes "Open Rx list (core)" gap).
 *
 * Mirrors PrescriptionEditPolicy: a single facility flag, read lazily,
 * default OFF (PRD §5.6) so every clinic keeps the 100% stock bridge
 * (`controller.php?prescription&list`) until this passes parity sign-off.
 *
 * No eager service construction (crash-pattern rule) — lazy getters only.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class PrescriptionHistoryPolicy
{
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
        return $this->config ??= new ClinicConfigService();
    }

    private function getVisitScope(): VisitScopeService
    {
        return $this->visitScope ??= new VisitScopeService();
    }

    public function isNativeRxHistoryEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->getVisitScope()->resolveDeskFacilityId();
        }

        return $this->getConfig()->getInt('enable_native_rx_history', 0, $facilityId) === 1;
    }
}
