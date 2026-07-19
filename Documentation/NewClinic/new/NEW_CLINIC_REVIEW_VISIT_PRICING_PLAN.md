# Review-Visit Pricing (REV-*) — Design & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Version:** v0.1.0 · **Date:** 2026-07-19 · **Status:** Planned (not started)

**Goal:** When a patient returns about the same complaint, the clinic can charge its own chosen "review" price for the consultation — with the front desk automatically prompted when a returning patient qualifies, and zero changes to the cashier's money path.

**Architecture:** A "Review" visit type (new `is_review` column) whose `default_fee_schedule_id` points at a new clinic-priced `REVIEW_CONSULT` fee-schedule item. The cashier's existing `resolveVisitTypeSuggestions()` flow (visit type → default fee) then surfaces the review price with no cashier changes at all. A tiny new leaf service computes "seen within the clinic's review window?" from `MAX(form_encounter.date)` (already indexed via `new_idx_fe_pid_date`) and rides the existing `patients.preview` payload; the front-desk start-visit form shows a one-click "Book as Review?" prompt. Staff always decide — the suggestion never forces anything.

**Tech Stack:** PHP 8.2 module service + existing ajax actions (no new actions); React 19 + TS strict front-desk island; PHPUnit 11 + Vitest 4.

## Design summary (the spec)

- **Market origin:** a doctor reported the clinic's real policy — a return visit for the same complaint pays half the consultation price. Product decision (user, 2026-07-19): don't hardcode "half" — the clinic prices reviews at **any amount they wish** via a normal fee-schedule item, and chooses its own **review window** in days.
- **Who decides "same complaint":** staff. The system auto-suggests (patient seen within the window → prompt at start-visit), a human confirms. No hard blocks; ignoring the prompt books a normal full-price visit. Fully-automatic discounting was explicitly rejected (a return within the window with a NEW complaint must stay full price).
- **What the clinic controls:** `REVIEW_CONSULT` price (existing Fees tab, no new pricing UI) and `review_window_days` (new setting, default 14; 0 disables the suggestion). Both only matter when `enable_review_visits` is ON (default OFF; three-place wired).
- **Cashier:** untouched. Review is an ordinary visit type whose default fee is the review item; the existing suggestion flow (`FeeScheduleAdminService::resolveVisitTypeSuggestions`) does the rest. The existing `new_discount` ACL manual override still works on top.
- **Edge cases (decided simply):** window anchors to the most recent encounter of any kind (review-of-a-review is staff judgment, no chaining rules in V1); suggestion is same-facility scoped; the Review type appears in the scheduling booking sheet automatically (shared `new_visit_type` list) but the auto-prompt is front-desk-only in V1; `is_review` is not editable in the admin visit-type modal in V1 (rename/price/deactivate all work; the marker itself is seed-owned).
- **Reports:** free — review visits are ordinary visits with a distinct `visit_type_label` and an ordinary fee line, so reconciliation/receipts/counts need no changes.
- **Out of scope V1:** auto-prompt in scheduling; percentage-based rules; chaining/expiry logic; PRD amendment text (queue it with the next PRD batch; this plan + README row carry the record until then).

## Global Constraints

- PHP: 4-space indent, LF, no `declare(strict_types=1)`; module namespace `OpenEMR\Modules\NewClinic\`.
- Flags: `enable_review_visits` = `'0'` and `review_window_days` = `'14'` wired in **all three** places (install.sql, `ClinicAdminService::EDITABLE_SETTINGS`, `adminFieldDefs.ts` allowlist + field defs) or unreachable. Flag OFF = today's behavior exactly (no prompt, no payload field consumed, seeds inert).
- New service must be a **leaf** (deps: `ClinicConfigService`, `QueryUtils` only) — no ctor cycles; run `composer verify:new-clinic` after any `__construct` change.
- No new ajax actions, no new polls, no unbounded queries (SCALE R1–R8). The suggestion query is one indexed `MAX()` lookup inside the existing `patients.preview` request — and even that only when the flag is ON.
- Frontend: TS strict, no `any`, no `console.log`; `nc-info-callout` from `@components/deskCalloutStyles` for the prompt (never Bootstrap alerts); Lucide icons; 44px touch targets; plain-English copy; DD/MM regional style for any dates shown; front-desk island is NOT i18n-migrated → literal strings.
- Commits: Conventional Commits with the task ID, e.g. `feat(new-clinic): review visit suggestion service (REV-2)`.
- The shared asset VERSION string is edited by concurrent sessions — **append** a suffix, never overwrite.
- Never claim done without desktop `composer verify:new-clinic` (backend) and build + asset bump + hard-refresh instruction (UI).

## File structure

| File | Responsibility |
|---|---|
| `interface/modules/custom_modules/oe-module-new-clinic/sql/install.sql` (append) | `is_review` column; `REVIEW_CONSULT` fee seed; Review visit-type seed; 2 config seeds |
| `.../src/Services/ClinicAdminService.php` (modify) | 2 `EDITABLE_SETTINGS` entries |
| `frontend/src/islands/admin-hub/adminFieldDefs.ts` (modify) | allowlist + 2 field defs |
| `.../src/Services/ReviewVisitSuggestionService.php` (create) | window evaluation + suggestion lookup (leaf service) |
| `.../src/Services/PatientContextService.php` (modify, ~line 298) | add `review_suggestion` to the front-desk preview payload |
| `.../src/Services/VisitTypeAdminService.php` (modify, `listForDesk` ~266–330) | SELECT + return `is_review` |
| `tests/Tests/Unit/Modules/NewClinic/ReviewVisitSuggestionServiceTest.php` (create) | TDD for window logic + payload shape |
| `frontend/src/core/types/front-desk.ts` (modify) | `DeskVisitType.is_review`; `FrontDeskPreviewData.review_suggestion` |
| `frontend/src/islands/front-desk/useStartVisit.ts` (modify) | expose suggestion state + `applyReviewSuggestion()` |
| `frontend/src/islands/front-desk/StartVisitForm.tsx` (modify, ~line 210) | the prompt callout above the visit-type picker |
| `frontend/src/islands/front-desk/FrontDesk.test.tsx` (modify) | prompt behavior tests |

---

### Task REV-1: Schema, seeds, and settings (three-place wiring ×2)

**Files:**
- Modify: `interface/modules/custom_modules/oe-module-new-clinic/sql/install.sql` (append at end)
- Modify: `.../src/Services/ClinicAdminService.php` (inside `EDITABLE_SETTINGS`, after `'enable_patient_import'`)
- Modify: `frontend/src/islands/admin-hub/adminFieldDefs.ts` (allowlist after `'enable_patient_import'`; field defs — see Step 3)

**Interfaces:**
- Produces: config keys `enable_review_visits` (bool, `'0'`), `review_window_days` (int, `'14'`, min 0 max 365); column `new_visit_type.is_review TINYINT(1) NOT NULL DEFAULT 0`; fee row `REVIEW_CONSULT` (facility 0); visit-type row `Review` (facility 0, `is_review=1`, `default_fee_schedule_id` → the REVIEW_CONSULT row). Later tasks read the flag via `ClinicConfigService->get('enable_review_visits', '0', $facilityId)` and the window via `->getInt('review_window_days', 14, $facilityId)`.

- [ ] **Step 1: Append the SQL blocks to install.sql** (CRLF file — match its line endings):

```sql
#IfMissingColumn new_visit_type is_review
ALTER TABLE `new_visit_type` ADD COLUMN `is_review` TINYINT(1) NOT NULL DEFAULT 0 AFTER `referral_required`;
#EndIf

#IfNotRow2D new_fee_schedule facility_id 0 code REVIEW_CONSULT
INSERT INTO `new_fee_schedule` (`facility_id`, `code`, `name`, `category`, `amount`, `is_active`)
VALUES (0, 'REVIEW_CONSULT', 'Review consultation', 'consultation', 0.00, 1);
#EndIf

#IfNotRow2D new_visit_type facility_id 0 label Review
-- Seeded INACTIVE deliberately: flag OFF must equal 100% legacy behavior
-- (PRD §5.6), and an active type would appear in every desk/booking picker
-- regardless of the flag. The enable_review_visits settings hint tells the
-- admin to activate it in Visit types + price it in Fees when turning on.
INSERT INTO `new_visit_type`
    (`facility_id`, `label`, `pc_catid`, `service_profile`, `referral_required`, `is_review`, `default_fee_schedule_id`, `is_active`)
SELECT 0, 'Review', 5, 'full_opd', 0, 1, f.id, 0
FROM `new_fee_schedule` f
WHERE f.facility_id = 0 AND f.code = 'REVIEW_CONSULT'
LIMIT 1;
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_review_visits
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_review_visits', '0'),
(0, 'review_window_days', '14');
#EndIf
```

**Before writing:** open `install.sql` and check the real `new_fee_schedule` column list at its CREATE TABLE (~line 146) and the `OPD_CONSULT` seed (~line 210) — mirror the exact column names/format used there (the block above assumes `code/name/category/amount/is_active`; correct it to whatever the OPD_CONSULT seed actually uses, keeping amount 0.00 so the clinic consciously sets its price).

- [ ] **Step 2: `ClinicAdminService::EDITABLE_SETTINGS`** — add after the `'enable_patient_import'` entry:

```php
        'enable_review_visits' => ['type' => 'bool', 'default' => '0'],
        'review_window_days' => ['type' => 'int', 'default' => '14', 'min' => 0, 'max' => 365],
```

- [ ] **Step 3: `adminFieldDefs.ts`** — add both keys to the allowlist array (after `'enable_patient_import'`), then two field defs. Place them in `QUEUE_FIELD_SECTIONS` in the **"Registration & duplicate detection (M1)"** section (front-desk policy belongs with front-desk fields), at the end of its `fields` array:

```ts
      {
        key: 'enable_review_visits',
        type: 'bool',
        label: 'Enable review visits (returning patient, same complaint)',
        hint: 'Adds a "Review" visit type priced by the "Review consultation" item in the Fees tab. When a patient was seen within the review window, the front desk is prompted to book the visit as a Review — staff confirm it is the same complaint.',
      },
      {
        key: 'review_window_days',
        type: 'int',
        label: 'Review window (days)',
        hint: 'How recently the patient must have been seen for the Review prompt to appear. 0 turns the prompt off (the Review type stays bookable manually).',
        indent: 1,
      },
```

(Copy the exact object shape of neighboring defs — check whether int defs in this file carry `min`/`max` properties and match.)

- [ ] **Step 4: Apply to the dev DB** — run the four blocks' statements manually via `C:\xampp\mysql\bin\mysql.exe` (credentials in `sites/default/sqlconf.php`), with the same `WHERE NOT EXISTS` guards the importer flag used, then verify:

```sql
SHOW COLUMNS FROM new_visit_type LIKE 'is_review';
SELECT id, code, amount FROM new_fee_schedule WHERE code='REVIEW_CONSULT';
SELECT id, label, is_review, default_fee_schedule_id FROM new_visit_type WHERE label='Review';
SELECT config_key, config_value FROM new_clinic_config WHERE config_key IN ('enable_review_visits','review_window_days');
```

Expected: column exists; one fee row; one visit-type row with `is_review=1` and a non-NULL `default_fee_schedule_id` equal to the fee row's id; both config rows at facility 0 (`0` / `14`).

- [ ] **Step 5: Gates** — `composer verify:new-clinic` → PASS; `cd frontend && npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/sql/install.sql interface/modules/custom_modules/oe-module-new-clinic/src/Services/ClinicAdminService.php frontend/src/islands/admin-hub/adminFieldDefs.ts
git commit -m "feat(new-clinic): review visit type, clinic-priced review fee, window settings (REV-1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task REV-2: `ReviewVisitSuggestionService` (TDD, pure window logic + one indexed lookup)

**Files:**
- Create: `interface/modules/custom_modules/oe-module-new-clinic/src/Services/ReviewVisitSuggestionService.php`
- Create: `tests/Tests/Unit/Modules/NewClinic/ReviewVisitSuggestionServiceTest.php`

**Interfaces:**
- Consumes: `ClinicConfigService->get(string $key, ?string $default = null, int $facilityId = 0): ?string` and `->getInt(string $key, int $default = 0, int $facilityId = 0): int` (verify `getInt`'s real signature before use); `QueryUtils::querySingleRow`.
- Produces (Task REV-3 consumes):
  - `suggestFor(int $pid, int $facilityId): ?array` → `null` when flag off / window 0 / no prior visit / outside window / no active review type; else `['days_ago' => int, 'last_visit_date' => 'YYYY-MM-DD', 'review_visit_type_id' => int]`.
  - `public static daysSince(?string $lastVisitDate, \DateTimeImmutable $today): ?int` — pure, TDD'd directly.

- [ ] **Step 1: Write the failing tests** — follow the sibling tests' conventions (`require_once __DIR__ . '/ModuleAutoload.php';`, namespace `OpenEMR\Tests\Unit\Modules\NewClinic`, config stubbed via an anonymous subclass matching `ClinicConfigService`'s real method signatures):

```php
<?php

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Modules\NewClinic\Services\ReviewVisitSuggestionService;
use PHPUnit\Framework\TestCase;

class ReviewVisitSuggestionServiceTest extends TestCase
{
    public function testDaysSinceCountsWholeDays(): void
    {
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertSame(5, ReviewVisitSuggestionService::daysSince('2026-07-14', $today));
        $this->assertSame(0, ReviewVisitSuggestionService::daysSince('2026-07-19', $today));
    }

    public function testDaysSinceHandlesDatetimeStrings(): void
    {
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertSame(5, ReviewVisitSuggestionService::daysSince('2026-07-14 15:42:00', $today));
    }

    public function testDaysSinceNullOnMissingOrGarbage(): void
    {
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertNull(ReviewVisitSuggestionService::daysSince(null, $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('', $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('0000-00-00', $today));
        $this->assertNull(ReviewVisitSuggestionService::daysSince('not-a-date', $today));
    }

    public function testDaysSinceNullOnFutureDate(): void
    {
        // A future encounter date (bad data / clock skew) must not suggest a review.
        $today = new \DateTimeImmutable('2026-07-19');
        $this->assertNull(ReviewVisitSuggestionService::daysSince('2026-07-25', $today));
    }

    public function testWithinWindowBoundaryIsInclusive(): void
    {
        // Window 14, seen exactly 14 days ago -> still eligible.
        $today = new \DateTimeImmutable('2026-07-19');
        $days = ReviewVisitSuggestionService::daysSince('2026-07-05', $today);
        $this->assertSame(14, $days);
        $this->assertTrue(ReviewVisitSuggestionService::withinWindow($days, 14));
        $this->assertFalse(ReviewVisitSuggestionService::withinWindow(15, 14));
        $this->assertFalse(ReviewVisitSuggestionService::withinWindow(null, 14));
        $this->assertFalse(ReviewVisitSuggestionService::withinWindow(3, 0));
    }
}
```

- [ ] **Step 2: Run to verify failure** — `vendor/bin/phpunit -c phpunit.xml --filter ReviewVisitSuggestionServiceTest` → errors: class not found.

- [ ] **Step 3: Implement the service:**

```php
<?php

/**
 * REV-2 — "book as Review?" suggestion for returning patients.
 *
 * A clinic-configurable policy: patients returning about the same complaint
 * within the review window pay the clinic's chosen review price. Software
 * cannot judge "same complaint", so this service only ANSWERS "was this
 * patient seen recently, and is there an active Review visit type here?" —
 * the front desk confirms or ignores. Consumed by the front-desk preview
 * payload; no ajax action of its own, nothing on a poll timer.
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;

class ReviewVisitSuggestionService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * @return array{days_ago: int, last_visit_date: string, review_visit_type_id: int}|null
     */
    public function suggestFor(int $pid, int $facilityId): ?array
    {
        if ($pid <= 0) {
            return null;
        }
        if ((string) ($this->config->get('enable_review_visits', '0', $facilityId) ?? '0') !== '1') {
            return null;
        }
        $windowDays = $this->config->getInt('review_window_days', 14, $facilityId);
        if ($windowDays <= 0) {
            return null;
        }

        // One indexed lookup (new_idx_fe_pid_date) — same shape the search
        // service already uses for its last_visit_date column.
        $row = QueryUtils::querySingleRow(
            "SELECT MAX(fe.date) AS last_visit_date FROM form_encounter fe WHERE fe.pid = ?",
            [$pid]
        );
        $lastVisitDate = is_array($row) ? (string) ($row['last_visit_date'] ?? '') : '';

        $daysAgo = self::daysSince($lastVisitDate, new \DateTimeImmutable('today'));
        if (!self::withinWindow($daysAgo, $windowDays)) {
            return null;
        }

        $reviewType = QueryUtils::querySingleRow(
            "SELECT id FROM new_visit_type
             WHERE is_review = 1 AND is_active = 1 AND (facility_id = 0 OR facility_id = ?)
             ORDER BY facility_id DESC
             LIMIT 1",
            [$facilityId]
        );
        $reviewTypeId = is_array($reviewType) ? (int) ($reviewType['id'] ?? 0) : 0;
        if ($reviewTypeId <= 0) {
            return null;
        }

        return [
            'days_ago' => (int) $daysAgo,
            'last_visit_date' => substr($lastVisitDate, 0, 10),
            'review_visit_type_id' => $reviewTypeId,
        ];
    }

    /** Whole days between the last visit and today; null for missing/garbage/future dates. */
    public static function daysSince(?string $lastVisitDate, \DateTimeImmutable $today): ?int
    {
        $raw = trim((string) $lastVisitDate);
        if ($raw === '' || str_starts_with($raw, '0000-00-00')) {
            return null;
        }
        try {
            $then = new \DateTimeImmutable(substr($raw, 0, 10));
        } catch (\Exception) {
            return null;
        }
        if ($then > $today) {
            return null;
        }

        return (int) $today->diff($then)->format('%a');
    }

    public static function withinWindow(?int $daysAgo, int $windowDays): bool
    {
        return $daysAgo !== null && $windowDays > 0 && $daysAgo <= $windowDays;
    }
}
```

Note: `new \DateTimeImmutable('not-a-date')` **throws**, but some garbage strings parse surprisingly — if a Step-1 test fails on a garbage-input case, tighten with a `preg_match('/^\d{4}-\d{2}-\d{2}/', $raw)` guard before constructing, and keep the tests as written.

- [ ] **Step 4: Run tests** — `vendor/bin/phpunit -c phpunit.xml --filter ReviewVisitSuggestionServiceTest` → all PASS. Then `composer verify:new-clinic` → PASS (leaf ctor confirmed by the cycle scan).

- [ ] **Step 5: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/src/Services/ReviewVisitSuggestionService.php tests/Tests/Unit/Modules/NewClinic/ReviewVisitSuggestionServiceTest.php
git commit -m "feat(new-clinic): review visit suggestion service (REV-2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task REV-3: Wire the payloads (preview + visit types)

**Files:**
- Modify: `.../src/Services/PatientContextService.php` (front-desk context block, ~line 289–299)
- Modify: `.../src/Services/VisitTypeAdminService.php` (`listForDesk`, SELECT at ~272 and payload map at ~315–324)

**Interfaces:**
- Consumes: `ReviewVisitSuggestionService->suggestFor(int $pid, int $facilityId): ?array` (REV-2).
- Produces (REV-4 consumes):
  - `patients.preview` payload (front-desk context only) gains `'review_suggestion' => array{days_ago:int, last_visit_date:string, review_visit_type_id:int}|null`.
  - `visit.types` payload rows gain `'is_review' => bool`.

- [ ] **Step 1: PatientContextService.** Read the constructor first: if it uses eager promoted defaults (`private readonly X $x = new X()`), add `private readonly ReviewVisitSuggestionService $reviewSuggestion = new ReviewVisitSuggestionService(),` (it is a leaf — safe); if it uses lazy getters, follow that pattern instead. Then in the front-desk context block (beside `$payload['revisit_gate'] = ...` at ~line 297):

```php
        $payload['review_suggestion'] = $this->reviewSuggestion->suggestFor($pid, $facilityId);
```

Confirm `$facilityId` is in scope at that point (it is used on the neighboring lines); if the block is context-gated (only built for `'front-desk'`), keep this inside the same gate — the chart context does not need it.

- [ ] **Step 2: VisitTypeAdminService::listForDesk.** Add `is_review` to the SELECT column list (line ~272):

```php
            "SELECT id, label, service_profile, pc_catid, facility_id, referral_required, is_review
```

and to the returned row map (after `'referral_required'` at ~line 321):

```php
                'is_review' => (int) ($row['is_review'] ?? 0) === 1,
```

Do NOT add `is_review` to the admin save/edit paths in V1 — the marker is seed-owned (spec decision).

- [ ] **Step 3: Gates** — `composer verify:new-clinic` → PASS; `vendor/bin/phpunit -c phpunit.xml tests/Tests/Unit/Modules/NewClinic` → no new failures (fix any test pinning the exact `listForDesk` field list by adding the new field to its expectation).

- [ ] **Step 4: Live read check (flag ON briefly).** Throwaway CLI script (scratchpad, per the CLI-smoke house pattern: `$ignoreAuth = true; $_GET['site']='default'; require interface/globals.php; $_SESSION['authUser']='Adminstrator';` and flag toggled via `ClinicConfigService::set` — never raw SQL): with the flag ON, call `(new ReviewVisitSuggestionService())->suggestFor($pidWithRecentVisit, 3)` and print — expect a populated array for a patient with a recent encounter and `null` for a patient without. Toggle OFF, verify, record both outputs in the commit message body or a note.

- [ ] **Step 5: Commit**

```bash
git add interface/modules/custom_modules/oe-module-new-clinic/src/Services/PatientContextService.php interface/modules/custom_modules/oe-module-new-clinic/src/Services/VisitTypeAdminService.php
git commit -m "feat(new-clinic): review suggestion in front-desk preview + is_review on visit types (REV-3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task REV-4: Front-desk prompt (TDD)

**Files:**
- Modify: `frontend/src/core/types/front-desk.ts` (interfaces at ~17 and ~108)
- Modify: `frontend/src/islands/front-desk/useStartVisit.ts`
- Modify: `frontend/src/islands/front-desk/StartVisitForm.tsx` (~line 210, above the visit-type field)
- Test: `frontend/src/islands/front-desk/FrontDesk.test.tsx` (follow its existing per-action `oeFetch` mock pattern)

**Interfaces:**
- Consumes: REV-3's payload fields.
- Produces: `UseStartVisitReturn` gains `reviewSuggestion: { daysAgo: number; reviewVisitTypeId: number } | null` (already filtered to "the review type actually exists in the loaded list and isn't already selected") and `applyReviewSuggestion: () => void`.

- [ ] **Step 1: Types** — in `front-desk.ts`:

```ts
// In DeskVisitType (after allows_referral_upload):
  is_review?: boolean;

// In FrontDeskPreviewData (top-level, after queue_bridge / revisit_gate — match neighbors):
  review_suggestion?: {
    days_ago: number;
    last_visit_date: string;
    review_visit_type_id: number;
  } | null;
```

- [ ] **Step 2: Write the failing tests** in `FrontDesk.test.tsx` — read the file's existing mock scaffolding first and reuse it exactly (it mocks `@core/oeFetch` per action; extend the `patients.preview` fixture and the `visit.types` fixture). The two tests to add:

```tsx
it('prompts to book as Review when the preview suggests it, and one click selects the Review type', async () => {
  // Arrange: preview fixture with review_suggestion = { days_ago: 5, last_visit_date: '2026-07-14', review_visit_type_id: 42 }
  // and visit.types fixture including { id: 42, label: 'Review', is_review: true }.
  // (Concrete wiring: copy the file's existing preview/types fixtures and extend them.)
  // Act: open the start-visit panel for the patient.
  expect(await screen.findByText(/Seen 5 days ago/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /book as review/i }));
  // Assert: the visit-type select now shows Review.
  expect(screen.getByLabelText(/visit type/i)).toHaveTextContent('Review');
});

it('shows no Review prompt when the preview has no suggestion', async () => {
  // Arrange: same fixtures but review_suggestion: null.
  // Assert:
  expect(screen.queryByText(/book as review/i)).not.toBeInTheDocument();
});
```

(The comments describe fixture arrangement, not skipped work — write the real `mockResolvedValue` wiring against the file's existing helpers; if the file mounts `StartVisitForm` through a smaller harness, target that instead of the whole island. Assert on real rendered output, not mock internals.)

- [ ] **Step 3: Run to verify failure** — `cd frontend && npx vitest run src/islands/front-desk/FrontDesk.test.tsx` → the two new tests FAIL (prompt not rendered).

- [ ] **Step 4: Implement.** In `useStartVisit.ts`:

```ts
// Derived (place with the other preview-derived consts around line 132-151):
const rawSuggestion = preview.review_suggestion ?? null;
const reviewTypeInList = rawSuggestion
  ? types.find((t) => t.id === rawSuggestion.review_visit_type_id && t.is_review) ?? null
  : null;
const reviewSuggestion = rawSuggestion && reviewTypeInList && String(reviewTypeInList.id) !== visitTypeId
  ? { daysAgo: rawSuggestion.days_ago, reviewVisitTypeId: reviewTypeInList.id }
  : null;

const applyReviewSuggestion = useCallback(() => {
  if (rawSuggestion) {
    setVisitTypeId(String(rawSuggestion.review_visit_type_id));
    markDirty();
  }
}, [markDirty, rawSuggestion]);
```

Add both to `UseStartVisitReturn` and the returned object. In `StartVisitForm.tsx`, directly above the visit-type `<Label>` block (~line 212):

```tsx
{reviewSuggestion && (
  <div className={deskCalloutClass('info')} role="status">
    <p className="m-0">
      Seen {reviewSuggestion.daysAgo === 0 ? 'today' : `${reviewSuggestion.daysAgo} day${reviewSuggestion.daysAgo === 1 ? '' : 's'} ago`} — same complaint? Book as a Review visit at the clinic's review price.
    </p>
    <Button type="button" variant="outline" size="lg" onClick={applyReviewSuggestion}>
      Book as Review
    </Button>
  </div>
)}
```

(Import `deskCalloutClass` the way the island already does; destructure the two new hook fields where the form pulls the rest. If the form receives hook state via props rather than calling the hook, thread them through the same way its siblings are threaded. Selecting any other type after accepting simply un-reviews it — no extra state.)

- [ ] **Step 5: Run tests** — `npx vitest run src/islands/front-desk` → all green (new + existing). Then `npm run check` → PASS (typecheck, lint, bs:check, i18n fence untouched).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/core/types/front-desk.ts frontend/src/islands/front-desk/useStartVisit.ts frontend/src/islands/front-desk/StartVisitForm.tsx frontend/src/islands/front-desk/FrontDesk.test.tsx
git commit -m "feat(new-clinic): front-desk Book-as-Review prompt (REV-4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task REV-5: Build, live smoke, docs

**Files:**
- Modify: `.../src/ModuleAssetVersion.php` (append suffix, e.g. `-review1` — never overwrite)
- Modify: `Documentation/NewClinic/README.md` (index row), this plan (Status line + history row)
- Built assets under `.../public/assets/modern/` (committed per branch convention — check `git log --stat` for a prior island commit)

**Interfaces:** none new — this task proves the whole chain.

- [ ] **Step 1: Build + bump** — `cd frontend && npm run build`; append the VERSION suffix; `composer verify:new-clinic` → PASS.

- [ ] **Step 2: Live browser smoke** (Playwright MCP if the shared browser is free — check for `ms-playwright-mcp` chrome processes first and do NOT kill another session's; otherwise the curl-based HTTP smoke pattern in `scripts/smoke-*-http.php` driven at the same checkpoints). Hard refresh (Ctrl+F5) after the build; login `?site=default`:
  1. Admin Hub → Queue & roles → Registration section: turn ON "Enable review visits"; set window 14; Save. Fees tab: set "Review consultation" to a visible test price (e.g. 10.00).
  2. Front Desk: search a patient **with a recent encounter** (create one if needed via a normal visit first) → open start-visit → the "Seen N days ago — Book as Review" callout appears → click it → visit type shows Review → start the visit.
  3. Walk the visit to `ready_for_payment` (triage → doctor complete → sign, or use the golden-path prep script `scripts/e2e-prep-golden-path.php` conventions) → Cashier: the suggested fee line shows **Review consultation at the clinic's price**. Post payment; receipt shows the review line.
  4. Re-open start-visit for a patient with **no** recent encounter → no callout. Then toggle `enable_review_visits` OFF → no callout for anyone (the Review type remains bookable only if the clinic deliberately left it active in Visit types — their choice; a fresh install that never touched the feature sees nothing anywhere, because the type seeds inactive). Note step 1 must therefore ALSO activate the Review visit type in the Visit types tab — the seed ships it inactive by design.
  5. Cleanup: delete/void the smoke visit per usual practice, flag back OFF, note ids.
- [ ] **Step 3: Record evidence** — screenshots (prompt, cashier line, receipt) or HTTP transcripts; note run ids.

- [ ] **Step 4: Docs** — this plan: Status → Delivered + history row (include the is_active=0 seed decision); `Documentation/NewClinic/README.md`: add an index row in the plans section (match surrounding format). Add a one-line "PRD amendment queued" note in the history row.

- [ ] **Step 5: Commit** (include built assets + VERSION per branch convention)

```bash
git add -A -- interface/modules/custom_modules/oe-module-new-clinic/public/assets/modern interface/modules/custom_modules/oe-module-new-clinic/src/ModuleAssetVersion.php Documentation/NewClinic
git commit -m "feat(new-clinic): review visits live — build, smoke, docs (REV-5)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Plan self-review notes (resolved inline)

- The REV-5 smoke surfaced a spec conflict while writing this plan (flag OFF must equal legacy behavior, but an active seeded type would appear in pickers regardless of flag): resolved by seeding `is_active = 0`. REV-1's Step 1 SQL block already carries the fix (with an in-block comment); the settings hint tells the admin to activate + price the type when enabling. Also update the REV-1 Step 4 verification expectation accordingly: the Review row check should show `is_active = 0` after seeding.
- No placeholders remain; REV-4's test comments describe fixture arrangement against named existing helpers, with concrete assertions.
- Type consistency: `review_visit_type_id` (snake, wire) vs `reviewVisitTypeId` (camel, hook) is deliberate — wire types mirror PHP, hook state mirrors TS convention.

## Out of scope (V1 — needs a new decision before building)

Auto-prompt in the scheduling booking sheet; percentage-based pricing rules; review chaining/expiry logic; editing `is_review` in the admin visit-type modal; PRD amendment text.

## History

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-07-19 | Initial design + 5-task plan (brainstormed from doctor feedback: half-price reviews → generalized to clinic-chosen review price + clinic-chosen window; auto-suggest with staff confirmation; zero cashier changes by riding visit-type default fees) |
