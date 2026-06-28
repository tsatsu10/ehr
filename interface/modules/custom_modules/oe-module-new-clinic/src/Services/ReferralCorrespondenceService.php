<?php

/**
 * Referral correspondence read models (M11-F08 / CDb façade)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class ReferralCorrespondenceService
{
    public const PAGE_SIZE = 20;

    public function __construct(
        private readonly FacilityScopeService $facilityScope = new FacilityScopeService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function getClinicalStrip(int $pid, ?int $encounterId = null): array
    {
        $this->facilityScope->assertPatientAccessible($pid);

        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        $webroot = $GLOBALS['webroot'] ?? '';
        $encounterId = $this->resolveEncounterId($pid, $encounterId);

        if (!$this->isReferralStripEnabled($facilityId) || $encounterId <= 0) {
            return $this->hiddenStripPayload($webroot, $pid, $encounterId);
        }

        $visitDate = $this->resolveVisitDateForEncounter($pid, $encounterId);
        $items = $this->fetchReferralItems($pid, $visitDate, 5);
        $canManage = AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral');
        $hubUrl = $webroot
            . '/interface/modules/custom_modules/oe-module-new-clinic/public/chart-depth/referrals.php?pid='
            . urlencode((string) $pid)
            . '&encounter_id='
            . urlencode((string) $encounterId);

        return [
            'hidden' => $items === [],
            'encounter_id' => $encounterId,
            'items' => $items,
            'has_active_draft' => $this->hasDraftItem($items),
            'can_open_referrals' => $canManage || AclMain::aclCheckCore('new_clinic', 'new_chart_depth'),
            'can_create_referral' => $canManage,
            'open_referrals_url' => $canManage || AclMain::aclCheckCore('new_clinic', 'new_chart_depth')
                ? $hubUrl
                : null,
            'stock_transactions_url' => $webroot
                . '/interface/patient_file/transaction/transactions.php?set_pid='
                . urlencode((string) $pid),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getReferralsList(
        int $pid,
        int $offset = 0,
        int $limit = self::PAGE_SIZE,
        ?int $encounterId = null
    ): array {
        $this->facilityScope->assertPatientAccessible($pid);
        $this->assertReferralEnabled();

        $limit = min(max($limit, 1), 50);
        $offset = max($offset, 0);
        $visitDate = null;
        if ($encounterId !== null && $encounterId > 0) {
            $visitDate = $this->resolveVisitDateForEncounter($pid, $encounterId);
        }

        $total = $this->countReferrals($pid, $visitDate);
        $items = $this->fetchReferralItems($pid, $visitDate, $limit, $offset);
        $webroot = $GLOBALS['webroot'] ?? '';
        $canManage = AclMain::aclCheckCore('new_clinic', 'new_chart_depth_referral');

        return [
            'pid' => $pid,
            'encounter_id' => $encounterId,
            'items' => array_map(function (array $item) use ($webroot, $canManage): array {
                $item['print_url'] = $canManage
                    ? $webroot . '/interface/patient_file/transaction/print_referral.php?transid='
                        . urlencode((string) ($item['transaction_id'] ?? 0))
                    : null;
                $item['edit_url'] = $canManage
                    ? $webroot . '/interface/patient_file/transaction/add_transaction.php?transid='
                        . urlencode((string) ($item['transaction_id'] ?? 0))
                        . '&title=LBTref&inmode=edit'
                    : null;

                return $item;
            }, $items),
            'total' => $total,
            'offset' => $offset,
            'limit' => $limit,
            'has_more' => ($offset + count($items)) < $total,
            'can_create_referral' => $canManage,
            'create_referral_url' => $canManage
                ? $webroot . '/interface/patient_file/transaction/add_transaction.php?title=LBTref'
                : null,
        ];
    }

    private function isReferralStripEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_chart_depth', 0, $facilityId) === 1
            && $this->config->getInt('enable_chart_depth_referral', 0, $facilityId) === 1;
    }

    private function assertReferralEnabled(): void
    {
        $facilityId = $this->visitScope->resolveDefaultFacilityId();
        if (!$this->isReferralStripEnabled($facilityId)) {
            throw new \RuntimeException('Chart depth referrals are not enabled', 403);
        }
    }

    private function resolveEncounterId(int $pid, ?int $encounterId): int
    {
        return $this->visitScope->resolveActiveEncounterId($pid, $encounterId);
    }

    private function resolveVisitDateForEncounter(int $pid, int $encounterId): ?string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT visit_date FROM new_visit WHERE pid = ? AND encounter = ? ORDER BY id DESC LIMIT 1',
            [$pid, $encounterId]
        );

        if (!is_array($row)) {
            return null;
        }

        $date = (string) ($row['visit_date'] ?? '');

        return $date !== '' && $date !== '0000-00-00' ? $date : null;
    }

    private function countReferrals(int $pid, ?string $visitDate): int
    {
        $bind = [$pid];
        $dateFilter = $this->buildVisitDateFilter($visitDate, $bind);

        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(DISTINCT t.id) AS cnt
             FROM transactions t
             WHERE t.pid = ? AND t.title = 'LBTref'{$dateFilter}",
            $bind
        );

        return is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchReferralItems(int $pid, ?string $visitDate, int $limit, int $offset = 0): array
    {
        $bind = [$pid];
        $dateFilter = $this->buildVisitDateFilter($visitDate, $bind);

        $rows = QueryUtils::fetchRecords(
            "SELECT t.id, t.date, t.user,
                    MAX(CASE WHEN ld.field_id = 'refer_to' THEN ld.field_value END) AS refer_to,
                    MAX(CASE WHEN ld.field_id = 'refer_date' THEN ld.field_value END) AS refer_date,
                    MAX(CASE WHEN ld.field_id = 'body' THEN ld.field_value END) AS body
             FROM transactions t
             LEFT JOIN lbt_data ld ON ld.form_id = t.id
             WHERE t.pid = ? AND t.title = 'LBTref'{$dateFilter}
             GROUP BY t.id, t.date, t.user
             ORDER BY COALESCE(MAX(CASE WHEN ld.field_id = 'refer_date' THEN ld.field_value END), t.date) DESC,
                      t.id DESC
             LIMIT " . (int) $limit . ' OFFSET ' . (int) $offset,
            $bind
        ) ?: [];

        return array_map(fn (array $row): array => $this->mapReferralRow($row), $rows);
    }

    /**
     * @param array<int, mixed> $bind
     */
    private function buildVisitDateFilter(?string $visitDate, array &$bind): string
    {
        if ($visitDate === null || $visitDate === '') {
            return '';
        }

        $bind[] = $visitDate;
        $bind[] = $visitDate;

        return " AND (
            EXISTS (
                SELECT 1 FROM lbt_data ld2
                WHERE ld2.form_id = t.id AND ld2.field_id = 'refer_date' AND ld2.field_value = ?
            )
            OR DATE(t.date) = ?
        )";
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapReferralRow(array $row): array
    {
        $referTo = trim((string) ($row['refer_to'] ?? ''));
        $body = trim((string) ($row['body'] ?? ''));
        $label = $referTo !== '' ? $referTo : ($body !== '' ? $this->clipText($body, 60) : 'Referral');
        $status = $referTo === '' ? 'Draft' : 'Issued';
        $occurredAt = trim((string) ($row['refer_date'] ?? ''));
        if ($occurredAt === '' || $occurredAt === '0000-00-00') {
            $occurredAt = (string) ($row['date'] ?? '');
        }

        return [
            'transaction_id' => (int) ($row['id'] ?? 0),
            'label' => $label,
            'status' => $status,
            'occurred_at' => $this->formatDate($occurredAt),
            'author' => trim((string) ($row['user'] ?? '')),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $items
     */
    private function hasDraftItem(array $items): bool
    {
        foreach ($items as $item) {
            if (($item['status'] ?? '') === 'Draft') {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function hiddenStripPayload(string $webroot, int $pid, int $encounterId): array
    {
        return [
            'hidden' => true,
            'encounter_id' => $encounterId > 0 ? $encounterId : null,
            'items' => [],
            'has_active_draft' => false,
            'can_open_referrals' => false,
            'can_create_referral' => false,
            'open_referrals_url' => null,
            'stock_transactions_url' => $webroot
                . '/interface/patient_file/transaction/transactions.php?set_pid='
                . urlencode((string) $pid),
        ];
    }

    private function clipText(string $value, int $max): string
    {
        if (strlen($value) <= $max) {
            return $value;
        }

        return substr($value, 0, $max - 1) . '…';
    }

    private function formatDate(?string $date): ?string
    {
        if (empty($date) || str_starts_with((string) $date, '0000-00-00')) {
            return null;
        }

        try {
            return (new \DateTime($date))->format('j M Y');
        } catch (\Exception) {
            return null;
        }
    }
}
