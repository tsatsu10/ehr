# Trainer one-pager — New Clinic pilot day-1

**Print this.** Maps to PRD §17.2 · §17.4.3 · G12 · G6 training log.

| Clinic | __________________ | Date | __________ |
| Trainer | __________________ | Asset | __________ |

## Before staff arrive (15 min)

- [ ] Staging login works for each enabled role (reception, nurse, doctor, lab, pharmacy, cashier).
- [ ] M6 cash profile applied; test receipt shows correct currency.
- [ ] At least one staging patient per drill role (or use pilot seed).
- [ ] Worksheets printed or open: [G12](./NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) · [med safety](./NEW_CLINIC_V1_MEDICATION_SAFETY_WORKSHEET.md) (if pharmacy/Prescribe) · [doc integrity](./NEW_CLINIC_V1_DOCUMENTATION_INTEGRITY_WORKSHEET.md) (if doctor shortcuts).

## Day-1 block order (~10 h enabled roles; skip disabled stations)

| Block | Time | Do this | Worksheet |
|-------|------|---------|-----------|
| 1 Plenary | 10 min | Role pill vs banner vs visit chip; queue slip print demo | — |
| 2 Golden path walk-through | 60–90 min | Search → start visit → triage → doctor → lab/pharm → pay (staging) | — |
| 3 **G12 wrong patient** | 25 min | §17.2.2 plenary + role stations; run **M1–M6** script | [G12](./NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) |
| 4 Med safety | 15 min | *If pharmacy or Prescribe enabled* | [Med safety](./NEW_CLINIC_V1_MEDICATION_SAFETY_WORKSHEET.md) |
| 5 Doc integrity | 10 min | *If Open encounter / Prescribe enabled* | [Doc integrity](./NEW_CLINIC_V1_DOCUMENTATION_INTEGRITY_WORKSHEET.md) |
| 6 Role deep-dives | rest | Only enabled desks; hands-on Q&A | USER_WORKFLOWS by role |

## Taglines (read aloud once each)

| Drill | Tagline |
|-------|---------|
| G12 | *Role pill = who I am. Banner = who they are. Visit = which attendance today.* |
| Med safety | *Warning ≠ documented. Chip ≠ safe to dispense. Fix the chart or log why you proceeded.* |
| Doc integrity | *Reopen = more orders, not rewrite the note.* |

## G12 manual script — must pass 6/6 before live patients

| # | Witness | Pass |
|---|---------|------|
| M1 | Reception dirty Start visit → switch result | ☐ |
| M2 | Reception dirty Quick Add → switch result | ☐ |
| M3 | Nurse dirty vitals → switch patient | ☐ |
| M4 | Two doctors race Take patient | ☐ |
| M5 | Two nurses race Start triage | ☐ |
| M6 | Cashier Take payment — confirm Patient · MRN · Queue # | ☐ |

**Gate:** **6/6** required. Attach signed [G12 worksheet](./NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) to training log.

## Week-1 admin (trainer + manager)

- [ ] §17.7 tagline poster at each clinical desk (photo in log).
- [ ] Manager briefed: cancel reason **Wrong patient selected** + EOD wrong-patient review week 1.
- [ ] Cron for `bin/reconcile.php` configured (§17.4 step 9).

## Handoff to pilot

When day-1 drills are signed, clinic may start **pilot week 1** using [Pilot day checklist](./NEW_CLINIC_V1_PILOT_DAY_CHECKLIST.md). Product hub slices: [Hub Product sign-off](./NEW_CLINIC_V1_HUB_PRODUCT_SIGNOFF_WORKSHEET.md) after staging walkthrough.

**Engineering baseline (2026-07-04):** golden path 11/11 · hub smokes 57/57 · test **43** 14/14 — [QA sign-off](../NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md).
