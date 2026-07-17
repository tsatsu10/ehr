# OpenEMR Coverage Analysis

Two passes in conversation: **June 2026 (first)** and **re-scan after M11–M18 specs**.

---

## What New Clinic is designed to cover

### Golden path (daily OPD)

Search → Start visit → Triage → Doctor → Lab/Rx → Cashier → receipt → manager reports.

### Role desks and packages

| Package | Role |
|---------|------|
| M0 Core | Visit FSM, queue, ACL, services |
| M1 Front Desk | M1a search, M1b registration, M1c completion, M1d start visit |
| M2 Visit Board | Floor queue |
| M3–M5 | Triage, Doctor, Cashier |
| M6 | Clinic admin config |
| M7 | Daily ops reports |
| M8–M9 | Lab / Pharmacy **desks** (visit queue + deep links) |
| COM | Staff messages + dated reminders |
| S1 | Scheduling & Flow (calendar, flow, recalls) |
| MRD | Full chart IA (5 tabs) |
| T1/T2 | Shell, menu prune, cash clinic globals |

### Post-pilot hubs (added after first gap analysis)

| Module | Purpose | Release slice |
|--------|---------|---------------|
| M10 | Patient Registry cohort search | V1.1-REG |
| M11 | Chart Depth (ledger, referrals, export) | V1.1-CD |
| M12 | Lab Operations Hub | V1.1-LAB |
| M13 | Pharmacy Operations Hub | V1.1-PHARM |
| M14 | Billing Back Office | V1.2-BILL |
| M15 | Admin Operations Hub | V1.1-ADMIN |
| M16 | Reporting Operations Hub | V1.1-REP |
| M17 | Clinical Documentation Hub | V1.1-DOC |
| M18 | Queue Bridge Hub | V1.1-BRIDGE |

### Orchestrate, not rewrite

Vitals, encounter forms, procedure orders, core Rx, lab results, cash AR, documents — deep-linked from desks; engines stay stock OpenEMR.

---

## First-pass “failed to address” (June)

~80% of OpenEMR menu tree still stock: insurance billing, full reports, admin trees, portal, groups, interop APIs, specialty forms, third-party modules.

**Partially addressed at that time:** lab admin, pharmacy inventory, billing AR, admin runbooks, chart sub-menus — **thin or missing**.

---

## Second-pass re-check (after M11–M18)

Documentation coverage **much broader**; gaps shifted to:

1. **Implementation** — still the main blocker at audit time (scorecard tracks later progress).
2. **Intentional non-goals** — portal, telehealth, groups, NHIS claims API, etc.
3. **Niche unaddressed** — EHI, BatchCom, de-ID, DICOM, chart tracker (see `09-niche-features-explained.md`).
4. **Post-pilot slices** — spec exists; flags OFF until ship.

---

## Legacy replacements (planned menu cutover)

| Legacy | Replacement |
|--------|-------------|
| Finder `fin0` | M1a daily + M10 cohort |
| Message Center tabs | COM hub |
| PostCalendar / tracker / Recall Board (daily) | S1 lenses |
| `new.php` daily registration | M1 Quick Add / registration form |
| Stock demographics dashboard | MRD redesign |

---

## Tabular export

`Documentation/NewClinic/OPENEMR_AREAS_NOT_ADDRESSED.txt` — 19 rows of areas with no or minimal New Clinic spec (some rows partially superseded by M15/M16 — file may need Status column update).

---

## Training one-liner (from README)

Desk for queue work; chart for history; depth panels for money, letters, and exports; ops hubs for lab/pharmacy bench work; billing back office after V1.2-BILL; Admin Hub for people and system health.
