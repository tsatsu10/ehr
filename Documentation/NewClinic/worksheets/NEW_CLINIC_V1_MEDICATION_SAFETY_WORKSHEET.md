# Medication safety drill worksheet (§6.1k)

**Maps to:** PRD §17.2.3 · §21.1i (ancillary) · USER_WORKFLOWS §17.7

**Required when:** `enable_pharmacy_role` = 1 and/or doctor **Prescribe** shortcut is used.

| Field | Value |
|-------|--------|
| Clinic | |
| Trainer | |
| Date | |
| Pharmacy enabled | Y / N |
| Doctor Prescribe enabled | Y / N |

## Plenary (5 min)

Tagline: *“Warning ≠ documented. Chip ≠ safe to dispense. Fix the chart or log why you proceeded.”*

| # | Topic | Trainer initials |
|---|-------|------------------|
| P1 | Banner warnings → ack with reason → hard gates | |
| P2 | Allergy gate has **no override** for walk-in dispense | |

## Role stations

| Role | Station | Pass | Participant initials | Trainer initials |
|------|---------|------|----------------------|------------------|
| Nurse | No allergy row → **None known** or real allergy before Send to doctor | `lists` row exists | | |
| Doctor | **Allergies undocumented** chip → correct fix path named | | | |
| Doctor | Under-5 estimated DOB → **Prescribe** | Ack modal witnessed | | |
| Pharmacy | Cross-check chip → **Acknowledge & continue** | Reason ≥10 chars; audit row | | |
| Pharmacy | **Pharmacy complete** without allergy row | Blocked — no override | | |
| Pharmacy | External Rx — blank prescriber | Validation error or override demo | | |

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Trainer | | | |
| Nurse lead (if enabled) | | | |
| Doctor lead (if enabled) | | | |
| Pharmacy lead (if enabled) | | | |

**Attach to training log (G6).**
