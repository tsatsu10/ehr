# SEC-8 — Upstream CVE Process & Emergency-Patch Drill

| Field | Value |
|-------|-------|
| **Document version** | 1.0.0 |
| **Baseline** | OpenEMR 8.0.0 (VERSION_BASELINE.md) |
| **Cadence** | Advisory check monthly + before every release train |
| **Owner** | Engineering |

## 1. Monthly / pre-train check

```
php interface/modules/custom_modules/oe-module-new-clinic/scripts/upstream-advisory-check.php
```
Prints advisories new since the last watermark. For each: check the affected
range vs **8.0.0**, then `NEW_CLINIC_SEC8_EXPOSURE_MAP.md`.

## 2. Triage decision (mechanical)

| Condition | Action |
|-----------|--------|
| Affects 8.0.0 **and** hits an exposed surface (login, session, ajax bootstrap, document upload, bridged screen we use) | **Emergency patch drill** (§3), within 48h |
| Only portal / REST / FHIR / OAuth / CCDA / eRx | **Not applicable** — record + skip (surfaces disabled) |
| Affects 8.0.0 but only an unexposed/unused core area | **Next release train** |
| Not in the 8.0.0 range | **No action** (already fixed or never present) |

## 3. Emergency patch drill — command sequence

1. **Get the fix.** Find the upstream commit(s) from the advisory.
   - Small, isolated fix → **cherry-pick**:
     `git fetch upstream && git cherry-pick <sha>` (add `upstream` remote if absent).
   - Broad / conflicting → **targeted patch** onto our fork; mark it `NC-CVE-PATCH`
     with the GHSA id so the next rebase reconciles it.
2. **Verify chain (all must pass):**
   ```
   composer verify:new-clinic          # RESULT: PASS
   composer test:new-clinic-mandatory  # contract + ACL/CSRF/lockout guards
   vendor/bin/phpunit -c phpunit.xml tests/Tests/Unit/Modules/NewClinic
   cd frontend && npm run check         # only if the fix touches JS
   ```
   Plus the smoke set for the affected surface (e.g. SEC-2 CSRF smoke, login smoke).
3. **Canary first.** Deploy to one internal/canary box; run `fleet-healthcheck.sh`
   + a manual smoke of the patched surface. Watch for 24h (or less if severity high).
4. **Fleet rollout within a week** (within 48h for critical): push the tag, roll
   box-by-box, `fleet-healthcheck.sh` green after each.
5. **Record** the GHSA id, commit, and rollout date in this file's log below.

## 4. Dry-run (executed 2026-07-09)

Ran the advisory check mechanism against live GitHub advisories. Real result:

| GHSA | Sev | Affected | In 8.0.0 range? | Exposed surface? | Decision |
|------|-----|----------|-----------------|------------------|----------|
| GHSA-x32c-xj5g-7jx7 (SQLi, patient selection) | high | ≤8.0.0.2 | **Yes** | **Yes** (patient selection, staff) | **Emergency drill** |
| GHSA-6vx2-w9hw-prqj (SQLi, MedEx recall) | medium | ≤8.0.0.2 | Yes | Partial (recalls; our module code is separate) | Next train |
| GHSA-6ch2-p26g-x33h (XSS, Eye Exam form) | high | ≤8.0.0.2 | Yes | No (form unused in cash OPD) | Not applicable |

**Timings / gaps found:** advisory fetch < 5s. Gap: `gh`/`curl` from PHP's
`shell_exec` fails on the Windows dev box (cmd PATH) — the script is intended to
run on the **Linux deployment/CI host**, where curl/gh resolve. Recorded so the
monthly check is scheduled there, not on a dev laptop.

## 5. Rollout log

| Date | GHSA | Decision | Commit | Fleet done |
|------|------|----------|--------|------------|
| 2026-07-09 | (dry-run only) | mechanism validated | — | — |
