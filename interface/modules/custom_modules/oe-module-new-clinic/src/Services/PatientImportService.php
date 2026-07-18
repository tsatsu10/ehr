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
use OpenEMR\Modules\NewClinic\Exceptions\PatientImportValidationException;
use OpenEMR\Services\PatientService;
use OpenEMR\Validators\ProcessingResult;

class PatientImportService
{
    public const MAX_CHUNK_ROWS = 200;

    /** Circuit breaker (Task C): stop the chunk after this many CONSECUTIVE insert failures. */
    private const MAX_CONSECUTIVE_FAILURES = 10;

    /** @var list<string> */
    public const IMPORT_FIELDS = [
        'fname', 'lname', 'mname', 'sex', 'dob', 'age', 'phone',
        'street', 'old_clinic_number', 'national_id',
    ];

    private const DEFAULT_PHONE_REGEX = '^0[235]\d{8}$';

    public function __construct(
        private readonly PhoneNormalizer $phoneNormalizer = new PhoneNormalizer(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
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

        // Sex is REQUIRED (audit amendment): core PatientValidator rejects an
        // empty sex at insert, so allowing blank here would pass dry run and
        // fail 100% at commit.
        if ($d['sex'] === '') {
            return $this->bad('Sex is required — use M or F');
        }
        $sex = $this->normalizeSex($d['sex']);
        if ($sex === null) {
            return $this->bad('Sex not recognized — use M, F, Male, or Female');
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

        if ($d['age'] !== '') {
            if (preg_match('~^\d{1,3}$~', $d['age']) !== 1) {
                return $this->bad('Age must be a whole number of years (0-130)');
            }
            $ageYears = (int) $d['age'];
            if ($ageYears > 130) {
                return $this->bad('Age must be a whole number of years (0-130)');
            }
            $d['age'] = (string) $ageYears;
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

        // Identity rule (audit amendment): core PatientValidator requires a DOB
        // at insert, so a phone number alone is no longer sufficient. A row with
        // an age but no DOB gets an estimated DOB of July 1st of the birth year —
        // mirroring PatientRegistrationService::parseSectionOneFields — and is
        // flagged dob_estimated so the chart shows it's not a real birth date.
        if ($d['dob'] !== '') {
            $d['dob_estimated'] = '0';
        } elseif ($d['age'] !== '') {
            $d['dob'] = sprintf('%04d-07-01', (int) date('Y') - (int) $d['age']);
            $d['dob_estimated'] = '1';
        } else {
            return $this->bad('Each patient needs a date of birth or an age');
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
     * $priorKeys seeds that index with identity keys accepted by earlier chunks
     * of the SAME run (dry run or commit) — the caller collects them from each
     * chunk's 'accepted_keys' response and echoes them back — so a repeat that
     * lands in a later chunk is predicted as a duplicate too, not just repeats
     * within one 200-row chunk.
     *
     * @param array<int, array<string, mixed>> $rows each with 'row_number' plus IMPORT_FIELDS
     * @param array{name_dob?: list<string>, name_phone?: list<string>, national_id?: list<string>} $priorKeys
     * @return array{
     *     results: array<int, array<string, mixed>>,
     *     summary: array<string, int>,
     *     stopped: bool,
     *     stopped_reason?: string,
     *     accepted_keys: array{name_dob: list<string>, name_phone: list<string>, national_id: list<string>}
     * }
     */
    public function processChunk(array $rows, bool $dryRun, int $actorUserId, int $facilityId, array $priorKeys = []): array
    {
        if (count($rows) > self::MAX_CHUNK_ROWS) {
            throw new \InvalidArgumentException('Too many rows in one request (max ' . self::MAX_CHUNK_ROWS . ')');
        }

        $index = $this->buildDuplicateIndex();
        foreach (['name_dob', 'name_phone', 'national_id'] as $bucket) {
            foreach ($priorKeys[$bucket] ?? [] as $key) {
                if (is_string($key) && $key !== '') {
                    $index[$bucket][$key] = true;
                }
            }
        }

        $results = [];
        $summary = ['processed' => 0, 'ok' => 0, 'duplicates' => 0, 'errors' => 0];
        $acceptedKeys = ['name_dob' => [], 'name_phone' => [], 'national_id' => []];
        $consecutiveFailures = 0;
        $stopped = false;
        $stoppedReason = '';

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
                try {
                    $pid = $this->insertPatient($data, $facilityId);
                } catch (\Exception $e) {
                    $summary['errors']++;
                    $consecutiveFailures++;
                    $results[] = [
                        'row_number' => $rowNumber,
                        'status' => 'error',
                        'reason' => $this->describeInsertFailure($e, $rowNumber),
                        'name' => $displayName,
                        'pid' => null,
                    ];
                    if ($consecutiveFailures >= self::MAX_CONSECUTIVE_FAILURES) {
                        // Rows already committed earlier in this chunk must still get an
                        // audit event — without this, a breaker trip silently drops the
                        // audit trail for whatever succeeded before the outage started.
                        // The chunk stops here but still returns its real, partial results
                        // to the caller — it no longer throws, so whatever succeeded (or
                        // failed) up to this point is never lost from the UI.
                        $stopped = true;
                        $stoppedReason = 'Import stopped after repeated save failures — fix the reported rows and re-run';
                        $this->logChunkAudit($actorUserId, $summary);
                        break;
                    }
                    continue;
                }
            }
            $consecutiveFailures = 0;

            // Keep in-chunk repeats from double-importing (and from double-counting in dry run).
            foreach ($this->indexKeysFor($data) as $bucket => $key) {
                if ($key !== '') {
                    $index[$bucket][$key] = true;
                    $acceptedKeys[$bucket][] = $key;
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

        if (!$dryRun && !$stopped) {
            $this->logChunkAudit($actorUserId, $summary);
        }

        $payload = ['results' => $results, 'summary' => $summary, 'stopped' => $stopped, 'accepted_keys' => $acceptedKeys];
        if ($stopped) {
            $payload['stopped_reason'] = $stoppedReason;
        }

        return $payload;
    }

    /**
     * Separated from processChunk() so it always fires exactly once per commit
     * chunk (with accurate counts, even when some rows errored) and so tests can
     * no-op it without touching the real audit log.
     *
     * @param array<string, int> $summary
     */
    protected function logChunkAudit(int $actorUserId, array $summary): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            'admin.patient_import.chunk',
            $actorUserId,
            1,
            'imported=' . $summary['ok'] . ' duplicates=' . $summary['duplicates'] . ' errors=' . $summary['errors']
        );
    }

    /**
     * One full-table scan (deliberate, documented exception: admin-only,
     * user-triggered, never on a poll timer) over patient_data → in-memory
     * match keys.
     *
     * @return array{name_dob: array<string, true>, name_phone: array<string, true>, national_id: array<string, true>}
     */
    protected function buildDuplicateIndex(): array
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
    protected function insertPatient(array $d, int $facilityId): int
    {
        // DOB is always present at this point (normalizeRow() guarantees a real
        // or estimated one — the audit amendment's identity rule), so it is
        // always sent: core PatientValidator requires it at insert.
        $patientData = [
            'fname' => $d['fname'],
            'lname' => $d['lname'],
            'mname' => $d['mname'],
            'sex' => $d['sex'],
            'phone_cell' => $d['phone'],
            'street' => $d['street'],
            'country_code' => 'GH',
            'DOB' => $d['dob'],
        ];
        if ($d['national_id'] !== '') {
            $patientData['ss'] = $d['national_id'];
        }

        // Task C: patient insert -> phone_normalized -> meta insert -> dup score
        // refresh are wrapped in one DB transaction so a row that fails partway
        // through never leaves a half-created patient (a patient row with no
        // matching new_patient_meta row) behind. This mirrors the
        // sqlBeginTrans()/sqlCommitTrans()/catch idiom used elsewhere in this
        // module (e.g. CashierService::postPayment()) — EXCEPT the catch path
        // calls sqlRollbackTrans() directly rather than the module's usual
        // `sqlCommitTrans(false)`: library/sql.inc.php's sqlCommitTrans()
        // wrapper does not forward its $ok argument to ADODB (it always calls
        // `CommitTrans()` with no args), so `sqlCommitTrans(false)` silently
        // COMMITS instead of rolling back everywhere else it's used in this
        // module. sqlRollbackTrans() calls ADODB's RollbackTrans() directly and
        // is unaffected by that bug.
        require_once dirname(__DIR__, 6) . '/library/sql.inc.php';

        sqlBeginTrans();
        try {
            $result = (new PatientService())->insert($patientData);
            if (!$result->isValid() || !$result->hasData()) {
                throw new PatientImportValidationException(
                    'Could not create patient' . $this->describeValidationFailure($result)
                );
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
                 VALUES (?, ?, 0, 'cash', ?)",
                [$pid, (int) ($d['dob_estimated'] ?? '0'), $d['old_clinic_number'] !== '' ? $d['old_clinic_number'] : null]
            );

            require_once $GLOBALS['fileroot'] . '/library/patient.inc.php';
            updateDupScore($pid);

            sqlCommitTrans();
        } catch (\Throwable $e) {
            sqlRollbackTrans();
            throw $e;
        }

        return $pid;
    }

    /**
     * PatientValidator::validate() (via BaseValidator::validate()) shapes
     * validation messages as field => (string | array<string, string>). Flatten
     * whatever is there into a short, readable detail; return '' when there's
     * nothing to add so the caller can fall back to a plain message.
     */
    private function describeValidationFailure(ProcessingResult $result): string
    {
        $messages = $result->getValidationMessages();
        if (empty($messages) || !is_array($messages)) {
            return '';
        }

        $parts = [];
        foreach ($messages as $field => $fieldMessages) {
            if (is_array($fieldMessages)) {
                foreach ($fieldMessages as $rule => $detail) {
                    $parts[] = is_string($rule) ? "{$field}: {$detail}" : "{$field}: {$rule}";
                }
            } else {
                $parts[] = "{$field}: {$fieldMessages}";
            }
        }

        return $parts !== [] ? ' (' . implode('; ', $parts) . ')' : '';
    }

    /**
     * Task D: a validation-shaped failure (PatientImportValidationException,
     * thrown by insertPatient() when core PatientValidator rejects the row) is
     * user-actionable, so its message is shown as-is. Anything else (a real SQL
     * or DB exception) can contain internals we don't want in the UI, so the
     * user sees a generic reason and the real message goes to the server log,
     * tagged with the row number so support can find it.
     */
    private function describeInsertFailure(\Exception $e, int $rowNumber): string
    {
        if ($e instanceof PatientImportValidationException) {
            return $e->getMessage();
        }

        error_log('PatientImportService: row ' . $rowNumber . ' failed to save: ' . $e->getMessage());

        return 'Could not save this patient — see server log';
    }
}
