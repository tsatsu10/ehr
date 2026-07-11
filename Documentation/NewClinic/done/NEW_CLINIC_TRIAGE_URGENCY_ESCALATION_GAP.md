# New Clinic — Gap: Nurse Cannot Set/Escalate Urgency at Triage

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Status** | **Implemented, audited, and hardened 2026-07-09.** Backend, frontend, tests, and doc sync all landed (§9); a same-day `/code-review` pass found 6 real issues in the first cut, all fixed (§10). |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) §6.4f (urgent ≠ skip triage cross-screen rule), §8 M1.9 (M1d-F06, Start visit Urgent toggle); [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) §8.2 (Nurse — Triage), §12.2 Visit Board ↔ Triage exception matrix; [NEW_CLINIC_PERSONA_NURSE_AKUA.md](../NEW_CLINIC_PERSONA_NURSE_AKUA.md) |
| **Raised by** | User report (2026-07-09), attributed to a working nurse's real-world expectation: severity/urgency triage is a nursing clinical judgment call |
| **Researched** | 2026-07-09 — verified against code (`TriageActionHandler.php`, `TriageService.php`, `VisitQueueService.php`, `TriageQueue.tsx`, `TriageActivePane.tsx`), the ACL matrix, the PRD exception tables, and external clinical-triage practice (ESI, see §7 Sources) |

---

## 1. The gap, verified against code

`is_urgent` on `new_visit` drives queue sort order everywhere (Triage queue, Doctor Desk, Visit
Board — shared `is_urgent DESC, queue_number ASC, started_at ASC` clause, PRD M0-F14). Today it
can be **written** in exactly two places:

1. **Reception, at Start visit** (`front-desk` island → `VisitQueueService::startVisit`) — a
   toggle in the Start Visit form. This is the documented, intentional path (PRD M1d-F06,
   workflows §12.2: *"Reception sets Urgent on Start visit"*).
2. **The nurse, but only for the walk-in-with-no-visit-yet case** — `TriageDesk.tsx`
   `handleAutoStartConfirm()` → `triage.auto_start` → `VisitQueueService::startVisitAtTriage(...,
   $isUrgent)`. This only fires when the nurse is doing reception's job in the moment (patient
   walks straight into the triage room, no visit exists).

For every other patient — the overwhelming majority, who arrive via a visit reception already
started — **there is no control anywhere in the Triage Desk UI to set or change `is_urgent`**.
Confirmed by reading the full triage surface:

- `TriageQueue.tsx` / `TriageQueueCardBadges.tsx` — read `card.is_urgent` for the badge and sort
  class only; no write.
- `TriageActivePane.tsx` — vitals form, chief complaint, Start triage / Save vitals / Send to
  doctor buttons. No urgency control anywhere in the active pane.
- `TriageActionHandler.php` — dispatches `triage.select`, `triage.save_vitals`,
  `triage.send_doctor`, `triage.auto_start`, `triage.restore_session`. None of these accept or
  mutate `is_urgent` for an existing visit.
- `TriageService.php` — no method touches `is_urgent`.

So a nurse who takes vitals on a patient reception logged as routine, and finds a dangerously high
blood pressure or a child with a high fever, has **no way to move that patient to the front of her
own queue** — the exact scenario PRD's own vitals-warning system (`evaluateWarnings()` in
`VitalsPreviewBuilder`) already detects, but does nothing with beyond a visual warning on her
screen.

This is not a bug in the sense of broken code — reception's flag works exactly as designed. It is
a **missing feature**: the PRD scoped "who can set urgent" to reception only (§6.1, M1d-F06) and
never revisited it for the nurse's own clinical assessment during triage itself.

---

## 2. Why this matters (clinical practice, not just this codebase)

Standard emergency/urgent-care triage practice treats the *first* acuity assignment — whether by a
receptionist's visual read, a kiosk, or an algorithm — as provisional, and gives the **triage
nurse** explicit authority to override it once she has actually assessed the patient. In the
Emergency Severity Index (ESI) model this is a named part of the workflow, and the convention is
that the override **reason is recorded**, not that the override is blocked or requires a second
approver:

> "Well-trained triage nurses are allowed to override the acuity level for each patient at the end
> of the routine triage process if the computer-generated triage score does not correspond to the
> nurses' clinical impression, though the reason for this override must be recorded."
> — see Sources

New Clinic's reception-set flag is even less authoritative than a "computer-generated triage
score" — it's a non-clinical staff member's visual guess, taken *before* any vitals exist. Denying
the nurse an equivalent override is a stricter restriction than standard clinical practice applies
to a full ESI algorithm. This lines up with what Akua's persona already claims she wants (§4:
*"she wants the system to support urgent-patient prioritization, not silently override her sense
of who needs to be seen next"*) — a claim the persona doc made before this gap was verified against
code, and which the code does not currently back up (see §5).

---

## 3. Proposed design

Minimal, additive, reuses existing plumbing — no new tables, no state-machine changes.

### 3.1 What does NOT change (hold this invariant)

PRD and workflows are explicit and this proposal does not touch it: **`is_urgent` alone must never
change visit state** (workflows §12.2 exception matrix: *"urgent alone must not change state"*).
The nurse still runs full triage on an escalated patient — escalation reorders the queue, it does
not skip triage (that's the separate, already-built **Skip triage** exception, reception/lead
only, unrelated to this proposal).

### 3.2 Backend

New `TriageService` method, following the exact shape of `sendToDoctor()`/existing mutations
(`getVisitForActor` load, optimistic `row_version` lock, no `logStateChange` call since state does
not change):

```php
public function setUrgency(
    int $visitId,
    int $actorUserId,
    int $expectedVersion,
    bool $isUrgent,
    ?string $reason = null
): array {
    $visit = $this->queueService->getVisitForActor($visitId);
    if (!in_array($visit['state'], ['waiting', 'in_triage'], true)) {
        throw new \InvalidArgumentException('Visit must be waiting or in triage to change urgency');
    }
    if ((int) $visit['is_urgent'] === ($isUrgent ? 1 : 0)) {
        return $this->queueService->getVisitForActor($visitId); // no-op, idempotent
    }

    $reasonValue = $reason !== null ? mb_substr(trim($reason), 0, 200) : null;
    // De-escalating a flag reception set is the riskier direction — require a reason for it.
    if (!$isUrgent && ($reasonValue === null || $reasonValue === '')) {
        throw new \InvalidArgumentException('Reason required to remove the urgent flag');
    }

    $sql = "UPDATE new_visit SET is_urgent = ?, row_version = row_version + 1, updated_at = NOW()
            WHERE id = ? AND row_version = ?";
    $affected = sqlStatement($sql, [$isUrgent ? 1 : 0, $visitId, $expectedVersion]);
    if (!$affected) {
        throw new \InvalidArgumentException('Visit was modified by someone else — refresh and retry');
    }

    $this->audit('new_visit', 'urgency_changed', (int) $visit['pid'], $visitId, [
        'is_urgent' => $isUrgent,
        'reason' => $reasonValue,
        'set_by_role' => 'nurse',
        'prior_value' => (int) $visit['is_urgent'],
    ]);

    return $this->queueService->getVisitForActor($visitId);
}
```

New ajax action `triage.set_urgent` in `TriageActionHandler.php`, same POST + CSRF + ACL shape as
`triage.save_vitals`:

```php
case 'triage.set_urgent':
    if ($method !== 'POST') { $this->host->respond(false, 'POST required', [], 405); }
    $body = $this->host->readJsonBody();
    $this->host->verifyCsrf($body);
    $visit = $this->host->svc(TriageService::class)->setUrgency(
        (int) ($body['visit_id'] ?? 0),
        $userId,
        (int) ($body['row_version'] ?? 0),
        !empty($body['is_urgent']),
        isset($body['reason']) ? (string) $body['reason'] : null
    );
    $this->host->respond(true, 'Urgency updated', ['visit' => $visit]);
    break;
```

**ACL:** `new_nurse`, `single_acl` — same as her other triage actions (`save_vitals`,
`send_doctor`). No lead/manager gate: unlike Skip-to-payment (a billing-workflow shortcut that
needs lead sign-off), setting urgency during triage is squarely her own clinical scope, and
gating it behind a lead would recreate exactly the "override theater" pattern the Reception
persona already resents. Add one row to `AJAX_ACTION_ACL_MATRIX.md`:
`triage.set_urgent | single_acl | new_nurse`.

**Audit:** reuses the existing `EventAuditLogger` pattern (`category='new_visit',
event='urgency_changed'`) — no new table or column. Every change is attributable, timestamped, and
reason-bearing when de-escalating, same discoverability as every other `new_visit.*` event.

**Zero blast radius elsewhere:** because `is_urgent DESC` is already the first sort key shared by
`TriageService::getTriageQueue`, `DoctorService` queue queries, and `VisitBoardService`, flipping
the flag here automatically reorders the Triage queue, and — once the patient reaches
`ready_for_doctor` — the Doctor Desk and Visit Board too. No changes needed to those three
surfaces beyond what already exists.

### 3.3 Frontend

Add an urgency toggle to `TriageActivePane.tsx`, visible whenever a visit is open (`waiting` or
`in_triage`, i.e. before and during vitals capture — the two moments she's actually assessing the
patient):

- A compact toggle/badge near the chief-complaint field (not a full `ConfirmModal` — this needs to
  be fast, one interaction, matching her "keep the bench moving" and "not be second-guessed by the
  computer" priorities from her persona; a modal-per-flag would feel like the "override theater"
  Reception's persona already flags as a trust-eroding pattern).
- Escalating (OFF → ON): one click, optional reason text collapsed under an "Add reason" toggle —
  optional because speed matters most in the direction that protects the patient.
- De-escalating (ON → OFF): reason field mandatory and expands automatically — matches the backend
  rule in §3.2 and the real-world convention that removing a safety flag is the direction that
  needs a paper trail.
- `showDeskToast()` confirmation on save ("Marked urgent — moved to top of queue" /
  "Urgent flag removed"), per the existing desk-feedback convention (CLAUDE.md §7).
- Queue re-sorts on the next 30s poll or immediately via optimistic local reorder, consistent with
  how other same-queue mutations already behave.

---

## 4. Non-goals for this proposal

- **No ESI-style scoring algorithm.** This is a binary flag matching what already exists
  (`is_urgent`), not a new acuity scale — that would be new PRD scope requiring its own amendment.
- **No change to who can set urgent at Start visit.** Reception keeps that path unchanged; this
  adds a second, independent write surface for the nurse, it doesn't take anything away.
- **No state-machine change.** Confirmed in §3.1 — urgent alone still never skips triage.
- **No removal of reception's own judgment.** Reception's flag is still respected and still sorts
  the queue the moment it's set; the nurse's flag is an *additional* clinical check, not a
  replacement gate reception must pass through.
- **Doctor/other-desk urgency-setting is out of scope here** — the Doctor Desk already reads
  `is_urgent` for its own sort; whether a doctor should also be able to flag urgency retroactively
  is a separate question, not addressed by this proposal.

---

## 5. Persona correction

[NEW_CLINIC_PERSONA_NURSE_AKUA.md](../NEW_CLINIC_PERSONA_NURSE_AKUA.md) §3 and §4 originally
described Akua flagging urgent cases as part of her normal triage day — that predated verification
and wasn't true of the product at the time. Corrected same-day (persona v1.2.0) to describe it as
a known, designed-but-unbuilt gap; flipped back to describing real, shipped behavior once this
landed (persona v1.4.0) — see §9.

---

## 6. What updates when this ships (do not skip — CLAUDE.md §12)

- Workflows §8.2 (Nurse — Triage playbook) — add the escalation step; §12.2 exception matrix — add
  a row analogous to the existing "Urgent walk-in" row, crediting the nurse as an actor. **Done** —
  workflows v1.9.51, §8.2 step 3b + §12.2 row.
- `AJAX_ACTION_ACL_MATRIX.md` — add `triage.set_urgent` row (see §3.2). **Done** — v1.0.1.
- Akua's persona — remove the "proposed" framing from §5 once shipped, restore §3/§4 to describing
  real behavior, bump version, add history row. **Done** — persona v1.4.0.
- README.md — index entry for this doc's "Implementation-closed" status. **Done.**
- PRD §6.4f / §8 M1.9 (M1d-F06) area and `NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md` line item — **not done
  in this batch**; both are large, heavily cross-referenced documents and a single-feature edit
  risks drifting their own version/history conventions without a dedicated pass. Flagged here so
  it isn't silently dropped — pick up next time either document is touched for Triage/M2.

## 7. Acceptance / verification — completed 2026-07-09 (re-run after §10 audit fixes)

- `composer verify:new-clinic` → `RESULT: PASS` (252 actions, 0 constructor cycles) — both before
  and after the §10 consolidation.
- `composer test:new-clinic-mandatory` → 85/85 (ACL contract + CSRF coverage both exercise
  `triage.set_urgent` regardless of which service class handles it).
- `vendor/bin/phpunit --filter "TriageServiceTest|VisitQueueServiceTest"` → 19/19 (3 new
  reflection-based structural cases on `VisitQueueServiceTest.php`, matching that file's existing
  convention for methods that can't be unit-invoked without a live DB).
- `cd frontend; npm test -- --run src/islands/triage-desk` → 21/21 (2 new cases, unaffected by the
  backend consolidation since they test through the `oeFetch` mock); `npm run check` → pass (lint +
  typecheck + full vitest); `npm run build` → pass.
- Manual smoke deferred to the user's own hard-refresh pass (see `ModuleAssetVersion.php` bump
  note in §9) — golden-path Playwright specs untouched, this is additive to an existing desk's ACL
  surface, not a new queue state, so no new fixtures were needed.

---

## 8. Sources

Web research (2026-07-09) grounding the "nurse override, reason recorded" pattern as standard
clinical-triage practice, not a New Clinic invention:

- [Priority Queue in the Setting of Nurse Triage — American Academy of Ambulatory Care Nursing](https://library.aaacn.org/p/s/priority-queue-in-the-setting-of-nurse-triage-spotlight-poster-13813)
- [Some Patients Can't Wait: Improving Timeliness of Emergency Department Care — AHRQ PSNet](https://psnet.ahrq.gov/web-mm/some-patients-cant-wait-improving-timeliness-emergency-department-care)
- [Validation of a five-level triage system in pediatric trauma and the effectiveness of triage nurse modification — PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9664936/)
- [Emergency Severity Index (ESI) — A Triage Tool for Emergency Department Care (AHRQ/govinfo)](https://www.govinfo.gov/content/pkg/GOVPUB-HE20_6500-PURL-gpo23161/pdf/GOVPUB-HE20_6500-PURL-gpo23161.pdf)
- [ENA Updates Emergency Severity Index Resources to Improve Patient Triage — Emergency Nurses Association](https://www.ena.org/news-publications/newsroom/ena-updates-emergency-severity-index-resources-improve-patient-triage)

---

## 9. Implementation notes (2026-07-09, final state after §10 audit)

**`VisitQueueService::setUrgency()` is the single, self-contained owner of this mutation** —
`TriageService` does **not** have a `setUrgency()` method; `TriageActionHandler`'s
`triage.set_urgent` case calls `VisitQueueService::setUrgency()` directly, matching the existing
precedent set by `triage.start`/`triage.auto_start` (both already bypass `TriageService` for
mutations with no triage-specific business logic on top of the generic FSM/row rules). This is the
*post-audit* shape — the first pass split validation into `TriageService` with a thin delegate to
`VisitQueueService`; §10 found that split left `VisitQueueService::setUrgency()` unsafe to call on
its own (no facility re-check, no reason re-validation, no state pin), so it was consolidated into
one method, mirroring `cancelVisit()`'s shape exactly: validates its own reason rule, re-fetches
via `getVisitForActor()` (facility/ACL check), pins `state IN ('waiting','in_triage')` in the
UPDATE's WHERE clause alongside `row_version`, and **always** runs the versioned UPDATE — including
when the target value already matches current state — so a stale caller can never get a silent
"success" instead of a conflict. The actor id is threaded into the audit payload
(`'actor_user_id' => $actorUserId`), matching the `reopen`/`take` convention.

**Files touched (final):**
- `VisitQueueService.php` — `setUrgency()`: the complete self-contained mutation (validation +
  versioned update + audit).
- `TriageActionHandler.php` — `triage.set_urgent` action, calls `VisitQueueService` directly.
- `AjaxActionPolicy.php` — ACL `new_nurse`.
- `AJAX_ACTION_ACL_MATRIX.md` — row added.
- `frontend/src/core/types/triage.ts` — `is_urgent` added to `TriageVisit`.
- `frontend/src/islands/triage-desk/TriageUrgencyControl.tsx` — new component (escalate: one
  click, optional reason; de-escalate: reason required, expands automatically). A shared
  `ReasonField` sub-component avoids duplicating the Label+Textarea between the two branches.
- `TriageActivePane.tsx` — wired in; keyed by `${visit.id}-${visit.is_urgent}` so the control
  remounts (and drops any typed reason text) whenever urgency flips, not only when the patient
  changes — see §10 finding 1.
- `TriageDesk.tsx` — `handleSetUrgency`, `showDeskToast()` on success.
- Tests: `VisitQueueServiceTest.php` gained 3 reflection-based structural tests (matching that
  file's established convention for methods that touch the DB directly and can't be unit-invoked
  against a mock); the 5 cases originally added to `TriageServiceTest.php` were removed along with
  the method they tested. `TriageDesk.test.tsx` keeps its 2 new cases (still test through
  `oeFetch('triage.set_urgent', ...)`, unaffected by the backend consolidation).
- Docs synced: workflows §8.2 step 3b + §12.2 exception matrix row, Akua's persona (§3/§4/§8
  flipped from "known gap" to shipped behavior), this document.
- **Deferred:** PRD §6.4f/§8 M1.9 (M1d-F06) and the implementation scorecard — see §6.

`ModuleAssetVersion.php` bumped to `20260709triageurgent`; `npm run build` completed clean
(`triage-desk.js` rebuilt). **Hard-refresh (Ctrl+Shift+R) the Triage Desk to pick up the new
bundle** before testing in the browser.

## 10. Post-ship audit (2026-07-09)

Run immediately after §9's first-pass implementation, using the project's `/code-review` skill at
high effort (5 parallel finder angles: line-by-line diff, removed/weakened-guard audit, cross-file
tracing, reuse/simplification/efficiency, altitude/conventions) plus manual verification against
sibling methods (`transition()`, `cancelVisit()`) in `VisitQueueService.php`. All findings were
independently corroborated by 2–4 of the 5 angles before being treated as real. Fixed in this same
batch — the "Files touched" list in §9 above already reflects the corrected code:

- **Stale reason text carried across an urgency flip** — `TriageUrgencyControl`'s local
  `reason`/`reasonOpen` state only reset when the *patient* changed (`key={visit.id}`), not when
  `isUrgent` itself flipped for the same patient — an escalation note typed by the nurse could
  resurface pre-filled and ready to submit as the de-escalation justification. Fixed by keying on
  `${visit.id}-${visit.is_urgent}`.
- **Optimistic lock bypassed on the no-op path** — the original `TriageService::setUrgency()`
  returned early (without touching `row_version`) whenever the requested value already matched
  current state, so a caller with a stale view whose target happened to coincide with reality got
  a silent "success" instead of a stale-visit conflict. Fixed by removing the early return
  entirely — `VisitQueueService::setUrgency()` now always runs the versioned UPDATE; a genuine
  no-op just means `is_urgent` is set to the value it already had (harmless) while `row_version`
  still advances and the caller's optimistic-lock token is still consumed correctly. Audit rows
  are only written when the value actually changes, preserving the original intent of not spamming
  the log for confirmed-idempotent clicks.
- **Weaker guarantees than sibling mutators** — the first-pass `VisitQueueService::setUrgency()`
  pinned only `id`+`row_version` in its WHERE clause (siblings also pin `state`), never re-checked
  facility access itself (siblings re-fetch via `getVisitForActor()` internally), and never
  re-validated the reason-required rule (siblings like `cancelVisit()` self-validate their own
  required fields). All three fixed by consolidating validation into `VisitQueueService::setUrgency()`
  per §9, matching `cancelVisit()`'s shape line-for-line in spirit.
- **Unused `$actorUserId` parameter, not threaded to the audit trail** — resolved as a side effect
  of the consolidation; the actor id now appears in the `urgency_changed` audit payload.
- **Redundant third DB fetch** — the first pass fetched the visit row three times (once in
  `TriageService`, twice more in `VisitQueueService`) for one flag flip; the consolidated method
  fetches twice (before/after), matching every sibling mutator.
- **Copy-pasted reason field markup** — `TriageUrgencyControl`'s two branches duplicated the
  Label+Textarea block with a reused `id`. Extracted into a small `ReasonField` sub-component
  within the same file; each branch now passes its own unique id and required/optional flag.

**Considered and deliberately not changed:**
- **Hand-rolled reason-confirm UI instead of reusing `ConfirmModal`** (the pattern
  `SkipToPaymentModal.tsx` uses) — this was a deliberate design choice from §3.3, not an oversight:
  a full modal per urgency flag would recreate the "override theater" feel the Reception persona
  already flags as trust-eroding, and Akua's persona explicitly wants this fast and inline.
- **No guard against switching the active patient while a `set_urgent` request is in flight** —
  real and reachable (confirmed by reading `selectVisit()`'s switch-guard, which checks only
  `formDirty`), but verified to be a **pre-existing pattern shared by every mutation handler in
  `TriageDesk.tsx`** (`handleSave`, `handleStart`, `executeSendToDoctor` have the identical gap),
  not a regression introduced here. Fixing it properly means auditing all four handlers together —
  out of scope for a single-feature gap closure; flagged for a future dedicated pass rather than
  silently accepted.
- **Generic `EventAuditLogger` JSON payload instead of a first-class structured log table for
  urgency changes** — raised, then checked against precedent: every other *non-state-transition*
  `new_visit` metadata change in this codebase (`taken`, `lab_taken`, `pharmacy_taken`,
  `appointment_linked`) is logged the same way; only actual state transitions get a
  `new_visit_state_log` row via `logStateChange()`. Urgency changes are explicitly not a state
  transition (§3.1), so the generic audit log is the consistent choice, not a gap.

---

## Document history

| Version | Date | Changes |
|---|---|---|
| 0.1.0 | 2026-07-09 | Initial gap write-up: verified against `TriageActionHandler.php`, `TriageService.php`, `VisitQueueService.php`, `TriageQueue.tsx`, `TriageActivePane.tsx`, PRD/workflows exception matrices, ACL matrix; design grounded in ESI nurse-override clinical practice (see §7 Sources); companion correction to Akua persona v1.2.0 |
| 1.0.0 | 2026-07-09 | **Implemented and shipped.** Backend (`TriageService`/`VisitQueueService`/`TriageActionHandler`/`AjaxActionPolicy`), frontend (`TriageUrgencyControl`, wired into the active pane), tests (5 PHP + 2 frontend), and doc sync (workflows, ACL matrix, Akua persona) all landed and verified — see §9. Moved to `done/`. |
| 1.1.0 | 2026-07-09 | **Post-ship audit (§10).** `/code-review --effort high`, 5 finder angles, found 6 real issues in the first cut: stale reason text across an urgency flip, optimistic-lock bypass on the no-op path, `VisitQueueService::setUrgency()` missing the state-pin/facility-recheck/reason-revalidation guarantees its siblings have, an unused `$actorUserId` never reaching the audit trail, a redundant third DB fetch, and duplicated reason-field markup. All fixed by consolidating `setUrgency()` entirely into `VisitQueueService` (matching `cancelVisit()`'s self-contained shape) and removing the pass-through `TriageService::setUrgency()`. Two items considered and deliberately left as-is (documented, not silently dropped). PRD companion citation in this doc's own header corrected (was citing the wrong section, §6.1, instead of §6.4f/§8 M1.9). Re-verified: `composer verify:new-clinic` PASS, mandatory contracts 85/85, `TriageServiceTest`+`VisitQueueServiceTest` 19/19, frontend 21/21 + check + build all pass. |
