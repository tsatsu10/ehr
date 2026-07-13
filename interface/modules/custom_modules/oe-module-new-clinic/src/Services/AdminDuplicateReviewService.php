<?php

/**
 * Possible-duplicate patient review for the Admin Hub System lens (GAP-D D2, closes G10).
 *
 * Detection + surfacing only — NOT an automated merge (NG12 stands). Finds existing
 * likely-duplicate PAIRS via bounded, index-friendly self-joins on strong signals
 * (exact name+DOB, exact national ID), and hands each pair off to the stock merge
 * tool (`merge_patients.php`, super-admin gated) through a T1 wrapper. Behind
 * `enable_duplicate_review` (PRD §5.6, default OFF).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class AdminDuplicateReviewService
{
    private const MAX_PAIRS = 50;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isEnabled(?int $facilityId = null): bool
    {
        return $this->config->isEnabled('enable_duplicate_review', 0, $facilityId);
    }

    /**
     * @return array<string, mixed>
     */
    public function getReview(): array
    {
        if (!$this->isEnabled()) {
            return ['enabled' => false, 'pairs' => [], 'capped' => false, 'merge_base_url' => ''];
        }

        $pairs = $this->findDuplicatePairs();
        $webroot = rtrim((string) ($GLOBALS['webroot'] ?? ''), '/');

        return [
            'enabled' => true,
            'pairs' => $pairs,
            'capped' => count($pairs) >= self::MAX_PAIRS,
            'merge_base_url' => $webroot . '/interface/modules/custom_modules/oe-module-new-clinic/public/admin-merge-legacy.php',
        ];
    }

    /**
     * Bounded list of likely-duplicate pairs, strongest signal first.
     *
     * @return array<int, array<string, mixed>>
     */
    private function findDuplicatePairs(): array
    {
        $pairs = [];
        $seen = [];

        // Signal 1: exact name+DOB. The self-join is anchored by idx_patient_dob
        // (DOB equality is un-wrapped), so work is bounded by DOB collisions.
        foreach ($this->queryPairs($this->nameDobSql(), 'Same name and date of birth') as $pair) {
            $key = $pair['pid_a'] . '-' . $pair['pid_b'];
            $seen[$key] = true;
            $pairs[] = $pair;
        }
        // Signal 2: exact national ID. patient_data has no index on `ss`, so a
        // self-join would be O(n²); instead find duplicated ss values in one scan,
        // then fetch only those groups' members (bounded).
        if (count($pairs) < self::MAX_PAIRS) {
            foreach ($this->nationalIdPairs() as $pair) {
                $key = $pair['pid_a'] . '-' . $pair['pid_b'];
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $pairs[] = $pair;
                if (count($pairs) >= self::MAX_PAIRS) {
                    break;
                }
            }
        }

        return array_slice($pairs, 0, self::MAX_PAIRS);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function queryPairs(string $sql, string $reason): array
    {
        $rows = QueryUtils::fetchRecords($sql, [self::MAX_PAIRS]) ?: [];

        return array_map(static function (array $row) use ($reason): array {
            return [
                'pid_a' => (int) ($row['pid_a'] ?? 0),
                'name_a' => trim(($row['fname_a'] ?? '') . ' ' . ($row['lname_a'] ?? '')),
                'pubpid_a' => (string) ($row['pubpid_a'] ?? ''),
                'pid_b' => (int) ($row['pid_b'] ?? 0),
                'name_b' => trim(($row['fname_b'] ?? '') . ' ' . ($row['lname_b'] ?? '')),
                'pubpid_b' => (string) ($row['pubpid_b'] ?? ''),
                'dob' => (string) ($row['dob'] ?? ''),
                'reason' => $reason,
            ];
        }, $rows);
    }

    /** Exact (case-insensitive) name + DOB match — the strongest duplicate signal. */
    private function nameDobSql(): string
    {
        return "SELECT a.pid AS pid_a, a.fname AS fname_a, a.lname AS lname_a, a.pubpid AS pubpid_a,
                       b.pid AS pid_b, b.fname AS fname_b, b.lname AS lname_b, b.pubpid AS pubpid_b,
                       a.DOB AS dob
                FROM patient_data a
                JOIN patient_data b
                  ON b.pid > a.pid
                 AND LOWER(TRIM(a.lname)) = LOWER(TRIM(b.lname))
                 AND LOWER(TRIM(a.fname)) = LOWER(TRIM(b.fname))
                 AND a.DOB = b.DOB
                WHERE a.DOB IS NOT NULL AND a.DOB <> '0000-00-00'
                  AND TRIM(a.lname) <> '' AND TRIM(a.fname) <> ''
                ORDER BY a.lname, a.fname, a.pid
                LIMIT ?";
    }

    /**
     * Exact non-empty national ID (ss) pairs, O(n): one aggregate scan to find
     * duplicated ss values, then a bounded fetch of just those groups' members,
     * paired in PHP. Avoids the index-less O(n²) self-join on `ss`.
     *
     * @return array<int, array<string, mixed>>
     */
    private function nationalIdPairs(): array
    {
        $dupSs = QueryUtils::fetchRecords(
            "SELECT ss FROM patient_data WHERE ss <> '' GROUP BY ss HAVING COUNT(*) > 1 LIMIT ?",
            [self::MAX_PAIRS]
        ) ?: [];
        if (empty($dupSs)) {
            return [];
        }
        $ssValues = array_values(array_filter(array_map(static fn ($r) => (string) ($r['ss'] ?? ''), $dupSs)));
        if (empty($ssValues)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ssValues), '?'));
        $members = QueryUtils::fetchRecords(
            "SELECT pid, fname, lname, pubpid, DOB, ss
             FROM patient_data
             WHERE ss IN ($placeholders)
             ORDER BY ss, pid",
            $ssValues
        ) ?: [];

        // Group members by ss and emit every unordered pair within each group.
        $groups = [];
        foreach ($members as $m) {
            $groups[(string) ($m['ss'] ?? '')][] = $m;
        }

        $pairs = [];
        foreach ($groups as $group) {
            $count = count($group);
            for ($i = 0; $i < $count; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    $pairs[] = $this->pairRow($group[$i], $group[$j], 'Same national ID');
                    if (count($pairs) >= self::MAX_PAIRS) {
                        return $pairs;
                    }
                }
            }
        }

        return $pairs;
    }

    /**
     * @param array<string, mixed> $a
     * @param array<string, mixed> $b
     * @return array<string, mixed>
     */
    private function pairRow(array $a, array $b, string $reason): array
    {
        return [
            'pid_a' => (int) ($a['pid'] ?? 0),
            'name_a' => trim(($a['fname'] ?? '') . ' ' . ($a['lname'] ?? '')),
            'pubpid_a' => (string) ($a['pubpid'] ?? ''),
            'pid_b' => (int) ($b['pid'] ?? 0),
            'name_b' => trim(($b['fname'] ?? '') . ' ' . ($b['lname'] ?? '')),
            'pubpid_b' => (string) ($b['pubpid'] ?? ''),
            'dob' => (string) ($a['DOB'] ?? ''),
            'reason' => $reason,
        ];
    }
}
