# SEC-6 — PHI in Logs, Exports & Backups (Runbook)

| Field | Value |
|-------|-------|
| **Document version** | 1.0.0 |
| **Status** | Operational runbook — deploy-time + ongoing |
| **Owner** | Engineering + clinic local admin |
| **Applies to** | Both hosting flavors (on-prem box primary, VPS read-replica / VPS-primary) |

## 1. Code-level (enforced in the module)

- **Logging is identifier-only.** Audit/error paths log `action`, `user`, `pid`,
  `encounter`, `facility` — never names, DOB, phone, diagnosis, or the value that
  failed validation. CSRF and input-validation failures audit to the `log` table
  with field NAMES only (SEC-2/SEC-3). Verified by code scan.
- **No stack traces in responses.** `ajax.php` maps every exception to a generic
  envelope (`{success:false, error}`); server detail goes to the error log. The
  optional `detail` field is gated on `$GLOBALS['debug']`, which must stay unset
  in production.
- **Exports at rest.** Cohort and ancillary exports stream from `php://temp`
  (nothing on disk). The Report Hub async export writes to
  `sites/<site>/documents/nc_report_exports/` — served only through OpenEMR's
  ACL document controller, never directly — with **dir 0700, file 0600**, and a
  **24-hour retention sweep** on each write (`ReportHubExportService`).

## 2. Deploy-time config (apply on every box)

1. **PHP:** merge `scripts/deploy/php-production.ini` — `display_errors=Off`,
   `log_errors=On`, `expose_php=Off`, secure/httponly/samesite session cookies.
   On a DB outage this is what stops a raw connection error reaching the browser.
2. **Log rotation:** install `scripts/deploy/logrotate-openemr.conf` — weekly,
   8 rotations, compressed. The unbounded XAMPP `error.log` is the main offender.
3. **Confirm** `$GLOBALS['debug']` is not set and `sites/*/documents` is not
   directly web-served (stock OpenEMR blocks it; verify after any Apache change).

## 3. Backups (deployment — MSA §7.2)

- **Encrypt before leaving the box.** Backups are encrypted at rest and in
  transit (age/gpg or the replica's TLS tunnel). Plaintext dumps never touch
  removable media or a third-party sync folder.
- **Key custody:** one key copy held by the clinic, one by us, recorded in the
  MSA annex (§7.2). Losing both = unrecoverable; document the escrow.
- **Off-site copy = the VPS read-replica** (see
  `NEW_CLINIC_VPS_REPLICA_DEPLOYMENT_PROMPT.md`). Its snapshot pipeline is the
  off-site backup; fleet monitoring ships **status only** (up/down, last-snapshot
  age), never data.

## 4. Retention & review

- Export files: 24h (automatic).
- Rotated logs: 8 weeks.
- Audit `log` table: retained per clinic policy (Act 843 evidence expectation);
  do not truncate without a documented policy.

## 5. Smoke (deploy-time)

- Induce an error (stop MySQL, hit a desk) → browser shows the generic envelope,
  `php_error.log` has the detail, no connection string in the page.
- Run an async Report Hub export → file appears 0600 under
  `nc_report_exports/`, is gone after 24h.
