<?php

/**
 * Native procedure-order engine policy (GAP-D / D3).
 *
 * Decides whether the module's native React procedure-order form replaces the
 * stock `procedure_order` encounter form for a facility. Mirrors
 * EncounterNoteEnginePolicy (the native consult-note precedent): a single
 * facility flag, read lazily, with the formdir-routing predicate the
 * clinical-doc form-open funnel consults.
 *
 * Governing invariant (PRD §5.6): `enable_native_proc_order` defaults OFF,
 * so every clinic keeps the 100% stock bridge until the native form passes
 * parity sign-off. The native form additionally requires the Lab Operations
 * hub (it shares that catalog/provider/fee plumbing), matching how the
 * Doctor-Desk panel quick-order gates.
 *
 * No eager service construction (crash-pattern rule) — lazy getters only.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

class ProcedureOrderEnginePolicy
{
    /** Stock encounter form directory this native form stands in for. */
    public const STOCK_FORMDIR = 'procedure_order';

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

    public function isNativeProcOrderEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->getVisitScope()->resolveDeskFacilityId();
        }

        // Requires the Lab Operations hub — the native form reads the same
        // procedure_type catalog, provider, and fee mapping it powers.
        if ($this->getConfig()->getInt('enable_lab_ops', 0, $facilityId) !== 1) {
            return false;
        }

        return $this->getConfig()->getInt('enable_native_proc_order', 0, $facilityId) === 1;
    }

    /**
     * True when a form-open for the given formdir should route to the native
     * procedure-order host instead of the stock bridge.
     */
    public function shouldOpenNativeProcOrder(string $formdir, ?int $facilityId = null): bool
    {
        if (strcasecmp(trim($formdir), self::STOCK_FORMDIR) !== 0) {
            return false;
        }

        return $this->isNativeProcOrderEnabled($facilityId);
    }
}
