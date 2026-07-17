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
}
