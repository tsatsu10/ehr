# Medical History & Background — Redesign Specification

| Field | Value |
|-------|--------|
| **Document version** | 0.2.1 |
| **Status** | **Built + always-on** — the **D-HIST-9** native editor and **D-HIST-10** full form are the permanent edit path since **2026-07-18** (flags `enable_native_history_editor`/`_full_form` retired, PRD §5.6 amendment); the **V1.1-HIST-WRAP** editor shell (§8.2–8.3) was **deleted** along with the stock edit path — §8's stock/wrap sections are historical |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md) (v1.20.41), [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md) (v0.2.31), [NEW_CLINIC_V1_PAGE_DESIGNS.md](../NEW_CLINIC_V1_PAGE_DESIGNS.md) (v0.6.45), [NEW_CLINIC_V1_USER_WORKFLOWS.md](../NEW_CLINIC_V1_USER_WORKFLOWS.md) (v1.9.44), [NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_CHART_DEPTH_REDESIGN.md) (v0.1.9), [NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md) (v0.1.2), [NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md](./NEW_CLINIC_V1_PATIENT_DASHBOARD_B7_PRIMARY_REDESIGN.md) (v0.1.1) |
| **Audience** | Product, design, clinical leads, trainers, implementers, QA |
| **Scope** | **Longitudinal background** — family, social, PMH narrative, screening dates — in MRD **Clinical → Background**; stock History & Lifestyle **editor** retained V1; Ghana OPD field pack |
| **Primary market** | Private outpatient clinics — **Ghana & West Africa** |
| **Implementation** | Design spec only — no code in this document |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Research — OpenEMR medical history pain points](#2-research--openemr-medical-history-pain-points)
3. [Research — UI/UX principles for background history](#3-research--uiux-principles-for-background-history)
4. [Research — how leading EHRs address background history](#4-research--how-leading-ehrs-address-background-history)
5. [Research — Ghana & West Africa context](#5-research--ghana--west-africa-context)
6. [Comprehensive redesign — V1 partial + V1.1 wrap](#6-comprehensive-redesign--v1-partial--v11-wrap)
7. [Background read panel — build spec (T1-F20)](#7-background-read-panel--build-spec-t1-f20)
8. [History editor path — stock V1, wrapped V1.1](#8-history-editor-path--stock-v1-wrapped-v11)
9. [Legacy overlay on stock chart — boundary module (plain English)](#9-legacy-overlay-on-stock-chart--boundary-module-plain-english)
10. [Ghana OPD starter field pack (M6)](#10-ghana-opd-starter-field-pack-m6)
11. [Phasing, acceptance & training](#11-phasing-acceptance--training)
12. [Closed decisions](#12-closed-decisions)
13. [Document history](#13-document-history)

---

## 1. Purpose & positioning

### 1.1 What this document is for

New Clinic maps stock OpenEMR **History & Lifestyle** (`history_data` table, layout form **HIS**) into the redesigned full chart as **Clinical → Background** (`#clinical-background`). That is the correct **read home** for longitudinal narrative that changes rarely — family history, social habits, free-text past medical history, screening dates.

**V1 is intentionally partial:**

| Layer | V1 behavior | Why |
|-------|-------------|-----|
| **Read / summary** | Modern **Background** section inside MRD Clinical tab | Staff see background in chart IA without horizontal nav archaeology |
| **Write / edit** | Stock **History & Lifestyle editor** (full HIS layout form) | Avoid forking `layout_options` / `history_save` — NG5 stands |
| **Legacy paths** | Horizontal nav **History** still works with **T1-F18** strip when enabled | Locums and pilot pre-B7 |

**Trainer one-liner (PRD §6.1h, D49):** *“**Background** is who they are over time; **assessments** are what we documented **this visit**.”*

### 1.2 Problem statement (Ghana private OPD)

> Nurse Adwoa opens **History** from the old patient menu to capture family history of sickle cell and hypertension. The screen shows US-centric tabs (mammogram, sigmoidoscopy, seatbelt use) and three levels of horizontal navigation. She saves and returns to the doctor desk — but the doctor, on the redesigned chart **Clinical** tab, still sees an empty **Background** block because nobody wired the read view yet. The same HTN is also typed in the SOAP note and again in **General** history. At payment, completion is 68% because family history lives in a form the cashier never opens.

### 1.3 Positioning vs other chart areas

| Surface | Question | Background / history role |
|---------|----------|---------------------------|
| **Role desk banner** | Who am I treating now? | **Not** full PMH — severe allergies + problem count only (§6.1g) |
| **MRD Clinical → Background** | Who are they over time? | **Primary read** for `history_data` narrative |
| **MRD Clinical → Problems / Allergies** | What must we respect structurally? | **`lists`** — source of truth; not duplicated in Background |
| **MRD Clinical → This visit** | What did we document today? | Encounter forms — **not** `history_data` |
| **Stock History menu** | Legacy entry | De-emphasized; T1-F18 strip + **Back to chart** when from MRD |

```text
Structured lists (allergies, problems, meds)  →  Safety strip + Clinical sections
Narrative background (family, social, PMH)   →  Clinical → Background
Visit findings (exam, plan, vitals today)    →  This visit + encounter forms
```

---

## 2. Research — OpenEMR medical history pain points

Evidence from stock codebase audit (`history.php`, `history_full.php`, `history.inc.php`, `history_data`, layout **HIS**) and community UX reviews.

### 2.1 Information architecture

| Pain | Evidence | Ghana OPD impact |
|------|----------|------------------|
| **Separate menu from dashboard** | Horizontal nav **History** is distinct from **Dashboard**, **Issues**, **Assessments** | Staff unsure whether PMH belongs in History, Issues, or SOAP |
| **Assessments vs History split** | Stock has both **History** and **Assessments (SDOH)** tabs | Duplicate mental model; SDOH is USCDI-oriented, not Ghana OPD-first |
| **Not on consult-ready banner** | `history_data` never surfaces on Doctor Desk Tier 1 | Doctor discovers sickle-cell trait only after opening legacy History |
| **MRD migration incomplete in UX** | Spec says Background embeds HIS — stock UI unchanged until B7 | Pilot staff live on two paradigms |

### 2.2 Stock History & Lifestyle UI

| Pain | Evidence | Impact |
|------|----------|--------|
| **US-primary screening grid** | `history.inc.php` exams: mammogram, prostate, sigmoidoscopy, PSA, LDL | Irrelevant or empty fields dominate; clinic ignores form |
| **Tabbed HIS layout** | `display_layout_tabs('HIS')` — multiple sub-tabs inside one page | High scroll; hard on 360px tablet |
| **View vs edit split** | Read-only `history.php` → **Edit** → `history_full.php` | Two pages, repeated header + horizontal nav |
| **Legacy chrome stack** | `dashboard_header` + horizontal patient menu on both pages | Same iframe noise as rest of stock chart |
| **No visit context** | History pages unaware of `new_visit` | Cannot see queue # while documenting background at triage |
| **Obsolete surgery fields** | `history.inc.php` `$obsoletes` — deprecated columns still in layout | Clutter; should be problem list or procedures |

### 2.3 Data model & duplication

| Pain | Evidence | Risk |
|------|----------|------|
| **Unstructured vs structured** | PMH free text in `history_data` vs `lists` medical_problem | HTN documented twice; registry search misses narrative-only |
| **Visit findings in history** | Staff paste exam results into General PMH | Breaks D49 taxonomy — belongs in encounter |
| **Single row per patient** | `history_data` one row per `pid` | Correct for longitudinal — but no encounter audit trail on edits |
| **Layout admin complexity** | HIS fields via `layout_options` / Admin → Layout | Ghana clinic cannot trim US fields without admin training |

### 2.4 Performance & integration

| Pain | Impact |
|------|--------|
| Full HIS layout render on every open | Slow on shared clinic PC |
| SDOH widget separate page | Extra hop when US SDOH enabled |
| No AJAX summary API | MRD Background cannot lazy-load without new service |
| eRx / portal JS included on history view | Unnecessary script weight |

### 2.5 What upstream OpenEMR provides (reuse, don’t fork)

| Mechanism | New Clinic use |
|-----------|----------------|
| `getHistoryData()` / `history_data` | Canonical store — **no parallel table** |
| Layout form **HIS** | Editor V1 — clinic trims via M6 Ghana pack |
| `history_save.php` | Unchanged save path V1 |
| `HistorySdohService` | Optional SDOH summary chips on Background when enabled |
| ACL `patients` / `med` | Same gates on read and edit |

---

## 3. Research — UI/UX principles for background history

Aligned with PRD §6.1h, MRD §8.9, D49, and primary-care UX literature.

| # | Principle | Application to Background |
|---|-----------|---------------------------|
| P1 | **Structured beats narrative for active care** | Problems, allergies, meds in **`lists`** — Background is supplement, not substitute |
| P2 | **Progressive disclosure** | Background summary shows **filled sections only** + “Not documented” placeholders for L3b targets |
| P3 | **Read fast, edit intentionally** | Summary scannable in ≤30s; **Edit history** is explicit action |
| P4 | **Conditional fields** | Ghana pack hides US screening tabs by default; show sickle cell, malaria prophylaxis, hypertension family matrix |
| P5 | **Same patient anchor** | Background header repeats name · MRN (inherits MRD Zone A — no fourth banner) |
| P6 | **No dead ends** | **Back to chart** returns to `#clinical-background` same tab |
| P7 | **Pre-populate + amend** | Established patients: show last saved values; edit merges — do not re-interview entire form (cf. [AAF P FPM](https://www.aafp.org/fpm/2007/0700/p39)) |
| P8 | **Branching logic for social history** | If “Never smoked” → hide pack-years; if “Current” → show quantity (Formisoft / JMIR patterns) |
| P9 | **Non-judgmental framing** | “How often do you drink alcohol?” not “Do you abuse alcohol?” — matters in Ghana social context |
| P10 | **Touch-first** | Edit form targets ≥44px controls; summary uses collapsible sections on mobile |

### 3.1 Anti-patterns (reject)

| Anti-pattern | Why |
|--------------|-----|
| Copy full HIS into React V1 | Violates NG5 — fork layout engine |
| Put vitals or lab results in Background | Belongs in Clinical labs/vitals or This visit |
| Require full HIS for 70% billing gate | L3b is **optional** V1.1-OPS (PRD §6.1h) |
| Duplicate problem-list rows in General PMH | D49 PMH duplication rule |
| Separate sixth tab “History” on MRD | D-MRD-1 five-tab IA — Background is section **#1** inside Clinical |

---

## 4. Research — how leading EHRs address background history

| Pattern | Epic | Cerner | athenaOne | OpenMRS / Bahmni | Helium Health (Africa) | **New Clinic V1 → V1.1** |
|---------|------|--------|-----------|------------------|------------------------|--------------------------|
| **Social + family history in chart review** | History sidebar sections | Social/Family tabs in chart | Structured SH/FH | Obs groups + forms | Patient profile sections | **Clinical → Background** |
| **Structured problem list separate** | Problem list | Diagnosis list | Problem list | Conditions widget | Conditions on banner | **Safety strip + #clinical-problems** |
| **Patient-entered history pre-visit** | MyChart questionnaires | Patient portal | athenaCommunicator | Community apps | SMS / paper forms | **V2** — Front Desk registration form + completion banner first |
| **Summary before full editor** | Snapshot in chart review | Chart summary | Overview panels | Bahmni summary | Dashboard cards | **T1-F20 read panel** |
| **Branching questionnaires** | Flowsheet templates | Dynamic forms | Smart forms | Concept sets | Limited | **M6 Ghana HIS pack** + future LBF |
| **Legacy editor wrap** | Hyperspace web components | PowerChart embed | Hybrid | Angular shell | Partial | **V1.1-HIST-WRAP** T1 shell on stock editor |

**Takeaways:**

1. Top systems **show a summary in chart review** and defer the full editor to an explicit action — matches V1 partial strategy.
2. **Family history** is high value for sickle cell, hypertension, diabetes screening in West Africa — deserves prominent Ghana pack, not buried US tabs.
3. **Patient-entered history** helps waiting-room throughput — align with PRD progressive registration (Q10) in V2, not V1 pilot blocker.

---

## 5. Research — Ghana & West Africa context

### 5.1 Clinical priorities for background capture

| Domain | Why it matters locally | Background / structured home |
|--------|------------------------|------------------------------|
| **Sickle cell / G6PD** | High prevalence; affects drugs, malaria care | Family history matrix + **`lists`** if diagnosed |
| **Hypertension, diabetes** | Rising burden; family clustering | Family history + problem list |
| **Malaria exposure / prophylaxis** | Endemic; travel to rural areas | Social/lifestyle — not US “hazardous activities” |
| **Herbal / traditional medicine use** | Common; drug interaction risk | Social history — non-judgmental field |
| **Occupation & fuel exposure** | TB, respiratory — urban vs rural | Social history |
| **Pregnancy intent / breastfeeding** | OPD ANC routing | Profile L3 + problem list; optional banner chip V1.1 |
| **HIV status (if disclosed)** | Chronic care | Problem list + Background only if patient consents to document |
| **NHIS / cash** | No insurance workflow in V1 | **Not** in History — Profile only |

### 5.2 Operational constraints

| Factor | Design response |
|--------|-----------------|
| **Short consult windows** | Background **summary** on chart; full edit at registration or triage — not mid-consult unless needed |
| **Nurse-led triage** | Triage desk may complete family/social history before doctor — link from triage banner **Open full chart → Clinical** |
| **Low digital literacy staff** | Plain section labels: “Family health”, “Social habits”, “Past illnesses (story)” |
| **English UI V1** | All labels via translation helper; Twi voice V2 |
| **Paper family history at registration** | Reception transcribes key rows — optional L3b completion weight only when enabled |
| **Shared tablet at triage** | T1-F18 strip on stock history pages if nurse uses legacy nav |

### 5.3 Training one-liners (Ghana)

| Audience | One-liner |
|----------|-----------|
| **Reception** | *“Put name and phone in Profile; put family health in Background when you have time.”* |
| **Nurse** | *“Allergies and problems go in the lists; family and social story goes in Background.”* |
| **Doctor** | *“Read Background for the life story; read This visit for today’s note.”* |
| **All** | *“One condition — one problem list row. Don’t re-type the same disease in three places.”* |

---

## 6. Comprehensive redesign — V1 partial + V1.1 wrap

### 6.1 Target experience (B7 + this spec)

```text
┌─ MRD Clinical tab ─────────────────────────────────────────────────────────┐
│ 1. Background (#clinical-background)                                      │
│    ┌─ Summary (T1-F20) ─────────────────────────────────────────────────┐ │
│    │ Family: Father — hypertension · Sibling — sickle cell trait        │ │
│    │ Social: Non-smoker · Alcohol occasional · Herbal meds: yes (notes)│ │
│    │ PMH narrative: Childhood asthma, resolved                          │ │
│    │ SDOH (if enabled): Food secure · Transport: ok                     │ │
│    │ [ Edit history ]  [ Expand all ]                                   │ │
│    └────────────────────────────────────────────────────────────────────┘ │
│ 2. Problems … 3. Allergies … 4. Meds …                                   │
└───────────────────────────────────────────────────────────────────────────┘

[ Edit history ]  →  stock History editor (V1) OR T1-wrapped editor (V1.1)
                      with Back to chart → #clinical-background
```

### 6.2 Phasing

| Phase | Deliverable | Slice |
|-------|-------------|-------|
| **B7 / T1-F16** | Background section host + anchor in Clinical tab | Core MRD |
| **B7 / T1-F20** | Read summary panel from `history_data` + SDOH service | Same PR as Background |
| **V1 pilot** | Edit → stock editor; T1-F18 on legacy History URLs | §5.6.1 |
| **V1.1-HIST-WRAP** | ~~T1 top bar + Back to chart on editor~~ **Deleted 2026-07-18** — superseded by the permanent native editor (D-HIST-9/10) | — |
| **V1.1-OPS L3b** | Optional completion weight for family **or** social documented | Config OFF default |
| **V2** | Patient-facing pre-visit background questionnaire (portal / QR) | Out of scope V1 |

### 6.3 PMH duplication rule (normative — D49)

| Do | Don’t |
|----|-------|
| HTN as **`lists`** problem row | HTN only in free-text General |
| “Family: mother diabetes” in Background | Diagnosis-grade entries only in narrative |
| Sickle cell **trait** in family section | Full diagnosis without confirmatory test note |
| Visit exam findings in SOAP | Exam findings copied into `history_data` |

---

## 7. Background read panel — build spec (T1-F20)

**Feature ID:** **T1-F20** (Background read summary — extends T1-F16 Clinical tab host; registered PRD §8).

### 7.1 Data source

| Source | Fields |
|--------|--------|
| **`history_data`** via `getHistoryData($pid)` | All populated HIS layout fields |
| **`HistorySdohService`** (when SDOH enabled) | Latest SDOH domain summary |
| **`lists`** (read-only counts) | Optional footnote: “3 active problems — see Problems section” — **no duplication of rows** |

### 7.2 Summary layout

| Block | Display rule |
|-------|--------------|
| **Family health** | Father, mother, siblings, offspring — show **only non-empty**; clip long text at 120 chars with expand |
| **Relatives — conditions** | Diabetes, HTN, sickle cell, cancer — Ghana pack priority order |
| **Social & lifestyle** | Tobacco, alcohol, exercise, occupation, herbal/traditional use |
| **General PMH** | Free-text general medical history if populated |
| **Screening dates** | Only **Ghana-relevant** exams when in pack (BP check, Hb, glucose) — hide empty US exams |
| **SDOH chips** | Max 4 chips + “+N” when widget enabled |
| **Empty state** | *“No background documented”* + **Edit history** CTA; L3b amber hint when config ON |

### 7.3 Actions

| Action | Behavior |
|--------|----------|
| **Edit history** | Navigate to stock editor (V1) or wrapped editor (V1.1) — same tab; `return=` query → `#clinical-background` |
| **Expand all** | Accordion opens all subsections (mobile) |
| **Refresh** | On return from editor, re-fetch summary (no full MRD reload) |

### 7.4 AJAX (optional V1)

| Action | Request | Response |
|--------|---------|----------|
| `mrd.clinical_section` | `{ pid, section: 'background' }` | `{ sections: [{ id, title, lines[], empty }], sdoh_chips?, last_updated?, editor_url, anchor: 'clinical-background' }` |

**Alias:** `mrd.background_summary` with `{ pid }` returns the same DTO — prefer `mrd.clinical_section` for consistency with PAGE_DESIGNS §4.14.

May inline in first Clinical tab fetch V1 — separate endpoint preferred for refresh-after-edit.

### 7.5 ACL

| Capability | ACL |
|------------|-----|
| View summary | `patients` / `demo` |
| Edit history button | `patients` / `med` write or addonly |

---

## 8. History editor path — stock V1, wrapped V1.1

### 8.1 V1 — stock editor (locked for pilot)

| Property | Value |
|----------|-------|
| **Editor** | Stock History & Lifestyle full layout form (existing save handler) |
| **Entry** | Background **Edit history** · legacy horizontal **History** · Classic menu |
| **Navigation** | Same tab; **`return=clinical-background`** query param triggers **Back to chart** link in editor header (module inject via event) |
| **Session** | `pid` only — no encounter bind |
| **Chrome** | Stock header + nav; **T1-F18** legacy strip when overlay ON |

### 8.2 V1.1-HIST-WRAP — T1 shell on editor (**T1-F20b**) — *historical; deleted 2026-07-18*

| Property | Value |
|----------|-------|
| **When** | ~~Module installed + `enable_history_editor_wrap` = 1~~ **Feature deleted** — native editor is the permanent path |
| **Shell** | T1 top bar (clinic name, role) — **no** stock horizontal nav |
| **Strip** | T1-F18 legacy strip **or** compact MRD breadcrumb: *Chart › Clinical › Edit background* |
| **Primary action** | **Save** (stock) + **Back to chart** (module) |
| **Implementation** | Symfony response filter / RenderEvent on editor routes — same pattern as T1-F18 |

### 8.3 Wireframe — wrapped editor (V1.1)

```text
┌─ T1 top bar ────────────────────────────────────────────────────────────────┐
│  Clinic Name · Nurse · [ Visit Board ]                                      │
├─ Legacy strip (optional T1-F18) ────────────────────────────────────────────┤
│  Akua Mensah · MRN 00482 · In triage · Queue #14                            │
├─ Page title ───────────────────────────────────────────────────────────────┤
│  Edit background history          [ Back to chart ]  [ Save ]               │
├─ HIS layout form (stock fields — Ghana pack) ──────────────────────────────┤
│  Family · Social · PMH …                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Legacy overlay on stock chart — boundary module (plain English)

When staff use **legacy chart pages** (old horizontal menu, Finder, Classic menu) instead of the redesigned full chart, the **legacy patient context overlay** (T1-F18) adds a compact identity strip. Below: every capability in that boundary module, explained **without technical file names**, including **history-specific** paths.

### 9.1 Configuration and gates

| Function (plain English) | What it does |
|--------------------------|--------------|
| **Master overlay switch** | Turns the mini patient strip on or off for old chart pages. |
| **Clinical chips switch** | Optionally shows severe allergy warnings on the strip. |
| **Desk return link switch** | Shows “Return to Triage Desk” (or doctor/lab/pharmacy) when browser memory says you were treating a different patient. |
| **Shared device warning switch** | Separate setting for blocking warning when returning to a module desk after changing patient in another tab. |
| **Module installed check** | Strip never appears if New Clinic module is disabled. |
| **Clinic role check** | Only New Clinic role staff see the strip. |

### 9.2 Injection pipeline

| Function (plain English) | What it does |
|--------------------------|--------------|
| **Page render listener** | Detects when an old chart page is loading and may attach the strip. |
| **Allowlist matcher** | Only approved pages get the strip — includes **history read page**, **history edit page**, and **social determinants widget page** when those are opened from legacy nav. |
| **Fallback response filter** | Catches pages that do not fire the standard render event and prepends the strip another way. |
| **Duplicate strip guard** | Skips injection if a fuller banner or encounter strip is already on the page. |
| **Print and PDF guard** | Does not inject on print or PDF export. |
| **Strip placement** | Inserts the strip above the old page title and horizontal menu. |

### 9.3 Data loading for the strip

| Function (plain English) | What it does |
|--------------------------|--------------|
| **Legacy chart preview builder** | Loads patient name, medical record number, photo, and today’s unfinished visit in one server call. |
| **Unfinished visit resolver** | Finds active visit today for the queue chip. |
| **Allergy chip loader** | Optional severe allergies for the strip when clinical chips setting is on. |
| **Request-scoped cache** | Avoids duplicate database reads in one page load. |

### 9.4 Strip display

| Function (plain English) | What it does |
|--------------------------|--------------|
| **Legacy context strip renderer** | Draws sticky bar: name, sex, age, medical record number, date of birth. |
| **Visit chip renderer** | Shows queue state and number when patient has unfinished visit today. |
| **Open full chart link** | Opens redesigned chart in new tab at role default tab when B7 live. |
| **Return to desk link** | When desk patient ≠ chart patient, link back to role desk without auto-switching session. |
| **Sticky layout styles** | Keeps strip visible while scrolling long history forms. |

### 9.5 History-specific behavior (legacy path)

| Function (plain English) | What it does |
|--------------------------|--------------|
| **History read page coverage** | When nurse opens **History** from old menu, strip shows who the narrative belongs to. |
| **History edit page coverage** | When staff tap **Edit** on history, strip persists on the edit form — long forms scroll under sticky strip. |
| **Social determinants page coverage** | When SDOH widget page opened from legacy nav, strip applies same rules. |
| **No visit bind on history** | Opening history does **not** attach encounter session — background is patient-longitudinal. |
| **After save return** | Staff use **Back to chart** (when launched from MRD) or horizontal nav — strip updates only on full patient switch. |
| **Horizontal nav within same patient** | Dashboard → History → Report: strip unchanged, same patient. |

### 9.6 Shared device session warning (desk companion)

| Function (plain English) | What it does |
|--------------------------|--------------|
| **Desk return detector** | Detects session patient mismatch when returning to module desk tab. |
| **Blocking banner renderer** | Shows desk patient vs session patient with medical record numbers. |
| **Restore session action** | Re-binds session to desk visit after confirm. |
| **Return to queue action** | Clears active pane without wrong bind. |
| **Front desk exclusion** | Reception desk does not show this warning. |

### 9.7 What the overlay does NOT do on history pages

| Not included | Reason |
|--------------|--------|
| Edit or save history fields | Editor is stock form — overlay is identity only |
| Show full Background summary | That lives on MRD Clinical tab (T1-F20) |
| Replace redesigned chart | B7 MRD is primary read path when live |
| Bind encounter | History is patient-scoped |

---

## 10. Ghana OPD starter field pack (M6)

**Purpose:** Trim HIS layout noise for private Ghana OPD without code fork — admin imports **Ghana OPD Background** layout group.

### 10.1 Show by default (priority)

| Section | Fields (illustrative) |
|---------|------------------------|
| **Family** | Father, mother, siblings — free text; structured relatives: diabetes, hypertension, **sickle cell**, cancer, stroke |
| **Social** | Tobacco, alcohol, **herbal/traditional medicine**, occupation, marital status |
| **PMH narrative** | General medical history (free text) |
| **Ghana screening** | Last BP check, last Hb (sickle), last glucose — date fields |

### 10.2 Hide or deprioritize (US-centric)

| Hide / move to optional pack | Reason |
|------------------------------|--------|
| Mammogram, sigmoidoscopy, PSA, LDL panels | Low relevance default Ghana OPD |
| Seatbelt use, hazardous activities | US primary care bias |
| Obsolete surgery checkboxes | Migrate to problem list |

### 10.3 Admin delivery

| Item | Detail |
|------|--------|
| **M6 profile** | `ghana_opd_cash_clinic` recommends Ghana HIS pack import via **M6-F28** wizard |
| **Import** | CSV or SQL seed for `layout_options` form_id **HIS** — document in M15 Admin Hub runbook |
| **Training** | M15 day-2: “Customize Background fields” — do not delete `history_data` columns |

---

## 11. Phasing, acceptance & training

### 11.1 Acceptance criteria

**Background read (T1-F20 — with B7):**

- [ ] Clinical tab `#clinical-background` renders summary from `history_data` without loading full HIS form in iframe.
- [ ] Empty state shows **Edit history** when ACL allows.
- [ ] Family and social blocks hide when empty — no blank US exam rows.
- [ ] SDOH chips appear when SDOH enabled and data exists.
- [ ] **Edit history** returns to `#clinical-background` after save (same tab).
- [ ] PMH duplication: active problem in `lists` not echoed as duplicate narrative line in summary (server rule or display filter).

**Legacy overlay on history pages (CTX — when T1-F18 ON):**

- [ ] History read and edit pages show sticky strip with name · MRN · visit chip when visit active.
- [ ] No duplicate strip when MRD Zone A already present.
- [ ] Strip does not bind encounter.

**Ghana pack (M6):**

- [ ] Fresh install with Ghana profile hides US exam tabs by default in HIS editor.
- [ ] Sickle cell / HTN family fields visible without admin layout training.

**Normative cross-tests:** PRD test **42** (Clinical layout + View documentation); **§21.1aa** HIST-1–HIST-6; **§21.1l**; MRD §17 items 16–18.

### 11.2 Training checklist

- [ ] Deliver D49 one-liner: Background vs This visit vs problem list.
- [ ] Drill: reception adds family history from **Open full chart → Clinical → Edit history**.
- [ ] Drill: legacy nav **History** still works with strip when overlay ON.
- [ ] SOP: one structured problem row beats narrative-only HTN.

---

## 12. Closed decisions

| ID | Decision |
|----|----------|
| **D-HIST-1** | **V1 partial:** read modern (Background summary), **edit stock** HIS form — no layout engine rewrite (NG5) |
| **D-HIST-2** | Canonical store remains **`history_data`** — no parallel background table |
| **D-HIST-3** | Background is **§8.9 section #1** inside Clinical — not a sixth MRD tab |
| **D-HIST-4** | **Edit history** same tab with **Back to chart** — not new tab by default |
| **D-HIST-5** | T1-F18 legacy strip applies to stock history read/edit URLs on allowlist |
| **D-HIST-6** | Ghana OPD field pack via **M6 layout import** — not hardcoded PHP |
| **D-HIST-7** | L3b background completion **optional** — default OFF (PRD §6.1h) |
| **D-HIST-8** | ~~V1.1 T1-F20b wrap~~ **Deleted 2026-07-18** — the native editor became permanent, so the wrap (and the stock edit path it dressed) was removed (PRD §5.6 amendment) |
| **D-HIST-10** | **Full native History form** — **shipped and permanent since 2026-07-18**: replaced stock `history_full.php` entirely (flag retired); a superset of the D-HIST-9 quick editor. Plan: [NEW_CLINIC_V1_FULL_HISTORY_FORM_REDESIGN.md](../NEW_CLINIC_V1_FULL_HISTORY_FORM_REDESIGN.md). No stock fallback link remains. |
| **D-HIST-9** | **Native Background editor** (**permanent since 2026-07-18** — flag retired) — **supersedes D-HIST-1 for the edit path**. A *curated* West-Africa-first field set (family narrative + structured relatives incl. sickle cell, social/lifestyle incl. herbal medicine + occupation, PMH narrative, screening dates) edited in a native drawer. Writes the canonical `history_data` row directly (still D-HIST-2 — no parallel table); only whitelisted columns touched, stock-only HIS fields preserved. **This is NOT a layout-engine fork** (NG5 stands): the field set is deliberately fixed, not a dynamic HIS reproduction. Stock editor stays the fallback one click away until parity sign-off. |

### 12.1 Native editor field → column map (D-HIST-9, normative)

Fields without a dedicated stock column use reserved spare columns — verified free of the HIS
layout (which only claims `usertext11` "Risk Factors"). Kept in sync with
`PatientHistoryEditorService` and `PatientChartClinicalService::buildBackgroundSection`.

| Field | `history_data` column |
|-------|-----------------------|
| Family: mother / father / siblings | `history_mother` / `history_father` / `history_siblings` |
| Relatives: hypertension, diabetes, heart, stroke, TB, cancer, epilepsy, mental illness | existing `relatives_*` (stored `'yes'`) |
| Relatives: **sickle cell / G6PD** | **`usertext12`** (reserved) |
| Tobacco / alcohol / recreational drugs / exercise | `tobacco` / `alcohol` / `recreational_drugs` / `exercise_patterns` |
| **Herbal / traditional medicine** | **`usertext13`** (reserved) |
| **Occupation** | **`usertext14`** (reserved) |
| Past medical history (narrative) | `additional_history` |
| Last Hb / sickle test | `last_hemoglobin` |
| Last BP check / last glucose check | **`userdate11`** / **`userdate12`** (reserved) |

Tobacco and alcohol are free-text with guidance placeholders (non-lossy round-trip with any
stock-entered value); structured branching radios deferred. ACL: `patients` / `med` write,
mirroring the stock editor. *(Note: the D-HIST-9 sentence "Stock editor stays the fallback one
click away until parity sign-off" is historical — parity was signed off and the stock edit path
retired 2026-07-18.)*

---

## 13. Document history

| Version | Date | Changes |
|---------|------|---------|
| 0.2.1 | 2026-07-18 | **Flag retirement (PRD §5.6 amendment)** — D-HIST-9/10 native editor is the permanent edit path (`enable_native_history_editor`/`_full_form` retired); T1-F20b wrap **deleted** (`enable_history_editor_wrap` removed); §6.2 phase row, §8.2 wrap section, D-HIST-8/9/10 decisions marked historical/permanent |
| 0.2.0 | 2026-07-14 | **D-HIST-9** — optional native Background editor (curated field set, `enable_native_history_editor`, default OFF) supersedes D-HIST-1 for the edit path; reserved-column map (§12.1); read summary extended for sickle cell / herbal medicine / occupation |
| 0.1.1 | 2026-06-24 | **Audit closure** — PRD T1-F20/T1-F20b, M6-F28, D-HIST-1–8 registered; AJAX aligned to `mrd.clinical_section`; cross-refs PAGE_DESIGNS §4.14 edit return path |
| 0.1.0 | 2026-06-24 | Initial spec — OpenEMR pain points, UI/UX, EHR patterns, Ghana context, T1-F20 Background read, V1.1 editor wrap, legacy overlay plain-English glossary |

---

*Normative chart IA: [MRD §8.9](./MEDICAL_RECORD_DASHBOARD_REDESIGN.md#89-clinical-tab--layout--anchors-d-mrd-10) · [PAGE_DESIGNS §4.14](../NEW_CLINIC_V1_PAGE_DESIGNS.md#414-mrd-clinical-tab--build-spec-t1-f16-d-mrd-10) · Taxonomy [PRD §6.1h](./NEW_CLINIC_V1_PRD.md#61h-longitudinal-chart-taxonomy--history-vs-assessments) · Legacy strip [LEGACY_CHART_CONTEXT](./NEW_CLINIC_V1_LEGACY_CHART_CONTEXT_REDESIGN.md)*
