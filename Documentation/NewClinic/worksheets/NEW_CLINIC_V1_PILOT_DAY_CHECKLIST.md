# Pilot day checklist

**Use for:** first live patient day and every live cash day during pilot week 1–4.

| Clinic | __________________ | Date | __________ |
| Manager on duty | __________________ | Trainer signed G12? | Y / N |

---

## A. Before doors open (first live day only)

| # | Check | Done | Initials |
|---|-------|------|----------|
| A1 | §17.4.3 G12 manual script **6/6** on staging (not skipped because CI is green) | ☐ | |
| A2 | [G12 worksheet](./NEW_CLINIC_V1_G12_WRONG_PATIENT_WORKSHEET.md) signed and in training log | ☐ | |
| A3 | Med safety + doc integrity worksheets signed if those roles enabled | ☐ | |
| A4 | M6: fee schedule, visit types, currency verified | ☐ | |
| A5 | Reception can print **queue slip** after Start visit (test on staging) | ☐ | |
| A6 | Shared-device **role pill** visible; each user knows how to switch role | ☐ | |
| A7 | Manager + tech lead name recorded for escalation | ☐ | |

**Do not admit first live patient until A1–A2 pass.**

---

## B. During the day (manager spot-checks)

| # | Check | Done | Notes |
|---|-------|------|-------|
| B1 | Every Start visit: queue # assigned; slip printed when clinic policy requires | ☐ | |
| B2 | Cashier confirms **Patient · MRN · Queue #** before payment (G12) | ☐ | |
| B3 | No payment with unsigned profile docs unless override logged | ☐ | |
| B4 | Wrong-patient cancels use reason **Wrong patient selected** | ☐ | |
| B5 | Open visits at lunch: manager knows M7-F15 / EOD policy | ☐ | |

---

## C. End of day — every live cash day

Complete [Pilot day reconciliation worksheet](./NEW_CLINIC_V1_PILOT_DAY_RECONCILIATION_WORKSHEET.md) and retain with pilot records.

| # | Check | Done | Initials |
|---|-------|------|----------|
| C1 | M7 reconciliation or Bill Ops Close day run | ☐ | |
| C2 | Status `ok` **or** `warning` with manager explanation for delta | ☐ | |
| C3 | Receipt count matches expected cashier activity | ☐ | |
| C4 | Sample receipt shows queue # (when `print_queue_number_on_receipt` = ON) | ☐ | |
| C5 | Week 1: manager EOD wrong-patient review (cancel reason + payment audit) | ☐ | |

**Optional SQL (reconciliation audit):**

```sql
SELECT status, receipt_total, payment_total, delta_amount, trigger, run_at
FROM new_reconciliation_run
WHERE facility_id = ? AND run_date = ?
ORDER BY id DESC LIMIT 1;
```

---

## D. End of pilot week 1

| # | Check | Done | Owner |
|---|-------|------|-------|
| D1 | All enabled staff completed G12 drill | ☐ | Trainer |
| D2 | [Hub Product sign-off](./NEW_CLINIC_V1_HUB_PRODUCT_SIGNOFF_WORKSHEET.md) staging walkthrough for enabled slices | ☐ | Product |
| D3 | Week-4 observation slot booked for G11 (if applicable) | ☐ | Manager |
| D4 | Issues log shared with engineering (asset version + steps to reproduce) | ☐ | Tech lead |

---

## Escalation quick reference

| Situation | Action |
|-----------|--------|
| Payment blocked — unsigned docs | E-Sign profile form or manager `esign_override` with reason |
| `taken_elsewhere` / stale row | Refresh queue; do not force-submit |
| Reconciliation warning | Manager documents delta; do not delete receipts |
| Wrong patient suspected after payment | Manager incident log; do not reverse without Bill Ops training |

**Docs:** [Trainer one-pager](./NEW_CLINIC_V1_TRAINER_ONE_PAGER.md) · [Worksheets index](./README.md) · [§21 QA sign-off](../NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md)
