# G12 — Wrong patient prevention drill worksheet

**Maps to:** PRD §17.2.2 · §17.4.3 · §21.1m · goal **G12** · mandatory test **43**

| Field | Value |
|-------|--------|
| Clinic | |
| Facility ID | |
| Trainer | |
| Date | |
| Environment | Staging / Pilot |
| Asset version | |

## Plenary (5 min — all staff)

Tagline: *“Role pill = who I am. Banner = who they are. Visit = which attendance today.”*

| # | Topic covered | Trainer initials |
|---|---------------|------------------|
| P1 | Role pill vs patient banner vs visit chip demonstrated | |
| P2 | Cancel reason **Wrong patient selected** → desk interrupt | |
| P3 | Cashier rule: confirm **Patient · MRN · Queue #** before payment | |

## Role stations (enabled roles only)

| Role | Station | Pass | Participant initials | Trainer initials |
|------|---------|------|----------------------|------------------|
| Reception | Dirty **Start visit** → switch search result | Confirm modal; new MRN on preview | | |
| Reception | Dirty **Quick Add** → switch result (M1a-F14b) | Confirm modal | | |
| Nurse | Dirty vitals → switch queue patient | Banner updates after **Switch** | | |
| Nurse ×2 | Race **Start triage** on same card | Loser: **`taken_elsewhere`** (nurse copy) | | |
| Doctor | **Take patient** → read banner name + MRN aloud | | | |
| Doctor ×2 | Race **Take patient** | Loser: **`taken_elsewhere`** interrupt | | |
| Cashier | **Take payment** on staging visit | Confirm modal matches banner | | |
| Cashier | One `ready_for_payment` via search (M1a-F15) | Charges match queue row, not `pid` alone | | |
| Clinical | Core shortcut (if enabled) | T1-F17 strip matches desk banner | | |

## §17.4.3 manual script (week-1 gate — trainer witnesses)

| # | Scenario | Pass (Y/N) | Notes |
|---|----------|------------|-------|
| M1 | Reception dirty Start visit → switch | | |
| M2 | Reception dirty Quick Add → switch | | |
| M3 | Nurse dirty vitals → switch | | |
| M4 | Two doctors concurrent Take patient | | |
| M5 | Two nurses concurrent Start triage | | |
| M6 | Cashier Take payment — receipt queue # matches | | |

**Manual script result:** _____ / 6 pass (requires **6/6** for pilot week 1)

## Week-1 admin items

| # | Item | Done | Initials |
|---|------|------|----------|
| 1 | §17.7 tagline poster at each clinical desk (photo in training log) | | |
| 2 | Manager briefed: wrong-patient EOD review week 1 | | |
| 3 | Pinned reception preview ON when M6 cash profile enables (D53) | | |

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Trainer | | | |
| Clinic manager | | | |

**Attach to training log (G6).** Engineering evidence: PHPUnit `WrongPatientPreventionMandatoryTest` (test **43**) · Playwright `@new-clinic-mandatory` where applicable.
