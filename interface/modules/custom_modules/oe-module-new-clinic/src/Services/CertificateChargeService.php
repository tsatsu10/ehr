<?php

/**
 * Post the medical-certificate fee to encounter billing when a certificate
 * is issued (Clinic Setup option `certificate_auto_bill`, default OFF).
 *
 * The amount lives where every other price lives: the clinic's fee schedule,
 * under the reserved code MED_CERT. Posting is idempotent per encounter —
 * the supersede flow (new number after print) never double-charges. Mirrors
 * LabOrderChargeService (M12 §16.2 auto-bill pattern).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Billing\BillingUtilities;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;

class CertificateChargeService
{
    /** Reserved fee-schedule code for the certificate fee. */
    public const FEE_CODE = 'MED_CERT';

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isAutoBillEnabled(int $facilityId): bool
    {
        return $this->config->getInt('certificate_auto_bill', 0, $facilityId) === 1;
    }

    /**
     * Post the certificate fee for this encounter, once.
     *
     * @return array{enabled: bool, posted: bool, already_billed: bool, missing_fee: bool, amount: float, currency_symbol: string}
     */
    public function postCertificateCharge(
        int $pid,
        int $encounter,
        int $providerId,
        int $facilityId,
        int $actorUserId
    ): array {
        $result = [
            'enabled' => false,
            'posted' => false,
            'already_billed' => false,
            'missing_fee' => false,
            'amount' => 0.0,
            'currency_symbol' => (string) $this->config->get('currency_symbol', 'GH₵', $facilityId),
        ];

        if (!$this->isAutoBillEnabled($facilityId) || $pid <= 0 || $encounter <= 0) {
            return $result;
        }
        $result['enabled'] = true;

        $fee = QueryUtils::querySingleRow(
            'SELECT name, price_amount, code_type, billing_code
             FROM new_fee_schedule
             WHERE facility_id = ? AND code = ? AND is_active = 1
             LIMIT 1',
            [$facilityId, self::FEE_CODE]
        );
        if (!is_array($fee) || (float) ($fee['price_amount'] ?? 0) <= 0) {
            // Toggle on but no active MED_CERT price — surface it so the admin
            // adds the fee-schedule row instead of silently not charging.
            $result['missing_fee'] = true;

            return $result;
        }

        $billingCode = (string) ($fee['billing_code'] ?? self::FEE_CODE);
        $existing = QueryUtils::querySingleRow(
            'SELECT id FROM billing WHERE pid = ? AND encounter = ? AND code = ? AND activity = 1 LIMIT 1',
            [$pid, $encounter, $billingCode]
        );
        if (is_array($existing) && !empty($existing['id'])) {
            $result['already_billed'] = true;

            return $result;
        }

        $amount = round((float) $fee['price_amount'], 2);
        BillingUtilities::addBilling(
            $encounter,
            (string) ($fee['code_type'] ?? 'CPT4'),
            $billingCode,
            (string) ($fee['name'] ?? 'Medical certificate'),
            $pid,
            '1',
            $providerId,
            '',
            '1',
            (string) $amount,
            '',
            '',
            0,
            '',
            '',
            '',
            ''
        );

        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'clinical_doc.certificate_charge_posted',
            $actorUserId,
            1,
            'pid=' . $pid . ' encounter=' . $encounter . ' amount=' . $amount
        );

        $result['posted'] = true;
        $result['amount'] = $amount;

        return $result;
    }
}
