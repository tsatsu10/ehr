# Front Desk Search and Patient Registry

## Two different questions

| Tool | Question | User | Results |
|------|----------|------|---------|
| **M1a Front Desk search** | Who walked in? / Find Akua | Reception, nurse daily | Top 8 fast; operational |
| **M10 Patient Registry** | Who matches these rules? | Doctor, admin, program lead | Many rows; export; cohort |

## Patient Finder (`fin0` / `dynamic_finder.php`)

**Decision:** Hide for clinic roles in daily use. Do not depend on legacy Finder for reception workflows.

- Replaced by M1a `PatientSearchService` + `patient-search` component.
- M10 replaces Finder for **structured cohort** queries when `enable_patient_registry` = 1.

## Front Desk search — path to “100%”

Spec: `NEW_CLINIC_V1_FRONT_DESK_SEARCH_REDESIGN.md` — **Approved Phase 1**.

Key requirements captured in conversation:

- Debounced search; server scores up to 25; UI shows top 8.
- Normalized phone, NHIS, MRN, name matching.
- `patients.search` and `patients.preview` AJAX contracts.
- Embed matrix for desks and modals.
- P95 under 1.5s target (PRD G7).
- Open full chart → MRD (role default tab).

## Patient Registry — comprehensive design

Spec: `NEW_CLINIC_V1_PATIENT_REGISTRY_REDESIGN.md` — Module **M10**.

User-confirmed filter choices:

- **Record status** dropdown: Active / Include inactive / Deceased only / All — default **Active patients only**.
- **Confirmed malaria (and similar):** user-selectable **confirmation source** (not hard-coded).
- **Age at diagnosis** supported (not just age today).
- Phased delivery: PR-1 demographics → PR-2 clinical → PR-3 lab confirmation + saved filters.

PRD integration:

- Module M10 block with M10-F01–F13.
- M6-F19: `enable_patient_registry`.
- PAGE_DESIGNS §7.32 (added in later doc passes).

## Config keys

| Key | Default | Effect |
|-----|---------|--------|
| `enable_patient_registry` | 0 | Enables M10; hides legacy Finder menu |

## Release slice

- **V1.1-REG** — after M1 Front Desk live; not pilot-blocking when flag OFF.
