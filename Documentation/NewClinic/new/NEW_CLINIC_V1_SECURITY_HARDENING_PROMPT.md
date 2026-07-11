# New Clinic — V1 Security Hardening Prompt (SEC-1..8)

**Version:** v0.1.0 · **Date:** 2026-07-09 · **Status:** Ready to run
**Owner:** Product/Founder · **Read alongside:**
[Master plan §7.2/§7.3](./NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md) ·
[Scalability plan](./NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md) ·
[VPS replica prompt](./NEW_CLINIC_VPS_REPLICA_DEPLOYMENT_PROMPT.md) · CLAUDE.md §6.4

One executable prompt covering the full pre-pilot security pass. Run it as a single
audit → todo → fix-ALL → verify batch per phase, in phase order (highest risk first).
**SEC-1 is the only phase that blocks the first pilot going live**; SEC-2..6 should land
before pilot conversion; SEC-7..8 are deployment/process work that can run in parallel.

---

## The prompt

```
Run a full security hardening pass on the New Clinic module and its deployment posture.
Execute phases in order; within each phase: audit first, produce a findings table, then
fix EVERY finding critical→low in one pass (no partial fixes), then verify.

GLOBAL RULES (apply to every phase):
- Deployment context: staff-only system; on-prem clinic box primary + one-way VPS
  read-replica (default), or opt-in VPS-primary; Tailscale tunnel per master plan §7.3.
  Patient portal, REST API, and FHIR are disabled product non-goals — verify disabled,
  don't harden them.
- Don't rebuild what OpenEMR core already has (auth counters, CsrfUtils, AclMain,
  EventAuditLogger). Configure and extend; never duplicate.
- Core-file patches: minimal, clearly marked for upstream-rebase survival (CLAUDE.md
  §6.4). Module changes follow all standing gates: composer verify:new-clinic must
  print RESULT: PASS; frontend touched → cd frontend && npm run check && npm run build
  + ONE ModuleAssetVersion bump for the whole batch; schema/ACL → upgrade_sql.php +
  install_acl.php; browser smoke per phase.
- Never log or display patient data in error paths: log identifiers (pid, encounter,
  action, user), never clinical/demographic values.
- One SEC task ID per commit (feat/fix(new-clinic): ... SEC-N).

── SEC-1 · PER-ACTION AUTHORIZATION AUDIT (blocks pilot) ─────────────────────────
1. Enumerate every dispatchable action in public/ajax.php: AjaxController routes +
   all handlers in src/Controllers/Ajax/Handlers/*. Build the table: action →
   handler → ACL check applied (which ACO via AclMain::aclCheckCore) → intended
   role(s) per the PRD role matrix.
2. Flag: actions with no ACL check on their path; too-broad ACOs (any-authenticated
   guarding clinical notes or cash ops); reads returning PHI/financial data beyond
   the caller's role; writes callable by roles the PRD doesn't grant.
3. IDOR sweep: every action taking pid/encounter/visit id must validate the id
   against session facility scope and the wrong-patient guards (G12) — an authorized
   role must not operate on an arbitrary pid via payload editing.
4. Fix all; new/changed ACOs via bin/install_acl.php. Save the action→ACL table as
   Documentation/NewClinic/new/AJAX_ACTION_ACL_MATRIX.md (versioned living doc).
5. Contract tests: per action, assert expected deny for at least one wrong-role
   session (extend tests\Tests\Unit\Modules\NewClinic, pattern after the queue-FSM /
   wrong-patient contract tests; add to composer test:new-clinic-mandatory).
Smoke: two different roles in the browser — denied action returns the generic
envelope error, not a 500.

── SEC-2 · CSRF COVERAGE ─────────────────────────────────────────────────────────
1. From the SEC-1 action table, mark every write action (any INSERT/UPDATE/DELETE or
   state change in its call graph). Confirm AjaxController::verifyCsrf() runs on each
   write path BEFORE side effects; flag writes reachable without it, including any
   dispatched via GET.
2. Method discipline: state-changing actions reject GET.
3. Frontend: oeFetch and legacy postJson() always attach the token from the #nc-t1
   shell data attributes for writes — audit all islands.
4. Bridge pages (admin-people-legacy.php, clinical-form-bridge.php): wrapped legacy
   screens keep stock CSRF handling intact through the bridge.
5. Failure behavior: bad/missing token → existing generic 403 envelope, audit-logged
   (action + user, never the token value).
Smoke: curl a write action with the token stripped → 403.

── SEC-3 · SERVER-SIDE INPUT VALIDATION ──────────────────────────────────────────
Scope: user-typed identity/profile fields — patient registration/demographics
(FrontDeskActionHandler + services), staff create/edit (AdminActionHandler / People &
Access), my-profile. Do NOT touch stock core login.
1. Validate format + length in the service layer (PHP enforces; React inline
   validation is UX only). No external validation lib: one shared validator helper in
   src/Services/, consolidating the existing validate*/InvalidArgumentException
   patterns (don't add a 16th variant).
2. Sanitize: reject/strip HTML and script tags; parameterized ADODB always (no
   string-interpolated SQL); output escaping via text()/attr() stays — input
   sanitizing is defense-in-depth, not a substitute.
3. Errors in the module envelope { success:false, error:... }: field-level keys for
   registration/profile forms (inline-validation UX rule — form must not wipe);
   generic message ONLY for auth-adjacent actions (password change, username checks).
4. Log validation failures via EventAuditLogger (action + user id, never the rejected
   value — may contain PHI or a password).
5. Unit tests: reject/accept cases per field.
Reminder: every new XxxService in AjaxController needs its use import; no eager
service construction (ctor-cycle rule).

── SEC-4 · AUTH ERROR UNIFORMITY (pre-auth surfaces only) ────────────────────────
1. Core login flow (interface/login/login.php + src/Common/Auth/AuthUtils.php): every
   failure path (unknown user, wrong password, locked, expired, disabled) → one
   uniform message, no wording/status/timing/redirect-param differences. Strings go
   through xl(); check AuthUtils return codes rendered differently by login.php.
2. public/ajax.php pre-auth: unauthenticated / bad-CSRF / unknown-action requests get
   one generic envelope error — no stack traces or PHP warnings in the body.
3. Verify portal/API/FHIR disabled in deployment config; record "disabled".
4. OUT of scope — do not genericize: staff-facing messages behind a valid session
   ("patient not found", duplicate-patient warnings, "username taken" in admin hub).
5. Server-side detail stays: uniform user-facing message, precise EventAuditLogger
   trail.
Smoke: wrong username vs wrong password vs locked account — visually and textually
identical at the login screen.

── SEC-5 · BRUTE-FORCE PROTECTION + HUMANE RECOVERY ──────────────────────────────
Design rule: brutal to bots at the network layer, forgiving to humans at the account
layer (Ghanaian clinic staff forget passwords often — recovery must be fast and local).
1. Network layer: default posture is tunnel-only (SEC-7) — bots never see the login
   page. For any publicly exposed deployment: fail2ban jail on OpenEMR auth failures
   (ban ~8 fails/5 min, escalating) + web-server rate limit on the login URL. No
   in-PHP progressive sleep (self-DoS on a public VPS); cap at 2s if kept anywhere.
2. Account layer (core globals, set via a deployment script in the module's
   scripts/): password_max_failed_logins=10;
   time_reset_password_max_failed_logins=300 (5-min auto-unlock — a locked
   receptionist mid-queue is a clinic outage). Uniform error per SEC-4.
3. Password policy globals: NO forced periodic expiration (drives forgetting +
   sticky notes; NIST 800-63B); length over complexity soup; history off/minimal.
   Document each deliberate relaxation.
4. Login screen: show-password toggle (verify core has one; else small marked patch)
   — typos in hidden fields on shared keyboards are half of "forgotten" passwords.
5. Recovery UX: People & Access hub gets a locked/failed-logins indicator and a
   one-click unlock + set-temporary-password (forces change at next login), ACL'd to
   the clinic's local admin, audit-logged. No email reset flow.
6. Laminated quick-card (printable md, §7.3 knowledge-base style): "Can't log in?" —
   3 steps for staff, 3 for the admin.
Smoke: 10 wrong passwords → locked, generic message → admin unlocks from hub → temp
password login forces change.

── SEC-6 · PHI IN LOGS, EXPORTS & BACKUPS ────────────────────────────────────────
1. Code scan (module src/, public/, scripts/, frontend/): logging of payloads or
   patient fields — error_log, EventAuditLogger misuse, exception messages embedding
   names/DOB/diagnosis, stray console.*. Fix to identifier-only logging.
2. Error display: display_errors=Off in production config; ajax.php never echoes
   stack traces into JSON (exception → generic error + server log); check the
   MySQL-down outage path doesn't dump connection strings.
3. Export surfaces (ReportHubExportService, registry cohort export, M14 bill-ops):
   files land in protected paths, not world-readable temp; cleaned up after.
4. Backups (deployment): encrypted before leaving the box; key custody documented
   (clinic copy + our copy, MSA annex per §7.2); replica snapshot pipeline from the
   VPS replica prompt counts as the off-site copy; monitoring ships status only.
5. Apache/PHP log rotation + retention on the clinic box (XAMPP error.log grows
   unbounded) — runbook section.
Smoke: induce an error → browser sees generic envelope, error.log has the detail.

── SEC-7 · TLS & NETWORK ACCESS (both hosting flavors) ───────────────────────────
1. Default: tunnel-only (Tailscale/WireGuard). Apache serves HTTPS on the tunnel
   interface only; firewall denies all public inbound except key-only SSH (ideally
   tunnel-only too). TLS inside the tunnel via Tailscale cert or internal CA —
   document the choice and the clinic written-consent step (§7.3).
2. Public-exposure variant (explicit customer opt-in only): Let's Encrypt +
   auto-renew + renewal-failure alert into fleet monitoring; 80→443 redirect; HSTS;
   TLS 1.2+; fail2ban from SEC-5 assumed.
3. Both: session cookie secure/httponly/samesite (verify core defaults first);
   phpMyAdmin absent or tunnel-only; MySQL bound to localhost/tunnel; unattended
   security updates on.
4. On-prem flavor: same pattern on the clinic mini-PC (self-signed/mkcert local CA,
   browser-trust step documented per OS) — no plaintext HTTP on clinic Wi-Fi.
5. Fleet checklist entries (scriptable, heartbeat-runnable): cert validity, tunnel
   up, firewall as-specified. Outage Runbook additions: cert expired; tunnel down;
   explicit statement that VPS-primary has NO offline mode (paper fallback +
   back-entry procedure).

── SEC-8 · UPSTREAM CVE PROCESS (operationalize CLAUDE.md §6.4) ──────────────────
1. Record the upstream baseline (release/commit this fork tracks) in
   VERSION_BASELINE.md.
2. Exposure map (one page, Documentation/NewClinic/new/): which core surfaces our
   deployments expose (login, session, module ajax bootstrap, document upload,
   bridged legacy screens; portal/API/FHIR disabled) — makes the 48h triage decision
   mechanical: exposed → emergency, unexposed → next train.
3. scripts/upstream-advisory-check: fetch OpenEMR advisories + release notes, diff
   against baseline, print "new since last check". Monthly calendar item + before
   every release train.
4. Emergency-patch drill runbook: cherry-pick vs rebase decision, verify chain
   (composer verify:new-clinic + CI + smoke set), canary first, fleet within a week
   — actual command sequences, not prose.
5. Dry-run the drill once against a real past OpenEMR CVE; record timings; fix
   what was slow.

DELIVERABLES SUMMARY: AJAX_ACTION_ACL_MATRIX.md · contract + unit tests · validator
helper · globals/deployment scripts in module scripts/ · People & Access lockout UX ·
quick-card · runbook sections · TLS setup scripts/configs · VERSION_BASELINE.md ·
exposure map · advisory-check script · drill report. Every phase ends with its smoke
passing and gates green before the next phase starts.
```

---

## Sequencing notes

- **SEC-1 blocks pilot go-live.** One shared endpoint fronting 22 islands means one
  missed ACL check leaks PHI across roles — this is the crown-jewels risk, above
  everything else in this document.
- SEC-2 and SEC-3 reuse SEC-1's action table — run them immediately after while the
  map is fresh.
- SEC-5 depends on SEC-4's uniform-message work and SEC-7's tunnel decision; SEC-7's
  scripts pair with the [VPS replica prompt](./NEW_CLINIC_VPS_REPLICA_DEPLOYMENT_PROMPT.md)
  (same tunnel, same fleet monitoring hooks) — build them in one server-setup pass.
- SEC-8 is process, not code — it can run any time, but the dry-run drill is best done
  after SEC-7 exists so the fleet path is real.

## Explicitly out of scope

Portal/API/FHIR hardening (disabled non-goals — SEC-4.3 just verifies they're off) ·
multi-tenant isolation (gated on SCALE-*) · offline/sync clients (master plan §7.2) ·
penetration testing by a third party (worth buying once revenue exists — note as a
business action, not a SEC task).

## History

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-07-09 | Initial consolidated prompt: SEC-1 ACL audit, SEC-2 CSRF, SEC-3 input validation, SEC-4 auth-error uniformity, SEC-5 brute-force + humane recovery, SEC-6 PHI in logs/backups, SEC-7 TLS/network, SEC-8 upstream CVE process; global rules, sequencing, out-of-scope |
