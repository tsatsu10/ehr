# Hub slices — Product sign-off worksheet

**Maps to:** PRD §21.1f–z · COM · V1.2 notify / PHARM-RX / hard assign

Engineering completed **57/57** Playwright hub smokes on **2026-07-04** (asset `20260704sp81hubcomplete`). This worksheet is for **Product** to sign normative §21 rows after staging walkthrough + optional live pilot observation.

| Field | Value |
|-------|--------|
| Clinic | |
| Product owner | |
| Clinical lead | |
| Date | |
| Rollout script used | `scripts/pilot-enable-v21-golden-path.php` (+ slice scripts as enabled) |

## Engineering evidence (pre-filled)

| Evidence | Result | Date |
|----------|--------|------|
| Golden-path E2E (4 specs) | 11/11 | 2026-07-04 |
| Hub smokes (19 specs) | 57/57 | 2026-07-04 |
| PHPUnit mandatory contracts | 62/62 | 2026-07-04 |
| Test 43 wrong patient | 14/14 | 2026-07-04 |
| Test 44 signed lock + reopen | 1/1 | 2026-07-04 |

Full map: [NEW_CLINIC_V1_SECTION21_E2E_MAP.md](../NEW_CLINIC_V1_SECTION21_E2E_MAP.md)

## Product walkthrough (check when observed on staging)

| Slice | §21 section | Smoke spec | Staging OK | Live pilot OK | Product initials |
|-------|-------------|------------|------------|---------------|------------------|
| Scheduling | §21.1f–h | `v11-scheduling-smoke` | | | |
| Ancillary | §21.1i | `v11-anc-smoke` | | | |
| Advisory routing | RT / §21.1j partial | `v11-rt-smoke` | | | |
| Chart depth shell | §21.1p | `v11-cd-smoke` | | | |
| Lab ops | §21.1q | `v11-lab-smoke` · `v11-lab-ord-smoke` | | | |
| Print Rx | §21.1s | `v11-print-rx-smoke` | | | |
| Bill ops | §21.1u | `v12-bill-smoke` · `v12-bill-depth-smoke` | | | |
| Admin hub | §21.1v | `v11-admin-smoke` | | | |
| Report hub | §21.1w | `v11-rep-smoke` | | | |
| Clinical doc | §21.1x | `v11-doc-smoke` | | | |
| Queue bridge | §21.1y | `v11-bridge-smoke` | | | |
| Legacy CTX | §21.1z | `v12-ctx-smoke` | | | |
| Registry shell | §21.1ae | `v11-reg-smoke` | | | |
| Communications | COM | `v11-comms-smoke` | | | |
| Hard assign | V1.2 | `v12-hard-assign-smoke` | | | |
| Doctor ready notify | V1.2 | `v12-doctor-ready-notify-smoke` | | | |
| Formulary Rx | V1.2-PHARM-RX | `v12-pharm-rx-smoke` | | | |

## Training prerequisites (must be signed separately)

| Worksheet | Required before | Signed |
|-----------|-----------------|--------|
| [G12 wrong patient](NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) | Pilot week 1 live patients | |
| [Medication safety](NEW_CLINIC_V1_MEDICATION_SAFETY_WORKSHEET.md) | Pharmacy / Prescribe enabled | |
| [Documentation integrity](NEW_CLINIC_V1_DOCUMENTATION_INTEGRITY_WORKSHEET.md) | Doctor shortcuts enabled | |
| [Pilot day reconciliation](NEW_CLINIC_V1_PILOT_DAY_RECONCILIATION_WORKSHEET.md) | Each live cash day | |

## Product sign-off

I confirm engineering smokes are acceptable for pilot enablement of checked slices; normative §21 rows for those slices may be marked signed in the PRD after live pilot validation.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product owner | | | |
| Clinical lead | | | |
| Engineering lead | | | |
