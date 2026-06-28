<?php

/**
 * Real-time duplicate scoring for registration (M1b / DUP-F01–F04)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class PatientDuplicateService
{
    public function __construct(
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * @return array{max_score: int, level: string, candidates: array<int, array<string, mixed>>}
     */
    public function scoreProspect(array $fields, ?int $excludePid = null): array
    {
        $fname = trim((string) ($fields['fname'] ?? ''));
        $lname = trim((string) ($fields['lname'] ?? ''));
        $sex = trim((string) ($fields['sex'] ?? ''));
        $dob = trim((string) ($fields['DOB'] ?? ''));
        $phone = $this->phoneNormalizer->normalize((string) ($fields['phone'] ?? ''));
        $nationalId = trim((string) ($fields['national_id'] ?? ''));

        if ($fname === '' && $lname === '' && $phone === '' && $dob === '' && $nationalId === '') {
            return ['max_score' => 0, 'level' => 'none', 'candidates' => []];
        }

        $phoneDigits = preg_replace('/\D+/', '', $phone) ?? '';
        $excludeSql = $excludePid !== null && $excludePid > 0 ? ' AND scored.pid != ?' : '';
        $excludeBind = $excludePid !== null && $excludePid > 0 ? [$excludePid] : [];

        $sql = "SELECT scored.pid, scored.fname, scored.lname, scored.pubpid, scored.DOB, scored.sex, scored.dupscore
                FROM (
                    SELECT p2.pid, p2.fname, p2.lname, p2.pubpid, p2.DOB, p2.sex,
                    (
                        6 * (? != '' AND p2.DOB IS NOT NULL AND p2.DOB = ?) +
                        6 * (? != '' AND ? != '' AND LOWER(CONCAT(TRIM(?), TRIM(?))) = LOWER(CONCAT(TRIM(p2.fname), TRIM(p2.lname)))) +
                        6 * (? != '' AND TRIM(p2.sex) != '' AND TRIM(p2.sex) = ?) +
                        2 * (SOUNDEX(?) = SOUNDEX(p2.lname)) +
                        1 * (
                            ? != '' AND (
                                REPLACE(REPLACE(p2.phone_cell, '-', ''), ' ', '') = ?
                                OR REPLACE(REPLACE(p2.phone_home, '-', ''), ' ', '') = ?
                                OR REPLACE(REPLACE(p2.phone_biz, '-', ''), ' ', '') = ?
                                OR p2.phone_normalized = ?
                                OR EXISTS (
                                    SELECT 1 FROM new_patient_meta m
                                    WHERE m.pid = p2.pid
                                    AND REPLACE(REPLACE(m.reach_contact_phone, '-', ''), ' ', '') = ?
                                )
                            )
                        ) +
                        8 * (? != '' AND TRIM(p2.ss) != '' AND TRIM(p2.ss) = ?)
                    ) AS dupscore
                    FROM patient_data p2
                ) scored
                WHERE scored.dupscore > 0{$excludeSql}
                ORDER BY scored.dupscore DESC, scored.pid DESC
                LIMIT 3";

        $bind = array_merge([
            $dob, $dob,
            $fname, $lname, $fname, $lname,
            $sex, $sex,
            $lname,
            $phoneDigits, $phoneDigits, $phoneDigits, $phoneDigits, $phone, $phoneDigits,
            $nationalId, $nationalId,
        ], $excludeBind);

        $rows = QueryUtils::fetchRecords($sql, $bind) ?: [];

        $maxScore = 0;
        $candidates = [];
        foreach ($rows as $row) {
            $score = (int) ($row['dupscore'] ?? 0);
            $maxScore = max($maxScore, $score);
            $candidates[] = [
                'pid' => (int) $row['pid'],
                'display_name' => trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? '')),
                'pubpid' => (string) ($row['pubpid'] ?? ''),
                'sex' => (string) ($row['sex'] ?? ''),
                'DOB' => (string) ($row['DOB'] ?? ''),
                'score' => $score,
            ];
        }

        $blockThreshold = $this->config->getInt('dup_block_threshold', 17);
        $warnThreshold = $this->config->getInt('dup_warn_threshold', 10);

        $level = 'none';
        if ($maxScore >= $blockThreshold) {
            $level = 'block';
        } elseif ($maxScore >= $warnThreshold) {
            $level = 'warn';
        }

        return [
            'max_score' => $maxScore,
            'level' => $level,
            'candidates' => $candidates,
        ];
    }

    public function getBlockThreshold(): int
    {
        return $this->config->getInt('dup_block_threshold', 17);
    }
}
