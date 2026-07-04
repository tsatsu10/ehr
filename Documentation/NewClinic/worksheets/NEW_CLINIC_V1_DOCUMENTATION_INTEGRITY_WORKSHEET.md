# Documentation integrity drill worksheet (§6.1l)

**Maps to:** PRD §17.2.4 · §21.1o · mandatory test **44**

**Required when:** Doctor uses **Open encounter** / **Prescribe** shortcuts.

| Field | Value |
|-------|--------|
| Clinic | |
| Trainer | |
| Date | |
| `enable_bill_ops` | Y / N |

## Plenary (5 min)

Tagline: *“Reopen = more orders, not rewrite the note.”*

| # | Topic | Trainer initials |
|---|-------|------------------|
| P1 | E-Sign vs signature amendment note vs clinical correction | |
| P2 | `esign_override` bypasses **unsigned** gate — not signed-note edit | |

## Role stations (doctor + manager)

| Role | Station | Pass | Participant initials | Trainer initials |
|------|---------|------|----------------------|------------------|
| Doctor | E-Sign consult → try **Open encounter** edit | Locked control shown | | |
| Doctor | **Complete consult** → **Reopen consult** with reason | `with_doctor`; Signed chip green | | |
| Doctor | After reopen → **Prescribe** or **Order lab** | Succeeds; note still Locked | | |
| Manager | Paid-visit correction path explained | No Reopen from `completed`; core unlock; M14 or fee sheet | | |
| Nurse | Update allergy after doctor signed | `lists` row saved | | |

## Engineering evidence

PHPUnit mandatory test **44** (signed lock + reopen) — run before go-live:

```bash
vendor/bin/phpunit -c phpunit.xml --filter SignedRecordAmendmentMandatoryTest
```

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Trainer | | | |
| Doctor lead | | | |
| Clinic manager | | | |

**Attach to training log (G6).**
