# New Clinic — Clinic→VPS One-Way Replication Deployment Prompt

**Version:** v0.1.0 · **Date:** 2026-07-09 · **Status:** Ready to run
**Owner:** Product/Founder · **Companion to:** [Master plan §7.2](./NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md)
(hosting posture, decided 2026-07-09) · [Scalability plan](./NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md)

This document is an executable work prompt in the same style as the security-hardening
prompts: paste it into a desktop dev session and run it end-to-end. It builds the
deployment pipeline for the default hosting flavor — **on-prem clinic server as primary,
managed single-tenant VPS as one-way read-replica** (owner remote reports, off-site
backup, remote support point).

**Invariants (do not negotiate these while implementing):**

- Replication is **one-way, clinic → VPS, always**. The VPS MySQL must be physically
  unable to accept application writes: `read_only=ON` + `super_read_only=ON`, and the
  replica's OpenEMR (if installed for report viewing) runs with a DB user that has no
  INSERT/UPDATE/DELETE grants. No master-master, no failback-by-promotion without a
  documented manual runbook step.
- The link is the Tailscale/WireGuard tunnel from the fleet stack (§7.3) — replication
  traffic never crosses the public internet unencrypted, and the VPS exposes no public
  MySQL port.
- The clinic keeps working when the link is down; replication catches up when it returns.
  Lag is a monitoring event, never a clinic-facing failure.

---

## The prompt

```
Build the clinic→VPS one-way replication pipeline for New Clinic deployments
(on-prem XAMPP/MariaDB primary in the clinic; Ubuntu VPS replica; Tailscale tunnel
between them per master plan §7.3).

1. Replication mechanism — pick and justify ONE:
   (a) native MySQL/MariaDB async replication (binlog → replica over the tunnel), or
   (b) scheduled push: mysqldump/mariadb-dump + rsync of sites/default/documents every
       N minutes, applied to the replica.
   Decide based on what the clinic box actually runs (XAMPP ships MariaDB — check the
   exact version and its binlog/GTID support before assuming) and on operational
   simplicity for a one-person fleet: a replica that silently breaks and needs skilled
   re-seeding is worse than a dump-push that is trivially re-runnable. State the
   trade-off in a short ADR at the top of the setup script. Whichever is chosen:
   - Initial seed procedure (full dump, verified restore, checksum comparison).
   - Patient documents (sites/default/documents) replicate too, not just the DB.
   - Re-seed procedure for when replication breaks — one command, documented.

2. Clinic-side setup script (PowerShell for the XAMPP box):
   - Enable binlog/GTID (variant a) or install the scheduled push task (variant b);
     dedicated replication DB user, minimal grants, strong generated password.
   - Tailscale up + tagged into the fleet ACL; replication bound to the tunnel
     interface only.
   - Local safety net stays regardless: nightly local dump retained N days on the box
     (the VPS replica supplements, never replaces, point-in-time backups).

3. VPS-side setup script (bash):
   - MariaDB replica with read_only=ON + super_read_only=ON; no public ports (UFW:
     tunnel interface only, per the TLS/access prompt).
   - Nightly encrypted snapshot of the replica to separate object storage — this is
     the off-site backup obligation from §7.2; key custody documented (we hold one
     copy, clinic holds one, MSA annex).
   - Optional read-only OpenEMR install for owner report access: DB user with
     SELECT-only grants; module surfaces that attempt writes must fail gracefully —
     smoke-test the report hub against a SELECT-only user and fix any incidental
     writes it performs (reads-that-write are a known pattern in this codebase; see
     SCALE-* R-rules) rather than widening grants.

4. Monitoring — wire into the fleet heartbeat (§7.3):
   - Replication lag / last-successful-push age: alert when > 4h (tune later).
   - Replica data sanity: daily row-count + checksum spot-check on high-churn tables
     (new_visit, billing, patient_data); alert on divergence.
   - Backup-snapshot success: alert on miss, same channel as existing backup monitor.
   - All three visible per-facility in the fleet version registry view.

5. Runbooks (Documentation/NewClinic/new/ or the ops runbook, versioned):
   - "Replica is behind" — diagnose tunnel vs MySQL, catch-up expectations.
   - "Replica broken" — the one-command re-seed.
   - "Clinic box died" — DISASTER PATH: how to stand a clinic back up FROM the VPS
     replica (restore to a replacement mini-PC; explicitly NOT auto-promotion of the
     VPS — the clinic may have taken paper records in the gap; include the back-entry
     step and the checklist for re-pointing replication at the new box).
   - Owner-access setup: creating the read-only report login, and what the owner can
     and cannot do on the replica.

6. Verify end-to-end on the dev box + a throwaway VPS before calling this done:
   seed → write a visit on the primary → appears on replica within the window →
   kill the tunnel for an hour → clinic operations unaffected → restore tunnel →
   catch-up confirmed → run the disaster-path restore drill once and time it.
   Document the timings in the runbook ("expect ~X minutes").

No module PHP/React changes expected. If the report-hub-on-replica smoke (step 3)
requires code fixes for reads-that-write, treat those as SCALE-flavored fixes: one
per commit, composer verify:new-clinic (RESULT: PASS) + targeted phpunit before done.
```

---

## Out of scope (deliberately)

- Two-way sync, conflict resolution, VPS auto-failover — ruled out in master plan §7.2.
- Offline capture app (append-only front-desk client) — V2 idea, **[PRD amendment required]**.
- Multi-tenant hosting — gated on SCALE-* completion and an isolation review.

## History

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-07-09 | Initial prompt: mechanism decision (native replication vs dump-push), clinic + VPS setup scripts, read-only owner access, fleet monitoring hooks, disaster-path runbook, end-to-end verification drill |
