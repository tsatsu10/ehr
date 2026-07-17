# Niche OpenEMR Features Explained

Plain-language reference from codebase study (no New Clinic redesign unless noted).

---

## EHI export

| Item | Detail |
|------|--------|
| **Path** | `oe-module-ehi-exporter` |
| **What** | Bulk export of patient electronic health information to ZIP files (computable format) |
| **Why exists** | US ONC certification requirement (b)(10) — patients/admins can export full record |
| **Who uses** | Super-admin, compliance, data migration, legal requests |
| **West Africa OPD** | Rare unless patient requests full portable record or US certification pursued |
| **New Clinic** | Not wrapped; optional future M15 Compliance link only |

---

## BatchCom (Batch Communication)

| Item | Detail |
|------|--------|
| **Path** | `interface/batchcom/` |
| **What** | Filter patients (demographics, appointments, zip, HIPAA mail consent) → CSV, bulk email, or phone call list |
| **ACL** | Admin `batchcom` |
| **Who uses** | Managers running outreach campaigns |
| **vs COM** | COM = staff internal messages + dated reminders; BatchCom = **mass patient** communication |
| **vs S1 Recalls** | Recalls = structured follow-up workflow; BatchCom = broader marketing-style lists |
| **New Clinic** | Not spec’d; possible **V2.3-OUTREACH** via M10 cohort + SMS/recall batch |

---

## De-identification

| Item | Detail |
|------|--------|
| **Path** | `interface/de_identification_forms/` |
| **What** | Copy clinical data into anonymized tables for research; separate re-identification screens |
| **Who uses** | Research hospitals, IRB-approved studies |
| **Global** | `include_de_identification` |
| **West Africa OPD** | Almost never for private clinic |
| **New Clinic** | Out of scope; M15 covers access control + backup for Act 843-style ops, not research anonymization |

---

## DICOM viewer

| Item | Detail |
|------|--------|
| **Path** | `library/dicom_frame.php` — menu Miscellaneous → Dicom Viewer |
| **What** | View DICOM imaging (X-ray, CT, etc.) attached to patient Documents |
| **Who uses** | Radiology-heavy practices |
| **West Africa OPD** | Low unless clinic does in-house digital imaging |
| **New Clinic** | Documents in MRD Profile; no imaging viewer redesign |

---

## Chart tracker

| Item | Detail |
|------|--------|
| **Path** | `custom/chart_tracker.php` — Miscellaneous → Chart Tracker |
| **What** | Track **physical paper chart** folder location or which staff has it checked out |
| **Who uses** | Hybrid paper + EMR clinics |
| **Config** | `disable_chart_tracker` in cash profile (may leave enabled but not in module path) |
| **New Clinic** | **Do not redesign** — conflicts with digital queue + MRD model |

---

## Other rows in OPENEMR_AREAS_NOT_ADDRESSED.txt (brief)

| Area | Summary |
|------|---------|
| Patient portal | Self-service app — PRD non-goal |
| Portal mail | Separate from COM |
| Telehealth | `oe-module-comlink-telehealth` — non-goal |
| Group therapy | `therapy_groups/` — non-goal |
| Prior auth / Claimrev | US insurance — NG1; M14 insurance vault Advanced only |
| Weno eRx | Hidden unless diaspora clinic (pharmacy spec) |
| REST/FHIR/SMART | Staff UI uses session ajax; M15 Advanced for API clients |
| Clinical decision rules | Disabled in cash profile (`enable_cdr=0`) |
| Patient/clinical reminders | Distinct from COM dated reminders; MRD when CDR on |
| Fax/scan | COM preserves fax deep links |
| Direct message log | M16 audit lens Advanced |
| Language/i18n | M15 links stock language admin — no New Clinic i18n strategy |
| Product registration | OpenEMR housekeeping |
