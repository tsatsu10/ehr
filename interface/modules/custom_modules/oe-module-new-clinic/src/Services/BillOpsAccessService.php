<?php

/**
 * M14 Billing Back Office — feature gate and ACL helpers
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;

class BillOpsAccessService
{
    /** @var array<int, string> */
    public const HUB_READ_ACLS = [
        'new_bill_ops',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const CORRECT_ACLS = [
        'new_bill_ops_correct',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const PAYMENT_ACLS = [
        'new_bill_ops_payment',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const CLOSE_ACLS = [
        'new_bill_ops_close',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const OUTSTANDING_ACLS = [
        'new_bill_ops_outstanding',
        'new_admin',
    ];

    /** @var array<int, string> */
    public const INSURANCE_ACLS = [
        'new_bill_ops_insurance',
        'new_admin',
    ];

    /** @var callable|null */
    private $aclChecker;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
        ?callable $aclChecker = null,
    ) {
        $this->aclChecker = $aclChecker;
    }

    public function isHubEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->config->getInt('enable_bill_ops', 0, $facilityId) === 1;
    }

    public function isOutstandingEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->isHubEnabled($facilityId)
            && $this->config->getInt('enable_bill_ops_outstanding', 0, $facilityId) === 1;
    }

    public function isInsuranceVaultEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->isHubEnabled($facilityId)
            && $this->config->getInt('enable_insurance', 0, $facilityId) === 1;
    }

    /**
     * CBILL-4a — payer-aware pricing admin screen. Requires the CBILL-3 scheme-split flag
     * as a prerequisite (payer prices are meaningless without the scheme-split claim flow).
     */
    public function isPayerBillingEnabled(?int $facilityId = null): bool
    {
        if ($facilityId === null || $facilityId <= 0) {
            $facilityId = $this->visitScope->resolveDeskFacilityId();
        }

        return $this->isInsuranceVaultEnabled($facilityId)
            && $this->config->getInt('enable_insurance_scheme', 0, $facilityId) === 1
            && $this->config->getInt('enable_payer_billing', 0, $facilityId) === 1;
    }

    public function assertHubEnabled(?int $facilityId = null): void
    {
        if (!$this->isHubEnabled($facilityId)) {
            throw new \RuntimeException('Billing back office is not enabled for this clinic', 403);
        }
    }

    public function canReadHub(): bool
    {
        return $this->hasAnyAcl(self::HUB_READ_ACLS);
    }

    public function canCorrectCharges(): bool
    {
        return $this->hasAnyAcl(self::CORRECT_ACLS);
    }

    public function canManagePayments(): bool
    {
        return $this->hasAnyAcl(self::PAYMENT_ACLS);
    }

    public function canCloseDay(): bool
    {
        return $this->hasAnyAcl(self::CLOSE_ACLS);
    }

    public function canViewOutstanding(): bool
    {
        return $this->hasAnyAcl(self::OUTSTANDING_ACLS);
    }

    public function canViewInsuranceVault(): bool
    {
        return $this->hasAnyAcl(self::INSURANCE_ACLS);
    }

    public function assertHubAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canReadHub()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertCorrectAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canCorrectCharges()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertPaymentAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canManagePayments()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertCloseAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->canCloseDay()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function assertOutstandingAccess(): void
    {
        $this->assertHubEnabled();
        if (!$this->isOutstandingEnabled()) {
            throw new \RuntimeException('Outstanding balances are not enabled', 403);
        }
        if (!$this->canViewOutstanding()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    public function modulePublicUrl(): string
    {
        $webroot = $GLOBALS['webroot'] ?? '';

        return $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public';
    }

    public function chargeCorrectionUrl(int $visitId): string
    {
        return $this->modulePublicUrl() . '/bill-ops/correct.php?visit_id=' . urlencode((string) $visitId);
    }

    /**
     * M5-F10 — cashier Advanced billing / fee sheet routing.
     *
     * @return array{url: string, label: string, external: bool}
     */
    public function advancedBillingLink(int $visitId, int $encounter, ?int $facilityId = null, int $pid = 0): array
    {
        if (!$this->isHubEnabled($facilityId)) {
            // 2026-07-18: stock encounter_top is no longer a destination — the fee
            // sheet renders through the clinical-form-bridge in module chrome, with
            // the same per-form ACL (registry aco_spec encounters|coding).
            $modulePublic = $this->modulePublicUrl();

            return [
                'url' => $modulePublic . '/clinical-form-bridge.php?' . http_build_query([
                    'pid' => (string) $pid,
                    'encounter' => (string) $encounter,
                    'formname' => 'fee_sheet',
                    'return' => $modulePublic . '/cashier.php',
                ]),
                'label' => 'Open fee sheet',
                'external' => true,
            ];
        }

        if ($this->canCorrectCharges()) {
            return [
                'url' => $this->chargeCorrectionUrl($visitId),
                'label' => 'Billing back office',
                'external' => false,
            ];
        }

        return [
            'url' => $this->modulePublicUrl() . '/bill-ops/index.php?tab=corrections',
            'label' => 'Billing back office',
            'external' => false,
        ];
    }

    /**
     * M11 — Chart Depth payment history **Add correction** (D-FIN-7).
     *
     * @return array{visible: bool, url: string|null, label: string|null}
     */
    public function addCorrectionLink(?int $visitId, ?int $facilityId = null): array
    {
        if ($visitId === null || $visitId <= 0 || !$this->isHubEnabled($facilityId) || !$this->canCorrectCharges()) {
            return [
                'visible' => false,
                'url' => null,
                'label' => null,
            ];
        }

        return [
            'visible' => true,
            'url' => $this->chargeCorrectionUrl($visitId),
            'label' => 'Add correction',
        ];
    }

    /**
     * @param array<int, string> $acos
     */
    private function hasAnyAcl(array $acos): bool
    {
        foreach ($acos as $aco) {
            if ($this->hasAcl($aco)) {
                return true;
            }
        }

        return false;
    }

    private function hasAcl(string $aco): bool
    {
        if ($this->aclChecker !== null) {
            return ($this->aclChecker)('new_clinic', $aco);
        }

        return AclMain::aclCheckCore('new_clinic', $aco);
    }
}
