<?php

/**
 * MKT-MIG-1 — self-serve patient demographics CSV import (Admin Hub)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Services\PatientService;

class PatientImportService
{
    public const MAX_CHUNK_ROWS = 200;

    /** @var list<string> */
    public const IMPORT_FIELDS = [
        'fname', 'lname', 'mname', 'sex', 'dob', 'phone',
        'street', 'old_clinic_number', 'national_id',
    ];

    private const DEFAULT_PHONE_REGEX = '^0[235]\d{8}$';

    public function __construct(
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly VisitScopeService $visitScope = new VisitScopeService(),
    ) {
    }

    /**
     * Trim, validate, and normalize one mapped CSV row. Never touches the DB.
     *
     * @param array<string, mixed> $row
     * @return array{ok: bool, reason: string, data: array<string, string>}
     */
    public function normalizeRow(array $row): array
    {
        $d = [];
        foreach (self::IMPORT_FIELDS as $field) {
            $d[$field] = trim((string) ($row[$field] ?? ''));
        }

        if ($d['fname'] === '' || strlen($d['lname']) < 2) {
            return $this->bad('First name and last name (at least 2 letters) are required');
        }
        foreach (['fname', 'lname', 'mname'] as $nameField) {
            if (mb_strlen($d[$nameField]) > 80) {
                return $this->bad('Name is too long (80 characters max)');
            }
        }
        if (mb_strlen($d['street']) > 255) {
            $d['street'] = mb_substr($d['street'], 0, 255);
        }
        if (mb_strlen($d['old_clinic_number']) > 40) {
            return $this->bad('Old clinic number is too long (40 characters max)');
        }
        if (mb_strlen($d['national_id']) > 40) {
            return $this->bad('National ID is too long (40 characters max)');
        }

        $sex = $this->normalizeSex($d['sex']);
        if ($sex === null) {
            return $this->bad('Sex not recognized — use M, F, Male, or Female (or leave blank)');
        }
        $d['sex'] = $sex;

        if ($d['dob'] !== '') {
            $dob = $this->parseDob($d['dob']);
            if ($dob === null) {
                if (preg_match('~\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2}$~', $d['dob']) === 1) {
                    return $this->bad('Date of birth needs a 4-digit year (example: 12/03/1988)');
                }

                return $this->bad('Date of birth not understood — use day/month/year (12/03/1988) or 1988-03-12');
            }
            $d['dob'] = $dob;
        }

        if ($d['phone'] !== '') {
            $normalized = $this->phoneNormalizer->normalize($d['phone']);
            $pattern = $this->safePhoneRegex(
                (string) ($this->config->get('phone_validation_regex', self::DEFAULT_PHONE_REGEX) ?? self::DEFAULT_PHONE_REGEX)
            );
            if (@preg_match('/' . $pattern . '/', $normalized) !== 1) {
                return $this->bad('Phone number format not valid for this clinic');
            }
            $d['phone'] = $normalized;
        }

        if ($d['dob'] === '' && $d['phone'] === '') {
            return $this->bad('Each patient needs a date of birth or a phone number');
        }

        return ['ok' => true, 'reason' => '', 'data' => $d];
    }

    /**
     * @param array<string, string> $data normalized row data
     * @param array{name_dob: array<string, true>, name_phone: array<string, true>, national_id: array<string, true>} $index
     * @return string '' when not a duplicate, else the plain-English reason
     */
    public function resolveDuplicate(array $data, array $index): string
    {
        $keys = $this->indexKeysFor($data);

        if ($keys['national_id'] !== '' && isset($index['national_id'][$keys['national_id']])) {
            return 'National ID already belongs to a patient in the system';
        }
        if ($keys['name_dob'] !== '' && isset($index['name_dob'][$keys['name_dob']])) {
            return 'A patient with the same name and date of birth already exists';
        }
        if ($keys['name_phone'] !== '' && isset($index['name_phone'][$keys['name_phone']])) {
            return 'A patient with the same name and phone number already exists';
        }

        return '';
    }

    /**
     * @param array<string, string> $data
     * @return array{name_dob: string, name_phone: string, national_id: string}
     */
    public function indexKeysFor(array $data): array
    {
        $name = mb_strtolower(trim((string) ($data['fname'] ?? '')))
            . '|' . mb_strtolower(trim((string) ($data['lname'] ?? '')));
        $dob = trim((string) ($data['dob'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        $nationalId = trim((string) ($data['national_id'] ?? ''));

        return [
            'name_dob' => $dob !== '' ? $name . '|' . $dob : '',
            'name_phone' => $phone !== '' ? $name . '|' . $phone : '',
            'national_id' => $nationalId,
        ];
    }

    /** @return array{ok: bool, reason: string, data: array<string, string>} */
    private function bad(string $reason): array
    {
        return ['ok' => false, 'reason' => $reason, 'data' => []];
    }

    /** @return string|null Male|Female|'' on success, null when unrecognized */
    private function normalizeSex(string $sex): ?string
    {
        $map = ['' => '', 'm' => 'Male', 'male' => 'Male', 'f' => 'Female', 'female' => 'Female'];

        return $map[mb_strtolower($sex)] ?? null;
    }

    /** @return string|null Y-m-d on success */
    private function parseDob(string $raw): ?string
    {
        $day = 0;
        $month = 0;
        $year = 0;
        if (preg_match('~^(\d{4})-(\d{1,2})-(\d{1,2})$~', $raw, $m) === 1) {
            [, $y, $mo, $dy] = $m;
            $year = (int) $y;
            $month = (int) $mo;
            $day = (int) $dy;
        } elseif (preg_match('~^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$~', $raw, $m) === 1) {
            // Day-first, per the regional rule (DD/MM/YYYY).
            [, $dy, $mo, $y] = $m;
            $year = (int) $y;
            $month = (int) $mo;
            $day = (int) $dy;
        } else {
            return null;
        }

        if ($year < 1900 || !checkdate($month, $day, $year)) {
            return null;
        }
        $iso = sprintf('%04d-%02d-%02d', $year, $month, $day);
        if ($iso > date('Y-m-d')) {
            return null;
        }

        return $iso;
    }

    private function safePhoneRegex(string $pattern): string
    {
        if ($pattern === '' || strlen($pattern) > 64 || @preg_match('/' . $pattern . '/', '') === false) {
            return self::DEFAULT_PHONE_REGEX;
        }

        return $pattern;
    }

    /**
     * Process one chunk of mapped rows. Dry run and commit share this path;
     * $dryRun disables the writes only. The duplicate index is rebuilt from the
     * DB per request (stateless), so rows committed by earlier chunks are seen.
     *
     * @param array<int, array<string, mixed>> $rows each with 'row_number' plus IMPORT_FIELDS
     * @return array{results: array<int, array<string, mixed>>, summary: array<string, int>}
     */
    public function processChunk(array $rows, bool $dryRun, int $actorUserId, int $facilityId): array
    {
        if (count($rows) > self::MAX_CHUNK_ROWS) {
            throw new \InvalidArgumentException('Too many rows in one request (max ' . self::MAX_CHUNK_ROWS . ')');
        }

        $index = $this->buildDuplicateIndex();
        $results = [];
        $summary = ['processed' => 0, 'ok' => 0, 'duplicates' => 0, 'errors' => 0];

        foreach ($rows as $row) {
            $rowNumber = (int) ($row['row_number'] ?? 0);
            $summary['processed']++;

            $normalized = $this->normalizeRow($row);
            $displayName = trim(((string) ($row['fname'] ?? '')) . ' ' . ((string) ($row['lname'] ?? '')));
            if (!$normalized['ok']) {
                $summary['errors']++;
                $results[] = ['row_number' => $rowNumber, 'status' => 'error', 'reason' => $normalized['reason'], 'name' => $displayName, 'pid' => null];
                continue;
            }

            $data = $normalized['data'];
            $dupReason = $this->resolveDuplicate($data, $index);
            if ($dupReason !== '') {
                $summary['duplicates']++;
                $results[] = ['row_number' => $rowNumber, 'status' => 'duplicate', 'reason' => $dupReason, 'name' => $displayName, 'pid' => null];
                continue;
            }

            $pid = null;
            if (!$dryRun) {
                $pid = $this->insertPatient($data, $facilityId);
            }

            // Keep in-chunk repeats from double-importing (and from double-counting in dry run).
            foreach ($this->indexKeysFor($data) as $bucket => $key) {
                if ($key !== '') {
                    $index[$bucket][$key] = true;
                }
            }

            $summary['ok']++;
            $results[] = [
                'row_number' => $rowNumber,
                'status' => $dryRun ? 'ok' : 'imported',
                'reason' => '',
                'name' => $displayName,
                'pid' => $pid,
            ];
        }

        if (!$dryRun) {
            EventAuditLogger::getInstance()->newEvent(
                'new_clinic',
                'admin.patient_import.chunk',
                $actorUserId,
                1,
                'imported=' . $summary['ok'] . ' duplicates=' . $summary['duplicates'] . ' errors=' . $summary['errors']
            );
        }

        return ['results' => $results, 'summary' => $summary];
    }

    /**
     * One bounded query over patient_data → in-memory match keys. Admin-only,
     * user-triggered, never on a poll timer (SCALE R-rules).
     *
     * @return array{name_dob: array<string, true>, name_phone: array<string, true>, national_id: array<string, true>}
     */
    private function buildDuplicateIndex(): array
    {
        $rows = QueryUtils::fetchRecords(
            "SELECT fname, lname, DOB, phone_normalized, ss FROM patient_data"
        ) ?: [];

        $index = ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
        foreach ($rows as $row) {
            $keys = $this->indexKeysFor([
                'fname' => (string) ($row['fname'] ?? ''),
                'lname' => (string) ($row['lname'] ?? ''),
                'dob' => (string) ($row['DOB'] ?? ''),
                'phone' => (string) ($row['phone_normalized'] ?? ''),
                'national_id' => (string) ($row['ss'] ?? ''),
            ]);
            foreach ($keys as $bucket => $key) {
                if ($key !== '') {
                    $index[$bucket][$key] = true;
                }
            }
        }

        return $index;
    }

    /**
     * Create the patient the same way M1b registration does (parity: same
     * PatientService path, phone_normalized, meta row, dup score refresh).
     *
     * @param array<string, string> $d normalized row data
     */
    private function insertPatient(array $d, int $facilityId): int
    {
        $patientData = [
            'fname' => $d['fname'],
            'lname' => $d['lname'],
            'mname' => $d['mname'],
            'sex' => $d['sex'],
            'phone_cell' => $d['phone'],
            'street' => $d['street'],
            'country_code' => 'GH',
        ];
        if ($d['dob'] !== '') {
            $patientData['DOB'] = $d['dob'];
        }
        if ($d['national_id'] !== '') {
            $patientData['ss'] = $d['national_id'];
        }

        $result = (new PatientService())->insert($patientData);
        if (!$result->isValid() || !$result->hasData()) {
            throw new \InvalidArgumentException('Could not create patient');
        }
        $pid = (int) $result->getFirstDataResult()['pid'];

        if ($d['phone'] !== '') {
            QueryUtils::sqlStatementThrowException(
                "UPDATE patient_data SET phone_normalized = ? WHERE pid = ?",
                [$d['phone'], $pid]
            );
        }
        // No facility_id write here: patient_data has no facility_id column in
        // this schema (confirmed via SHOW COLUMNS), and M1b registration
        // (PatientRegistrationService::createSectionOne) never sets one either.
        // $facilityId is accepted for interface parity with processChunk() and
        // for any future facility-aware write, but is intentionally unused now.

        QueryUtils::sqlInsert(
            "INSERT INTO new_patient_meta (pid, dob_estimated, disability_flag, insurance_type, old_clinic_number)
             VALUES (?, 0, 0, 'cash', ?)",
            [$pid, $d['old_clinic_number'] !== '' ? $d['old_clinic_number'] : null]
        );

        require_once $GLOBALS['fileroot'] . '/library/patient.inc.php';
        updateDupScore($pid);

        return $pid;
    }
}
