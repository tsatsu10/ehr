# Patient Importer (MKT-MIG-1) — Design & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Version:** v0.2.1 · **Date:** 2026-07-18 · **Status:** Delivered (V1) — full in-browser smoke passed 2026-07-18 (flag round-trip, messy-CSV dry run, import, idempotent re-run, old-number search, audit trail)

**Goal:** A self-serve "Import patients" tab in the Admin Hub that lets a clinic upload a CSV of their existing patients, match its columns to our fields, see a dry-run report, and import demographics — with duplicates skipped and reported, never merged.

**Architecture:** The browser parses the CSV (papaparse), auto-matches columns, and sends normalized rows to `ajax.php` in chunks of 200. One new backend service (`PatientImportService`) validates each row, checks duplicates against a pre-loaded in-memory index, and creates patients through the same `PatientService` path hand registration uses. Dry run and commit are the same code path with writes disabled. Everything sits behind `enable_patient_import` (default OFF).

**Tech Stack:** PHP 8.2 module service + AjaxController handler; React 19 + TS strict Admin Hub tab; papaparse for CSV; PHPUnit 11 + Vitest 4.

## Design summary (the spec)

- **Who runs it:** clinic admin staff, self-serve, from the Admin Hub. ACL `new_admin`.
- **Scope V1:** demographics only — first/middle/last name, sex, date of birth, phone, address (street), old clinic number, national ID. **No** balances, allergies, visit history, or Excel files (screen tells Excel users to "Save as CSV"). No updating of existing patients.
- **Template:** a "Download template" button produces a starter CSV (headers + 2 example rows); a copy lives in `Documentation/NewClinic/samples/patient_import_template.csv` for support use.
- **Row rules (v0.2.0 — audit amendment; supersedes the v0.1.0 code samples in Tasks 2/5 where they conflict):** first + last name required (last name ≥ 2 chars, mirroring registration); **sex required** (M/F/Male/Female any case; blank or anything else is a row error — core `PatientValidator` rejects empty sex at insert, so allowing blank would pass dry run and fail commit); each row needs a **date of birth or an age in years** (new optional `age` column, integer 0–130; a row with age but no DOB gets an estimated DOB of July 1st of the birth year and `dob_estimated=1`, exactly like hand registration; a row with neither is a row error — phone alone is no longer sufficient because core requires DOB at insert); dates parsed day-first (`31/12/1985`, `31-12-1985`, `31.12.1985`) or ISO (`1985-12-31`), 4-digit years only; phones normalized via `PhoneNormalizer` and checked against the clinic's `phone_validation_regex` config. Template header becomes `first_name,last_name,middle_name,sex,date_of_birth,age,phone,address,old_clinic_number,national_id`.
- **Duplicates — skip and report, never merge.** A row is a duplicate when it matches an existing patient on **national ID**, on **first+last name + DOB**, or on **first+last name + phone**. A phone match *alone* is deliberately NOT a duplicate — families share phones in this market (the live dup scorer weights phone at 1 of 17 for the same reason). Exact repeat rows *within the file* are caught client-side before sending. Re-running an import is therefore safe and idempotent. Two different age-only patients who share the same name and age collapse to the same estimated July-1 DOB, so the name+DOB duplicate rule treats the second one as a duplicate of the first and skips it with a reason — a real limitation, not a bug, of estimating DOB from age. Age-only rows are only re-run-idempotent within the same calendar year, because the estimated DOB is computed from the current year at import time; re-running the same file in a later year produces a different estimated DOB and so is no longer recognized as the same patient.
- **Chunking:** 5,000-row cap per file (matches the SCALE B9 precedent); the client sends sequential chunks of 200 rows — each request stays small (no `LARGE_BODY_ACTIONS` entry needed) and short, and the user gets a real progress bar. Dry run and commit both chunk.
- **Parity:** imported patients get the same `patient_data` + `new_patient_meta` + `phone_normalized` + `updateDupScore()` treatment as hand-registered ones, and the same `facility_id` a hand-registered patient would get (verified at build time). Old clinic number is stored in a new `new_patient_meta.old_clinic_number` column and becomes exact-match searchable in Front Desk search (which already joins `new_patient_meta`).
- **UI/UX rules honored:** 4-step flow (Upload → Match columns → Check → Import) with a visible stepper; nothing saved before an explicit confirm (`ConfirmModal`); plain-English copy; DD/MM date hint shown before import; `nc-*` callouts not Bootstrap alerts; aria-live progress; labeled file input; focus moves to each step's heading; 44px touch targets; Lucide icons; token colors only; `bs:check` ratchet respected. Admin Hub is not i18n-migrated, so literal strings (no `t()`).
- **Audit:** every commit chunk logs a `new_clinic` audit event with counts (action lands in `log.user` per module convention).

## Global Constraints

- PHP: 4-space indent, LF, **no** `declare(strict_types=1)`; module namespace `OpenEMR\Modules\NewClinic\`.
- Flag default OFF: `enable_patient_import` = `'0'`, wired in **all three** places (install.sql, `ClinicAdminService::EDITABLE_SETTINGS`, `adminFieldDefs.ts` allowlist + field def) or it is unreachable.
- Never eager-construct service trees that can cycle; keep constructor deps to leaf services only (`PhoneNormalizer`, `ClinicConfigService`, `VisitScopeService` are safe leaves). Run `composer verify:new-clinic` after touching any `__construct`.
- Every `new XxxService()` in a handler needs its `use OpenEMR\Modules\NewClinic\Services\XxxService;` import (handlers use `$this->host->svc()` — still verify imports).
- Frontend: TS strict, no `any`, no `console.log`, no module-scope `t()` (N/A — island unmigrated), no new Tailwind/BS colliding classes (`npm run bs:check`), tokens via `var(--oe-nc-*)`.
- Commits: Conventional Commits with the task ID, e.g. `feat(new-clinic): patient import service row validation (MKT-MIG-1)`.
- Branch: execute on a fresh branch `new-clinic/patient-importer` off `main` (check `git worktree list` first — nested worktrees exist under `.claude/worktrees/`). The shared asset VERSION string gets edited by concurrent sessions — append to it, don't overwrite.
- Never claim done without desktop `composer verify:new-clinic` (backend) and build + asset version bump + hard-refresh instruction (UI).

## File structure

| File | Responsibility |
|---|---|
| `interface/modules/custom_modules/oe-module-new-clinic/sql/install.sql` (modify, append) | `enable_patient_import` config row; `new_patient_meta.old_clinic_number` column |
| `.../src/Services/PatientImportService.php` (create) | Row normalization/validation, duplicate index, chunk processing, patient creation |
| `.../src/Services/ClinicAdminService.php` (modify) | `EDITABLE_SETTINGS` entry |
| `.../src/Services/AjaxActionPolicy.php` (modify) | ACL map entry `admin.patient_import.chunk => new_admin` |
| `.../src/Controllers/Ajax/Handlers/AdminActionHandler.php` (modify) | Action registration + handler case (POST, CSRF, flag gate) |
| `.../src/Services/PatientSearchService.php` (modify) | Exact-match on `npm.old_clinic_number` |
| `tests/Tests/Unit/Modules/NewClinic/PatientImportServiceTest.php` (create) | Unit tests for pure logic |
| `frontend/src/islands/admin-hub/adminTypes.ts` (modify) | `'import'` tab id + label |
| `frontend/src/islands/admin-hub/AdminHub.tsx` (modify) | Flag-gate the tab in `visibleTabs` |
| `frontend/src/islands/admin-hub/AdminHubTabPanels.tsx` (modify) | Render the panel |
| `frontend/src/islands/admin-hub/adminFieldDefs.ts` (modify) | Flag allowlist + field def |
| `frontend/src/islands/admin-hub/patientImport/types.ts` (create) | Shared TS types |
| `frontend/src/islands/admin-hub/patientImport/parseCsv.ts` (create) | papaparse wrapper, row cap, header extraction |
| `frontend/src/islands/admin-hub/patientImport/columnMatch.ts` (create) | Header→field auto-matching synonyms |
| `frontend/src/islands/admin-hub/patientImport/fileDuplicates.ts` (create) | In-file duplicate detection |
| `frontend/src/islands/admin-hub/patientImport/csvBuilders.ts` (create) | Template CSV + result-report CSV + download helper |
| `frontend/src/islands/admin-hub/patientImport/PatientImportPanel.tsx` (create) | The 4-step tab UI |
| `frontend/src/islands/admin-hub/patientImport/*.test.ts(x)` (create) | Vitest |
| `Documentation/NewClinic/samples/patient_import_template.csv` (create) | Support copy of the template |

---

### Task 1: Schema + flag wiring (the three places + column)

**Files:**
- Modify: `interface/modules/custom_modules/oe-module-new-clinic/sql/install.sql` (append at end)
- Modify: `interface/modules/custom_modules/oe-module-new-clinic/src/Services/ClinicAdminService.php` (inside `EDITABLE_SETTINGS`, near `'enable_pharm_ops'`)
- Modify: `frontend/src/islands/admin-hub/adminFieldDefs.ts` (allowlist near `'enable_pharm_ops'` ~line 73, field def in the System section near ~line 329)

**Interfaces:**
- Produces: config key `enable_patient_import` (bool, `'0'`); column `new_patient_meta.old_clinic_number VARCHAR(40) NULL`. Later tasks read the flag via `ClinicConfigService->get('enable_patient_import', '0')` and write/read the column by name.

- [ ] **Step 1: Append the SQL blocks to install.sql**

```sql
#IfNotRow2D new_clinic_config facility_id 0 config_key enable_patient_import
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_patient_import', '0');
#EndIf

#IfMissingColumn new_patient_meta old_clinic_number
ALTER TABLE `new_patient_meta` ADD COLUMN `old_clinic_number` VARCHAR(40) NULL;
#EndIf
```

- [ ] **Step 2: Add the setting to `ClinicAdminService::EDITABLE_SETTINGS`**

```php
        'enable_patient_import' => ['type' => 'bool', 'default' => '0'],
```

- [ ] **Step 3: Add to `adminFieldDefs.ts`** — the key in the allowlist array (alongside `'enable_pharm_ops'`), and a field def in the System tab section:

```ts
      {
        key: 'enable_patient_import',
        type: 'bool',
        label: 'Enable patient import (CSV)',
        hint: 'Shows the Import patients tab. Upload a CSV of existing patients, check a dry-run report, then import demographics. Duplicates are skipped, never merged.',
        indent: 1,
      },
```

(Copy the exact object shape of the neighboring `enable_pharm_ops` def, including any properties this snippet is missing.)

- [ ] **Step 4: Apply the SQL on the dev box** — run the two new blocks by hand against the dev DB (XAMPP MySQL CLI, credentials in `sites/default/sqlconf.php`), since module upgrade scripts only run on module upgrade:

```sql
INSERT INTO new_clinic_config (facility_id, config_key, config_value)
SELECT 0, 'enable_patient_import', '0' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM new_clinic_config WHERE facility_id = 0 AND config_key = 'enable_patient_import');
ALTER TABLE new_patient_meta ADD COLUMN old_clinic_number VARCHAR(40) NULL;
```

- [ ] **Step 5: Verify** — `SELECT * FROM new_clinic_config WHERE config_key='enable_patient_import';` returns one row with value `0`; `SHOW COLUMNS FROM new_patient_meta LIKE 'old_clinic_number';` returns the column. Run `composer verify:new-clinic` — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/sql/install.sql interface/modules/custom_modules/oe-module-new-clinic/src/Services/ClinicAdminService.php frontend/src/islands/admin-hub/adminFieldDefs.ts
git commit -m "feat(new-clinic): enable_patient_import flag + old_clinic_number column (MKT-MIG-1)"
```

---

### Task 2: `PatientImportService` — row normalization + duplicate resolution (pure logic, TDD)

**Files:**
- Create: `interface/modules/custom_modules/oe-module-new-clinic/src/Services/PatientImportService.php`
- Create: `tests/Tests/Unit/Modules/NewClinic/PatientImportServiceTest.php`

**Interfaces:**
- Consumes: `PhoneNormalizer->normalize(string): string`; `ClinicConfigService->get(string $key, ?string $default): ?string`.
- Produces (used by Tasks 3–4):
  - `PatientImportService::IMPORT_FIELDS: array` — `['fname','lname','mname','sex','dob','phone','street','old_clinic_number','national_id']`
  - `PatientImportService::MAX_CHUNK_ROWS = 200`
  - `normalizeRow(array $row): array{ok: bool, reason: string, data: array<string,string>}`
  - `resolveDuplicate(array $data, array $index): string` — `''` when not a duplicate, else a plain-English reason
  - `indexKeysFor(array $data): array{name_dob: string, name_phone: string, national_id: string}` (empty-string members when the row lacks that key)

- [ ] **Step 1: Write the failing tests** — `tests/Tests/Unit/Modules/NewClinic/PatientImportServiceTest.php`. Match the file-header docblock and namespace style of the existing tests in that directory.

```php
<?php

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

use OpenEMR\Modules\NewClinic\Services\ClinicConfigService;
use OpenEMR\Modules\NewClinic\Services\PatientImportService;
use PHPUnit\Framework\TestCase;

class PatientImportServiceTest extends TestCase
{
    private function service(): PatientImportService
    {
        $config = new class extends ClinicConfigService {
            public function get(string $key, ?string $default = null): ?string
            {
                return $default;
            }
        };

        return new PatientImportService(config: $config);
    }

    public function testValidRowNormalizes(): void
    {
        $r = $this->service()->normalizeRow([
            'fname' => ' Ama ', 'lname' => 'Mensah', 'mname' => '',
            'sex' => 'f', 'dob' => '12/03/1988', 'phone' => '024 412 3456',
            'street' => '12 Ring Road', 'old_clinic_number' => 'OPD-0031', 'national_id' => '',
        ]);
        $this->assertTrue($r['ok']);
        $this->assertSame('Ama', $r['data']['fname']);
        $this->assertSame('Female', $r['data']['sex']);
        $this->assertSame('1988-03-12', $r['data']['dob']);
        $this->assertSame('0244123456', $r['data']['phone']);
    }

    public function testIsoDateAccepted(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'K', 'lname' => 'Boateng', 'dob' => '1975-11-02']);
        $this->assertTrue($r['ok']);
        $this->assertSame('1975-11-02', $r['data']['dob']);
    }

    public function testMissingNameFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => '', 'lname' => 'Mensah', 'dob' => '12/03/1988']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('name', strtolower($r['reason']));
    }

    public function testShortLastNameFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'M', 'dob' => '12/03/1988']);
        $this->assertFalse($r['ok']);
    }

    public function testNeedsDobOrPhone(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('date of birth or a phone', $r['reason']);
    }

    public function testBadDateFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '31/02/1990']);
        $this->assertFalse($r['ok']);
    }

    public function testTwoDigitYearFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/88']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('4-digit', $r['reason']);
    }

    public function testFutureDateFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/2099']);
        $this->assertFalse($r['ok']);
    }

    public function testUnknownSexFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'sex' => 'X']);
        $this->assertFalse($r['ok']);
    }

    public function testBlankSexAllowed(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988', 'sex' => '']);
        $this->assertTrue($r['ok']);
        $this->assertSame('', $r['data']['sex']);
    }

    public function testInvalidPhoneFails(): void
    {
        $r = $this->service()->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'phone' => '12345']);
        $this->assertFalse($r['ok']);
        $this->assertStringContainsString('phone', strtolower($r['reason']));
    }

    public function testDuplicateByNameDob(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Ama', 'lname' => 'Mensah', 'dob' => '12/03/1988'])['data'];
        $index = ['name_dob' => ['ama|mensah|1988-03-12' => true], 'name_phone' => [], 'national_id' => []];
        $this->assertNotSame('', $svc->resolveDuplicate($data, $index));
    }

    public function testPhoneAloneIsNotDuplicate(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Kojo', 'lname' => 'Mensah', 'dob' => '01/01/2015', 'phone' => '0244123456'])['data'];
        // Same phone in the clinic (a parent) but different name+dob and no name_phone entry for THIS name.
        $index = ['name_dob' => ['ama|mensah|1988-03-12' => true], 'name_phone' => ['ama|mensah|0244123456' => true], 'national_id' => []];
        $this->assertSame('', $svc->resolveDuplicate($data, $index));
    }

    public function testDuplicateByNationalId(): void
    {
        $svc = $this->service();
        $data = $svc->normalizeRow(['fname' => 'Ama', 'lname' => 'Owusu', 'dob' => '02/02/1990', 'national_id' => 'GHA-1'])['data'];
        $index = ['name_dob' => [], 'name_phone' => [], 'national_id' => ['GHA-1' => true]];
        $this->assertNotSame('', $svc->resolveDuplicate($data, $index));
    }
}
```

- [ ] **Step 2: Run to verify failure** — `vendor/bin/phpunit -c phpunit.xml --filter PatientImportServiceTest` → expect errors: class `PatientImportService` not found.

- [ ] **Step 3: Implement the service (pure part)** — create `PatientImportService.php`:

```php
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
```

- [ ] **Step 4: Run tests** — `vendor/bin/phpunit -c phpunit.xml --filter PatientImportServiceTest` → expect all PASS. If the anonymous-subclass config stub fails (e.g. `ClinicConfigService::get` signature differs or is final), read `ClinicConfigService` and adapt the stub to its real signature — the tests only need `get()` to return the default.

- [ ] **Step 5: Run `composer verify:new-clinic`** → expect PASS (constructor-cycle scan included).

- [ ] **Step 6: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/src/Services/PatientImportService.php tests/Tests/Unit/Modules/NewClinic/PatientImportServiceTest.php
git commit -m "feat(new-clinic): patient import row validation + duplicate resolution (MKT-MIG-1)"
```

---

### Task 3: `PatientImportService::processChunk` — duplicate index + patient creation

**Files:**
- Modify: `interface/modules/custom_modules/oe-module-new-clinic/src/Services/PatientImportService.php`
- Modify: `tests/Tests/Unit/Modules/NewClinic/PatientImportServiceTest.php`

**Interfaces:**
- Consumes: Task 2's `normalizeRow` / `resolveDuplicate` / `indexKeysFor`; `PatientService::insert(array): ProcessingResult`; `updateDupScore(int)` from `library/patient.inc.php`.
- Produces (used by Task 4):
  - `processChunk(array $rows, bool $dryRun, int $actorUserId, int $facilityId): array` returning
    `['results' => list<array{row_number:int, status:'ok'|'imported'|'duplicate'|'error', reason:string, name:string, pid:int|null}>, 'summary' => array{processed:int, ok:int, duplicates:int, errors:int}]`
    (`'ok'` = would import, dry run; `'imported'` = created, commit)

- [ ] **Step 1: Write the failing test** for the chunk-size guard (the only DB-free part of `processChunk`) — add to `PatientImportServiceTest.php`:

```php
    public function testChunkTooLargeThrows(): void
    {
        $rows = array_fill(0, PatientImportService::MAX_CHUNK_ROWS + 1, ['row_number' => 2, 'fname' => 'A', 'lname' => 'Bb', 'dob' => '01/01/2000']);
        $this->expectException(\InvalidArgumentException::class);
        $this->service()->processChunk($rows, true, 1, 3);
    }
```

- [ ] **Step 2: Run to verify failure** — `vendor/bin/phpunit -c phpunit.xml --filter testChunkTooLargeThrows` → FAIL: method `processChunk` not defined.

- [ ] **Step 3: Implement** — add to `PatientImportService`:

```php
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
        if ($facilityId > 0) {
            QueryUtils::sqlStatementThrowException(
                "UPDATE patient_data SET facility_id = ? WHERE pid = ?",
                [$facilityId, $pid]
            );
        }

        QueryUtils::sqlInsert(
            "INSERT INTO new_patient_meta (pid, dob_estimated, disability_flag, insurance_type, old_clinic_number)
             VALUES (?, 0, 0, 'cash', ?)",
            [$pid, $d['old_clinic_number'] !== '' ? $d['old_clinic_number'] : null]
        );

        require_once $GLOBALS['fileroot'] . '/library/patient.inc.php';
        updateDupScore($pid);

        return $pid;
    }
```

- [ ] **Step 4: Verify facility parity (build-time check, not optional).** Register one patient by hand through Front Desk on the dev box, then:
`SELECT pid, facility_id FROM patient_data ORDER BY pid DESC LIMIT 1;`
If hand registration leaves `facility_id` at `0`/empty (the filter clause treats those as visible-everywhere), change `insertPatient` to match exactly what registration produces — parity beats cleverness. Record the finding in the commit message.

- [ ] **Step 5: Run tests** — `vendor/bin/phpunit -c phpunit.xml --filter PatientImportServiceTest` → all PASS. Then `composer verify:new-clinic` → PASS.

- [ ] **Step 6: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/src/Services/PatientImportService.php tests/Tests/Unit/Modules/NewClinic/PatientImportServiceTest.php
git commit -m "feat(new-clinic): patient import chunk processing + duplicate index (MKT-MIG-1)"
```

---

### Task 4: Ajax action `admin.patient_import.chunk` (POST + CSRF + ACL + flag gate)

**Files:**
- Modify: `interface/modules/custom_modules/oe-module-new-clinic/src/Controllers/Ajax/Handlers/AdminActionHandler.php` (ACTIONS list + new case + `use` import)
- Modify: `interface/modules/custom_modules/oe-module-new-clinic/src/Services/AjaxActionPolicy.php` (ACL map, near `'admin.config.save' => 'new_admin'` ~line 80)

**Interfaces:**
- Consumes: `PatientImportService::processChunk(array $rows, bool $dryRun, int $actorUserId, int $facilityId): array` (Task 3).
- Produces: ajax action `admin.patient_import.chunk` — POST JSON body
  `{ csrf_token, facility_id: number, dry_run: 0|1, rows: [{row_number, fname, lname, mname, sex, dob, phone, street, old_clinic_number, national_id}] }`
  → envelope `data` = `{ results: [...], summary: {processed, ok, duplicates, errors} }` (shape from Task 3). The frontend (Task 6) calls exactly this.

- [ ] **Step 1: Register the action** — add to `AdminActionHandler::ACTIONS` (after `'admin.config.import'`):

```php
        'admin.config.import',
        'admin.patient_import.chunk',
```

Add the service import with the other `use` lines:

```php
use OpenEMR\Modules\NewClinic\Services\PatientImportService;
```

- [ ] **Step 2: Add the handler case** (model: the `admin.fee.import` case at ~line 285; add near it):

```php
                case 'admin.patient_import.chunk':
                    if ($method !== 'POST') {
                        $this->host->respond(false, 'POST required', [], 405);
                    }
                    $body = $this->host->readJsonBody();
                    $this->host->verifyCsrf($body);
                    if ((string) ($this->host->svc(ClinicConfigService::class)->get('enable_patient_import', '0') ?? '0') !== '1') {
                        $this->host->respond(false, 'Patient import is not enabled', [], 403);
                    }
                    $importFacilityId = (int) ($body['facility_id'] ?? ($_SESSION['facilityId'] ?? 0));
                    $importPayload = $this->host->svc(PatientImportService::class)->processChunk(
                        is_array($body['rows'] ?? null) ? $body['rows'] : [],
                        !empty($body['dry_run']),
                        $userId,
                        $importFacilityId
                    );
                    $this->host->respond(true, 'ok', $importPayload);
                    break;
```

(`ClinicConfigService` is already imported in this handler — verify, and add the `use` if not. Missing `use` = every ajax request 500s.)

- [ ] **Step 3: Policy entry** — in `AjaxActionPolicy.php`, add to the ACL map beside the other `admin.*` rows:

```php
        'admin.patient_import.chunk' => 'new_admin',
```

Do **not** add it to `LARGE_BODY_ACTIONS` — chunks of 200 rows stay far below the 1 MB body cap by design.

- [ ] **Step 4: Verify** — `composer verify:new-clinic` → PASS (it cross-checks handler/policy registration). Then a live HTTP smoke from the logged-in browser dev console on the Admin Hub page (flag ON via `UPDATE new_clinic_config SET config_value='1' WHERE config_key='enable_patient_import';` — remember the SCALE-3.3 config cache: toggle via the Admin Hub UI or `ClinicConfigService::set` + invalidate, not a raw SQL write, per the CLI smoke gotchas memory):

```js
fetch(ncAjaxUrl + '?action=admin.patient_import.chunk', { method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ csrf_token: ncCsrf, facility_id: 3, dry_run: 1,
    rows: [{ row_number: 2, fname: 'Test', lname: 'Import', dob: '01/01/1990' }] }) }).then(r => r.json()).then(console.log)
```

Expected: `{ success: true, data: { results: [{ row_number: 2, status: 'ok', ... }], summary: { processed: 1, ok: 1, duplicates: 0, errors: 0 } } }`. Re-run with `dry_run: 0`, confirm a patient appears in `patient_data` and a `new_patient_meta` row exists; run the same row again with `dry_run: 0` → `status: 'duplicate'`. Delete the test patient afterwards.

- [ ] **Step 5: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/src/Controllers/Ajax/Handlers/AdminActionHandler.php interface/modules/custom_modules/oe-module-new-clinic/src/Services/AjaxActionPolicy.php
git commit -m "feat(new-clinic): admin.patient_import.chunk ajax action (MKT-MIG-1)"
```

---

### Task 5: Frontend pure libs — parse, column matching, in-file duplicates, CSV builders (TDD)

**Files:**
- Create: `frontend/src/islands/admin-hub/patientImport/types.ts`
- Create: `frontend/src/islands/admin-hub/patientImport/parseCsv.ts` + `parseCsv.test.ts`
- Create: `frontend/src/islands/admin-hub/patientImport/columnMatch.ts` + `columnMatch.test.ts`
- Create: `frontend/src/islands/admin-hub/patientImport/fileDuplicates.ts` + `fileDuplicates.test.ts`
- Create: `frontend/src/islands/admin-hub/patientImport/csvBuilders.ts` + `csvBuilders.test.ts`
- Modify: `frontend/package.json` (add papaparse)

**Interfaces:**
- Produces (consumed by Task 6):
  - `types.ts`: `ImportField` union, `IMPORT_FIELD_LABELS`, `ParsedCsv`, `ColumnMapping`, `RowResult`, `ChunkResponse`
  - `parseCsv(text: string): ParsedCsv`
  - `autoMatch(headers: string[]): ColumnMapping`
  - `findInFileDuplicates(rows: Record<string, string>[]): Map<number, string>` (data-row index → reason)
  - `buildTemplateCsv(): string`, `buildReportCsv(results: RowResult[]): string`, `downloadCsv(filename: string, content: string): void`

- [ ] **Step 1: Add papaparse**

```bash
cd frontend
npm install papaparse
npm install -D @types/papaparse
```

- [ ] **Step 2: Write `types.ts`**

```ts
export type ImportField =
  | 'fname' | 'lname' | 'mname' | 'sex' | 'dob' | 'phone'
  | 'street' | 'old_clinic_number' | 'national_id';

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  fname: 'First name',
  lname: 'Last name',
  mname: 'Middle name',
  sex: 'Sex',
  dob: 'Date of birth',
  phone: 'Phone',
  street: 'Address',
  old_clinic_number: 'Old clinic number',
  national_id: 'National ID',
};

export const MAX_IMPORT_ROWS = 5000;

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  error: string | null;
}

/** File column index -> our field, or null for "don't import". */
export type ColumnMapping = (ImportField | null)[];

export interface RowResult {
  row_number: number;
  status: 'ok' | 'imported' | 'duplicate' | 'error';
  reason: string;
  name: string;
  pid: number | null;
}

export interface ChunkResponse {
  results: RowResult[];
  summary: { processed: number; ok: number; duplicates: number; errors: number };
}
```

- [ ] **Step 3: Write failing tests** (all four test files; representative cases below — include all of them):

```ts
// parseCsv.test.ts
import { describe, expect, it } from 'vitest';
import { parseCsv } from './parseCsv';
import { MAX_IMPORT_ROWS } from './types';

describe('parseCsv', () => {
  it('parses headers and rows, handling quoted commas and CRLF', () => {
    const out = parseCsv('name,address\r\nAma,"12 Ring Road, Accra"\r\n');
    expect(out.error).toBeNull();
    expect(out.headers).toEqual(['name', 'address']);
    expect(out.rows).toEqual([['Ama', '12 Ring Road, Accra']]);
  });

  it('strips a UTF-8 BOM from the first header', () => {
    const out = parseCsv('\uFEFFname\nAma\n');
    expect(out.headers).toEqual(['name']);
  });

  it('rejects an empty file', () => {
    expect(parseCsv('').error).toMatch(/empty/i);
  });

  it('rejects files over the row cap with a split hint', () => {
    const big = 'name\n' + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `P${i}`).join('\n');
    expect(parseCsv(big).error).toMatch(/5,?000/);
  });

  it('drops fully empty rows', () => {
    const out = parseCsv('name,phone\nAma,024\n,\n');
    expect(out.rows).toHaveLength(1);
  });
});
```

```ts
// columnMatch.test.ts
import { describe, expect, it } from 'vitest';
import { autoMatch } from './columnMatch';

describe('autoMatch', () => {
  it('matches common header spellings regardless of case/punctuation', () => {
    expect(autoMatch(['First Name', 'SURNAME', 'Date of Birth', 'Gender', 'Mobile No.', 'Folder No']))
      .toEqual(['fname', 'lname', 'dob', 'sex', 'phone', 'old_clinic_number']);
  });

  it('returns null for headers it cannot place', () => {
    expect(autoMatch(['Blood Group'])).toEqual([null]);
  });

  it('never assigns the same field twice (first wins)', () => {
    expect(autoMatch(['Phone', 'Telephone'])).toEqual(['phone', null]);
  });
});
```

```ts
// fileDuplicates.test.ts
import { describe, expect, it } from 'vitest';
import { findInFileDuplicates } from './fileDuplicates';

describe('findInFileDuplicates', () => {
  it('flags a later row repeating name+dob', () => {
    const rows = [
      { fname: 'Ama', lname: 'Mensah', dob: '12/03/1988' },
      { fname: 'ama', lname: 'MENSAH', dob: '12/03/1988' },
    ];
    const dups = findInFileDuplicates(rows as Record<string, string>[]);
    expect(dups.has(0)).toBe(false);
    expect(dups.get(1)).toMatch(/same name and date of birth/i);
  });

  it('does not flag siblings sharing a phone', () => {
    const rows = [
      { fname: 'Ama', lname: 'Mensah', dob: '12/03/1988', phone: '0244123456' },
      { fname: 'Kojo', lname: 'Mensah', dob: '01/01/2015', phone: '0244123456' },
    ];
    expect(findInFileDuplicates(rows as Record<string, string>[]).size).toBe(0);
  });
});
```

```ts
// csvBuilders.test.ts
import { describe, expect, it } from 'vitest';
import { buildReportCsv, buildTemplateCsv } from './csvBuilders';

describe('csv builders', () => {
  it('template has the documented headers and 2 example rows', () => {
    const lines = buildTemplateCsv().trim().split('\n');
    expect(lines[0]).toBe('first_name,last_name,middle_name,sex,date_of_birth,phone,address,old_clinic_number,national_id');
    expect(lines).toHaveLength(3);
  });

  it('report quotes fields containing commas', () => {
    const csv = buildReportCsv([
      { row_number: 4, status: 'error', reason: 'Bad, very bad', name: 'A B', pid: null },
    ]);
    expect(csv).toContain('"Bad, very bad"');
  });
});
```

- [ ] **Step 4: Run to verify failure** — `cd frontend; npx vitest run src/islands/admin-hub/patientImport` → FAIL (modules not found).

- [ ] **Step 5: Implement the four libs**

```ts
// parseCsv.ts
import Papa from 'papaparse';
import { MAX_IMPORT_ROWS, type ParsedCsv } from './types';

export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^\uFEFF/, '');
  if (clean.trim() === '') {
    return { headers: [], rows: [], error: 'The file is empty.' };
  }

  const parsed = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' });
  const all = parsed.data.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (all.length < 2) {
    return { headers: [], rows: [], error: 'The file needs a header row and at least one patient row.' };
  }

  const [headers, ...rows] = all;
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      headers: [],
      rows: [],
      error: `This file has ${rows.length.toLocaleString()} rows — the limit is 5,000 per file. Split it into smaller files and import them one after the other.`,
    };
  }

  return { headers: headers.map((h) => h.trim()), rows, error: null };
}
```

```ts
// columnMatch.ts
import type { ColumnMapping, ImportField } from './types';

const SYNONYMS: [ImportField, string[]][] = [
  ['fname', ['firstname', 'first', 'givenname', 'given', 'prenom']],
  ['lname', ['lastname', 'last', 'surname', 'familyname', 'family', 'nom']],
  ['mname', ['middlename', 'middle', 'othernames', 'other']],
  ['sex', ['sex', 'gender']],
  ['dob', ['dob', 'dateofbirth', 'birthdate', 'birthday', 'born']],
  ['phone', ['phone', 'phoneno', 'mobile', 'mobileno', 'telephone', 'tel', 'contact', 'contactno', 'cell']],
  ['street', ['address', 'streetaddress', 'street', 'residence', 'location', 'homeaddress']],
  ['old_clinic_number', ['oldclinicnumber', 'oldid', 'cardno', 'cardnumber', 'folderno', 'foldernumber', 'opdno', 'opdnumber', 'hospitalno', 'hospitalnumber', 'patientid', 'patientno', 'recordno', 'mrn']],
  ['national_id', ['nationalid', 'ghanacard', 'ghanacardno', 'idnumber', 'nationalidnumber', 'nid']],
];

function squash(header: string): string {
  return header.toLowerCase().replace(/[^a-z]/g, '');
}

export function autoMatch(headers: string[]): ColumnMapping {
  const used = new Set<ImportField>();

  return headers.map((header) => {
    const key = squash(header);
    for (const [field, names] of SYNONYMS) {
      if (!used.has(field) && names.includes(key)) {
        used.add(field);
        return field;
      }
    }
    return null;
  });
}
```

```ts
// fileDuplicates.ts
/** Later occurrences of an identity already seen earlier in the same file. */
export function findInFileDuplicates(rows: Record<string, string>[]): Map<number, string> {
  const seenNameDob = new Map<string, number>();
  const seenNamePhone = new Map<string, number>();
  const seenNationalId = new Map<string, number>();
  const flagged = new Map<number, string>();

  rows.forEach((row, i) => {
    const name = `${(row.fname ?? '').trim().toLowerCase()}|${(row.lname ?? '').trim().toLowerCase()}`;
    const dob = (row.dob ?? '').trim();
    const phone = (row.phone ?? '').replace(/\D/g, '');
    const nid = (row.national_id ?? '').trim();

    if (nid !== '' && seenNationalId.has(nid)) {
      flagged.set(i, `Same national ID as row ${(seenNationalId.get(nid) ?? 0) + 2} in this file`);
      return;
    }
    if (dob !== '' && seenNameDob.has(`${name}|${dob}`)) {
      flagged.set(i, `Same name and date of birth as row ${(seenNameDob.get(`${name}|${dob}`) ?? 0) + 2} in this file`);
      return;
    }
    if (phone !== '' && seenNamePhone.has(`${name}|${phone}`)) {
      flagged.set(i, `Same name and phone as row ${(seenNamePhone.get(`${name}|${phone}`) ?? 0) + 2} in this file`);
      return;
    }

    if (nid !== '') seenNationalId.set(nid, i);
    if (dob !== '') seenNameDob.set(`${name}|${dob}`, i);
    if (phone !== '') seenNamePhone.set(`${name}|${phone}`, i);
  });

  return flagged;
}
```

```ts
// csvBuilders.ts
import type { RowResult } from './types';

const TEMPLATE_HEADERS = 'first_name,last_name,middle_name,sex,date_of_birth,phone,address,old_clinic_number,national_id';

export function buildTemplateCsv(): string {
  return [
    TEMPLATE_HEADERS,
    'Ama,Mensah,,Female,12/03/1988,0244123456,"12 Ring Road, Accra",OPD-0031,',
    'Kwame,Boateng,Kofi,Male,1975-11-02,0209876543,,,',
  ].join('\n') + '\n';
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildReportCsv(results: RowResult[]): string {
  const lines = ['row,name,status,reason'];
  for (const r of results) {
    lines.push([String(r.row_number), csvCell(r.name), r.status, csvCell(r.reason)].join(','));
  }
  return lines.join('\n') + '\n';
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 6: Run tests** — `npx vitest run src/islands/admin-hub/patientImport` → all PASS. Also `npm run typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/islands/admin-hub/patientImport
git commit -m "feat(new-clinic): patient import CSV parse, column matching, report builders (MKT-MIG-1)"
```

---

### Task 6: `PatientImportPanel` — the 4-step tab UI

**Files:**
- Modify: `frontend/src/islands/admin-hub/adminTypes.ts` (tab id + label)
- Modify: `frontend/src/islands/admin-hub/AdminHub.tsx` (`visibleTabs` gate ~line 166 + reset effect ~line 176)
- Modify: `frontend/src/islands/admin-hub/AdminHubTabPanels.tsx` (render case)
- Create: `frontend/src/islands/admin-hub/patientImport/PatientImportPanel.tsx`
- Create: `frontend/src/islands/admin-hub/patientImport/PatientImportPanel.test.tsx`

**Interfaces:**
- Consumes: Task 5 libs; `oeFetch<ChunkResponse>('admin.patient_import.chunk', { json: {...}, ajaxUrl, csrfToken })`; existing `Button`, `Select*` primitives, `ConfirmModal`, `showDeskToast`, callout classes.
- Produces: `<PatientImportPanel ajaxUrl csrfToken facilityId />`.

- [ ] **Step 1: Register the tab.** `adminTypes.ts`:

```ts
export type AdminTabId = 'queue' | 'people' | 'completion' | 'clinic' | 'forms' | 'system' | 'types' | 'fees' | 'directory' | 'import';
// …and in ADMIN_TABS:
  { id: 'import', label: 'Import patients' },
```

`AdminHub.tsx` — extend the existing `visibleTabs` filter and reset effect (pattern already there for `system`/`forms`):

```ts
  const patientImportEnabled = settings.enable_patient_import === true;
  const visibleTabs = useMemo(
    () => ADMIN_TABS.filter((tab) => {
      if (tab.id === 'system' || tab.id === 'forms') {
        return adminHubEnabled;
      }
      if (tab.id === 'import') {
        return patientImportEnabled;
      }
      return true;
    }),
    [adminHubEnabled, patientImportEnabled]
  );
```

(Also add `patientImportEnabled`/`'import'` to the tab-reset `useEffect` beside the `system`/`forms` reset. Check how `settings` booleans arrive — if the payload delivers `'1'`/`'0'` strings, compare accordingly; mirror whatever `enable_admin_hub` does at line 165.)

`AdminHubTabPanels.tsx` — add the case where the other tabs render:

```tsx
{activeTab === 'import' && (
  <PatientImportPanel ajaxUrl={ajaxUrl} csrfToken={csrfToken} facilityId={facilityId} />
)}
```

- [ ] **Step 2: Write failing panel tests** — `PatientImportPanel.test.tsx`. Mock `@core/oeFetch`; drive with a `File`-less flow by exposing the parse through a hidden test seam: the panel accepts an optional `initialCsvText` prop (test-only convenience, documented in a comment) so tests skip the FileReader.

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PatientImportPanel } from './PatientImportPanel';

const oeFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@core/oeFetch', () => ({ oeFetch: oeFetchMock }));

const CSV = 'First Name,Surname,Date of Birth\nAma,Mensah,12/03/1988\nKwame,Boateng,01/01/1970\n';

describe('PatientImportPanel', () => {
  it('walks upload → match → check → import', async () => {
    oeFetchMock.mockResolvedValue({
      results: [
        { row_number: 2, status: 'ok', reason: '', name: 'Ama Mensah', pid: null },
        { row_number: 3, status: 'ok', reason: '', name: 'Kwame Boateng', pid: null },
      ],
      summary: { processed: 2, ok: 2, duplicates: 0, errors: 0 },
    });

    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" facilityId={3} initialCsvText={CSV} />);

    // Auto-matched columns are shown on the match step.
    expect(await screen.findByText(/match columns/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /check file/i }));

    await waitFor(() => expect(screen.getByText(/2/)).toBeInTheDocument());
    expect(oeFetchMock).toHaveBeenCalledWith(
      'admin.patient_import.chunk',
      expect.objectContaining({ json: expect.objectContaining({ dry_run: 1 }) })
    );
  });

  it('blocks Continue until first and last name are mapped', async () => {
    render(<PatientImportPanel ajaxUrl="/ajax" csrfToken="tok" facilityId={3} initialCsvText={'a,b\n1,2\n'} />);
    const btn = await screen.findByRole('button', { name: /check file/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/first name and last name/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run src/islands/admin-hub/patientImport/PatientImportPanel.test.tsx` → FAIL (component missing).

- [ ] **Step 4: Implement `PatientImportPanel.tsx`.** Structure (a state machine over `step: 'upload' | 'match' | 'checking' | 'preview' | 'importing' | 'done'`); reuse existing primitives; all copy plain English. Skeleton with the load-bearing logic:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Users } from 'lucide-react';
import { oeFetch } from '@core/oeFetch';
import { Button } from '@components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { ConfirmModal } from '@components/ConfirmModal';
import { showDeskToast } from '@components/deskToast';
import { parseCsv } from './parseCsv';
import { autoMatch } from './columnMatch';
import { findInFileDuplicates } from './fileDuplicates';
import { buildReportCsv, buildTemplateCsv, downloadCsv } from './csvBuilders';
import {
  IMPORT_FIELD_LABELS, type ChunkResponse, type ColumnMapping, type ImportField, type RowResult,
} from './types';

const CHUNK_SIZE = 200;

interface Props {
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  /** Test seam: preloads the file content, skipping the FileReader. */
  initialCsvText?: string;
}

type Step = 'upload' | 'match' | 'checking' | 'preview' | 'importing' | 'done';

export function PatientImportPanel({ ajaxUrl, csrfToken, facilityId, initialCsvText }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [fileError, setFileError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const loadCsvText = useCallback((text: string) => {
    const parsed = parseCsv(text);
    if (parsed.error) {
      setFileError(parsed.error);
      return;
    }
    setFileError(null);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(autoMatch(parsed.headers));
    setStep('match');
  }, []);

  useEffect(() => {
    if (initialCsvText !== undefined) loadCsvText(initialCsvText);
  }, [initialCsvText, loadCsvText]);

  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const mappedRows = useMemo(() => rows.map((cells, i) => {
    const row: Record<string, string> = { row_number: String(i + 2) } as Record<string, string>;
    mapping.forEach((field, col) => { if (field) row[field] = (cells[col] ?? '').trim(); });
    return row;
  }), [rows, mapping]);

  const inFileDups = useMemo(() => findInFileDuplicates(mappedRows), [mappedRows]);
  const sendableRows = useMemo(() => mappedRows.filter((_, i) => !inFileDups.has(i)), [mappedRows, inFileDups]);
  const requiredMapped = mapping.includes('fname') && mapping.includes('lname');

  const runChunks = useCallback(async (dryRun: boolean) => {
    setStep(dryRun ? 'checking' : 'importing');
    setProgress(0);
    const collected: RowResult[] = [...inFileDups.entries()].map(([i, reason]) => ({
      row_number: i + 2, status: 'duplicate', reason, name: `${mappedRows[i]?.fname ?? ''} ${mappedRows[i]?.lname ?? ''}`.trim(), pid: null,
    }));
    try {
      for (let start = 0; start < sendableRows.length; start += CHUNK_SIZE) {
        const chunk = sendableRows.slice(start, start + CHUNK_SIZE)
          .map((r) => ({ ...r, row_number: Number(r.row_number) }));
        const data = await oeFetch<ChunkResponse>('admin.patient_import.chunk', {
          ajaxUrl, csrfToken,
          json: { facility_id: facilityId, dry_run: dryRun ? 1 : 0, rows: chunk },
        });
        collected.push(...data.results);
        setProgress(Math.min(1, (start + chunk.length) / Math.max(1, sendableRows.length)));
      }
      collected.sort((a, b) => a.row_number - b.row_number);
      setResults(collected);
      setStep(dryRun ? 'preview' : 'done');
      if (!dryRun) showDeskToast('success', 'Import finished');
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Something went wrong — nothing else was imported.');
      setStep(dryRun ? 'match' : 'done');
    }
  }, [ajaxUrl, csrfToken, facilityId, sendableRows, inFileDups, mappedRows]);

  // …render: one branch per step (see UX notes below).
}
```

Render requirements per step (each a `<section>` with an `<h3 tabIndex={-1} ref={headingRef}>` and a visible step indicator "Step 1 of 4 — Upload" etc.):
  - **Upload:** labeled `<input type="file" accept=".csv,text/csv">` inside a styled card (copy the `ConfigImportCard.tsx` FileReader pattern lines 31–60); a `Button` variant=outline with `<Download />` → `downloadCsv('patient_import_template.csv', buildTemplateCsv())`; hint text: "Using Excel? Save your sheet as CSV first (File → Save As → CSV). Up to 5,000 patients per file." File errors render in a `nc-error-callout` div with the parse error text.
  - **Match:** table (one row per file column): file header, 3 sample values (from `rows[0..2]`), and a `Select` of `IMPORT_FIELD_LABELS` + "Don't import" (value `skip` mapped to null — Radix Select can't have empty-string values). Auto-matched selects prefilled. Under the table, when `!requiredMapped`, an inline `nc-warn-callout`: "Match a column to First name and Last name to continue." Primary button "Check file" (disabled until `requiredMapped`) → `runChunks(true)`. Secondary "Choose a different file" → reset to upload.
  - **Checking / Importing:** progress bar `<div role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>` plus an `aria-live="polite"` line "Checked 400 of 3,120 rows…" / "Imported…". No table churn while running.
  - **Preview:** three summary stat tiles (Will import / Skipped as duplicates / Rows with problems — green/amber/red token colors) + a hint line: "Dates are read day-first: 05/03/1990 means 5 March 1990." A table of only the duplicate/error rows (columns: Row, Name, Problem) — capped at 200 rendered rows with a "…and N more, all listed in the downloadable report" line. Buttons: "Import N patients" (primary, opens `ConfirmModal`: title "Import N patients now?", body "Duplicates and problem rows will be skipped. This cannot be undone from this screen.", confirm → `runChunks(false)`), "Download full report" → `downloadCsv('patient_import_check.csv', buildReportCsv(results))`, "Back".
  - **Done:** same tiles with final counts; "Download report" (`patient_import_report.csv`, includes every non-imported row with its reason); "Import another file" → full state reset. When some chunks failed mid-import, the error callout explains rows up to the failure were imported and re-running the same file is safe because duplicates skip.
  - All buttons ≥44px touch target (default `Button` sizing satisfies this — verify), Lucide icons only, no new Bootstrap-colliding class names (run `npm run bs:check`), colors via `var(--oe-nc-*)` / existing `nc-` classes. Any bespoke styles go in the island's BEM CSS file next to the other admin-hub styles, not `@layer` utilities.

- [ ] **Step 5: Run tests** — `npx vitest run src/islands/admin-hub/patientImport` → PASS. Then the **full** admin-hub suite (`npx vitest run src/islands/admin-hub`) — the self-fetching-card memory says host tests break when a new component fetches on mount; this panel only fetches on click, but verify. Then `npm run check` (typecheck + lint + bs:check + i18n:check) → PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/islands/admin-hub
git commit -m "feat(new-clinic): Import patients Admin Hub tab (MKT-MIG-1)"
```

---

### Task 7: Old-number search, template sample, build + verify + docs

**Files:**
- Modify: `interface/modules/custom_modules/oe-module-new-clinic/src/Services/PatientSearchService.php` (~lines 116–131, condition list)
- Create: `Documentation/NewClinic/samples/patient_import_template.csv`
- Modify: module asset VERSION (find it: `Grep "assetVersion|VERSION" src/` in the module — append a suffix, never overwrite, per the concurrent-edits memory)
- Modify: `Documentation/NewClinic/new/NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md` (MKT-MIG-1 rows), `Documentation/NewClinic/README.md` (index), this plan's Status line

**Interfaces:**
- Consumes: `new_patient_meta.old_clinic_number` (Task 1); the existing `LEFT JOIN new_patient_meta npm` in the search SQL (line 139).

- [ ] **Step 1: Add exact-match search.** In `fetchCandidates()`, alongside the existing conditions (both the token and no-token branches), add for the raw query:

```php
        $conditions[] = 'npm.old_clinic_number = ?';
        $bind[] = trim($query);
```

Exact match only — no `LIKE` scan on the new column (SCALE R-rules). Place it so it joins the `OR` group in both branches.

- [ ] **Step 2: Unit/behavior check.** If `PatientSearchService` has existing tests, extend them; otherwise verify live in Step 5's smoke (search the old card number of an imported patient → the patient appears).

- [ ] **Step 3: Write the sample file** — `Documentation/NewClinic/samples/patient_import_template.csv` with content identical to `buildTemplateCsv()` in Task 5 (keep the two in sync; the Vitest template test pins the headers).

- [ ] **Step 4: Build + version bump**

```bash
cd frontend
npm run build
```

Then append a marker to the module asset VERSION string (e.g. `-patimport1`), and run `composer verify:new-clinic` → PASS.

- [ ] **Step 5: Browser smoke (the real gate).** Apache+MySQL running; hard refresh (Ctrl+F5) after the version bump; login with `?site=default`:
  1. Admin Hub → System: turn ON "Enable patient import (CSV)". Confirm the "Import patients" tab appears (and disappears when toggled OFF).
  2. Import a messy test CSV (quoted commas, BOM from Excel, `Surname`/`Folder No` headers, one bad date `31/02/1990`, one 2-digit year, one row missing both DOB and phone, two exact repeat rows, one row matching an existing patient's name+DOB): dry-run counts and reasons must all be right.
  3. Confirm import → patients exist; open one in Front Desk search; register-by-hand comparison: chart looks identical to a hand-registered demographics-only patient (meta row, insurance shows cash, completion score computes).
  4. Re-import the same file → everything skips as duplicates, zero created.
  5. Search Front Desk by an imported old clinic number → patient found.
  6. Audit check: `SELECT * FROM log WHERE user='admin.patient_import.chunk' ORDER BY id DESC LIMIT 3;` (module audits store the action in `log.user`).
- [ ] **Step 6: Docs sync.** Market plan: mark MKT-MIG-1 delivered (W1 table row + §3.0 + §7.4), add a history row + version bump per doc rules; README index: add this plan doc; update this plan's Status line to Delivered.

- [ ] **Step 7: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/src/Services/PatientSearchService.php Documentation/NewClinic
git commit -m "feat(new-clinic): old-clinic-number search + import template + docs (MKT-MIG-1)"
```

(The built assets + VERSION bump commit per this repo's usual practice — include them the way previous island commits do; check `git log --stat` for a prior `feat(new-clinic)` island commit.)

---

## Out of scope (V1 — needs a new decision before building)

Balances, allergies, chronic conditions, visit history, direct Excel (.xlsx) parsing, updating/merging existing patients, undo/rollback of a finished import, background/queued import jobs.

## History

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-07-17 | Initial design + 7-task implementation plan (brainstormed: self-serve, demographics-only, skip-and-report duplicates, template download) |
| v0.2.0 | 2026-07-17 | Whole-branch audit amendment (user-decided): sex now REQUIRED; "DOB or phone" replaced by "DOB or age" with registration-style estimated-DOB synthesis (`age` column added to fields + template); flag gate must use `isEnabled()`; `insertPatient` writes wrapped in a transaction; consecutive-failure circuit breaker (10) with `\Exception` (not `\Throwable`) per-row catch; client-supplied `facility_id` dropped from the ajax body (server resolves); error reasons sanitized (detail server-logged) |
| v0.2.1 | 2026-07-18 | Task 7 (final): old-clinic-number exact-match search wired into Front Desk search; `Documentation/NewClinic/samples/patient_import_template.csv` added (byte-identical to `buildTemplateCsv()`); breaker trip now logs an audit event for counts accumulated before the throw; added an in-file national-ID duplicate test and a header-only-file parse test; build + version bump (`-patimport7`); `composer verify:new-clinic` and `npm run check` both PASS; browser-smoked end to end; two duplicates-bullet caveats documented (age-only name+age DOB collision, same-calendar-year re-run idempotency); Status → Delivered |
