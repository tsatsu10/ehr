# Redesign Recommendations (Niche Features)

Opinion from conversation: **can you redesign EHI, BatchCom, de-ID, DICOM, chart tracker?**

---

## Summary table

| Feature | Redesign? | Priority | Recommendation |
|---------|-----------|----------|----------------|
| BatchCom | Maybe later | Medium | Cohort outreach via M10 + Recalls — not a BatchCom clone |
| EHI export | Thin wrapper | Low | M15 Compliance card + help text; super-admin only |
| DICOM viewer | Link/embed only | Low | Only if imaging becomes a product vertical |
| De-identification | No | Very low | Research/hospital — not OPD |
| Chart tracker | No | None | Paper-chart workflow; contradicts digital model |

---

## BatchCom — only serious candidate

**Problem it solves:** Mass outreach (“500 diabetes patients SMS this month”).

**Better New Clinic shape:**

- Start from **M10 Patient Registry** filter (who matches rules).
- Actions: export CSV, optional MedEx SMS, create S1 recall rows.
- Audit + consent flags.

**Slice name suggested:** V2.3-OUTREACH (optional).

**Do not** maintain legacy BatchCom UI as a first-class product surface.

---

## EHI — wrap, don’t rebuild

Module already implements ONC export. New Clinic value = discoverability:

- Admin Hub → Compliance lens
- Plain language: “Export all clinic data for migration or legal request”
- Restrict to super-admin

Estimated effort: documentation + link, not a hub rebuild.

---

## DICOM — niche vertical only

Redesigning DICOM viewing competes with PACS vendors. For typical Ghana OPD:

- External imaging center sends CD/film
- Occasional upload to Documents + stock viewer is enough

Invest only if product targets ortho, dental CBCT, or hospital imaging.

---

## De-ID — stay out of scope

Serves research registries, not clinical operations. Ghana private clinics need ACL, audit, backup (M15) — not anonymized research databases.

---

## Chart tracker — actively avoid

Redesigning legitimizes paper folders. Training message: **if the patient is in OpenEMR, the folder is not the source of truth.**

Keep global to disable menu if fully digital.

---

## Decision rule (proposed in chat)

```
Redesign if:
  - Weekly use by reception / nurse / doctor / cashier, OR
  - Blocks Ghana pilot go-live, OR
  - Required for clinical safety or data protection law

Leave stock if:
  - Admin-only, monthly or rarer, US-cert / research / paper-chart niche
```

All five niche features fail the weekly-use test for typical private OPD.

---

## Strategic warning

At time of opinion, **~20 redesign specs** existed with **implementation still catching up**. Adding five more admin tools would:

- Expand PAGE_DESIGNS and QA scope
- Blur “New Clinic vs old OpenEMR” for trainers
- Solve problems most year-one pilots won’t hit

**Priority order stated:**

1. Ship M0 → M5 + M7 + T1 pilot path
2. Update OPENEMR_AREAS_NOT_ADDRESSED.txt with Status column
3. Spec outreach only when a pilot asks for mass SMS/campaigns
4. Skip DICOM, de-ID, chart tracker unless explicit clinic demand

---

## Optional PRD addition (suggested, not done in chat)

Short **“Explicitly not redesigning”** appendix listing EHI, BatchCom, de-ID, DICOM, chart tracker with one-line rationale — prevents re-opening every audit.
