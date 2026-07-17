# New Clinic — Core Pages Without Native Replacements: Redesign Plan

**Version:** 0.1.1 · **Date:** 15/07/2026 · **Status:** Draft for review
**Scope:** every stock OpenEMR page the module still links to that has **no native replacement**, with a build / wrap / retire / defer decision and a concrete plan for each.

---

## 1. Purpose and method

After the 15/07/2026 core-link sweep (which re-pointed 9 button groups at existing native
pages), this document answers the follow-up question: **what is still stock, and what do we
do about each one?**

How the list was built (so it can be re-verified later):

1. **Full link inventory.** Grepped every `interface/...php` URL in the module's PHP
   services, Twig shells, page controllers, and React islands (~53 distinct stock pages
   referenced).
2. **Classification pass.** Each reference was checked *in context* — many are not links at
   all (menu-hide lists, deep-link allow-lists, code comments, flag-OFF fallbacks required
   by PRD §5.6, wrapped screens, or payload fields nothing renders).
3. **Double-check pass.** For every candidate, the stock page's own source was read
   (features, tables, size), and the module was re-searched for partial native coverage —
   *and* cross-checked against the gap-analysis plan's closed items. This pass **removed
   six would-be gaps that are already native** (comms reply, reminder create/log, list
   editor split, backup engine, audit log viewer, forms catalog toggles — see §5) and
   surfaced one standing blocker (growth-chart licensing, B2b).
4. **Outside research** where it changes the design: growth-chart standards (WHO vs CDC —
   see CP-3 sources), reconciled against the gap analysis's deeper licensing research.

Out of scope here (already correct by design): login/logout/redirect infrastructure,
flag-OFF legacy fallbacks, wrapped admin screens (`admin-people-legacy.php`,
`admin-merge-legacy.php`), the clinical form bridge, and labeled "Advanced (OpenEMR)"
escapes whose backing natives exist.

---

## 2. The verified list at a glance

| # | Stock page(s) | Linked from | Verdict | Effort | Priority |
|---|---|---|---|---|---|
| CP-1 | `transaction/add_transaction.php` (LBTref), `print_referral.php`, `transactions.php` | Chart-depth Referrals pane (create/edit/print buttons) | **BUILD** native referral editor + print | M | **P1** |
| CP-2 | `patient_file/front_payment.php` | Cashier shortcut "Front payment (core)" | **BUILD** into cashier/CBILL (deposits & other payments) | M | **P1** |
| CP-3 | `forms/vitals/growthchart/chart.php` | Chart clinical → Vitals ("Growth chart") | **BLOCKED** — WHO data licensing (B2b); deep link stays | M (once unblocked) | P2* |
| CP-4 | `orders/pending_orders.php`, `orders/pending_followup.php` | Chart clinical labs strip (`pending_orders_url`); followup via stock menu only | **BUILD** into Lab Ops / Report Hub | S–M | **P2** |
| CP-5 | `summary/pnotes_full.php` ("All notes" + per-note detail) | Chart Messages tab | **BUILD** small (native note detail) | S | **P2** |
| CP-6 | `patient_file/report/patient_report.php` (stock export builder) | Chart-depth Export pane escape | **FINISH** native export (custom section picker) | S | **P3** |
| CP-7 | `logview/logview.php` | Admin Hub Health tab | **KEEP** — native Audit log card already exists (W4); stock link is the tamper-check escape | — | done |
| CP-8 | `main/backup.php` | Admin Hub Health tab + runbook | **KEEP** — native backup engine already exists (C6); stock link is the manual escape | — | done |
| CP-9 | `forms_admin/forms_admin.php` | Admin Hub Forms tab | **KEEP** — native catalog with toggles already exists (M15-F07); stock link covers install-DB | — | done |
| CP-10 | `super/edit_layout.php` (2,435 lines) | Admin Hub Forms tab | **WRAP**, defer native (not justified) | S | P4 |
| CP-11 | `super/edit_list.php` (1,637 lines) | Admin Hub Forms tab | **KEEP designed split** (native allow-list editor exists) | — | P4 |
| CP-12 | `billing/billing_report.php` (Billing Manager) | Bill-ops "Advanced" | **DEFER** (claims = Tier-3 non-goal) | — | P4 |
| CP-13 | `reports/report.php` (stock reports menu) | Report Hub "Advanced" | **GOVERNED** by report-hub catalog; 2 named natives proposed | S each | P3 |
| CP-14 | Dead payload fields pointing at core | (nothing renders them) | **CLEANUP** | S | **P1** (rides any batch) |

---

## 3. Per-page plans

### CP-1 — Native referral editor + print *(BUILD, P1)*

**What the stock pages do (verified in source).**
`add_transaction.php` (658 lines) renders the **LBTref** layout-based transaction form —
the referral. Verified live field set: referral date, refer-by, external flag, refer-to
(address book picker), reason, referrer diagnosis, risk level, include-vitals flag,
requested service (code picker), billing facility — plus a **reply section** (reply date,
from, presumed/final diagnosis, documents, findings, services provided, recommendations,
prescriptions). Writes go to `transactions` + `lbt_data`. `print_referral.php` (234 lines)
renders `sites/<site>/referral_template.html` with those fields merged in.
`transactions.php` is the per-patient list.

**What the module already has.** `chart-depth/referrals.php` is a native, ACL-gated
*viewer* with pagination, print confirmation identity line (D-REF-8), and draft detection —
but its **Create / Edit / Print buttons all jump to the stock screens**. The letters
subsystem (`LettersService` + `letter-print.php`) already proved the "native print view
with stock template parity" pattern.

**Plan.**
1. **Editor drawer** on the native referrals page (same drawer pattern as the history /
   issue / immunization editors): the LBTref working set above, with refer-to backed by the
   existing address-book data (note the learned gotcha: `abook_type` labels don't predict
   person-vs-company — resolve by `option_value`). Reply section collapsed by default.
   Writes via a new `ReferralEditorService` → `transactions` + `lbt_data`, mirroring the
   stock write path so both screens stay interchangeable (same rule the letters feature
   follows).
2. **Print** via a native `referral-print.php` modeled on `letter-print.php`, reading
   `referral_template.html` for template parity.
3. **ACL:** reuse `new_chart_depth_referral` (already gates create/edit/print visibility).
4. **Flag:** `enable_native_referral_editor`, default OFF; OFF keeps today's stock links.
   Wire all 3 flag surfaces (install.sql + `EDITABLE_SETTINGS` + adminFieldDefs allowlist —
   the known Admin-Hub checklist).
5. **Parity checklist before sign-off:** create, edit, reply-capture, print output matches
   stock template rendering, vitals inclusion, draft badge on the viewer still detects
   native-written rows.

**Why P1:** referrals are a routine front-line workflow (external referral letters), and
this is the last *clinical* daily flow that round-trips through a stock layout form.

---

### CP-2 — Deposits and other payments *(BUILD via CBILL, P1)*

**What the stock page does (verified).** `front_payment.php` (1,867 lines) posts three
money shapes the native cashier cannot: **prepayments/deposits** (an `ar_session` row with
encounter 0), **copay-style per-encounter payments**, and **invoice payments** — each also
writing `ar_activity` + the legacy `payments` table. The module's own payment-reversal
already mirrors this 3-table posting, so the write pattern is proven in-module.

**What the module already has.** Native cashier checkout (M5) handles the
`ready_for_payment` flow only. The CBILL roadmap
(`NEW_CLINIC_CASHIER_BILLING_COMPLETION_PLAN.md`) already plans partial payment and
pharmacy charges; deposits/other-payments is the natural next CBILL increment rather
than a separate feature. (`new_receipt.visit_id` verified `NOT NULL` today — the
nullable migration in step 3 is required, not optional.)

**Plan.**
1. New cashier action **"Record other payment"** (button beside checkout): choose type —
   *deposit (no visit)* or *payment against a past visit* (picks from the patient's
   completed/unpaid visits) — amount, method (cash/MoMo per clinic config), reference.
2. Service posts the same 3-table shape as stock (`ar_session`, `ar_activity` `PP`,
   `payments`) so the daysheet reconciliation (module vs core totals) stays balanced —
   **this is the critical invariant**; add a reconciliation assertion test.
3. Receipts: issue a `new_receipt` row (visit_id nullable for deposits — schema change) so
   the payment appears in bill-ops Payments search and can be reversed there.
4. ACL: cashier checkout ACL + a `new_cashier_other_payment` grant for the deposit shape.
5. Flag: `enable_cashier_other_payments`, default OFF; the "Front payment (core)" shortcut
   stays until parity sign-off, then is removed.
6. **Out of scope:** insurance copays as a distinct concept (cash-only V1; the CBILL
   insurance split covers this later).

---

### CP-3 — Native growth chart *(BLOCKED on a licensing decision — tracked as B2b, P2 once unblocked)*

**What the stock page does (verified).** `chart.php` (738 lines) plots the child's vitals
onto **static CDC percentile background images** (PNG per sex/age band: birth–24 m,
2–20 y; weight, stature, head circumference, BMI) and outputs page/PNG/PDF. The module's
own vitals service documents why it stayed stock: *"the repo ships those only as PNG
images, not numeric LMS data."*

**Why WHO curves are the right target (re-confirmed).** For a West African clinic, the
**WHO Child Growth Standards** are the correct curves — built as a *standard* from six
sites **including Accra, Ghana**; CDC charts are a US population *reference*, and even the
CDC recommends WHO curves under 24 months. Regional child-health booklets print WHO
curves. Sources: [CDC/WHO recommendation (MMWR)](https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5909a1.htm),
[how the WHO standard was created](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/creating-who-growth-standard.html),
[methodology comparison](https://www.cdc.gov/growth-chart-training/hcp/using-growth-charts/who-methodology.html).

**The blocker (already researched in the gap analysis, B2b, 13/07/2026 — this plan defers
to that finding).** WHO's growth-standards publications are **CC BY-NC-SA 3.0 IGO —
non-commercial**. New Clinic is a commercial subscription product, so bundling WHO's
numeric LMS tables into the shipped codebase **requires WHO's separate written commercial
permission first** ([WHO permissions](https://www.who.int/about/policies/publishing/permissions)).
CDC's numeric data dodges the license question but is the clinically wrong reference for
this market — so there is no engineering shortcut. **This is a business decision, not a
build task.**

**Plan (conditional).**
1. **Now:** keep the existing safe deep link (Vitals Trends → stock chart for under-20s) —
   it already renders the real curves. No change.
2. **Business action:** request WHO commercial-use permission (owner: product; the request
   form is linked above). Track under B2b in the gap analysis — the single source of truth
   for this item.
3. **Once permission lands:** build the native overlay — WHO LMS JSON assets
   (weight-for-age, length/height-for-age, weight-for-length, head circumference; sex-split,
   0–5 y), percentile bands (3rd/15th/50th/85th/97th) in the existing Vitals Trends panel,
   z-score chip for the latest reading, DD/MM/YYYY axis, print stylesheet. No new DB
   tables. Flag `enable_native_growth_chart`, default OFF.

---

### CP-4 — Pending orders & abnormal-result follow-up *(BUILD, P2)*

**What the stock pages do (verified).** `pending_orders.php` (232 lines): a filterable
list of `procedure_order` rows joined against `procedure_report` — i.e. **ordered but not
resulted**. `pending_followup.php` (279 lines): results flagged abnormal that lack a
follow-up encounter.

**What the module already has.** Lab Ops (M12) natively owns the in-house order→result
worklist. What's missing is exactly these two *oversight* views (cross-patient, spanning
days), plus the doctor deep link that today lands on the stock page.

**Plan.**
1. Two native views in **Lab Ops** (a "Follow-up" tab) or the Report Hub clinical lens —
   recommend Lab Ops, since the audience is the lab/clinical team:
   *Unresulted orders* (age buckets like the outstanding-balances list: ≤2 d / 3–7 d /
   >7 d) and *Abnormal, no follow-up* (abnormal `procedure_report` rows with no later
   visit for that patient).
2. Bounded queries per the scalability rules (facility-scoped, date-windowed, paginated —
   the R1–R8 checklist applies; these tables grow forever).
3. Replace `ProcedureOrderDeepLinkService::buildPendingOrdersUrl()` target when the flag
   is on.
4. ACL: lab-ops read ACL; flag `enable_lab_followup_views`, default OFF.
5. `load_compendium.php` (order compendium loader) stays stock — setup-time tool, admin
   only, used ~once.

---

### CP-5 — Patient notes: native detail + "All notes" *(BUILD small, P2)*

**What the stock page does (verified).** `pnotes_full.php` (800 lines): the per-patient
note list with activity toggles, per-note thread view, status changes.

**What the module already has.** The chart **Messages tab already lists the patient's
notes natively** (paginated, with reminders merged). Two remaining stock jumps: the
per-note `detail_url` and the "All notes" button. The comms hub already proved the native
thread-view pattern (`communications.message_detail` with thread HTML + status actions).

**Plan.**
1. Add a per-patient note **detail modal** to the chart Messages tab: new ajax action
   `patients.note_detail` (read) reusing the hub's thread renderer. **ACL correction from
   the audit pass:** stock `pnotes_full` gates *viewing* on the `patients/notes` ACL —
   any authorized staff member sees ALL of the patient's notes, regardless of author
   (ownership only gates edit/delete, author-or-admin). The native detail must match
   that, NOT the hub's owner-scoped inbox rules, or other authors' notes would wrongly
   disappear. Actions (`note_done`, status) stay author-or-admin.
2. "All notes" becomes the tab itself once the activity filter (active/inactive/all) is
   added to the native list — then both stock links go away.
3. ACL: existing chart messages access; flag `enable_native_patient_notes`, default OFF.
4. Effort is small because every building block already exists.

---

### CP-6 — Finish the native MRD export *(FINISH, P3)*

**Verified state.** The chart-depth Export pane is native (presets, confirm-label, PDF via
a programmatic `custom_report.php` POST — that backend use is fine and invisible). One
visible escape remains: **"stock report builder"** (`patient_report.php`) for arbitrary
section selection.

**Plan.** Add a "Custom sections" mode to the native pane — a checklist of the same chart
sections the presets compose (demographics, issues, meds, immunizations, encounters range,
documents), feeding the existing PDF generator. Then remove the escape. Small, self-contained.

---

### CP-7 — Audit log viewer: already native — keep the stock escape *(KEEP, verified)*

**Double-checking removed this one as well.** W4 closed on 11/07/2026: a **native
read-only Audit log card** already exists in the Admin Hub System tab
(`AuditLogService` + `AuditLogCard` — date/user/text/result filters, pagination, detail
slide-over, CSV export). The remaining `logview.php` link is the **deliberate forensic
escape** for checksum/tamper verification and disclosure logging, which the native card
intentionally does not replicate. **No work needed.**

---

### CP-8 — Backup: already native — keep the stock escape *(KEEP, verified)*

**Double-checking removed this one too.** The module already ships a **native backup
engine** (GAP-C C6, complete): `AdminBackupService` + `BackupCloudTargetService` behind
`enable_native_backup` — encrypted scheduled runs, a separate incremental site-files
mirror, cloud-folder target detection, recovery-key custody status surfaced on the Admin
Health tab, and an honest "backups on this disk only" safety flag. Design doc:
`NEW_CLINIC_BACKUP_SYSTEM_DESIGN.md` (v0.5.0).

The remaining `backup.php` link on the Health tab is the **deliberate manual-tarball
escape** (stock page streams a one-off tar to the browser — 1,203 lines, `exec()` of
`mysqldump`/`tar`, fragile on Windows). Keep it: it's the honest fallback when the native
engine is off, and the tab already shows the XAMPP scheduling hint. **No work needed**
beyond the standing runbook (restore drills).

---

### CP-9 — Forms admin: already native — keep the stock escape *(KEEP, verified)*

**Double-checking removed this one too.** `AdminFormsCatalogService` (M15-F07) already
provides the native registered-forms catalog with **enable/disable toggles, clinic
guardrails (enable-warnings), and its own ACL check**, writing to `registry` directly. The
remaining `forms_admin.php` link is the escape for the two rare actions the native
catalog deliberately skips: **install-DB** (runs a form's SQL — one-time developer action)
and priority reordering. **No work needed.**

---

### CP-10 — Layout editor: wrap, defer native *(WRAP, P4)*

`edit_layout.php` is a 2,435-line visual builder for layout-based forms (field types,
validation, groups, conditions). It is used a handful of times per deployment, by an
administrator. A native rebuild is weeks of work for near-zero daily value — **defer**,
document the decision here, and wrap the stock page in the module shell for chrome
consistency. Revisit only if LBF editing becomes a routine clinic task (nothing on the
roadmap suggests it will).

---

### CP-11 — List editor: keep the designed split *(KEEP, P4)*

Double-checking removed this from the gap list: `AdminListEditorService` (GAP-C C3) is
already a **native, allow-listed editor** for the lists a cash clinic actually curates
(immunizations, education sources, note/message statuses), with stock `edit_list.php`
deliberately kept as the gateway for everything else (documented in the service header,
including why `payment_method` is excluded). The only future work is **growing the
allow-list** as new lists become clinic-editable — one-line changes, not a redesign.

---

### CP-12 — Billing Manager: defer *(DEFER, P4 — needs PRD amendment)*

`billing_report.php` (1,472 lines) is the claims work-queue (batching, X12, clearinghouse
flow). US claims/EDI are an explicit **Tier-3 non-goal** in the gap analysis, and the
product is cash-first. The single "Billing Manager (core)" item in the bill-ops Advanced
dropdown stays as-is: it's the honest escape for a future insurance-enabled deployment.
Building any native claims surface requires a PRD amendment first — recorded here so
nobody "helpfully" starts one.

---

### CP-13 — Remaining stock reports *(GOVERNED, P3 for two named builds)*

The Report Hub's "Stock Reports menu" escape opens ~40 stock reports. Cross-checking each
relevant one against the hub's native catalog:

| Stock report | Native coverage today | Action |
|---|---|---|
| `front_receipts_report`, `pat_ledger` | Bill-ops Payments search + chart payment history | covered |
| `prescriptions_report` | Pharm-ops native prescriptions report (July 2026) | covered |
| `destroyed_drugs`, `inventory_*` | Pharm-ops native bench reports | covered |
| `patient_list`, `patient_list_creation` | Patient Registry cohorts | covered |
| **`receipts_by_method_report`** | Daysheet splits by cashier/visit-type but **not by payment method** (cash vs MoMo) | **BUILD**: by-method block on the native daysheet. Data source (audit-verified): `new_receipt` has **no method column** — join `ar_session.payment_method` ('cash'/'momo') via `new_receipt.posted_payment_id` (0 for no-charge closes → bucket as n/a), or cleaner: add a `payment_method` column to `new_receipt` at checkout. Directly supports the MoMo tally reconciliation |
| **`referrals_report`** | Chart-depth referrals is per-patient only; no cross-patient referral log | **BUILD**: cross-patient referral list in Report Hub (pairs naturally with CP-1) |
| `appointments_report`, `appt_encounter` | Scheduling hub lenses | covered (verify during S-series QA) |
| `immunization_report` | Registry cohort filters partially; native immunization editor exists (D-IMM-1) | evaluate after wave 1 lands |
| Everything else (AMC/CQM/IPPF/EDI/collections…) | US-program or claims tooling | out of scope (Tier-3) |

The escape link itself stays until the two named builds land.

---

### CP-14 — Dead-prop cleanup *(CLEANUP, P1 — rides any batch)*

Verified server-supplied fields that point at core pages but are **rendered by nothing**:

- `legacy_reply_url` (comms detail — native reply is always wired; the fallback branch is
  unreachable), `reminder_add_url`, `reminder_log_url`, `legacy_compose_url`
  (communications.php props typed but never consumed — native compose/reminder-create/log
  actions exist)
- `ledger_url` (ProfilePaymentsSummaryService — zero frontend consumers)
- `demographics_url` (PatientCompletionService / PatientContextService — zero consumers;
  `chart_url` is what renders)
- cashier `fee_sheet_url` (always shadowed by `advanced_billing_url`)

Remove the fields and their types. Pure hygiene; prevents a future dev from "fixing" a
dead link back into the UI.

---

## 4. Sequencing recommendation

| Wave | Items | Rationale |
|---|---|---|
| 1 | CP-14 cleanup, CP-1 referral editor+print, CP-2 deposits (CBILL) | Last daily *clinical* stock flow + last daily *money* stock flow |
| 2 | CP-5 patient notes, CP-4 lab follow-up views (+ CP-3 growth chart **only if** the WHO permission has landed — otherwise it stays a deep link, tracked as B2b) | Small clinical completions |
| 3 | CP-13 (by-method daysheet block, referrals report), CP-6 export finish | Reporting completions |
| 4 | CP-10 layout wrap | Chrome consistency only, no functional change |

Every build item: one `enable_*` flag default OFF, all three flag surfaces wired, stock
link preserved until parity sign-off (PRD §5.6), one flag per PR, bounded queries per the
scalability rules.

---

## 5. Items removed from the gap list by double-checking

Recorded so the verification isn't repeated from scratch next time:

- **Comms reply** — the hub passes a native `onReply` everywhere; the `legacy_reply_url`
  branch is dead code (→ CP-14).
- **Dated reminder create + log** — native `communications.reminder_create` /
  `reminder_log` actions and `ReminderCreatePane` exist; the core URLs are unconsumed
  props (→ CP-14).
- **List editor** — designed native/stock split already implemented (→ CP-11 keep).
- **Backup** — a full native backup engine already exists (GAP-C C6: encrypted runs,
  site-files mirror, recovery-key custody); the stock link is the deliberate manual
  escape (→ CP-8 keep).
- **Audit log viewer** — native Audit log card already exists in the Admin Hub System tab
  (W4, closed 11/07/2026); the stock link is the tamper-check/disclosure escape
  (→ CP-7 keep).
- **Forms admin** — native registered-forms catalog with enable/disable toggles already
  exists (M15-F07); the stock link covers install-DB only (→ CP-9 keep).
- **Growth chart** — not a missing plan but a **standing licensing blocker** (B2b): WHO's
  numeric tables are non-commercial-licensed; the earlier deep-research finding governs
  (→ CP-3 blocked, business decision).
- **Observation (not a gap):** `LedgerCashProfileService` (the cash-vocabulary skin for
  stock `pat_ledger.php`) lost its last in-module entry link when the bill-ops Advanced
  dropdown was trimmed — the page remains reachable from the stock Fees menu where that
  menu isn't hidden, so the skin is still live code, not dead. If the stock Fees menu is
  ever fully hidden for all roles, retire the skin with it.
- **Rx list, requisitions, letters, labels, dispense/controlled register** — all already
  flag-gated native (verified `rxListUrl` gating and the letters/print pages).

---

## 6. History

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 15/07/2026 | Initial plan from the full core-link sweep + per-page source research (post replace-with-native batch). |
| 0.1.1 | 15/07/2026 | Audit pass: fixed CP-5 ACL model (patients/notes view vs owner-only — following 0.1.0 would have hidden other authors' notes), named CP-13's by-method data source (ar_session.payment_method via posted_payment_id), corrected CP-1/CP-4 linked-from claims, cited the CBILL doc by name, noted the pat_ledger cash-skin entry-point situation. |
