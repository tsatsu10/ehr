# New Clinic V1 — Pilot readiness pack

**Audience:** Clinic manager · trainer · Product owner · tech lead  
**Engineering gate:** **PASS** (2026-07-04) · asset `20260704sp81hubcomplete`

Use this pack in order. Engineering has signed automated evidence; **Product and clinic staff** close the remaining manual gates.

---

## 1. Engineering evidence (pre-filled — no action)

| Gate | Result | Record |
|------|--------|--------|
| Golden-path E2E | 11/11 | [§21 QA sign-off](../NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md) |
| Hub smokes (19 specs) | 57/57 | [E2E map](../NEW_CLINIC_V1_SECTION21_E2E_MAP.md) |
| PHPUnit mandatory contracts | 62/62 | `NewClinicMandatoryContractTest` |
| Test **43** wrong patient | 14/14 | `WrongPatientPreventionMandatoryTest` |
| Test **44** signed lock + reopen | 1/1 | `testMandatory44SignedLockAndReopenPragmaticPath` |

PRD rows already signed by engineering: **§21.1** (13) · **§21.1b** (1) · **§21.5 CI row** (1).

---

## 2. Install & enable (tech lead)

```bash
php interface/modules/custom_modules/oe-module-new-clinic/bin/upgrade_sql.php
php interface/modules/custom_modules/oe-module-new-clinic/scripts/pilot-enable-v21-golden-path.php
php interface/modules/custom_modules/oe-module-new-clinic/acl/seed_pilot_users.php
cd frontend && npm run build
```

- Complete PRD **§17.4** steps 1–12 (ACL, M6 cash profile, cron for `bin/reconcile.php`).
- Enable post-pilot slices only via their rollout scripts (see [NEXT_STEPS.md](../../../interface/modules/custom_modules/oe-module-new-clinic/NEXT_STEPS.md)).

---

## 3. Training (trainer — before first live patient)

| Step | Document | Gate |
|------|----------|------|
| Day-1 drill order | [Trainer one-pager](./NEW_CLINIC_V1_TRAINER_ONE_PAGER.md) | Print and follow |
| G12 wrong patient | [G12 worksheet](./NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) | **6/6** manual script |
| Med safety | [Med safety worksheet](./NEW_CLINIC_V1_MEDICATION_SAFETY_WORKSHEET.md) | If pharmacy / Prescribe ON |
| Doc integrity | [Doc integrity worksheet](./NEW_CLINIC_V1_DOCUMENTATION_INTEGRITY_WORKSHEET.md) | If doctor shortcuts ON |

Attach signed worksheets to training log (G6).

---

## 4. Product staging walkthrough

| Step | Document | Gate |
|------|----------|------|
| Hub slices enabled for clinic | [Hub Product sign-off](./NEW_CLINIC_V1_HUB_PRODUCT_SIGNOFF_WORKSHEET.md) | Staging OK per enabled slice |
| Normative §21 rows | [PRD §21](../NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot) | Mark `[x]` after live validation |

---

## 5. Live pilot (manager — every cash day)

| When | Document |
|------|----------|
| First live patient day | [Pilot day checklist](./NEW_CLINIC_V1_PILOT_DAY_CHECKLIST.md) section A |
| During day | Checklist section B |
| End of day | [Reconciliation worksheet](./NEW_CLINIC_V1_PILOT_DAY_RECONCILIATION_WORKSHEET.md) + checklist section C |
| End of week 1 | Checklist section D |

---

## 6. Sign-off ownership

| Role | Signs | When |
|------|-------|------|
| Engineering | §21.1 · §21.1b · §21.5 CI · hub smokes | **Done** 2026-07-04 |
| Trainer | G12 + optional med/doc worksheets | Before first live patient |
| Product | Hub Product worksheet + PRD §21.1f–z | After staging + live observation |
| Clinic manager | Reconciliation + pilot day checklist | Each live cash day |

---

## Quick links

- [All worksheets](./README.md)
- [Implementation scorecard](../NEW_CLINIC_V1_IMPLEMENTATION_SCORECARD.md)
- Module URL (XAMPP): http://localhost/openemr/interface/modules/custom_modules/oe-module-new-clinic/public/
