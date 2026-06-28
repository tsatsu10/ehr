# Patient Referrals & Letters (Transactions) — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.1.2 |
| **Status** | Audit closure — **pilot wrapper (M11-F11 transactions)** + **V1.1-CDb** referrals & letters hub |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.47), [NEW_CLINIC_V1_PAGE_DESIGNS.md](./NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.47), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.35), [NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) (v0.1.2), [NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CLINICAL_EXPORT_REDESIGN.md) (v0.1.1), [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.47) |
| **Audience** | Product, design, clinical leads, doctors, reception, trainers, implementers, QA |
| **Scope** | **Per-patient outbound** referral letters and general correspondence — stock **Transactions** menu rehosted via Chart Depth referral slice; **not** inbound referral scan (PRD D34) or clinic-wide reporting |
| **Primary market** | Private outpatient clinics — **Ghana & West Africa** |
| **Implementation** | Design spec only — no code in this document |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Research — OpenEMR transactions & referral pain points](#2-research--openemr-transactions--referral-pain-points)
3. [Research — UI/UX principles for referrals & letters](#3-research--uiux-principles-for-referrals--letters)
4. [Research — how leading EHRs address referrals & correspondence](#4-research--how-leading-ehrs-address-referrals--correspondence)
5. [Research — Ghana & West Africa context](#5-research--ghana--west-africa-context)
6. [Comprehensive redesign — pilot wrapper + V1.1-CDb](#6-comprehensive-redesign--pilot-wrapper--v11-cdb)
7. [Pilot interim — stock transactions wrapper (M11-F11)](#7-pilot-interim--stock-transactions-wrapper-m11-f11)
8. [Referrals & letters hub — build spec (M11-F03 / F04 / F08)](#8-referrals--letters-hub--build-spec-m11-f03--f04--f08)
9. [Legacy overlay on stock chart — transaction pages (plain English)](#9-legacy-overlay-on-stock-chart--transaction-pages-plain-english)
10. [Navigation, menu cutover & ACL](#10-navigation-menu-cutover--acl)
11. [Phasing, acceptance & training](#11-phasing-acceptance--training)
12. [Closed decisions](#12-closed-decisions)
13. [Document history](#13-document-history)

---

## 1. Purpose & positioning

### 1.1 What this document is for

Doctors and reception need to answer *“Write a referral for this patient to Korle Bu — and print it before she leaves”* without opening a page titled **Patient Transactions**, hunting **Create New Transaction**, or editing a raw **Layout-Based Form** with fields like *Reference classification (risk level)* and *Counter-Referral* that US public-health clinics use but Ghana private OPD rarely needs on day one.

This spec defines how stock **Transactions** becomes **Referrals & letters** in Chart Depth — a **visit-linked correspondence hub** opened from MRD Clinical **This visit**, the **Referrals strip**, or Visits row expand — **not** a sixth MRD tab and **not** a replacement for inbound referral upload at Start visit (PRD **D34**).

**Two-layer model (closed):**

| Layer | When | Behavior |
|-------|------|----------|
| **Pilot wrapper (M11-F11)** | Chart Depth referral flags **OFF**; pilot week 1–4 | Stock `transactions.php` with T1 banner + heading **Referrals & letters**; referral rows promoted |
| **Referrals hub (V1.1-CDb)** | `enable_chart_depth_referral` = 1 | New `chart-depth/referrals.php` — 3-step wizard + list + letter composer; MRD Clinical **Referrals strip** |

**Trainer one-liner:** *“**Upload** at Start visit is what the patient *brought in*; **Referrals & letters** is what *we send out* — same chart, different direction.”*

### 1.2 Problem statement (Ghana private OPD)

> After a chest-pain consult, Dr. Mensah needs to refer Akua to a cardiologist at a regional teaching hospital. He clicks **Transactions** in the old horizontal menu — a list mixing **Referral**, **Patient Request**, and **Physician Request** types from stock `list_options`. **Create New Transaction** opens the full LBF editor with twenty fields across two groups including **Counter-Referral**. He cannot see today’s queue # or encounter. Reception prints from **View/Print Blank Referral Form** — a separate button. The patient waits while staff fight the layout. Meanwhile lab-direct intake correctly uses **Referral on file** for an *inbound* scan — but nothing links the *outbound* letter to visit #18.

### 1.3 Positioning vs other surfaces

| Surface | Question | Referrals / letters role |
|---------|----------|-------------------------|
| **Start visit / M1d** | Patient brought external lab order? | **Inbound** upload → `referral_document_id` (D34) |
| **MRD Clinical — This visit** | Issue referral from today’s consult? | **Create referral** → CDb wizard |
| **Chart Depth referrals hub** | List, reprint, track status | **Primary** write/read path when CDb ON |
| **Stock Transactions menu** | Legacy LBF list | **Pilot:** wrapped `transactions.php`; **post-CDb:** hidden when `_referral` ON |
| **Clinical export (CDc)** | PDF handoff pack? | **Clinical summary** preset — separate from referral letter |
| **Employer / school letter** | Fitness certificate? | Export preset → **letter composer** (CDb, D-EXP-10) |
| **M16 Reporting Hub** | Clinic-wide referral stats? | Aggregate exports — not per-patient wizard |

```text
Inbound scan at desk     →  Start visit / lab intake (D34)
Outbound referral letter →  Chart Depth referrals (this spec)
Visit summary PDF        →  Chart Depth export (CDc)
Counter-referral reply     →  Stock LBF or V1.2+ (out of V1 golden path)
Other transaction types    →  Stock Classic menu (admin / power users)
```

### 1.4 Stock “Transactions” ≠ only referrals (D-REF-4)

OpenEMR’s `transactions` table holds **layout-based transaction types** from `list_options` (`Referral`, `Patient Request`, `Physician Request`, plus clinic-configured LBF forms). The default clinical path in Ghana OPD is **`LBTref` (Referral)** and **general letters** (`letter.php` templates).

| Type | V1.1-CDb path | Stock fallback |
|------|---------------|----------------|
| **Referral (`LBTref`)** | 3-step wizard + list | Wrapped `transactions.php` (pilot) |
| **General letter** | Letter composer in hub | `letter.php` via Classic menu |
| **Patient / Physician Request** | Not in golden path | Classic **⋯** → stock `add_transaction.php` |
| **Custom LBF transaction types** | Admin only | Classic menu when CDb ON |

**Closed:** CDb **does not** rebuild the entire LBF transaction engine (NG5) — wizard is a **façade** over `transactions` + `lbt_data` + optional `new_referral_meta`.

---

## 2. Research — OpenEMR transactions & referral pain points

Evidence from stock codebase audit (`interface/patient_file/transaction/*`, `library/transactions.inc.php`, `sql/database.sql` LBTref layout) and Chart Depth §3.3 / §4.3.

### 2.1 Information architecture

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Wrong label** | Page title *Patient Transactions* (`transactions.php` line 45) | Doctors expect *Referral* not accounting vocabulary |
| **Mixed type list** | All `transactions.title` values in one table | Referrals buried among unused request types |
| **Separate create paths** | *Create New Transaction* vs *View/Print Blank Referral Form* | Two buttons for one workflow |
| **Not visit-scoped** | No `encounter_id` on `transactions` row | “Referral from today” requires manual date scan |
| **Horizontal nav slot** | `standard.json` **Transactions** between Documents and Issues | Competes with MRD Clinical after B7 |

### 2.2 Stock Transactions UI (`transactions.php`)

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Legacy chrome** | `dashboard_header.php` + horizontal nav every page | Iframe noise; no `patient-context-banner` |
| **LBF edit surface** | `add_transaction.php` renders all `layout_options` for form id | 17+ fields including counter-referral block |
| **Refer date split** | `refer_date` in `lbt_data` vs `transactions.date` | List sort confusing (code handles both, lines 107–114) |
| **Delete via popup** | `deleter.php` popup | Popup blockers on shared PC |
| **Details column** | Raw `body` / truncated LBF fields | Not human-readable destination summary |
| **Print path** | Row → `add_transaction.php` or `print_referral.php` | No unified preview step |

### 2.3 LBF referral form (`LBTref`)

| Field (stock) | Wizard mapping | V1 default |
|---------------|----------------|------------|
| `refer_date` | Auto today | Hidden — set on save |
| `refer_from` | Logged-in doctor | Auto |
| `refer_to` | Step 1 destination | Autocomplete facility |
| `body` | Step 2 summary | Required textarea |
| `refer_diag` | Step 2 problem pick | Optional |
| `refer_risk_level` | — | **Hidden** in cash OPD V1 (D-REF-7) |
| `refer_vitals` | Step 2 checkbox | Optional include |
| `refer_related_code` | — | Hidden unless billing link needed |
| Counter-referral group (2) | — | **Out of V1 golden path** — stock LBF for admin |

### 2.4 Print & templates

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **US-centric template labels** | `print_referral.php` — *Client ID*, *Control No.*, insurance block | Letterhead must be clinic-branded via site template |
| **Template file on disk** | `sites/default/referral_template.html` | No in-app preview until CDb step 3 |
| **Letter separate app** | `interface/patient_file/letter.php` (~779 lines) | Employer/school letters disconnected from referral list |
| **Insurance merge fields** | Template includes insurance labels | Empty in cash clinic — hide when `enable_insurance = false` |
| **REST API exists** | `PatientTransactionService` + `TransactionRestController` | New Clinic uses module AJAX façade — not required for V1 UI |

### 2.5 Inbound vs outbound confusion

| Concept | Stock / PRD | This spec |
|---------|-------------|-----------|
| **Inbound** | `new_visit.referral_document_id` — scan at Start visit | **Not** CDb — M1d / lab intake |
| **Outbound** | `transactions` + `LBTref` | **CDb primary path** |
| **Banner chip inbound** | **Referral on file** (info) | MRD Zone A |
| **Banner chip outbound** | — (missing in stock) | **Referral issued** (success) when active encounter has outbound `LBTref` |

### 2.6 Data layer (what we keep)

| Source | Used for |
|--------|----------|
| `transactions` | Transaction header (`title` = `LBTref`, pid, user, date) |
| `lbt_data` | Referral field values (EAV) |
| `new_referral_meta` | Status, encounter/visit link, destination text, result document (V1.1-CDb) |
| `referral_template.html` | A4 print HTML merge |
| `letter_templates/` | General correspondence |
| `layout_options` | Power-user LBF types via Classic menu |

**Closed:** No parallel `new_referral_letter` table — metadata extends stock rows.

---

## 3. Research — UI/UX principles for referrals & letters

| # | Principle | Application |
|---|-----------|-------------|
| P1 | **Task over tool** | *Referrals & letters* — not *Transactions* |
| P2 | **Visit-first** | Wizard opens with active `encounter_id` / `visit_id`; list defaults to **This visit** |
| P3 | **Wizard over LBF** | ≤3 steps, ≤5 required fields for standard referral |
| P4 | **Print-first** | A4 preview before print; browser print dialog; clinic logo on letterhead |
| P5 | **Identity anchor** | `patient-context-banner` + encounter line on every step |
| P6 | **Inbound ≠ outbound** | Distinct chips, colors, and trainer language (D34 vs CDb) |
| P7 | **Status at a glance** | Draft · Printed · Given to patient · Result received |
| P8 | **Progressive depth** | Clinical strip summary → full hub → wizard |
| P9 | **≤3 clicks to print** | This visit → Create referral → Print (REF-3) |
| P10 | **Audit print/reprint** | `chart_depth.referral_printed` on every generate |
| P11 | **Not a sixth tab** | Depth panel — D-CD-1 / D-MRD-1 stand |
| P12 | **Power-user escape hatch** | Classic menu retains stock LBF for other transaction types |

### 3.1 Anti-patterns (do not ship)

| Anti-pattern | Why |
|--------------|-----|
| Replace `transactions` table | Breaks stock `print_referral.php` compatibility |
| Force counter-referral in V1 wizard | US public-health artifact; confuses Ghana OPD |
| Merge inbound scan into outbound list | Different workflows and ACL |
| eReferral / HL7 in V1 | Connectivity and policy not ready |
| Hide **Transactions** before CDb ships | Pilot needs wrapped stock path (F11) |

---

## 4. Research — how leading EHRs address referrals & correspondence

| System | Pattern | Lesson for New Clinic |
|--------|---------|----------------------|
| **Epic** | Referral order tied to encounter; Ambulatory referral management with status | **Encounter link** + status chips |
| **Cerner** | PowerChart **Documents** + referral letter templates | Separate **letter** from **clinical note** |
| **athenahealth** | Outbound referral tracked with receiving provider directory | **Facility autocomplete** seed list |
| **Helium Health (Africa)** | Referral letter PDF + patient handoff | **A4 print** with local clinic branding |
| **OpenMRS Bahmni** | Paper referral common; limited outbound tracking | Simplicity over network integration |
| **Ghana DHIMS / NHIS context** | Facility referral registers often paper-first | Print + optional scan-back of result |

**Takeaway:** Top systems tie outbound correspondence to **today’s encounter**, use **templates not free-form LBF**, and show **status** (draft → printed → given) — not a generic transaction log.

---

## 5. Research — Ghana & West Africa context

### 5.1 Referral & letter needs (private OPD)

| Need | Typical requester | CDb mapping |
|------|-------------------|-------------|
| **Specialist referral** | Doctor | Wizard step 1–3 → print A4 |
| **Private lab referral letter** | Doctor | Same wizard; destination = lab name |
| **Employer fitness letter** | Reception lead, doctor | **+ New letter** or Export → employer preset (D-EXP-10, D-REF-11) |
| **School medical certificate** | Reception lead | Letter template picker |
| **Reprint lost referral** | Reception lead, doctor | List → **Reprint** (requires `new_chart_depth_referral`) |
| **Track if patient went** | Doctor / manager | Status **Given to patient** → **Result received** + document link |
| **Inbound external order** | Reception | **Not CDb** — Start visit upload (D34) |

### 5.2 Regional UX constraints

| Constraint | Design response |
|------------|-----------------|
| **Paper handoff** | Patient carries printed letter; MoMo-era clinics still print |
| **Regional hospitals** | Seed autocomplete: Korle Bu, Komfo Anokye, regional teaching hospitals, top private labs |
| **NHIS line optional** | `referral_show_nhis_line` — show NHIS No. when populated |
| **Doctor registration** | MDC / medical council reg. optional on print (`referral_doctor_reg_required`) |
| **Low connectivity** | All read/write local DB — no external referral network V1 |
| **Shared front desk PC** | Banner visible throughout wizard; print confirm shows patient identity |
| **English + local names** | Facility names as typed; Twi labels V2 |

### 5.3 Inbound vs outbound (trainer table)

| Direction | When | UI | Chip |
|-----------|------|-----|------|
| **Inbound** | Patient arrives with external order | Start visit optional upload | **Referral on file** (blue/info) |
| **Outbound** | Clinic refers patient out | CDb wizard | **Referral issued** (green/success) |

### 5.4 Training (Ghana OPD)

| Role | One-liner |
|------|-----------|
| **Doctor** | *“After consult, **This visit** → **Create referral** — three steps, print, give patient.”* |
| **Reception lead** | *“Reprint from **Referrals & letters** — not Documents.”* |
| **Reception** | *“External order at arrival → **upload at Start visit**; employer letters → ask reception lead.”* |
| **Manager** | *“Old transaction types stay under **Classic menu** for admin.”* |

---

## 6. Comprehensive redesign — pilot wrapper + V1.1-CDb

### 6.1 Target architecture

```text
Start visit (M1d)
  Optional inbound upload → referral_document_id → Banner "Referral on file"

MRD Clinical (B7)
  This visit ── [ Create referral ] ──► chart-depth/referrals.php?encounter_id=
  Referrals strip ── [ Open referrals ] ──► same hub

chart-depth/referrals.php (V1.1-CDb)
  ├─ List: referrals + letters (newest first)
  ├─ [ + New referral ] → 3-step wizard → transactions + lbt_data + new_referral_meta
  ├─ [ + New letter ] → letter composer (letter.php model)
  └─ [ Reprint ] → chart_depth.referral_print

Export (CDc) — employer preset
  └─ Routes to letter composer when CDb ON (D-EXP-10)

Pilot (referral flags OFF):
  ⋯ Classic menu / horizontal Transactions ──► transactions.php + M11-F11 wrapper
```

### 6.2 Phasing summary

| Phase | Deliverable | Gate |
|-------|-------------|------|
| **V1 pilot** | M11-F11 wrapper on stock `transactions.php` | Chart Depth **OFF**; heading rename |
| **V1.1-CDb** | Referral wizard M11-F03; list + reprint M11-F04; Clinical strip M11-F08 | `enable_chart_depth` + `enable_chart_depth_referral` |
| **Menu cutover** | Hide stock **Transactions** from horizontal nav | `enable_chart_depth_referral` = 1 (M11-F09, D-EXP-6) |
| **Export handoff** | Employer letter preset → composer | CDc + CDb (D-EXP-10) |

### 6.3 Wireframe — referrals hub (V1.1-CDb)

Normative detail: [PAGE_DESIGNS §7.14](./NEW_CLINIC_V1_PAGE_DESIGNS.md#714-chart-depthreferralsphp--referrals--letters).

```text
┌─ Referrals & letters ─────────────────────────────────────────── [ × ] ─┐
│ [ patient-context-banner ]  Encounter: 18/06/2026 OPD · Dr. Mensah       │
│ [ + New referral ]  [ + New letter ]                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ 18/06/2026  Referral  → Regional Teaching Hospital, Cardiology         │
│             Status: Printed · [ View ] [ Reprint ] [ Mark given ]        │
│ 02/05/2026  Letter    → Employer fitness certificate                    │
│             Status: Given to patient                                    │
│ [ Load more ]                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Pilot interim — stock transactions wrapper (M11-F11)

**Purpose:** Pilot week 1–4 when `enable_chart_depth_referral` = 0 — staff still reach stock **Transactions** with clearer labeling.

**M11-F11 split (closed):** PRD **M11-F11** covers **three** stock URLs — ledger (**FIN-1**), report (**EXP-1**), and **transactions** (**REF-1**, this spec). Shared injection pattern.

### 7.1 Wrapper behavior

| Property | Value |
|----------|-------|
| **Target URL** | `interface/patient_file/transaction/transactions.php` |
| **Injection** | Symfony response filter / RenderEvent — same pattern as ledger/report F11 |
| **Banner** | Inject `patient-context-banner` Tier 1 **or** T1-F18 legacy strip when B7 pending |
| **Heading rename** | Page title + H1: **Referrals & letters** (not *Patient Transactions*) |
| **Subtitle** | *“Advanced transaction types — use Referrals hub when Chart Depth is enabled”* |
| **List emphasis** | Referral rows first: `transactions.title` = **`LBTref`** OR `lbt_data.refer_date` present — not `list_options` display title “Referral” alone (D-REF-3) |
| **Hide blank referral btn** | De-emphasize *View/Print Blank Referral Form* — secondary link in help |
| **Does not** | Replace LBF engine; add wizard; change `lbt_data` schema |

### 7.2 Pilot acceptance (F11 transactions — REF-1)

- [ ] Stock Transactions reachable from horizontal nav with banner visible.
- [ ] Heading reads **Referrals & letters** (REF-1).
- [ ] Referral rows (`LBTref` / `lbt_data`) sorted to top; filter not tied to display title “Referral” alone (REF-1, D-REF-3).
- [ ] No duplicate banner when T1-F18 + wrapper both eligible — D-CTX-5.
- [ ] Ledger + Report halves of M11-F11 verified per sibling specs (combined F11 sign-off).

---

## 8. Referrals & letters hub — build spec (M11-F03 / F04 / F08)

### 8.1 Routes & entry points

| Entry | Target |
|-------|--------|
| MRD Clinical **This visit** → **Create referral** | `chart-depth/referrals.php?pid=&encounter_id=&visit_id=` |
| Clinical **Referrals strip** → **Open referrals** | Same hub |
| Visits tab row expand → **Referrals for this visit** | Hub filtered by `encounter_id` |
| Export preset **Employer / school letter** (CDc) | Letter composer in hub when CDb ON (D-EXP-10) |
| Overview feed (future) | No navigate V1 — use Clinical tab |
| MRD ⋯ **Transactions** (flags OFF) | Wrapped `transactions.php` |
| Admin other LBF types | **⋯ Classic patient menu** → stock `add_transaction.php` |

### 8.2 Referral wizard (M11-F03)

| Step | Fields | Rules |
|------|--------|-------|
| **1 — Destination** | Facility name* (autocomplete), department, address/phone | Seed: `referral_facility_seed_json` + free text |
| **2 — Clinical reason** | CC (prefill `new_visit.chief_complaint`), diagnosis (problem list), summary*, recent labs (checkbox) | Summary required |
| **3 — Preview & print** | A4 HTML preview, optional doctor reg. no., **[ Print ]** **[ Save draft ]** | Print → status `printed`; audit event |

**Backend mapping to `LBTref`:**

| Wizard field | `lbt_data.field_id` |
|--------------|---------------------|
| Destination display | `refer_to` (text or addrbook id) + `new_referral_meta.destination_facility` |
| Summary | `body` |
| Diagnosis | `refer_diag` |
| Date | `refer_date` = today |
| Referrer | `refer_from` = session provider |
| Vitals include | `refer_vitals` boolean |

**Also writes:** `new_referral_meta` with `encounter_id`, `visit_id`, `status`.

### 8.3 Letter composer (M11-F04 extension)

**+ New letter** flow (simplified `letter.php`):

1. Template picker (`documents/letter_templates`)
2. To / From (address book)
3. Merge preview → Print / Save to Documents

Employer/school path from export lands here with template pre-selected when D-EXP-10.

**Letter list status (V1 — D-REF-13):** General letters appear in hub list when saved from composer. **Referrals** use `new_referral_meta.status` (`draft` → `result_received`). **Letters** use Documents link: no `document_id` = *Draft*; after **Save to Documents** = *Printed* (manual **Mark given** optional). Letters do **not** share referral status enum — row type `letter` vs `referral` in `chart_depth.referrals_list` JSON.

### 8.4 List & status (M11-F04)

| Status | Meaning | Next action |
|--------|---------|-------------|
| `draft` | Saved, not printed | Continue wizard |
| `printed` | Print dialog completed | **Mark given to patient** |
| `given` | Staff confirmed handoff | **Attach result** (optional document) |
| `result_received` | Result scan linked | View document |

Filter: **This visit** (default when `encounter_id` in URL) | **All** | Date range.

### 8.5 AJAX

| Action | Request | Response |
|--------|---------|----------|
| `mrd.clinical_referrals_strip` | `{ pid, encounter_id? }` | `{ items[], has_active_draft? }` |
| `chart_depth.referrals_list` | `{ pid, encounter_id?, offset, limit }` | `{ items[], has_more }` |
| `chart_depth.referral_save` | Wizard DTO | `{ transaction_id, print_url?, status }` |
| `chart_depth.referral_print` | `{ transaction_id }` | `{ pdf_url \| html }` |
| `chart_depth.referral_status` | `{ transaction_id, status, result_document_id? }` | `{ ok }` |

Audit: `chart_depth.referral_printed` — transaction_id, pid, encounter_id, actor.

### 8.6 Technical approach

| Item | Detail |
|------|--------|
| **Service** | `ReferralCorrespondenceService` — façade over `transactions` / `lbt_data` / `new_referral_meta` |
| **Print** | Render `referral_template.html` merge — same engine as `print_referral.php` |
| **Insurance block** | Omit template insurance section when `enable_insurance = false` |
| **Performance** | List first page ≤2s for one patient with &lt;200 referrals (CD-2) |
| **Round-trip** | Saved row printable via stock `print_referral.php?transid=` for power users |
| **Hub read-only mode** | User with `new_chart_depth` only (no `new_chart_depth_referral`): may open hub and **view** referral list; **+ New referral**, **+ New letter**, **Reprint**, **Mark given** hidden — D-REF-12 |

### 8.7 M11-F08 — Clinical Referrals strip

Lazy-fetch on Clinical tab when active encounter exists. Hidden when `enable_chart_depth_referral` = 0.

Shows latest outbound referral or draft; **Open referrals** → hub.

### 8.8 Print confirm (wrong-patient guard)

Before **Print** from step 3 (and **Reprint** from list):

```text
Print referral for Regional Teaching Hospital?
Patient: Akua Mensah · MRN 00042 · Encounter 18/06/2026
```

Same family as Cashier confirm (M5-F15) and export confirm (D-EXP-8). Normative wireframe: [PAGE_DESIGNS §7.14.8](./NEW_CLINIC_V1_PAGE_DESIGNS.md#7148-wrong-patient-prevention-print--reprint).

---

## 9. Legacy overlay on stock chart — transaction pages (plain English)

When **Chart Depth referral is not yet enabled**, staff may open stock **Transactions** from horizontal nav. **Legacy patient context overlay** (T1-F18) applies per [LEGACY_CHART_CONTEXT](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md).

### 9.1 Transaction-specific behavior

| Function | What it does |
|----------|--------------|
| **Transactions page coverage** | Sticky strip on stock list + add form |
| **Identity during LBF scroll** | Long referral form — strip stays visible |
| **After CDb cutover** | Clinic roles use MRD referrals hub; strip applies if admin opens Classic → Transactions |

### 9.2 What overlay does NOT do

| Not included | Reason |
|--------------|--------|
| Rename heading | M11-F11 wrapper responsibility |
| Wizard | CDb panel |
| Hide counter-referral LBF group | Admin path unchanged |

---

## 10. Navigation, menu cutover & ACL

### 10.1 Menu cutover (M11-F09 — Transactions only)

Per **D-EXP-6**: horizontal nav **Transactions** hidden when `enable_chart_depth_referral` = 1 (master `enable_chart_depth` = 1 required). **Ledger** and **Report** follow their own sub-flags.

| Role | When referral sub-flag ON | Modern path |
|------|---------------------------|-------------|
| **Doctor / reception lead** | Transactions nav hidden | Clinical **This visit** / strip → hub |
| **Power users / admin** | Transactions nav hidden | **⋯ Classic patient menu** → stock transactions + all LBF types (D-MRD-5) |

### 10.2 ACL matrix

| Capability | ACL key |
|------------|---------|
| Create / edit / print / reprint referral & letters | `new_chart_depth_referral` → `new_doctor`, `new_reception_lead`, `new_admin` (PRD §4.4) |
| View hub list (read-only) | `new_chart_depth` — create/reprint actions hidden without referral ACL (D-REF-12) |
| Stock transactions (legacy / pilot F11) | Core `patients` / `docs` as stock requires |
| Other LBF transaction types | Admin / Classic menu — unchanged stock ACL |

---

## 11. Phasing, acceptance & training

### 11.1 Acceptance (maps to PRD §21.1ad, §21.1p, tests CD-2, REF-1–REF-7)

**Pilot wrapper (M11-F11 transactions — REF-1):**

- [ ] Stock `transactions.php` shows T1 banner; heading **Referrals & letters** (REF-1).
- [ ] Referral rows primary in list; other types accessible (REF-1, D-REF-4).
- [ ] No duplicate T1-F18 + wrapper banner (REF-1).
- [ ] Ledger + Report F11 halves verified per sibling specs (REF-1).

**Referrals hub (V1.1-CDb — CD-2, REF-2–REF-7):**

- [ ] Doctor completes wizard in ≤5 required fields + preview (REF-2, CD-2).
- [ ] Save writes `transactions` + `lbt_data` compatible with `print_referral.php`; `title` = `LBTref` (REF-2).
- [ ] `new_referral_meta` links `encounter_id` + `visit_id` (REF-2).
- [ ] Wizard from **This visit** blocked when `encounter_id` ≠ active encounter (REF-2, D-REF-9).
- [ ] Print confirm **Patient · MRN · Encounter date** before POST (REF-3, D-REF-8).
- [ ] Audit `chart_depth.referral_printed` on print/reprint (REF-3).
- [ ] Referral printable in ≤3 clicks from **This visit** → Create → Print (REF-7).
- [ ] Print output includes clinic facility header; NHIS line when configured (REF-3).
- [ ] **Referral issued** Zone A chip ≠ **Referral on file** (REF-4, D34).
- [ ] Clinical **Referrals strip** when outbound exists (REF-4, M11-F08).
- [ ] Hub read-only when user lacks `new_chart_depth_referral` — no create/reprint CTAs (REF-4, D-REF-12).
- [ ] `chart_depth.referral_status` updates draft → printed → given → result_received (REF-2).
- [ ] List first page ≤2s for &lt;200 rows (REF-5, CD-2).
- [ ] **Employer / school letter** routes to composer when CDb ON; blocked message when CDb OFF (REF-6, D-EXP-10, D-REF-11).
- [ ] Visits row **Referrals for this visit** opens hub filtered by `encounter_id` (REF-4).

**Menu (REF-5):**

- [ ] **Transactions** hidden only when `enable_chart_depth_referral` = 1 (D-REF-6, D-EXP-6).
- [ ] Power users retain Classic menu → stock transactions (REF-5).

### 11.2 Training checklist

- [ ] Deliver role one-liners (§5.4) at CDb enablement.
- [ ] Drill: doctor prints referral from **This visit** in ≤3 clicks.
- [ ] Drill: reception distinguishes inbound upload vs outbound letter.

---

## 12. Closed decisions

| ID | Decision |
|----|----------|
| **D-REF-1** | **No parallel referral engine (closed):** CDb façade writes stock `transactions` + `lbt_data` + `new_referral_meta` |
| **D-REF-2** | **V1.1-CDb (closed):** `chart-depth/referrals.php` primary path when `enable_chart_depth_referral` = 1 |
| **D-REF-3** | **Pilot (closed):** stock `transactions.php` + **M11-F11 wrapper** — heading **Referrals & letters** |
| **D-REF-4** | **Scope split (closed):** CDb = referral (`LBTref`) + general letters; other LBF transaction types remain stock Classic menu for admin |
| **D-REF-5** | **Inbound vs outbound (closed):** inbound = `referral_document_id` (D34); outbound = CDb — distinct chips and training |
| **D-REF-6** | **Transactions menu hide (closed):** horizontal **Transactions** hidden only when `enable_chart_depth_referral` = 1 — per D-EXP-6 |
| **D-REF-7** | **V1 wizard scope (closed):** hide counter-referral group + `refer_risk_level` in default Ghana OPD profile |
| **D-REF-8** | **Print confirm (closed):** **Patient · MRN · Encounter date** before `chart_depth.referral_print` |
| **D-REF-9** | **Encounter required (closed):** wizard opened from **This visit** must match active `encounter_id` or block with message |
| **D-REF-10** | **Export handoff (closed):** employer/school letter preset routes to CDb composer — D-EXP-10 |
| **D-REF-11** | **Employer letter ACL (closed):** base `new_reception` redirected to reception lead for employer/school letter when CDb ON — `new_chart_depth_referral` required |
| **D-REF-12** | **Hub read-only (closed):** `new_chart_depth` without `new_chart_depth_referral` — view list only; hide create/reprint/status actions |
| **D-REF-13** | **Letter status (closed):** letters use Documents `document_id` for list status — separate from referral `new_referral_meta` enum |

---

## 13. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.2 | 2026-06-24 | **Consistency audit fix** — §11.1 header corrected from "REF-1–REF-6" to "REF-1–REF-7" (body and B7 sign-off already define REF-7) |
| 0.1.1 | 2026-06-24 | **Audit closure** — D-REF-8 print confirm aligned with PAGE_DESIGNS; D-REF-11 employer ACL; D-REF-12 read-only hub; D-REF-13 letter status; LBTref pilot filter; MRD Referral issued chip + Visits row; `referral_status` AJAX; REF-7 ≤3 clicks; PRD v1.20.47 |
| 0.1.0 | 2026-06-24 | Initial spec — OpenEMR pain points, UI/UX, EHR patterns, Ghana context, M11-F11 transactions wrapper, M11-F03/F04/F08 referrals hub, inbound/outbound split, menu cutover, D-REF-1–10 |

---

*Normative wireframes: [PAGE_DESIGNS §7.14](./NEW_CLINIC_V1_PAGE_DESIGNS.md#714-chart-depthreferralsphp--referrals--letters) · Chart Depth parent: [§10](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md#10-referrals-transactions--correspondence) · MRD Clinical strip: [MRD §8.10.2](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md#8102-clinical--referrals-strip) · PRD M11: [§8 Module M11](./NEW_CLINIC_V1_PRD.md#module-m11--chart-depth) · Inbound scan: PRD **D34***
