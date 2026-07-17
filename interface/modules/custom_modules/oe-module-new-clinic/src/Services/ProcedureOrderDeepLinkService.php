<?php

/**
 * Deep links to stock OpenEMR procedure_order encounter form (M4-F03 / M8-F10)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class ProcedureOrderDeepLinkService
{
    /** Ordering ACLs that can load the native proc-order host (mirrors proc-order.php). */
    private const NATIVE_ORDER_ACLS = [
        'new_clinical_doc_orders',
        'new_doctor',
        'new_lab',
        'new_lab_lead',
        'new_admin',
    ];

    private ?ProcedureOrderEnginePolicy $procOrderPolicy;

    public function __construct(?ProcedureOrderEnginePolicy $procOrderPolicy = null)
    {
        $this->procOrderPolicy = $procOrderPolicy;
    }

    private function getProcOrderPolicy(): ProcedureOrderEnginePolicy
    {
        return $this->procOrderPolicy ??= new ProcedureOrderEnginePolicy();
    }

    private function modulePublicPrefix(): string
    {
        return ($GLOBALS['webroot'] ?? '')
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/';
    }

    public function assertCanPlaceOrder(int $pid, int $encounter): void
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient context is required to place a lab order');
        }
        if ($encounter <= 0) {
            throw new \InvalidArgumentException(
                'This visit has no encounter yet. Start the visit at Front Desk before placing lab orders.'
            );
        }
    }

    public function sanitizeReturnUrl(string $url): string
    {
        $url = trim($url);
        $allowedPrefix = $this->modulePublicPrefix();
        if ($url === '' || !str_starts_with($url, $allowedPrefix)) {
            return $allowedPrefix . 'doctor.php';
        }

        return $url;
    }

    public function buildNewOrderUrl(int $pid, int $encounter, ?string $returnUrl = null): string
    {
        $this->assertCanPlaceOrder($pid, $encounter);

        return $this->buildBridgedFormUrl($pid, $encounter, $returnUrl);
    }

    public function buildEditOrderUrl(
        int $pid,
        int $encounter,
        int $procedureOrderId,
        ?string $returnUrl = null
    ): string {
        $this->assertCanPlaceOrder($pid, $encounter);
        if ($procedureOrderId <= 0) {
            throw new \InvalidArgumentException('Lab order id is required');
        }

        return $this->buildBridgedFormUrl($pid, $encounter, $returnUrl, $procedureOrderId);
    }

    /**
     * New-order link that prefers the native proc-order island when the
     * facility has it enabled (and the actor can load it), falling back to the
     * stock bridge otherwise. `$returnTo` is a proc-order.php return token
     * (e.g. 'chart', 'labops'); `$stockReturnUrl` is used on the stock path.
     */
    public function buildNewOrderUrlPreferNative(
        int $pid,
        int $encounter,
        string $returnTo,
        string $stockReturnUrl,
        ?int $facilityId = null
    ): string {
        $nativeUrl = $this->buildNativeProcOrderUrl($pid, $encounter, 0, $returnTo, $facilityId);
        if ($nativeUrl !== null) {
            return $nativeUrl;
        }

        return $this->buildNewOrderUrl($pid, $encounter, $stockReturnUrl);
    }

    /**
     * Edit-order twin of {@see buildNewOrderUrlPreferNative}.
     */
    public function buildEditOrderUrlPreferNative(
        int $pid,
        int $encounter,
        int $procedureOrderId,
        string $returnTo,
        string $stockReturnUrl,
        ?int $facilityId = null
    ): string {
        $nativeUrl = $this->buildNativeProcOrderUrl($pid, $encounter, $procedureOrderId, $returnTo, $facilityId);
        if ($nativeUrl !== null) {
            return $nativeUrl;
        }

        return $this->buildEditOrderUrl($pid, $encounter, $procedureOrderId, $stockReturnUrl);
    }

    /**
     * Native proc-order.php URL when routing there is both enabled and safe for
     * this actor + patient, or null to signal "use the stock path".
     */
    private function buildNativeProcOrderUrl(
        int $pid,
        int $encounter,
        int $procedureOrderId,
        string $returnTo,
        ?int $facilityId
    ): ?string {
        if ($pid <= 0 || $encounter <= 0) {
            return null;
        }
        if (!$this->getProcOrderPolicy()->isNativeProcOrderEnabled($facilityId)) {
            return null;
        }
        if (!$this->actorCanLoadNativeForm()) {
            return null;
        }

        $visitId = $this->resolveVisitId($pid, $encounter);
        if ($visitId <= 0) {
            return null;
        }

        $url = $this->modulePublicPrefix()
            . 'proc-order.php?visit_id=' . urlencode((string) $visitId)
            . '&return_to=' . urlencode($returnTo);
        if ($procedureOrderId > 0) {
            $url .= '&procedure_order_id=' . urlencode((string) $procedureOrderId);
        }
        // The chart return target needs the pid to rebuild the exact chart URL.
        if ($returnTo === 'chart') {
            $url .= '&pid=' . urlencode((string) $pid);
        }

        return $url;
    }

    private function actorCanLoadNativeForm(): bool
    {
        foreach (self::NATIVE_ORDER_ACLS as $acl) {
            if (AclMain::aclCheckCore('new_clinic', $acl)) {
                return true;
            }
        }

        return false;
    }

    private function resolveVisitId(int $pid, int $encounter): int
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM new_visit WHERE pid = ? AND encounter = ? ORDER BY id DESC LIMIT 1',
            [$pid, $encounter]
        );

        return is_array($row) ? (int) ($row['id'] ?? 0) : 0;
    }

    public function buildLabOpsReturnUrl(): string
    {
        return $this->modulePublicPrefix() . 'lab-ops/index.php';
    }

    public function buildLabDeskReturnUrl(): string
    {
        return $this->modulePublicPrefix() . 'lab.php';
    }

    private function buildBridgedFormUrl(
        int $pid,
        int $encounter,
        ?string $returnUrl,
        int $procedureOrderId = 0
    ): string {
        $webroot = $GLOBALS['webroot'] ?? '';

        if ($returnUrl !== null) {
            $url = $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/clinical-form-bridge.php'
                . '?formname=procedure_order'
                . '&pid=' . urlencode((string) $pid)
                . '&encounter=' . urlencode((string) $encounter);
            if ($procedureOrderId > 0) {
                $url .= '&form_id=' . urlencode((string) $procedureOrderId);
            }

            return $url . '&return=' . urlencode($this->sanitizeReturnUrl($returnUrl));
        }

        $url = $webroot
            . '/interface/patient_file/encounter/encounter_top.php'
            . '?set_pid=' . urlencode((string) $pid)
            . '&set_encounter=' . urlencode((string) $encounter)
            . '&formname=procedure_order'
            . '&formdesc=' . urlencode('Procedure Order');
        if ($procedureOrderId > 0) {
            $url .= '&id=' . urlencode((string) $procedureOrderId);
        }

        return $url;
    }

    public function buildPatientChartReturnUrl(int $pid): string
    {
        return $this->modulePublicPrefix()
            . 'patient-chart.php?pid='
            . urlencode((string) $pid)
            . '&tab=clinical';
    }

    public function buildPendingOrdersUrl(int $pid): string
    {
        if ($pid <= 0) {
            throw new \InvalidArgumentException('Patient context is required');
        }

        $webroot = $GLOBALS['webroot'] ?? '';

        // CP-4 — flag ON: the native Lab Ops Follow-up tab replaces the stock
        // pending-orders report. Flag OFF keeps the stock link (PRD §5.6).
        $facilityId = (new VisitScopeService())->resolveDeskFacilityId();
        if ((new ClinicConfigService())->getInt('enable_lab_followup_views', 0, $facilityId) === 1) {
            return $webroot
                . '/interface/modules/custom_modules/oe-module-new-clinic/public/lab-ops/index.php?tab=followup';
        }

        return $webroot
            . '/interface/orders/pending_orders.php?patient_id='
            . urlencode((string) $pid);
    }
}
