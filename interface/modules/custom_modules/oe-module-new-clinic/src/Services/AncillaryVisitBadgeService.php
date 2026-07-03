<?php

/**
 * Visit Board ancillary badges (PRD §6.8.6)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class AncillaryVisitBadgeService
{
    public const BADGE_LAB_DIRECT = 'lab_direct';
    public const BADGE_PHARMACY_WALKIN = 'pharmacy_walkin';
    public const BADGE_REFERRAL_ON_FILE = 'referral_on_file';
    public const BADGE_REFERRED_TO_OPD = 'referred_to_opd';

    public const ALL_BADGES = [
        self::BADGE_LAB_DIRECT,
        self::BADGE_PHARMACY_WALKIN,
        self::BADGE_REFERRAL_ON_FILE,
        self::BADGE_REFERRED_TO_OPD,
    ];

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isFeatureEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_ancillary_services', 0, $facilityId) === 1;
    }

    /**
     * @param array<string, mixed> $row
     * @return list<string>
     */
    public function badgesForRow(array $row, bool $referredToOpd = false): array
    {
        $facilityId = (int) ($row['facility_id'] ?? 0);
        if (!$this->isFeatureEnabled($facilityId)) {
            return [];
        }

        $badges = [];
        $profile = (string) ($row['service_profile'] ?? 'full_opd');

        if ($profile === 'lab_direct') {
            $badges[] = self::BADGE_LAB_DIRECT;
        } elseif ($profile === 'pharmacy_walkin') {
            $badges[] = self::BADGE_PHARMACY_WALKIN;
        }

        $referralDocId = $row['referral_document_id'] ?? null;
        if ($referralDocId !== null && $referralDocId !== '' && (int) $referralDocId > 0) {
            $badges[] = self::BADGE_REFERRAL_ON_FILE;
        }

        if ($referredToOpd) {
            $badges[] = self::BADGE_REFERRED_TO_OPD;
        }

        return $badges;
    }

    /**
     * @param array<int, int> $visitIds
     * @return array<int, bool>
     */
    public function batchReferredToOpd(array $visitIds): array
    {
        $visitIds = array_values(array_unique(array_filter($visitIds, fn ($id) => $id > 0)));
        if ($visitIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($visitIds), '?'));
        $rows = QueryUtils::fetchRecords(
            "SELECT DISTINCT opd.id AS visit_id
             FROM new_visit opd
             INNER JOIN new_visit pharm ON pharm.referred_to_visit_id = opd.id
             WHERE opd.id IN ({$placeholders})
               AND pharm.service_profile = 'pharmacy_walkin'
               AND pharm.pharmacy_outcome = 'rx_required_refer_to_opd'",
            $visitIds
        ) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $map[(int) ($row['visit_id'] ?? 0)] = true;
        }

        return $map;
    }

    public function isReferredToOpd(int $visitId): bool
    {
        if ($visitId <= 0) {
            return false;
        }

        $map = $this->batchReferredToOpd([$visitId]);

        return !empty($map[$visitId]);
    }

    /**
     * @param array<string, mixed> $row
     */
    public function shouldCheckReferredToOpd(array $row): bool
    {
        $profile = (string) ($row['service_profile'] ?? 'full_opd');

        return $profile === '' || $profile === 'full_opd';
    }
}
