# Full History Form — Comprehensive Native Redesign Plan

| Field | Value |
|-------|--------|
| **Document version** | 0.5.0 |
| **Status** | **D-HIST-10a/10b/10c COMPLETE + PERMANENT** — full native History editor (quick⇆full) is the only edit path since **2026-07-18** (flags `enable_native_history_editor`/`_full_form` retired, PRD §5.6 amendment; parity signed off 2026-07-15); stock `history_full.php` no longer linked; the T1-F20b wrap was deleted; 10d (admin-editable lists) deferred |
| **Feature ID** | **D-HIST-10** · flag retired 2026-07-18 (always on) |
| **Companion to** | [NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md](./done/NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) (v0.2.0 — the read summary + the curated quick editor D-HIST-9, already built), [NEW_CLINIC_V1_PRD.md](./done/NEW_CLINIC_V1_PRD.md), [NEW_CLINIC_V1_PAGE_DESIGNS.md](./NEW_CLINIC_V1_PAGE_DESIGNS.md) |
| **Primary market** | Private outpatient clinics — Ghana & West Africa |
| **Implementation** | Design/plan only — no code in this document |

---

## 1. What this is, in one paragraph

The **"Full history form"** is the link at the bottom of the native Background drawer. Today it
opens the **stock OpenEMR History & Lifestyle screen** (`history_full.php`) — the complete,
layout-driven form with every field. The native drawer we already built (**D-HIST-9**) is a fast,
region-first **quick editor** for the fields staff touch every day. This plan covers the **next
step: a full native History editor** that replaces the stock full form itself — so staff never drop
into the old layout-engine screen — while dropping the fields that don't fit a West-Africa cash OPD.

**The relationship, in plain words:**

- **Quick editor (built):** the 80% — family, social habits (dropdowns), past illnesses, key checks.
- **Full editor (this plan):** everything clinically useful in the stock form, natively, region-tuned.
- **Stock form:** stays as the last-resort fallback until the full editor passes parity sign-off.

---

## 2. Analysis of the stock form (what's actually there)

The stock form has **37 fields in 5 groups**, rendered by the LBF layout engine. Full inventory and
what we propose to do with each:

### 2.1 General (2 fields)

| Field | Stock widget | Disposition |
|-------|--------------|-------------|
| Risk Factors (`usertext11`, list `riskfactors`) | Multi-select list + custom | **Keep — redesign** as a native multi-select from a **fixed WHO-PEN-aligned starter list** (resolved Q1; admin-editable later in D-HIST-10d). List defined in §3.5 |
| Exams/Tests (`exams`) | US screening-date grid (mammogram, PSA, colonoscopy…) | **Drop the US grid**; replace with the region "Recent health checks" set (Hb, BP, glucose, cervical, HIV) |

### 2.2 Family History (10 fields)

| Field | Stock widget | Disposition |
|-------|--------------|-------------|
| Father / Mother / Siblings | Free text | **Keep** as narrative |
| Spouse / Offspring | Free text | **Drop** (resolved Q3) — low value for a cash OPD; keeps the form short. Existing data preserved, just not shown |
| Diagnosis Code ×5 (`dc_*`) | ICD/SNOMED code picker per relative | **Drop** — coding family history per relative is too heavy for OPD; the structured tick-list below captures what matters |

### 2.3 Relatives — conditions that run in the family (9 fields)

| Field | Disposition |
|-------|-------------|
| Cancer, Tuberculosis, Diabetes, High blood pressure, Heart problems, Stroke, Epilepsy, Mental illness | **Keep** as the native tick-list (already in the quick editor) |
| Suicide | **Keep, optional** — sensitive; behind an "add more" reveal, non-judgemental wording |
| — (new) **Sickle cell / G6PD** | **Add** — the #1 West Africa family-history signal, absent from stock |

### 2.4 Lifestyle (9 fields)

| Field | Stock widget | Disposition |
|-------|--------------|-------------|
| Tobacco | SNOMED smoking status | **Keep — simplify** to a plain dropdown (Never/Former/Current); SNOMED coding not needed for cash OPD |
| Alcohol, Recreational drugs, Exercise | "How often" detail widget | **Keep** as native dropdowns (already built) |
| Coffee | Frequency widget | **Drop** — low value |
| Counseling | Preventive-care widget | **Drop** — US preventive framing |
| Hazardous activities, Seatbelt use | Free text | **Drop** — US primary-care bias |
| Sleep patterns | Free text | **Keep, optional** |
| — (new) **Herbal / traditional medicine** | **Add** — common, drug-interaction risk (built) |
| — (new) **Occupation** | **Add** — TB/respiratory/urban-rural relevance (built) |

### 2.5 Other (7 fields)

| Field | Disposition |
|-------|-------------|
| Additional history (`additional_history`) | **Keep** — the past-illness narrative (built) |
| Name/Value ×2 | **Drop** — generic free slots, no clear OPD use |
| User Defined Area 11/12 | Already hidden (`uor=0`) — **ignore** |

### 2.6 Structural pain points (why redesign, not just re-skin)

- **US-centric by default** — a third of the visible fields (exams grid, seatbelt, hazardous
  activities, coffee, counseling) are irrelevant to the target clinic and crowd out what matters.
- **Layout-engine complexity** — the form is driven by `layout_options`; trimming it the "stock
  way" needs Admin → Layout training the clinic won't have.
- **Heavy widgets** — per-relative diagnosis-code pickers and SNOMED smoking status are more than a
  cash OPD needs and slow the form on a shared clinic PC/tablet.
- **Two paradigms** — dropping from the modern chart into the stock screen breaks the visual and
  interaction model staff just learned.

---

## 3. The redesign

### 3.1 Shape

A **full native History editor** — same slide-over drawer pattern and design language as the built
quick editor, but **complete**: every clinically useful group, in accordion sections, region-first.
It is a **superset of the quick editor**, adding Risk Factors, Spouse/Offspring family narrative,
the extra relative conditions, sleep, and a rationalized screening set. It writes the **same
`history_data` record** — no parallel store, no layout-engine fork.

```
Edit full history                                            [X]
Patient name · MRN
────────────────────────────────────────────────────────────
▾ Family health          (mother, father, siblings + tick-list; spouse/offspring optional)
▾ Social & lifestyle     (tobacco/alcohol/drugs/exercise dropdowns; herbal, occupation; sleep optional)
▸ Past illnesses         (narrative)
▸ Recent health checks   (Hb/sickle, BP, glucose — region set, not US exams)
▸ Risk factors           (region-tuned multi-select)
────────────────────────────────────────────────────────────
Quick edit ·                                    [ Cancel ] [ Save ]
```

### 3.2 What changes vs the quick editor

| Added in the full editor | Why |
|--------------------------|-----|
| Full relative-condition tick-list incl. TB, epilepsy, cancer | Parity with stock relatives group |
| Family history of **suicide / mental illness** behind an "Add more" reveal (resolved Q2) | Sensitive — kept but not front-and-centre; non-judgemental wording |
| Risk factors multi-select — WHO-PEN starter list (§3.5) | Captures chronic-disease and West-Africa risk in one scan |
| Sleep patterns (optional) | Occasionally relevant; kept low-priority |
| Rationalised screening set | Replaces the US exam grid with region-relevant checks |

### 3.3 States (every section)

- **Loading:** skeleton while the record loads.
- **Empty:** "Not documented" placeholders + the field ready — never a blank US-exam grid.
- **Validation:** inline while typing; dropdowns pre-select a stored value and preserve any typed
  custom value; dates DD/MM/YYYY; values kept on error; drawer closes only on successful save.
- **Error:** token error callout inside the drawer + retry; nothing lost.

### 3.4 Interactions

- One primary action: **Save**. Not visit-bound (background is patient-longitudinal).
- **Quick edit** link switches back to the short drawer for fast day-to-day entry.
- Non-judgemental copy throughout; 44px touch targets; keyboard tab order; Esc closes.
- No dead ends — closing returns to the chart Background section; the summary refreshes.

### 3.5 Risk factors — WHO-PEN-aligned starter list (resolved Q1)

A fixed, tick-box **starter list** grounded in the WHO Package of Essential NCD interventions
(WHO-PEN), the standard risk-assessment framework used in Ghana & West African primary care, plus
the regional additions WHO-PEN's core set omits. Ships fixed in V1; becomes admin-editable in
**D-HIST-10d**. A free-text "Other" box captures anything off-list (non-lossy).

| # | Risk factor | Basis |
|---|-------------|-------|
| 1 | Tobacco use (current or former) | WHO-PEN core CVD risk |
| 2 | Harmful alcohol use | WHO-PEN core |
| 3 | Physical inactivity | WHO-PEN core |
| 4 | Overweight / obesity (raised BMI) | WHO-PEN core |
| 5 | Known raised blood pressure | WHO-PEN core |
| 6 | Known raised blood sugar (diabetes) | WHO-PEN core |
| 7 | Family history of heart disease, stroke, or diabetes | WHO-PEN core |
| 8 | Sickle cell trait or disease | West Africa addition |
| 9 | HIV positive (if disclosed) | Regional chronic-care burden |
| 10 | Previous TB or TB contact | Regional comorbidity |
| 11 | High-risk pregnancy | ANC routing |
| 12 | Herbal / traditional medicine use | Drug-interaction risk |
| — | Other (free text) | Anything off-list |

Sources: [WHO-PEN readiness, Ghana](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11623084/) ·
[WHO CVD risk charts, Ghana & Nigeria](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12148134/) ·
[PEN pilot, Ghana](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5257011/).

---

## 4. Data & backend

- **Store:** the canonical `history_data` row (one per patient) — same as the quick editor. Only
  whitelisted columns are written; any column not managed here is preserved.
- **Reuse:** `getHistoryData($pid)` for reads; extend `PatientHistoryEditorService` with the
  additional fields rather than a new service. Reserved spare columns already documented for sickle
  cell / herbal / occupation / BP / glucose (see D-HIST-9). New additions: extra relative conditions
  (incl. suicide) → `relatives_*`; sleep → `sleep_patterns`; risk factors → reserved `usertext15`
  (selected keys, comma-joined) + `usertext16` ("Other" free text). **Note:** risk factors do NOT
  reuse the stock Risk Factors column (`usertext11`) — that column uses its own list-option format,
  so it is kept pristine to avoid a round-trip conflict. No new columns needed. Spouse/offspring
  columns are left untouched — dropped from the UI (Q3), data preserved.
- **Save is a partial update** — the service writes only the columns whose key is present in the
  payload, so the quick editor and full editor never blank each other's fields.
- **Actions:** extend the existing `patients.chart.history_get` / `patients.chart.history_save`
  with a `full` payload shape (or a `mode` flag) — no new ajax actions required.
- **ACL:** `patients` / `med` write, mirroring the stock form exactly.
- **No LBF fork:** the field set is deliberately fixed and curated; we do not reproduce the dynamic
  layout engine (upholds the NG5 rule).

---

## 5. Feature flag, rollout & parity sign-off

- **Flag: retired 2026-07-18** (PRD §5.6 amendment). Both `enable_native_history_full_form` and
  `enable_native_history_editor` were removed from code after parity — the native quick⇆full
  drawer is the permanent, only edit path; the stock `history_full.php` link and the T1-F20b
  wrap are gone. *(The two bullets below describe the pre-retirement rollout, kept for history.)*
- ~~Flag OFF: the "Full history form" link opens the stock `history_full.php`~~ (historical).
- **The stock full form is no longer offered** — parity passed; there is no "Advanced (stock
  form)" escape hatch (product decision 2026-07-15, made unconditional 2026-07-18).
- **Parity sign-off — PASSED 2026-07-15** (verified end-to-end via headless browser + live DB):
  - [x] Every native field writes the correct `history_data` column — verified round-trip
    (sickle→`usertext12`, sleep→`sleep_patterns`, BP→`userdate11`, suicide→`relatives_suicide`,
    risk→`usertext15`).
  - [x] A value entered via the stock form displays in the native editor (`history_mother` read back).
  - [x] Dropped US fields never lose data — seatbelt, mammogram, hazardous activities, coffee, and
    offspring were seeded via stock and left **untouched** after a native save (partial-update).
  - [x] Family free-text values entered in stock are preserved by the native editor.
  - [x] ACL matches stock (`patients`/`med`) — enforced in `PatientHistoryEditorService::save()`.
  - [x] 360px tablet smoke — panel fits, accordion usable, controls tappable (buttons are the module
    standard 36px height; consistent with every other desk).

---

## 6. Phasing (D-HIST-10)

| Phase | Deliverable |
|-------|-------------|
| **D-HIST-10a** | ✅ **Built** — `PatientHistoryEditorService` extended: partial-update save, WHO-PEN risk factors (`usertext15`/`16`), sleep, suicide |
| **D-HIST-10b** | ✅ **Built** — full native editor UI (accordion superset + risk factors + sensitive-conditions reveal) with a "Quick edit ⇆ Full form" switch — **always on since 2026-07-18** (flag retired; Admin Hub toggle removed) |
| **D-HIST-10c** | ✅ **Done** — parity signed off (§5, verified via headless browser + live DB); stock "Advanced" link **removed**; **2026-07-18:** flags retired, wrap deleted — native full form is the sole full editor unconditionally |
| **D-HIST-10d (optional, deferred)** | Region **Risk factors** and screening lists as admin-editable config, not hardcoded |

---

## 7. Resolved decisions (were open questions)

1. **Risk factors list** — ✅ Ship a **fixed WHO-PEN-aligned starter list** (§3.5) from online research; make it admin-editable later in **D-HIST-10d**. Free-text "Other" keeps it non-lossy.
2. **Suicide / mental-illness family history** — ✅ **Include behind an "Add more" reveal** — kept for clinical value, not front-and-centre, non-judgemental wording.
3. **Spouse / Offspring family narrative** — ✅ **Drop** from the UI to keep the form short; existing column data preserved, just not shown.
4. **One flag or two** — ✅ **Two flags** for rollout — both retired 2026-07-18 once the rollout completed (PRD §5.6 amendment).

No open questions remain; the plan is ready to hand to a build session.

---

## 8. Version history

| Version | Date | Changes |
|---------|------|---------|
| 0.5.0 | 2026-07-18 | **Flags retired (PRD §5.6 amendment)** — `enable_native_history_editor` + `enable_native_history_full_form` removed from code; native quick⇆full drawer is the permanent, only edit path; stock `history_full.php` no longer linked; T1-F20b wrap deleted; §5 rollout bullets marked historical; decision 4 closed |
| 0.4.0 | 2026-07-15 | **D-HIST-10c parity signed off** — verified end-to-end (native writes → correct columns; stock-only fields untouched by native save; stock→native read; ACL; 360px). Stock "Advanced (stock form)" link **removed** — native full form is the sole full editor when the flag is on |
| 0.3.0 | 2026-07-15 | **D-HIST-10a/10b built** — full native editor (quick⇆full switch, WHO-PEN risk factors in `usertext15`/`16`, sleep, sensitive-conditions reveal, partial-update save) behind `enable_native_history_full_form`; Admin Hub toggle; corrected risk-factor storage columns (not stock `usertext11`) |
| 0.2.0 | 2026-07-15 | Open questions resolved: WHO-PEN risk-factor starter list (§3.5, online research); suicide/mental-illness family history behind "Add more"; spouse/offspring dropped; two independent flags. Backend + phasing updated to match |
| 0.1.0 | 2026-07-15 | Initial plan — stock HIS 37-field inventory + disposition, full native editor design, D-HIST-10 phasing, flag `enable_native_history_full_form`, parity checklist |
