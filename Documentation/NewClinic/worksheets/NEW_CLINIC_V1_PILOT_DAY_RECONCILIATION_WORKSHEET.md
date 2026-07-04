# Pilot day — reconciliation & printing worksheet

**Maps to:** PRD §21.5 · M7-F10 · M5.4 queue slip · `bin/reconcile.php`

| Field | Value |
|-------|--------|
| Clinic | |
| Facility ID | |
| Pilot date (clinic TZ) | |
| Manager | |
| Cashier(s) on duty | |

## End of day — cash reconciliation (M7-F10)

Run from **Daily Reports** or Bill Ops **Close day** (when `enable_bill_ops` = 1).

| Check | Value | Pass (Y/N) |
|-------|-------|------------|
| Receipt count (module `new_receipt`) | | |
| Sum of receipt totals | | |
| Sum of linked core `payments` | | |
| Reconciliation status (`ok` / `warning`) | | |
| Delta amount (if warning) | | |
| Manager explanation for delta (if warning) | | |

**SQL audit (optional):**

```sql
SELECT status, receipt_total, payment_total, delta_amount, run_at
FROM new_reconciliation_run
WHERE facility_id = ? AND run_date = ?
ORDER BY id DESC LIMIT 1;
```

## Scheduled reconciliation (pilot week)

| Check | Pass (Y/N) | Notes |
|-------|------------|-------|
| Host cron configured for `bin/reconcile.php` (§17.1 step 7) | | |
| At least one run with `trigger = scheduled` during pilot | | |

## Printing (§21.5)

| Check | Pass (Y/N) | Notes |
|-------|------------|-------|
| Reception printed queue slip after Start visit; shows queue # | | |
| Cashier receipt shows queue # when `print_queue_number_on_receipt` = ON | | |

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Cashier lead | | | |
| Clinic manager | | | |

**Retain with pilot records.** Engineering smoke: `golden-path-lab-close-day.spec.js` (daysheet) · `v12-bill-depth-smoke.spec.js` (BILL-3 reverse).
