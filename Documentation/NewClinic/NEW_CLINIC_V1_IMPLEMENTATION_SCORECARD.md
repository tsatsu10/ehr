# New Clinic V1 — Implementation Scorecard

**Living tracker** synced to [PRD §5.6](./NEW_CLINIC_V1_PRD.md#56-implementation-status-matrix) (module shells) and [§20.1](./NEW_CLINIC_V1_PRD.md#201-post-pilot-release-slices-v11-family--independent-ships) (post-pilot release slices).

| Field | Value |
|-------|-------|
| **Last audited** | 2026-07-04 |
| **Code baseline** | `interface/modules/custom_modules/oe-module-new-clinic/` · asset `20260704sp81hubcomplete` |
| **Maintainer** | Engineering lead updates after each sprint; Product owns pilot sign-off |
| **How to update** | Change `%` and `Status` cells; bump **Last audited**; sync PRD §5.6 row if shell status changes |

### Rollup formulas

| Metric | Formula |
|--------|---------|
| **Module feature %** | Weighted P0=3, P1=2, P2=1 over normative feature IDs in PRD §8 + companion specs |
| **Pilot path %** | Mean of pilot-ready modules (§5.6 `Pilot-ready = Yes`) |
| **Post-pilot slice %** | Mean of §20.1 release slices |
| **Overall product %** | `0.50 × pilot_path + 0.35 × post_pilot_slices + 0.10 × v12_advanced + 0.05 × ui_shadcn` |

### Executive rollup (2026-07-04)

| Lens | % | Notes |
|------|---|-------|
| Specs written | **95** | PRD v1.20.50 + companions; §21 E2E map added |
| Module shells (§5.6) | **96** | 22 Shipped + T2 Partial / 24 packages |
| **V1 pilot path** | **92** code · **90** QA | B0–B7 signed; §21.1 + §21.1b + hub smokes 57/57 |
| Post-pilot slices (§20.1) | **82** | Mandatory contracts through **63** |
| §21 acceptance (documented) | **15** signed · **19** hub smokes · **~235** open | [QA sign-off](./NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md) 2026-07-04 |
| shadcn §9 | **25** | Phase A infra; Phase B started |
| **Overall product** | **81** | Weighted blend |

---

## §5.6 — Module scorecard

**Status legend:** `Done` ≥90% · `Partial` 50–89% · `Stub` 10–49% · `Not started` &lt;10% · `N/A` out of V1 scope

| ID | Module | Shell | Feature % | Pilot-ready | Owner | Status | Top gaps |
|----|--------|-------|-----------|-------------|-------|--------|----------|
| M0 | Core (queue, FSM, ACL, install) | Done | **95** | Yes | Eng | Done | M0-F07 REST queue API; M0-F18 advisory routing |
| M1 | Front Desk (M1a–M1d) | Done | **92** | Yes | Eng | Done | M1d chief complaint polish; full L3b background completion (OPS) |
| M2 | Visit Board | Done | **92** | Yes | Eng | Done | M2-F11 cancelled collapsible; wall profile privacy hardening |
| M3 | Triage | Done | **95** | Yes | Eng | Done | — |
| M4 | Doctor Desk | Done | **96** | Yes | Eng | Done | V1.2b Web Push notify deferred |
| M5 | Cashier | Done | **92** | Yes | Eng | Done | MoMo receipt label (V1.1-OPS) |
| M6 | Clinic Admin | Done | **88** | Yes | Eng | Partial | T2 globals profile automation incomplete |
| M7 | Daily Reports | Done | **92** | Yes | Eng | Done | M7-F18 ancillary section; scheduling tab bridge flag at some sites |
| M8 | Lab Desk | Done | **90** | Yes | Eng | Done | Role-gated |
| M9 | Pharmacy Desk | Done | **90** | Yes | Eng | Done | Role-gated |
| M10 | Patient Registry | Done | **82** | Post-pilot | Eng | Partial | PR-4 allergy/med/comms filters shipped; REG sign-off |
| M11 | Chart Depth | Done | **82** | Post-pilot | Eng | Partial | CDa/b/c panels; external care (V1.2) not built |
| M12 | Lab Operations Hub | Done | **78** | Post-pilot | Eng | Partial | LIS/DORN (V1.2-LIS) not built |
| M13 | Pharmacy Operations Hub | Done | **80** | Post-pilot | Eng | Partial | V1.2 destruction reports polish |
| M14 | Billing Back Office | Done | **72** | Post-pilot | Eng | Partial | F04 outstanding done; insurance vault partial |
| M15 | Admin Operations Hub | Done | **85** | Post-pilot | Eng | Done | RB-01–RB-20; config import/export |
| M16 | Reporting Operations Hub | Done | **85** | Post-pilot | Eng | Partial | RR-07 OPD attendance native; RR-01–RR-12 footer |
| M17 | Clinical Documentation Hub | Done | **85** | Post-pilot | Eng | Done | DR runbooks in spec; Ghana pack wizard |
| M18 | Queue Bridge Hub | Done | **85** | Post-pilot | Eng | Done | SQ-01–SQ-08 E2E matrix thin |
| COM | Communications Hub | Done | **80** | Post-pilot | Eng | Partial | Phase 1 approved; advanced comms TBD |
| S1 | Scheduling & Flow | Done | **85** | Post-pilot | Eng | Partial | S-P12 lane prefs; some calendar edge cases |
| T1 | Theme & shell | Done | **90** | Yes | Eng | Done | Twig shell + React islands |
| MRD | Patient chart (B7) | Done | **88** | Yes | Eng | Done | Activity feed; role-default tab (D-MRD-13) |
| T2 | Globals profile | Partial | **40** | Yes | Eng | Stub | Installer preset doc; not full automation |

**§5.6 mean feature % (all modules):** **86**  
**Pilot-ready modules only (12):** **92**

---

## §20.1 — Post-pilot release slice scorecard

| Release | Config gate(s) | % | Owner | Status | Evidence / gaps |
|---------|------------------|---|-------|--------|-----------------|
| **V1.1-ANC** | `enable_ancillary_services` | **88** | Eng | Partial | Lab-direct + pharmacy walk-in shipped; `v11-anc-smoke` green |
| **V1.1-RTa** | `enable_doctor_roster` | **90** | Eng | Done | `DoctorRosterBar`, `new_doctor_availability` |
| **V1.1-RTb** | `enable_advisory_routing` | **85** | Eng | Done | `VisitRoutingService`, queue chip, override modal |
| **V1.1-OPS** | per-feature §23 | **30** | Eng | Partial | Faster poll, surname warning, MoMo label scattered |
| **V1.1-CDa** | `enable_chart_depth_finance` | **85** | Eng | Done | payments island; menu cutover |
| **V1.1-CDb** | `enable_chart_depth_referral` | **85** | Eng | Done | referrals island |
| **V1.1-CDc** | `enable_chart_depth_export` | **80** | Eng | Done | export presets |
| **V1.1-LAB** | `enable_lab_ops` | **78** | Eng | Partial | worklist, results, panels |
| **V1.1-LAB-ORD** | `enable_lab_panel_order` | **70** | Eng | Partial | Doctor desk `LabPanelModal` |
| **V1.1-PRINT-RX** | `enable_rx_print` | **80** | Eng | Done | `pharmOpsPrintRx`, desk integration |
| **V1.1-PHARM** | `enable_pharm_ops` | **80** | Eng | Done | dispense, receive, OTC, controlled register |
| **V1.1-ADMIN** | `enable_admin_hub` | **85** | Eng | Done | runbooks, health, export |
| **V1.1-REP** | `enable_report_hub` | **82** | Eng | Partial | native reports + RR runbooks; RR-07 OPD attendance |
| **V1.1-DOC** | `enable_clinical_doc_hub` | **85** | Eng | Done | catalog, form bridge, visit summary |
| **V1.1-BRIDGE** | `enable_queue_bridge` | **85** | Eng | Done | hub, EX chips, Front Desk guard |
| **V1.1-REG** | `enable_patient_registry` | **82** | Eng | Partial | cohort search + saved filters + PR-4 filters |
| **V1.2-BILL** | `enable_bill_ops` | **72** | Eng | Partial | correct, payments, close, outstanding |
| **V1.2-CTX** | `enable_legacy_patient_context_overlay` | **90** | Eng | Done | strip inject + shared-device warning |
| **V1.2-PHARM** | OPS policy | **50** | Eng | Partial | destroy reports; expiry alerts |
| **V1.2-PHARM-RX** | `enable_pharm_rx_favorites` | **75** | Eng | Partial | `FormularyRxModal`; `v12-pharm-rx-smoke` green |
| **V1.2** | hard assign, notify, LIS | **75** | Eng | Partial | §6.5.3–4 shipped; `v12-doctor-ready-notify-smoke` + `v12-hard-assign-smoke` green |

**§20.1 mean:** **80**

---

## §21 — Acceptance sign-off tracker

Formal PRD checkboxes. **QA** updates `Signed` when E2E + pilot worksheet row passes.

| Section | Topic | Items | Signed | Eng smoke | Owner |
|---------|-------|-------|--------|-----------|-------|
| §21.1 | Golden path (full clinic) | 13 | 13 | — | QA |
| §21.1b | Golden path (minimal) | 1 | 1 | — | QA |
| §21.1c | Registration & data quality | 4 | 0 | partial | Product |
| §21.1d | Operational exceptions | 12 | 0 | partial | Product |
| §21.1e | Visit Board ↔ Triage | 6 | 0 | partial | Product |
| §21.1f–h | Scheduling integration | ~15 | 0 | **yes** | Product |
| §21.1i | Ancillary | ~14 | 0 | **yes** | Product |
| §21.1j–k | Clinical decision / MRD | ~12 | 0 | partial | Product |
| §21.1p–y | Hubs M11–M18 | ~40 | 0 | **yes** | Product |
| §21.1z | Legacy chart context CTX-1–5 | 5 | 0 | **yes** | Product |
| COM | Communications hub | 3 | 0 | **yes** | Product |
| V1.2 | Notify, PHARM-RX, hard assign | 3 | 0 | **yes** | Product |

**Automated evidence:** PHPUnit NewClinic **62/62** · Playwright golden-path **11/11** · hub smokes **57/57** · [§21 E2E map](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md).

**Estimated CI coverage of §21:** **~85** (engineering estimate; normative PRD checkboxes mostly open for Product)

---

## UI/UX — shadcn migration (§9)

| Phase | Scope | % | Owner | Status |
|-------|-------|---|-------|--------|
| A | Tokens, Tailwind, `ui/` primitives | **85** | Eng | Done |
| B | S-effort wrappers (Card, Badge, …) | **15** | Eng | Started |
| C | Dialog, Sheet, Command, DataTable | **5** | Eng | Not started |
| D | PatientContextBanner, chart-line | **0** | Eng | Not started |
| E | Retire BEM CSS | **0** | Eng | Not started |

**UI plan overall:** **25**

---

## P0 feature gaps (action backlog)

Prioritized from lowest module/slice %.

| Priority | ID | Module / slice | Feature | % | Owner |
|----------|-----|----------------|---------|---|-------|
| P1 | — | V1.2 | Web Push doctor notify (`enable_doctor_ready_web_push`) | 0 | Eng |
| P1 | — | V1.2 | Doctor ready notify E2E (test 35) | 100 | Done |
| P1 | — | V1.2-LIS | Lab LIS / DORN integration | 0 | Eng |
| P1 | — | V1.1-ANC | §21.1i Product normative sign-off | 88 | Product |
| P1 | — | V1.1-OPS | Bundle MoMo label, faster poll, surname warn | 30 | Eng |
| P1 | M10 | M10 | Patient Registry product sign-off | 82 | Product |
| P2 | M0-F07 | M0 | REST `GET /api/new/visits` | 0 | Eng |
| P2 | T2 | Platform | Globals installer profile | 40 | Eng |
| P2 | §9-B | UI | shadcn Phase B component swap | 15 | Eng |

---

## Per-module feature ID samples

Use PRD §8 tables as source of truth. Below: **representative** IDs for spot audits (not exhaustive).

### M4 Doctor Desk (sample)

| Feature | P | % | Status | Notes |
|---------|---|----|--------|-------|
| M4-F01 Take patient | P0 | 100 | Done | |
| M4-F10 Complete consult + routing | P0 | 100 | Done | |
| M4-F36 Lab panel quick order | P1 | 85 | Done | `LabPanelModal` |
| M4-F37 Formulary quick Rx | P1 | 70 | Partial | `FormularyRxModal` |
| M4-F40 Doc favorites / hub link | P1 | 90 | Done | M17 integration |
| RTb routing suggestion chip | P1 | 85 | Done | `VisitRoutingService`, queue chip |
| M4-F16 hard-assign take gate | P1 | 100 | Done | override modal + Assigned chip |
| M4-F17 doctor ready toast | P1 | 90 | Done | poll toast; Web Push deferred |

### M16 Reporting Hub (sample)

| Feature | P | % | Status | Notes |
|---------|---|----|--------|-------|
| M16-F01 Today lens (M7 embed) | P0 | 100 | Done | |
| M16-F02 Lens catalog | P0 | 95 | Done | |
| M16-F03 Native immunizations | P1 | 90 | Done | |
| M16-F04 Destroyed drugs | P1 | 90 | Done | |
| RR-01–RR-12 runbooks footer | P1 | 100 | Done | `ReportHubRunbooksPanel` |
| RR-07 OPD attendance template | P1 | 90 | Done | `ReportsAncillaryService` / Report Hub native |

### M18 Queue Bridge (sample)

| Feature | P | % | Status | Notes |
|---------|---|----|--------|-------|
| M18-F08 EX-01 Flow Board chip | P1 | 90 | Done | `FlowBoardLaneColumn` |
| M18-F09 EX-03/04 Visit Board badge | P1 | 90 | Done | `QueueCard` |
| M18-F11b Front Desk EX-01 guard | P1 | 85 | Done | `StartVisitForm` |
| M18-F01 Exception worklist hub | P0 | 85 | Done | `QueueBridgeHub` |

### V1.1-ANC ancillary (sample)

| Feature | P | % | Status | Notes |
|---------|---|----|--------|-------|
| M0-F25 ancillary start routing | P1 | 100 | Done | `VisitQueueService::createVisit` |
| M1d-F09 visit type profile hints | P1 | 100 | Done | `StartVisitForm`, `listForDesk` |
| M1d-F10 referral upload | P1 | 100 | Done | `ReferralUploadField` |
| M1d-F11 wrong visit type cancel | P1 | 95 | Done | waiting-only guard + replacement link |
| M8-F08 lab-direct intake | P1 | 100 | Done | `LabDirectPanel` |
| M9-F08 pharmacy walk-in triage | P1 | 100 | Done | `PharmacyWalkinPanel` |
| M9-F15 external Rx validation | P1 | 100 | Done | `ExternalRxValidationService` |
| §6.8.8 walk-in ACL keys | P1 | 100 | Done | `new_pharmacy_walkin_dispense`, `new_pharmacy_refer_to_opd` |
| M7-F18 ancillary report | P1 | 100 | Done | `AncillarySection` |
| §6.8.6 visit board badges | P1 | 100 | Done | `AncillaryVisitBadges` |
| §21.1i pilot acceptance | P1 | 88 | Eng smoke | `v11-anc-smoke` green; normative §21.1i rows for Product |

### V1.2 hard assign (sample)

| Feature | P | % | Status | Notes |
|---------|---|----|--------|-------|
| M0-F19 `hardAssignProvider` | P1 | 100 | Done | `VisitHardAssignService`, `visit.hard_assign` |
| M3-F13 triage send modal | P1 | 100 | Done | `TriageSendDoctorModal` |
| M1d-F08 front desk assign | P1 | 100 | Done | `ActiveVisitHardAssign`, start-visit picker |
| M4-F16 take override | P1 | 100 | Done | `HardAssignOverrideModal` |
| M4-F17 ready notify toast | P1 | 90 | Done | in-app; Web Push deferred |
| PRD test 34 E2E | P1 | 100 | Done | `v12-hard-assign-smoke.spec.js` |
| PRD test 35 E2E | P1 | 100 | Done | `v12-doctor-ready-notify-smoke.spec.js` |

---

## Audit log

| Date | Auditor | Change |
|------|---------|--------|
| 2026-07-02 | Engineering | Initial scorecard; synced §5.6 matrix refresh + July roadmap batch (RTa, RR runbooks, Vite manifest, PR-3 update) |
| 2026-07-02 | Engineering | V1.1-ANC batch: ancillary report, walk-in triage, badges, lab-direct, external Rx, referral upload, wrong-type correction, walk-in ACL keys (`sp38ancp`); M10 PR-4 filters; M16 RR-07 OPD attendance |
| 2026-07-03 | Engineering | V1.2 §6.5.3–4: hard assign (M0-F19, M3-F13, M1d-F08, M4-F16), doctor ready in-app notify (M4-F17); E2E `v12-hard-assign-smoke`; asset `sp57fdhardassign` |
| 2026-07-03 | Engineering | Roster fix (`DoctorRosterService` `authorized` column); E2E `v12-hard-assign-smoke` + `golden-path` green; asset `sp58rosterfix` |
| 2026-07-03 | Engineering | PRD test 35: doctor-ready notify debounce E2E; pilot script + fixture; asset `sp59notifye2e` |
| 2026-07-03 | Engineering | Post-V1.2 audit fixes: triage vitals gate via `TriageService`, stale `row_version` guards, notify audit log, roster error logging, today filter on doctor queue, admin notify coupling, shared pilot seed; PHPUnit + E2E green; asset `sp60auditfix` |
| 2026-07-04 | Engineering | §21 hub smokes 57/57 engineering sign-off; asset `sp81hubcomplete` |
| 2026-07-04 | Product prep | Pilot/training worksheets + [readiness pack](./worksheets/NEW_CLINIC_V1_PILOT_READINESS_PACK.md); tests **43**/**44** re-verified |
| 2026-07-04 | Engineering | §21 QA sign-off + fix BILL-3 `row_version` in payment reverse; COM/RT e2e stability; asset `sp77qasignoff` |
| 2026-07-04 | Engineering | §21 QA sign-off: golden path 11/11 E2E, PHPUnit 62/62, hub smokes 47/57; PRD §21.1/§21.1b/§21.5 CI signed; `NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md`; asset `sp76qasignoff` |
| 2026-07-04 | Engineering | S1 scheduling smoke (`testMandatory60`); V1.2-BILL depth (`61`); V1.1-COM (`62`); §21 golden path rollout (`63`) + `NEW_CLINIC_V1_SECTION21_E2E_MAP.md`; asset `sp75goldenpath` |

---

## Related documents

- [PRD §5.6 matrix](./NEW_CLINIC_V1_PRD.md#56-implementation-status-matrix)
- [PRD §20.1 slices](./NEW_CLINIC_V1_PRD.md#201-post-pilot-release-slices-v11-family--independent-ships)
- [PRD §21 acceptance](./NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot)
- [§21 E2E evidence map](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md)
- [§21 QA sign-off record](./NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md)
- [NEXT_STEPS.md](../../interface/modules/custom_modules/oe-module-new-clinic/NEXT_STEPS.md) — deploy / pilot commands
- [CODE_AUDIT React migration](../../interface/modules/custom_modules/oe-module-new-clinic/CODE_AUDIT_2026-06-27-REACT-MIGRATION.md)
