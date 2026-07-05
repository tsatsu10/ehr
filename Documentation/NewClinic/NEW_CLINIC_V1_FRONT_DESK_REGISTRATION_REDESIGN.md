# Front Desk Registration — Redesign Specification (M1b / M1c)

| Field | Value |
|-------|--------|
| **Document version** | 1.1.0 |
| **Status** | **Approved for implementation** — supersedes L1-only Quick Add as primary registration path |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](./NEW_CLINIC_V1_PRD.md), [NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md](./NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md) (M1a), [NEW_CLINIC_V1_PAGE_DESIGNS.md](./NEW_CLINIC_V1_PAGE_DESIGNS.md) §4.1.3 / §7.2, [NEW_CLINIC_V1_USER_WORKFLOWS.md](./NEW_CLINIC_V1_USER_WORKFLOWS.md) §8.1 / §9 |
| **Audience** | Product, design, backend, frontend, QA |
| **Scope** | **M1b** full registration form + **M1c** completion scoring alignment at Front Desk |
| **Replaces** | PRD M1b “Quick Add drawer” (L1-only, ≤10s) as **primary** path — retained only as legacy alias in code until removed |
| **Does not replace** | M1a search ([FRONT_DESK_SEARCH](./NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md)); M10 Patient Registry cohort search |

---

## Table of contents

1. [Purpose & positioning](#1-purpose--positioning)
2. [Design decision — why full desk form](#2-design-decision--why-full-desk-form)
3. [Registration flow](#3-registration-flow)
4. [Form layout — four sections](#4-form-layout--four-sections)
5. [Section 1 — Basic info](#5-section-1--basic-info)
6. [Section 2 — Contact & identity](#6-section-2--contact--identity)
7. [Section 3 — Clinical & demographics](#7-section-3--clinical--demographics)
8. [Section 4 — Admin & insurance](#8-section-4--admin--insurance)
9. [Ghana region & district model](#9-ghana-region--district-model)
10. [Save model & completion gates](#10-save-model--completion-gates)
11. [Duplicate detection](#11-duplicate-detection)
12. [Edit mode (returning patients)](#12-edit-mode-returning-patients)
13. [Data model & OpenEMR mapping](#13-data-model--openemr-mapping)
14. [AJAX API contracts](#14-ajax-api-contracts)
15. [Relationship to MRD Profile tab (B7)](#15-relationship-to-mrd-profile-tab-b7)
16. [Acceptance criteria](#16-acceptance-criteria)
17. [Document history](#17-document-history)

---

## 1. Purpose & positioning

Reception still operates **search first** (M1a). When no match is found, staff open a **structured registration form** in the right pane — not a minimal Quick Add drawer and not stock `demographics.php`.

| Principle | Rule |
|-----------|------|
| Search first | Default state = search; registration only after “no match” or **Edit profile** on existing patient |
| One form, four sections | Accordion on `front-desk.php` right pane; same form for **create** and **edit** |
| Capture at desk | Ghana pilot: reception collects full profile at registration; optional clinical/insurance sections encouraged same visit |
| Completion % | Existing `PatientCompletionService` + 70% billing gate unchanged |
| No stock chart for daily reg | “Open full chart” remains secondary for history/notes |

---

## 2. Design decision — why full desk form

**Supersedes PRD Q10 (progressive L1-only Quick Add)** for Ghana pilot clinics.

| Old model (deprecated) | New model |
|------------------------|-----------|
| L1 Quick Add ≤10s; L2–4 later via banner + stock demographics | Four-section form at Front Desk |
| ~35% complete at create | ~35–45% after Section 1; ~70%+ after Section 2 |
| Reception sends patients to overloaded stock MRD for address/NHIS | Address, region/district, NHIS captured in-module |

`new_clinic_config.registration_mode` default changes from `progressive` to **`desk_full_form`**. Value `progressive` retained for rollback only.

---

## 3. Registration flow

```text
Search (M1a) → No match → [ + Register patient ]
                              │
                              ▼
                    ┌─────────────────────┐
                    │ 4-section accordion │
                    │ 1 Basic (create)    │
                    │ 2 Contact & ID      │
                    │ 3 Clinical (opt)      │
                    │ 4 Insurance (opt)   │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         [ Save ]    [ Save & start visit ]  [ Cancel ]
```

**M1a switch guards (unchanged):** dirty registration form → confirm before changing search selection (replaces M1a-F14b Quick Add guard).

---

## 4. Form layout — four sections

| Section | Title | Required for | Required for 70% pay |
|---------|-------|--------------|----------------------|
| **1** | Basic info | **Create patient** | No |
| **2** | Contact & identity | — | **Yes** (address + region+district when location captured; allergies/NHIS per level) |
| **3** | Clinical & demographics | No | Allergies documented (or NKDA) for full score |
| **4** | Admin & insurance | No | NHIS fields when type = NHIS |

UI: single scrollable accordion; section headers show completion checkmarks. Target viewport: **1366×768** without horizontal scroll.

---

## 5. Section 1 — Basic info

### 5.1 Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| First name | text | **Yes** | |
| Last name | text | **Yes** | Min 2 characters |
| Middle name | text | No | Visible; maps `mname` |
| Sex | dropdown | **Yes** | Male, Female, Unknown (`UNK` in OpenEMR) |
| Date of birth | date | Conditional | Exact DOB **or** estimated age (one required on create) |
| Estimated age | number | Conditional | Used when DOB unknown; stored as mid-year DOB + `dob_estimated=1` |
| Phone number | text | Conditional | Required unless **No personal phone** checked |
| No personal phone | checkbox | — | When checked: **reach contact** (name, phone, relationship) required — separate from emergency contact in §6 |
| National ID | text | No | Ghana Card / national ID; persisted on Section 1 save; included in dup check |

### 5.2 Behavior

- **Save Section 1** → `PatientService::insert` (new) or update (edit); `updateDupScore`; `PatientCompletionService::recompute`
- Auto **MRN** (`pubpid`) from OpenEMR
- Completion status via **score %**, not a separate `INCOMPLETE` flag
- Phone validation: `PhoneNormalizer` + config regex (default `^0[235]\d{8}$`)

---

## 6. Section 2 — Contact & identity

### 6.1 Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Address | textarea | For completion | Free text → `street` |
| Landmark | text | No | `new_patient_meta.landmark` |
| Region | dropdown | When location provided | Parent admin unit — see §9 |
| District | dropdown | When location provided | **Child of region** — disabled until region selected |
| Nationality | text | No | `new_patient_meta.nationality` (replaces Country dropdown) |
| Place of birth | text | No | `new_patient_meta.place_of_birth` |
| Tribe | text | No | Ethnic/cultural group (e.g. Akan, Ewe) — separate from race in §7 |
| Additional phone | text | No | `phone_home` |
| Email | email | No | `email` |
| Emergency contact name | text | For completion | PRD L2; **not** the same as reach contact in §5 |
| Emergency contact phone | text | For completion | PRD L2 |

### 6.2 Rules

- **Progressive save:** Section 2 may be saved with email, emergency contact, or national ID only — region and district are required **only when** address, landmark, or either geo field is provided
- Region change → **clear district** and reload district options

---

## 7. Section 3 — Clinical & demographics

**Not required for registration** — encouraged at desk for safety.

| Field | Type | Notes |
|-------|------|-------|
| Blood group | dropdown | OpenEMR blood type |
| Allergies | tag input | `lists` type `allergy`; **NKDA** checkbox **or** **Allergies unknown** checkbox (mutually exclusive) |
| Chronic conditions | tag input | `lists` type `medical_problem` |
| Pregnancy status | dropdown | Visible only when Sex = Female |
| Disability flag | checkbox | `new_patient_meta` |
| Religion | dropdown | Fixed enum (Christianity, Islam, …) |
| Race | dropdown | Self-reported category (Black, African, …) — separate from tribe |
| Highest education level | dropdown | Seven plain-language options |
| Occupation | text | `new_patient_meta.occupation` |

Soft prompt if allergies empty: *“Not recorded — nurse will confirm at triage.”*

---

## 8. Section 4 — Admin & insurance

| Insurance type | Extra fields |
|----------------|--------------|
| **Cash** | None |
| **NHIS** | NHIS number, expiry date — **single source of truth** (no duplicate NHIS fields elsewhere) |
| **Private** | Provider name, policy number — **V1 pilot: optional / collapsed** |

**Rules:**

- If NHIS expiry &lt; today → treat as **Cash** for display and cashier (no claims in V1)
- V1 billing remains **cash only**; insurance is patient attribute only

---

## 9. Ghana region & district model

**Region and district are different administrative levels.** District is always **inside** a region.

```text
Country (Ghana)
  └── Region (16 regions)
        └── District (260+ districts; subset seeded for pilot)
```

### 9.1 UI

| Control | Behavior |
|---------|----------|
| Region | Dropdown of all regions |
| District | Disabled until region chosen; lists **only districts in that region** |

### 9.2 Storage

| Field | Storage | Reporting |
|-------|---------|-----------|
| `region_code` | `new_patient_meta.region_code` | Stable code (e.g. `GAR`) |
| `region_label` | `new_patient_meta.region_label` or `patient_data.state` | Display |
| `district_code` | `new_patient_meta.district_code` | Stable code |
| `district_label` | `new_patient_meta.district_label` or `patient_data.city` | Display |

M6 seeds `ghana_regions_districts.json` (or DB table `new_clinic_region` / `new_clinic_district`). Admin may update lists without code deploy.

### 9.3 Validation

- District without region → **validation error**
- District not in selected region → **validation error**
- Free-text district **not** allowed when Ghana country selected (dropdown only)

---

## 10. Save model & completion gates

| Action | When |
|--------|------|
| **Save** (per section or global) | Persists current section(s); stays on form |
| **Save & start visit** | After Section 1 valid → create/update → open Start visit panel |
| **Cancel** | Confirm if dirty |

**Do not** auto-save on every keystroke — save on section **Next** / **Save** button.

### Completion targets (approximate)

| After | Score | Start visit | Pay (70%) |
|-------|-------|-------------|-----------|
| Section 1 | ~35–45% | Yes | No |
| Section 2 complete | ~70–85% | Yes | Yes* |
| Sections 3–4 | 90–100% | Yes | Yes |

\*Plus pediatric exact-DOB rule (DOB-F06) and E-Sign gate at payment unchanged.

---

## 11. Duplicate detection

Reuse `PatientDuplicateService` (DUP-F01–F05). Score on:

| Signal | Weight (existing + additive) |
|--------|------------------------------|
| Phone exact (cell, home, biz, normalized, **reach contact**) | High |
| Name + DOB | High |
| Name similarity (SOUNDEX) | Medium |
| National ID exact | **High** (when field populated) |

UI: **“Possible match found”** panel below Section 1 with up to 3 candidates; block/warn/override unchanged.

**Edit mode:** `patients.dup_check` accepts `exclude_pid` (or `pid`) so the patient being edited is not scored as a duplicate of themselves.

---

## 12. Edit mode (returning patients)

Same four-section form opens from:

- Preview pane → **Edit profile**
- Completion banner → **Complete now** (when M1c banner ships on desks)
- MRD Profile tab (B7) — shared field contract

`patients.update` API with `pid`; no second patient created.

---

## 13. Data model & OpenEMR mapping

See §5–§8 field tables. New / extended module columns:

```sql
-- new_patient_meta extensions (install.sql migration)
region_code VARCHAR(16) NULL,
region_label VARCHAR(128) NULL,
district_code VARCHAR(16) NULL,
district_label VARCHAR(128) NULL,
landmark VARCHAR(255) NULL,
disability_flag TINYINT(1) DEFAULT 0,
insurance_type ENUM('cash','nhis','private') DEFAULT 'cash',
nhis_number VARCHAR(64) NULL,
nhis_expiry DATE NULL,
private_insurer VARCHAR(128) NULL,
private_policy VARCHAR(64) NULL,
pregnancy_status VARCHAR(32) NULL
```

Completion weights updated in `new_completion_field_weight` to include: `mname`, `national_id`, `region_code`, `district_code`, `landmark`, `emergency_contact`, `nhis_number` (when NHIS), etc.

---

## 14. AJAX API contracts

| Action | Method | ACL | Body |
|--------|--------|-----|------|
| `patients.create` | POST | `new_reception` | `{ section: 1..4, patient: {...}, csrf }` — first call may omit `pid` |
| `patients.update` | POST | `new_reception` | `{ pid, section, patient: {...}, csrf }` |
| `patients.dup_check` | POST | `new_reception` | DUP contract + `national_id`; optional `exclude_pid` on edit |
| `admin.geo.regions` | GET | desk ACL | `{ country: 'GH' }` → regions list |
| `admin.geo.districts` | GET | desk ACL | `{ region_code }` → districts list |

Deprecated: `patients.create` body shaped as Quick Add L1-only — migrate clients to sectioned payload.

---

## 15. Relationship to MRD Profile tab (B7)

| Surface | Role |
|---------|------|
| **Front Desk form (this doc)** | Primary **create + edit** at registration |
| **MRD Profile tab (B7)** | Read/review + edit for staff who opened full chart; **same field contract** |
| **Stock demographics.php** | Fallback until B7 ships; not primary training path |

B7 Profile tab checklist (L1–L4) must mirror section completion state from this form.

---

## 16. Acceptance criteria

### P0

- [x] Search → no match → Register opens 4-section accordion (not L1-only drawer)
- [x] Section 1 creates patient with name, sex, phone or reach contact (no personal phone)
- [x] Region dropdown enables district dropdown with **district ⊆ region**
- [x] DOB in Section 1 clears estimated age flag
- [x] Dup check includes national ID when provided
- [x] Save & start visit after Section 1
- [x] Completion % updates after each save; 70% gate at cashier unchanged
- [x] Edit profile reopens same form for existing `pid`
- [x] M1a-F14b dirty-switch applies to registration form

### P1

- [x] NHIS expiry -> display as Cash (PatientInsuranceUtil::effectiveType; preview badge sp168)
- [x] Allergies "None known" sets NKDA list entry (replaceListEntries + NKDA check aligned sp168)
- [x] Pregnancy field visible only for Female
- [ ] `ghana_regions_districts` seeded in M6 — **admin M6 setup step, not registration form**

---

## 17. Document history

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-06-25 | Reach contact replaces no-phone reason; nationality/tribe/demographics dropdowns; allergies unknown; national ID in Section 1; progressive Section 2 geo save; dup `exclude_pid`; reach phone in dup scoring |
| 1.0.0 | 2026-06-25 | Initial spec: 4-section desk form; Ghana region→district hierarchy; supersedes L1 Quick Add as primary path; Q10 superseded by Q46 |
