# New Clinic — Medical Certificate & Eye Exam redesign

| | |
|---|---|
| **Document version** | 0.3.0 |
| **Status** | BUILT (Parts A + B) |
| **Owner** | New Clinic engineering |
| **Flags** | `enable_native_certificate` · `enable_native_eye_exam` (`new_clinic_config`, both default OFF) |
| **Surfaces** | M17 Clinical Documentation hub (This-visit / Specialty lenses); patient chart (read); print pages |
| **Replaces** | Stock `note` (Work/School Note) — not installed here; stock `eye_mag` — installed but disabled |

---

## Part A — Medical certificate (excuse duty / work & school note)

### A1. Problem / why now

The "please give me a letter for my employer/school" request is one of the most common
non-clinical asks in any outpatient clinic — often daily. Today the clinic has no proper
tool for it:

- The **stock Work/School Note** form is a free-text box with the doctor's name typed by
  hand, no off-work date range, and a bare print page. Anyone can type any clinician name;
  nothing stops a backdated or altered certificate; there is no way for an employer to
  verify one.
- The **Letters** feature could print a template, but a plain letter has the same
  weaknesses: no structured record, no numbering, hand-editable text.

Medical certificates are **fraud-sensitive documents**. Fake and altered sick notes are a
well-known problem for employers, and clinics get blamed when a forged note carries their
name. A modern certificate tool treats this as a first-class concern.

### A2. What we build (the modern version)

A native **Medical certificate** drawer, opened from the Clinical Documentation hub
(This-visit lens card) — same drawer pattern as Clinical Instructions:

**Fields (structured, minimal typing):**

| Field | Behavior |
|---|---|
| Certificate type | Excuse duty · School absence · Fit to resume work · Attendance only (was seen today) |
| Date seen | Auto = visit date (read-only) |
| Rest advised from / to | Two date pickers; typing a number of days auto-fills the end date; "Attendance only" hides them |
| Remarks | Optional short free text (e.g. "light duties for one week") |
| Include diagnosis | **Checkbox, default OFF** — data-minimization: an employer is entitled to "unfit for work", not the diagnosis. Ticking it inserts the visit's diagnosis line with the patient's consent noted |
| Issued by | Auto = the logged-in clinician (identity from the session — never typed) |

**The anti-fraud spine (what makes it modern):**

1. **Certificate number** — every certificate gets a sequential number per facility
   (e.g. `MC-2026-00042`) printed prominently. An employer who phones the clinic can have
   reception look the number up and confirm it is genuine, issued to that patient, for
   those dates.
2. **Immutable audit record** — issuing writes an encounter form row; re-issuing creates
   a new certificate number rather than silently editing the old one (edits before first
   print are allowed; after print, amend = new certificate, old one marked superseded).
3. **Issued-by from the session** — the clinician on the certificate is whoever is logged
   in, recorded with their user id. No typed names.
4. **Print audit** — each print is logged (who, when), so "I never got one" and "they
   printed five" are both answerable.

**Print (letterhead handout, same pattern as the instructions print page):** clinic
header, certificate number, patient name + MRN, the certificate text composed from the
structured fields ("was seen at this clinic on 17/07/2026 and is advised to rest from
18/07/2026 to 20/07/2026"), clinician name + signature line, printed timestamp, and a
small "To verify this certificate call the clinic and quote the number" line.

### A3. Who uses it (workflows)

- **Doctor (M3)** issues it during or right after the consult — card on the This-visit
  lens next to Clinical instructions.
- **Reception (M1)** reprints an already-issued certificate when the patient comes back
  ("I lost it") — reprint works after the visit closes, read-only, logged.
- **Reception verifies** a certificate an employer phones about: Registry/chart search by
  certificate number (V1: look up via the patient's chart; a dedicated number-search box
  is a fast follow).

### A4. States & UX rules

Loading / empty (new certificate form) / error (token callout, values kept) / success
(toast, drawer closes, card shows "MC-2026-00042 · issued 17/07/2026 · Print"). Inline
validation: to-date ≥ from-date; rest range required unless "Attendance only". A11y per
module standard (labels, 44px targets, focus ring). Dates DD/MM/YYYY.

### A5. Data & backend

- New table `form_nc_certificate` (module-owned, `#IfNotTable` guarded): id, date, pid,
  encounter, user, authorized, activity, `cert_no` (unique per facility), `cert_type`,
  `rest_from`, `rest_to`, `remarks`, `include_diagnosis`, `diagnosis_text`,
  `issued_by_user_id`, `superseded_by` (nullable), `print_count`, `last_printed_at`.
- Number allocation: `new_clinic_counter`-style per-facility sequence (reuse the module's
  existing counter pattern; never MAX()+1).
- `CertificateService` (issue / get / reprint-log / supersede), ajax
  `clinical_doc.certificate_get|save` (write ACL; get on the SCALE read-only allowlist),
  `certificate-print.php` (hub-read ACL, no clinical-state guard — reprints must work
  after the visit moves on; logs the print).
- `forms` registry row (`nc_certificate` directory + `report.php`) so it shows on the
  encounter summary, per the `nc_screening` precedent.
- E-sign: certificate issuance is itself an attestation; the e-sign lock guard from the
  audit applies (signed ⇒ read-only + reprint only).

---

## Part B — Eye exam (right-sized)

### B1. Problem / why now

The stock Eye Exam (`eye_mag`) is a **subspecialty ophthalmology suite**: ~13,000 lines,
~16 database tables, cataract-surgery biometrics, neuro-ophthalmology, spectacle
dispensing, its own task manager. It was built by/for an eye surgeon's practice. For a
general outpatient clinic it is unusable — which is why it is disabled here.

But eye complaints are a real share of West African OPD visits (red eye, allergic
conjunctivitis, refractive error, cataract screening in older adults, glaucoma risk).
What the clinic needs is the **primary-eye-care exam**: the WHO-primary-care level
assessment a GP or visiting optometrist actually performs, feeding a refer/treat decision
— not a surgical workstation.

### B2. What we build (the modern version)

A native **Eye exam** drawer/pane on the **Specialty lens**, behind its flag:

**Sections (one screen, grouped like the vitals drawer):**

| Section | Fields |
|---|---|
| **Visual acuity** (the vital sign of the eye) | Per eye (R/L): unaided, with pinhole, with correction — **6/x metric notation** (6/6, 6/18, CF, HM, PL, NPL as quick-pick chips), not US 20/20 |
| **Pupils** | Equal/reactive toggle; RAPD present R/L; note |
| **Intraocular pressure** | Per eye, mmHg + method (if the clinic has a tonometer; section hidden by a config toggle when not) |
| **Anterior segment** | Quick-pick findings per eye (normal, conjunctival injection, discharge, corneal opacity, cataract, pterygium…) + free-text note |
| **Fundus** | Examined? per eye; quick-pick (normal, cupped disc, retinopathy…) + note; "not examined" is a first-class answer |
| **Spectacle prescription** (optional section) | Sphere / Cylinder / Axis / Add per eye + PD — only if the exam ends in a glasses prescription; prints as its own slip |
| **Impression & plan** | Free text + a **Refer to eye specialist** toggle that pre-fills a referral (hands off to the existing native referral editor) |

**Design principles that make it modern:**

- **Chips over typing** — acuity values, common findings, and IOP methods are one-tap
  choices; a complete normal exam should take under a minute to record.
- **Right/Left symmetry** — every clinical row is an R | L pair, matching how clinicians
  think and write.
- **"Not examined" is honest data** — no pretending; unexamined sections are recorded as
  such, not left ambiguous.
- **Refer is one tap** — the highest-value outcome of a primary eye exam is a good
  referral; the toggle bridges straight into the referral letter with the exam findings
  summarized.
- **The spectacle Rx prints as a slip** the patient takes to an optical shop — a real
  service in a cash clinic.

### B3. Data & backend

- New module table `form_nc_eye_exam` (one row per exam, R/L columns; `#IfNotTable`):
  acuity_r_unaided … acuity_l_corrected, pinhole pair, pupils fields, iop_r/iop_l +
  method, antseg findings (CSV of coded picks) + note per eye, fundus pair + notes,
  rx sphere/cyl/axis/add per eye + pd, impression, refer flag.
- **Deliberately NOT the stock 16-table shape.** The stock `eye_mag` stays disabled;
  since it was never used here there is no legacy data to stay compatible with. If it is
  ever re-enabled for a true eye-specialist tenant, both can coexist (different formdirs).
- `EyeExamService` (get/save, e-sign lock guard, edit-in-place per encounter like
  vitals), ajax `clinical_doc.eye_exam_get|save`, `forms` row + `nc_eye_exam/report.php`
  for the encounter summary, spectacle-slip print page reusing the handout pattern.
- Catalog: an `eye_exam` card on the **specialty** lens definitions (native allowance in
  `buildCard` like the screeners — no stock registry row needed).

### B4. Non-scope (explicit)

No biometrics/surgical planning, no dispensing/inventory of frames, no imaging (DICOM is
a module non-goal), no visual-field charting, no orthoptics. Those are eye-hospital
territory; a clinic that grows a real eye unit re-evaluates then.

---

## Rollout & flags (both parts)

- `enable_native_certificate`, `enable_native_eye_exam` — `new_clinic_config`, default
  OFF, wired in the standard three places + install.sql. Flag OFF = today's behavior
  exactly (no card).
- The specialty lens itself stays behind `clinical_doc_show_specialty`; the eye exam card
  needs both ON.
- Note: recent native editors (instructions, screening, vitals) were flipped to
  default-on by product decision after sign-off — same path is available here after
  parity/pilot review, but the spec ships flag-first per PRD §5.6.

### Parity / sign-off checklist

- [ ] Certificate: number sequence unique per facility under concurrent issuance; reprint
      logged; superseded flow verified; print renders on letterhead with verify line.
- [ ] Certificate: diagnosis appears ONLY when the consent checkbox is ticked.
- [ ] Eye exam: complete normal exam recordable in ≤ 60 seconds (chip taps only).
- [ ] Eye exam: refer toggle lands in the referral editor with findings pre-filled.
- [ ] Both: e-sign lock ⇒ read-only; encounter-summary rendering via report.php; DD/MM/YYYY.
- [ ] Flag OFF: zero UI change.

## Open questions

1. Certificate verification: is chart-level lookup enough for V1, or build the dedicated
   "verify by number" search box for reception immediately?
2. Should the certificate fee be billable (a `new_service` charge posted at issue)? Many
   clinics charge for excuse-duty letters — needs a product decision + cashier wiring.
3. Eye exam IOP section default: shown or hidden until the clinic confirms it owns a
   tonometer? (Proposed: config toggle, default hidden.)
4. Spectacle Rx: include in V1 or defer to a fast-follow once an optometrist actually
   works at a pilot clinic? (Proposed: build the fields, they're cheap; the slip print can
   follow.)

## Version history

| Version | Date | Changes |
|---|---|---|
| 0.1.0 | 2026-07-17 | Initial draft — analysis of stock `note` (thin, fraud-prone: free-text doctor name, no date range, no numbering) and `eye_mag` (~13k lines/~16 tables subspecialty suite, disabled here); modern designs: numbered auditable medical certificate with letterhead print + verify line, and a WHO-primary-care-level eye exam (R/L chips, 6/x notation, refer bridge, optional spectacle Rx) |
| 0.3.0 | 2026-07-17 | **Part B (Eye exam) BUILT.** `form_nc_eye_exam` + `EyeExamService` + `EyeExamDrawer` per spec (6/x acuity, R/L pairs, chips, honest not-examined, collapsible spectacle Rx, refer flag with save-toast reminder — the full referral-editor bridge deferred as a fast-follow). Implementation note: the specialty-pack filter (`clinical_doc_specialty_pack`) would have silently hidden the card; `nc_eye_exam` bypasses the pack — its own flag is the gate. IOP shown always in V1 (config toggle from open Q3 deferred). |
| 0.2.0 | 2026-07-17 | **Part A (Medical certificate) BUILT.** Implementation notes vs spec: serial numbers derive from the unique row id (`MC-YYYY-NNNNN`, race-free) instead of a per-facility counter — simpler and equally verifiable; certificate card lives on the This-visit lens (promoted out of consult "More"); flag ON at the pilot facility for testing. Open Q1 (verify-by-number search) and Q2 (billable fee) remain open; Part B (eye exam) not started. |
