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

class ProcedureOrderDeepLinkService
{
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

        return $webroot
            . '/interface/orders/pending_orders.php?patient_id='
            . urlencode((string) $pid);
    }
}
