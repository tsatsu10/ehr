# Immunizations — Native Editor Redesign Plan

| Field | Value |
|-------|--------|
| **Document version** | 0.1.0 |
| **Status** | Plan + build in progress — **D-IMM-1** native immunization editor behind `enable_native_immunization_editor` (default OFF) |
| **Companion to** | [MEDICAL_RECORD_DASHBOARD_REDESIGN.md](./done/MEDICAL_RECORD_DASHBOARD_REDESIGN.md), [NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md](./done/NEW_CLINIC_V1_MEDICAL_HISTORY_BACKGROUND_REDESIGN.md) (same native-drawer pattern) |
| **Primary market** | Private outpatient clinics — Ghana & West Africa |
| **Implementation** | Design + build |

---

## 1. Purpose

The chart's **Clinical → Immunizations** section lists a patient's shots, but the **Add / Edit**
action drops staff into the stock OpenEMR immunizations screen (`immunizations.php`) — a US-centric,
CVX-code-driven form with a known re-add bug on the PDF back-button. This replaces the *edit* path
with a native drawer (same pattern as the problem/allergy and history editors), using a **Ghana EPI**
vaccine list, while keeping the canonical `immunizations` table.

## 2. Analysis of the stock page (researched, not assumed)

- **Read (already native):** `PatientChartClinicalService::buildImmunizationsSection` reads the
  `immunizations` table (latest 25, `added_erroneously = 0`), resolves each shot's name from the
  `immunizations` list (`list_options`) or the CVX code, and shows date + lot.
- **Edit (stock):** `editor_url` → `interface/patient_file/summary/immunizations.php`. That form uses
  `REPLACE INTO immunizations` on `mode=add` and carries a documented re-add bug (its own comment).
- **Vaccine list:** `list_options` `list_id='immunizations'` ships **35 US-default options** (DTaP, DT,
  Hep A/B, MMR…) — missing the West Africa EPI staples: **Pentavalent, PCV, Rotavirus, Measles-Rubella,
  Yellow Fever, Meningococcal A, OPV/IPV as scheduled, Vitamin A, Td**.
- **Data model:** rich table — `administered_date`, `immunization_id` (→ list option), `cvx_code`,
  `lot_number`, `manufacturer`, `note`, `information_source`, `completion_status`, `refusal_reason`,
  `route`, `administration_site`, `added_erroneously`, `encounter_id`, `created_by`/`updated_by`.

## 3. Ghana EPI vaccine set (from research)

Seeded into the `immunizations` list (`list_options`, numeric option_ids 500+ to avoid collision with
the stock 1–35). Sources: Ghana EPI schedule (childhood immunization in Ghana, 2024) — birth to 18 months
plus Td for pregnant women.

| Vaccine | Schedule point |
|---------|----------------|
| BCG | Birth |
| OPV 0 / 1 / 2 / 3 | Birth, 6, 10, 14 weeks |
| IPV | 14 weeks |
| Pentavalent (DTP-HepB-Hib) 1 / 2 / 3 | 6, 10, 14 weeks |
| PCV 1 / 2 / 3 | 6, 10, 14 weeks |
| Rotavirus 1 / 2 | 6, 10 weeks |
| Measles-Rubella 1 / 2 | 9, 18 months |
| Yellow Fever | 9 months |
| Meningococcal A | 9–18 months |
| Vitamin A | 6 months + |
| Td / TT (tetanus) | Pregnancy / catch-up |

**All-ages additions (option_ids 520–526)** — beyond routine childhood EPI, for a clinic that
vaccinates all ages: **COVID-19**, **Malaria (RTS,S / R21)** (Ghana was a WHO pilot country and the
first to approve R21/Matrix-M), **HPV** (adolescent girls), **Hepatitis B (adult)**, **Influenza**,
**Rabies (post-exposure)**, **Typhoid conjugate**.

## 4. The redesign

A native **Immunization drawer** (same slide-over pattern, proper width) opened by **Add** / **Edit**
on the Immunizations section when the flag is on.

- **Vaccine** (required) — dropdown of the EPI set (stores `immunization_id`).
- **Date given** — DD/MM/YYYY (`administered_date`).
- **Given** — Here / Elsewhere (`information_source`).
- **Lot number** — optional (`lot_number`).
- **Note** — optional (`note`).
- States: loading / empty / inline validation (vaccine + date required) / error callout; values kept
  on error; drawer closes on save; the list refreshes.
- **Patient-longitudinal, not visit-bound** — the shot is recorded against the patient; `encounter_id`
  is left unset (the chart read does not filter immunizations by encounter). Encounter linkage is a
  possible later enhancement, not V1.

## 5. Data & backend

- **Store:** canonical `immunizations` table — INSERT a new row (or UPDATE by id when editing);
  `added_erroneously = 0`. **No** `REPLACE INTO` (avoids the stock re-add bug).
- **Service:** `PatientImmunizationEditorService` — `vaccineOptions()`, `getShot($pid,$id)`,
  `saveShot($pid,$input,$userId)`. Reads reuse the existing list-title resolution.
- **Actions:** `patients.chart.immunization_options`, `patients.chart.immunization_get`,
  `patients.chart.immunization_save` (registered in `PatientActionHandler` + `AjaxActionPolicy`; the two
  reads on the SCALE-1.2 read-only lock-release allowlist, the save is a mutation).
- **ACL:** `patients` / `med` write, mirroring stock `immunizations.php`.
- **Flag:** `enable_native_immunization_editor` in `new_clinic_config`, default OFF (PRD §5.6); flag OFF =
  stock link exactly as today.

## 6. Out of scope (V1)

Refusal capture, VIS/education dates, manufacturer/route/site, CVX coding UI, and bulk import — the stock
form remains reachable for those until a later phase. (Also unrelated: the referrals strip's stock
"Other transactions" link was removed this batch by product decision.)

## 7. Version history

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-07-15 | Initial plan + build — stock analysis, Ghana EPI vaccine set, native drawer design, `enable_native_immunization_editor` |
