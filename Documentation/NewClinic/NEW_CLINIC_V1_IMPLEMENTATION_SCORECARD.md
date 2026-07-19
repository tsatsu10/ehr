# New Clinic V1 — Implementation Scorecard

**Living tracker** synced to [PRD §5.6](./done/NEW_CLINIC_V1_PRD.md#56-implementation-status-matrix) (module shells) and [§20.1](./done/NEW_CLINIC_V1_PRD.md#201-post-pilot-release-slices-v11-family--independent-ships) (post-pilot release slices).

| Field | Value |
|-------|-------|
| **Last audited** | 2026-07-18 — targeted row refresh (COM, M15, M10, S1 + flag graduation); executive rollup not recomputed since 2026-07-09 |
| **Code baseline** | `interface/modules/custom_modules/oe-module-new-clinic/` · asset `…-setupaudit68` |
| **Maintainer** | Engineering lead updates after each sprint; Product owns pilot sign-off |
| **How to update** | Change `%` and `Status` cells; bump **Last audited**; sync PRD §5.6 row if shell status changes |

### Rollup formulas

| Metric | Formula |
|--------|---------|
| **Module feature %** | Weighted P0=3, P1=2, P2=1 over normative feature IDs in PRD §8 + companion specs |
| **Pilot path %** | Mean of pilot-ready modules (§5.6 `Pilot-ready = Yes`) |
| **Post-pilot slice %** | Mean of §20.1 release slices |
| **Overall product %** | `0.50 × pilot_path + 0.35 × post_pilot_slices + 0.10 × v12_advanced + 0.05 × ui_shadcn` |

### Executive rollup (2026-07-09 — not recomputed since; the 2026-07-18 row refresh raised COM 80→90 and M15 85→88, an under-1-point rollup effect)

| Lens | % | Notes |
|------|---|-------|
| Specs written | **96** | PRD v1.20.50 + companions; 15 companion specs implementation-closed in `done/` |
| Module shells (§5.6) | **96** | 22 Shipped + T2 Partial / 24 packages |
| **V1 pilot path** | **92** code · **90** QA | B0–B7 signed; §21.1 + §21.1b + hub smokes 57/57 |
| Post-pilot slices (§20.1) | **81** | Mandatory contracts through **80/80**; AUDIT-1–15 refactor roadmap complete |
| §21 acceptance (documented) | **15** signed · **19** hub smokes · **~235** open | [QA sign-off](./NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md) 2026-07-04 |
| shadcn §9 | **97** | Calendar + Pharm Ops on nc-* hooks; Phase C wrappers complete |
| **Overall product** | **82** | Weighted blend |

---

## §5.6 — Module scorecard

**Status legend:** `Done` ≥90% · `Partial` 50–89% · `Stub` 10–49% · `Not started` &lt;10% · `N/A` out of V1 scope

| ID | Module | Shell | Feature % | Pilot-ready | Owner | Status | Top gaps |
|----|--------|-------|-----------|-------------|-------|--------|----------|
| M0 | Core (queue, FSM, ACL, install) | Done | **95** | Yes | Eng | Done | M0-F07 REST queue API; M0-F18 advisory routing |
| M1 | Front Desk (M1a–M1d) | Done | **100** | Yes | Eng | Done | M1a-F11 P95 benchmark at pilot scale (geo seed ships via `GeoService` JSON) |
| M2 | Visit Board | Done | **92** | Yes | Eng | Done | M2-F11 cancelled collapsible; wall profile privacy hardening |
| M3 | Triage | Done | **95** | Yes | Eng | Done | — |
| M4 | Doctor Desk | Done | **96** | Yes | Eng | Done | V1.2b Web Push notify deferred |
| M5 | Cashier | Done | **92** | Yes | Eng | Done | MoMo receipt label (V1.1-OPS) |
| M6 | Clinic Admin | Done | **88** | Yes | Eng | Partial | T2 globals profile automation incomplete |
| M7 | Daily Reports | Done | **92** | Yes | Eng | Done | M7-F18 ancillary section; scheduling tab bridge flag at some sites |
| M8 | Lab Desk | Done | **90** | Yes | Eng | Done | Role-gated; M8-F07 skip-to-payment restored (AUDIT-1) |
| M9 | Pharmacy Desk | Done | **90** | Yes | Eng | Done | Role-gated; M9-F06 skip-to-payment restored (AUDIT-1) |
| M10 | Patient Registry | Done | **88** | Post-pilot | Eng | Partial | §22 acceptance eng-closed (spec v0.2.2); **always-on** since 2026-07-18 flag graduation; Product pilot sign-off + REG-4 browser UAT |
| M11 | Chart Depth | Done | **85** | Post-pilot | Eng | Partial | CDb referral wizard + status tracking shipped; external care (V1.2) not built |
| M12 | Lab Operations Hub | Done | **78** | Post-pilot | Eng | Partial | LIS/DORN (V1.2-LIS) not built |
| M13 | Pharmacy Operations Hub | Done | **80** | Post-pilot | Eng | Partial | V1.2 destruction reports polish |
| M14 | Billing Back Office | Done | **72** | Post-pilot | Eng | Partial | F04 outstanding done; F05 legacy insurance vault retired 2026-07-16, replaced by native CBILL-3/4 |
| M15 | Admin Operations Hub | Done | **88** | Post-pilot | Eng | Done | RB-01–RB-20; config import/export; setup checklist truthful auto-detects + unmark/reopen (SETUP-1..6, spec v0.1.5); patient importer tab (MKT-MIG-1) |
| M16 | Reporting Operations Hub | Done | **88** | Post-pilot | Eng | Partial | §19 acceptance eng-closed (spec v0.1.4, incl. `hub_advanced_open` audit); OPD attendance pilot review (Product) |
| M17 | Clinical Documentation Hub | Done | **90** | Post-pilot | Eng | Done | **Always-on since 2026-07-18 flip** (hub flag + legacy engine retired; opens any encounter, full form registry); Ghana HIS pack shipped (`HisPackImportService` + admin card); DR runbooks in spec |
| M18 | Queue Bridge Hub | Done | **85** | Post-pilot | Eng | Done | SQ-01–SQ-08 E2E matrix thin |
| COM | Communications Hub | Done | **90** | Post-pilot | Eng | Done | Phase 1 complete + premium chat UI (COMHUB-0..6, spec v1.0.5); **always-on** since 2026-07-18 flag graduation; advanced comms (patient SMS) remains TBD |
| S1 | Scheduling & Flow | Done | **85** | Post-pilot | Eng | Partial | Shell **always-on** since 2026-07-18 flag graduation; S-P12 lane prefs; some calendar edge cases |
| T1 | Theme & shell | Done | **90** | Yes | Eng | Done | Twig shell + React islands |
| MRD | Patient chart (B7) | Done | **92** | Yes | Eng | Done | §17 eng-closed (spec v0.2.37 incl. `hide_dashboard_cards`); pilot-scale perf + trainer drills |
| T2 | Globals profile | Partial | **40** | Yes | Eng | Stub | Installer preset doc; not full automation |

**§5.6 mean feature % (all modules):** **87**  
**Pilot-ready modules only (12):** **93**

---

## §20.1 — Post-pilot release slice scorecard

| Release | Config gate(s) | % | Owner | Status | Evidence / gaps |
|---------|------------------|---|-------|--------|-----------------|
| **V1.1-ANC** | `enable_ancillary_services` | **88** | Eng | Partial | Lab-direct + pharmacy walk-in shipped; `v11-anc-smoke` green |
| **V1.1-RTa** | `enable_doctor_roster` | **90** | Eng | Done | `DoctorRosterBar`, `new_doctor_availability` |
| **V1.1-RTb** | `enable_advisory_routing` | **85** | Eng | Done | `VisitRoutingService`, queue chip, override modal |
| **V1.1-OPS** | per-feature §23 | **30** | Eng | Partial | Faster poll, surname warning, MoMo label scattered |
| **V1.1-CDa** | `enable_chart_depth_finance` | **85** | Eng | Done | payments island; menu cutover |
| **V1.1-CDb** | `enable_chart_depth_referral` | **92** | Eng | Done | wizard + D-REF-8 print confirm, D-REF-9 guard, D-REF-12 read-only, Referral issued chip, Visits-row link (spec v0.1.3) |
| **V1.1-CDc** | `enable_chart_depth_export` | **80** | Eng | Done | export presets |
| **V1.1-LAB** | `enable_lab_ops` | **78** | Eng | Partial | worklist, results, panels |
| **V1.1-LAB-ORD** | `enable_lab_panel_order` | **70** | Eng | Partial | Doctor desk `LabPanelModal` |
| **V1.1-PRINT-RX** | `enable_rx_print` | **80** | Eng | Done | `pharmOpsPrintRx`, desk integration |
| **V1.1-PHARM** | `enable_pharm_ops` | **80** | Eng | Done | dispense, receive, OTC, controlled register |
| **V1.1-ADMIN** | `enable_admin_hub` | **85** | Eng | Done | runbooks, health, export |
| **V1.1-REP** | `enable_report_hub` | **86** | Eng | Done | native reports + RR runbooks + async export + `hub_advanced_open` audit; OPD attendance pilot review open (Product) |
| **V1.1-DOC** | always on (flag retired 2026-07-18) | **90** | Eng | Done | catalog, form bridge, visit summary; encounter-only mode + full-registry Add form |
| **V1.1-BRIDGE** | `enable_queue_bridge` | **85** | Eng | Done | hub, EX chips, Front Desk guard |
| **V1.1-REG** | always on (flag retired 2026-07-18) | **86** | Eng | Partial | cohort search + saved filters + PR-4 filters; `registry-signoff` PASS; Product pilot sign-off open |
| **V1.2-BILL** | `enable_bill_ops` | **72** | Eng | Partial | correct, payments, close, outstanding |
| **V1.2-CTX** | `enable_legacy_patient_context_overlay` | **90** | Eng | Done | strip inject + shared-device warning |
| **V1.2-PHARM** | OPS policy | **50** | Eng | Partial | destroy reports; expiry alerts |
| **V1.2-PHARM-RX** | `enable_pharm_rx_favorites` | **75** | Eng | Partial | `FormularyRxModal`; `v12-pharm-rx-smoke` green |
| **V1.2** | hard assign, notify, LIS | **75** | Eng | Partial | §6.5.3–4 shipped; `v12-doctor-ready-notify-smoke` + `v12-hard-assign-smoke` green |
| **CBILL-1** | `pharmacy_auto_bill_on_dispense` | **80** | Eng | Partial | Pharmacy charges at cashier (surface `drug_sales` fees) built behind flag default OFF; PHP verify + 711 vitest + SQL schema smoke green; live e2e payment smoke (flag ON) pending. [plan](./new/NEW_CLINIC_CASHIER_BILLING_COMPLETION_PLAN.md) §4 |
| **CBILL-2** | `enable_partial_payment` | **90** | Eng | Partial | Partial payment built behind flag default OFF (manager-gated `cashier.pay_partial`, remainder → M14 owed list); PHP verify + 724 vitest + 12/12 live smoke + audit fixes green; **PRD authorised (D-BILL-7, v1.20.53)**. [plan](./new/NEW_CLINIC_CASHIER_BILLING_COMPLETION_PLAN.md) §5 |
| **CBILL-3** | `enable_insurance_scheme` | **90** | Eng | Done | Insurance scheme-split (manual), all 3 slices: **3a** data+service (58faa48a), **3b** cashier screen (72c94a6d), **3c** claims register in M14 Insurance pane (47ce4eca); audit fixes (cdbc1013: server recomputes split from real charges — tamper-proof). Scheme picker + per-line coverage + collect patient part + owed list excludes scheme portion + manual claim register (submit/settle/void). Behind flag default OFF; PHP verify + PHPUnit + vitest + live smokes (11/11, 5/5 tamper) green. PRD D-BILL-8. [spec](./new/NEW_CLINIC_V1_INSURANCE_SCHEME_SPLIT_REDESIGN.md) |
| **CBILL-4** | `enable_payer_billing` | **80** | Eng | Partial | NHIS & private insurance foundation on top of CBILL-3. **4a payer-aware pricing: BUILT** — `new_payer_price` table, `PayerPriceService` (resolveLineAmount falls back to cash price when no override), admin "Payer prices" screen in Insurance tab, `CashierService::recordSchemePayment` prices covered lines at the payer's rate (patient-pay unaffected, cash-based sanity check unchanged); 8/8 live DB smoke. **4b manual eligibility-check log: BUILT** — `new_insurance_eligibility_check` table, `EligibilityCheckService`, shared `EligibilityCheckWidget` (badge + "Check eligibility" modal) mounted at Front Desk + Cashier; 8/8 live DB smoke. **4c multi-payer data model: BUILT, cashier split UI deliberately deferred** — `new_patient_payer` table + `PatientPayerService` (add/list/remove a second payer, reuses core `insurance_companies`), registration "Add a second payer" section (`AdditionalPayerSection`), `new_scheme_claim` unique key relaxed to `(visit_id, insurance_company_id)` so a visit CAN hold more than one claim; 8/8 live DB smoke (add/list/update-in-place/reject-no-insurer/remove, clean rollback). **The cashier split screen itself still assumes one payer per visit** — splitting a single checkout's charges across two payers in one atomic transaction needs its own careful pass (claim-line double-cover guard, multi-claim receipt/response contract) and was deliberately not rushed into this session; today a clinic can record 2 payers on a patient's file and see them, but the cashier UI to bill both in one checkout is a follow-up slice. **4d claims workbench upgrades: BUILT** — `SchemeClaimService::listClaims` age bucket (0–7/8–30/31+, same convention as Outstanding balances) + payer filter, `rejected` status with a required free-text `rejection_note` (resubmit clears it back to `to_submit`); `SchemeClaimsList` UI updated with age badge, payer filter, Reject/Resubmit actions; 9/9 live DB smoke + 4 vitest (incl. new reject-flow test). All slices: PHP verify + full `npm run check` green (lint/typecheck/i18n/bs-check/vitest all pass) after each. Behind flag default OFF, requires `enable_insurance_scheme`=1. PRD D-BILL-9. Explicitly excludes any live NHIA/HMO API integration, claim batching, and COB math pending real clinic discovery. [spec](./new/NEW_CLINIC_V1_INSURANCE_FOUNDATION_REDESIGN.md) |

**§20.1 mean:** **81** (excludes the four CBILL-* slices — tracked separately below)

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

**Automated evidence (2026-07-09):** PHPUnit NewClinic **839** tests · mandatory contracts **80/80** · frontend Vitest **393** · Playwright golden-path specs **2/2** green (incl. lab close-day) · hub smokes **57/57** · `composer registry-signoff` PASS · [§21 E2E map](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md).

**Estimated CI coverage of §21:** **~85** (engineering estimate; normative PRD checkboxes mostly open for Product)

---

## UI/UX — shadcn migration (§9)

| Phase | Scope | % | Owner | Status |
|-------|-------|---|-------|--------|
| A | Tokens, Tailwind, `ui/` primitives | **85** | Eng | Done |
| B | S-effort wrappers (Card, Badge, …) | **100** | Eng | Done |
| C | Dialog, Sheet, Command, DataTable | **100** | Eng | Done |
| D | PatientContextBanner, chart-line | **88** | Eng | consult-ready hook shipped (M4-F32) |
| E | Retire BEM CSS | **99** | Eng | T1 shell nc-*; CSS token vars `--oe-nc-*` remain (Phase A) |

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
| P1 | M10 | M10 | Patient Registry product sign-off | 88 | Product |
| P2 | M0-F07 | M0 | REST `GET /api/new/visits` | 0 | Eng |
| P2 | T2 | Platform | Globals installer profile | 40 | Eng |
| P2 | §9-B | UI | shadcn Phase B component swap | 100 | Done |

---

## Per-module feature ID samples

Use PRD §8 tables as source of truth. Below: **representative** IDs for spot audits (not exhaustive).

### M8 Lab Desk (sample)

| Feature | P | % | Status | Notes |
|---------|---|----|--------|-------|
| M8-F07 Skip to payment | P1 | 100 | Done | `SkipToPaymentModal`, `lab.skip_to_payment`, `#nc-lab-skip-btn` |
| M8-F08 lab-direct intake | P1 | 100 | Done | `LabDirectPanel` |

### M9 Pharmacy Desk (sample)

| Feature | P | % | Status | Notes |
|---------|---|----|--------|-------|
| M9-F06 Skip to payment | P1 | 100 | Done | `SkipToPaymentModal`, `pharmacy.skip_to_payment`, `#nc-pharmacy-skip-btn` |
| M9-F08 pharmacy walk-in triage | P1 | 100 | Done | `PharmacyWalkinPanel` |
| M9-F15 external Rx validation | P1 | 100 | Done | `ExternalRxValidationService` |
| M9 native Rx history (post-pilot) | P2 | 100 | Done | `rx-history.php`, `PrescriptionHistoryService`, `enable_native_rx_history` (default OFF), view + print only |

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

**2026-07-18 — Encounter-engine flip: M17 hub permanent, native engine only (PRD §5.6 amendment rows 8–9)**

The three-batch "upgrade native to stock level" plan completed same-day. Batch 1: the hub opens
**any** encounter — `?encounter_id=` synthesizes an encounter-only context for visits without a
queue row (G12 `bindForEncounter` session bind; native visit-keyed editors politely refused);
also fixed a `#IfNotRow2D`-arity bug that had re-registered the consult form on every upgrade
(7 duplicate registry rows, deduped). Batch 2: the Add-form list and visit summary cover the
**full form registry** (long-tail stock/LBF forms via the clinical-form-bridge; billing forms
excluded; per-form ACL kept). Batch 3: `enable_clinical_doc_hub` and `encounter_note_engine`
**deleted from code** — the native consult engine is the only engine, both 302 fall-throughs to
stock `encounter_top.php` removed, every open-encounter router (sign service, activity feed,
hub links) targets the hub, the stock encounter URL builder deleted. Live smokes: encounter-only
summary/sign/open + bridge renders + long-tail reviewofs edit round trip — all PASS. PRD →
v1.20.56; clinical-doc spec → v0.1.3.

**2026-07-19 — Post-visit corrections (clinical-doc spec → v0.1.4):** closed visits
(completed/paid/cancelled) open forms through the bridge-only encounter route (doctor/admin
bind, per-form ACL, stock form history as audit trail), and the DR-08 manager unlock works
after the visit closes. Native visit-keyed editors stay queue-only. Proven by unit test +
live smoke on a completed visit; consult e2e suite (golden path + native + variants) 6/6 green
2026-07-18 after focus-mode spec repairs.

**2026-07-18 — Flag retirement: five surfaces made permanent (PRD §5.6 amendment)**

Seven flags deleted from code after parity sign-off; the surfaces are now always on with no
legacy fallback and no Clinic Setup toggle: Communications Hub (`communications_hub_enable`),
Patient Registry (`enable_patient_registry` — reception Finder hide now role-based only),
Office Notes (`enable_office_notes`), S1 Scheduling & Flow (`enable_scheduling_redesign` —
sole remaining gate is `enable_scheduled_integration`), and the native Background/History
editor (`enable_native_history_editor` + `enable_native_history_full_form` — stock
`history_full.php` no longer linked). The T1-F20b history-editor wrap
(`enable_history_editor_wrap`) was **deleted outright** — service, injector, gate, template,
CSS, scripts, tests, and e2e spec. Verified: `composer verify:new-clinic` PASS, 1204 PHPUnit +
874 Vitest green, live HTTP smokes incl. a history save round-trip. PRD → v1.20.55; companion
specs bumped (scheduling 0.2.7, registry 0.2.3, page designs 0.6.53, medical history 0.2.1,
full history form 0.5.0).

**2026-07-12 — GAP-D / D3 native procedure-order form shipped (W2 top slice) — full native form behind `enable_native_proc_order` (OFF); browser sign-off pending**

Research first overturned the plan: a native React lab-ordering path already shipped
(`LabPanelModal` → `LabPanelOrderService`, `enable_lab_panel_order`), so "build a native pane" was
~60% met. Product parity-bar decision (open Q#4): **full native form**. Built in two verified slices —
`ProcedureOrderEnginePolicy` + `ProcedureOrderFormService` (full-field getFormData/saveOrder reusing
`LabPanelOrderService` idioms + `LabOrderChargeService` billing, no duplicate logic), then the
`proc-order` island (`ProcOrderForm`: lab picker, per-lab test checkboxes with fees + estimate,
priority/specimen/diagnosis/clinical-hx, edit prefill; on `t()` + the D1 eslint fence), `proc-order.php`
host (maps clinical-doc `form_id`=forms.id → procedure_order_id — a real slice-1 bug caught in debug),
ajax `proc_order.form_data|save` (`clinical_doc_write_acl`), and the routing hook in
`ClinicalDocFormOpenService` (native-vs-bridge; catalog card unchanged). Flag wired 3 places (OFF).
Full PHPUnit **975 (no failures)**, Vitest **490/490**, verify **297 actions / 0 cycles**, live-DB read
smoke green (real catalog + fees + 38 specimen options). Two self-caught issues fixed honestly: the
form_id/procedure_order_id bug, and DB pollution from a crashed smoke (fatal skips `finally`, left the
flag on at the desk facility) — cleaned + test hardened to read the resolved facility. Manual browser
submit is the remaining parity gate before prod enablement. Asset `20260712procorder`.

**2026-07-12 — GAP-D / D1 i18n foundation shipped — G8 mechanism closed (sweep continues desk-by-desk)**

The island i18n mechanism + extraction pipeline, per the D1 deliverable ("mechanism plus
extraction, not translations"). `@core/i18n`'s `t(msg, params?)` mirrors core `xl()`:
English source string as key, dictionary lookup with automatic English fallback, `{param}`
interpolation applied after translation so translators can reorder placeholders.
`mountIsland()` awaits `ensureI18nReady()` before first render; the locale reaches islands
via `#nc-t1` `data-lang-code`/`data-i18n-url`, stamped by new `ShellLocaleService`
(session `language_choice` → `lang_languages.lang_code`; dictionary URL only when
`public/assets/i18n/<code>.json` exists — NOT `assets/modern/`, which Vite wipes).
Research finding: the Twig half of D1 was already done (259 `|xlt` uses across all 41
templates); only `<html lang>` needed fixing. `npm run i18n:extract` maintains the key
inventory (`messages.json`); `i18n:check` joined `npm run check`; an eslint
`react/jsx-no-literals` fence covers migrated islands (office-notes seeded — 42 keys).
English ships as the only locale; French is open product question #3. Full gates green
(970 PHPUnit / 487 Vitest / verify 295 actions / build). Also fixed two pre-existing
full-suite test failures found while verifying: `backup_target_dir`'s blank default
(uncommitted prior work) and the referral-strip test's unpinned premise (ordering flake).

**2026-07-11 — GAP-A / A4 Letters & labels shipped — G4 closed**

Letters tab on the chart-depth referrals hub (`LettersPanel.tsx` behind a Referrals|Letters
`SegmentedControl`) + a "Print label" menu (chart/address/MRN-barcode) in the patient-chart
header, both behind one `enable_letters_labels` flag (default OFF; legacy `letter.php` stays
reachable). Letters reuse the STOCK flat-file template engine end to end — pre-build research
overturned the plan's `document_templates`-table assumption (that's the patient-portal system) —
so templates are interchangeable with the legacy screen; `TO_*` recipients come from the A3
directory (same `username=''` guard). Print pages (`letter-print.php` POST+CSRF,
`patient-label.php`) follow the queue-slip/rx-print Twig pattern; barcodes render via the
core-vendored `Barcode::gd()` as PNG data-URIs (no FPDF). Post-build audit: a new unit test
caught a dotfile-listing gap pre-merge, and the live smoke exposed + fixed a **pre-existing
chart-killing bug** — `PaymentsStrip.tsx` rendered `last_receipt` (an object) as a React child,
crashing the whole patient-chart island for any patient with a receipt once chart-depth finance
is on. 11 new tests (5 PHPUnit, 6 Vitest); full gates green (918 PHPUnit / 426 Vitest / verify
270 actions).

**2026-07-11 — GAP-A / A3 Directory tab shipped — G3 closed, GAP-A daily-use trio (G1/G2/G3) complete**

New "Directory" tab in Admin Hub (`DirectoryTab.tsx`/`DirectoryModal.tsx`) replaces the 2005-era
`addrbook_list.php`/`addrbook_edit.php` screens for managing external referral contacts
(specialists, labs, vendors, etc.). Storage is stock (`users.abook_type` rows, distinguished from
real staff logins by `username='' `/`authorized=0`) — every read/write/delete carries that guard,
proven by a PHPUnit test that seeds a fake staff-login row and confirms the service can't touch
it. Gated on the module's own `new_admin` ACO (not stock `admin/practice`, which would have 403'd
real pilot admins), always-on like Visit Types/Fees (no new toggle). Live testing caught a
genuine surprise before shipping: "External Organization" is stock `option_value=1`
(person-centric) despite the name — the UI already followed the real per-type flag, not a
hardcoded assumption, so this needed no fix, just a documented gotcha. 15 new tests (9 PHPUnit,
including a load-bearing guard test that seeds a fake staff row; 6 Vitest).

**2026-07-11 — GAP-A / A2 "unfiled documents" inbox lens shipped — G2 fully closed**

Closed the remaining half of G2: a new "Unfiled documents" lens in `report-hub`
(`UnfiledDocumentsLens.tsx`) lists scans with `foreign_id = 0` (stock's own pre-existing
"no patient" sentinel, same one `documents.php`'s "New Document Uploads" screen already used) and
files them to a patient via `PatientSearchDropdown`, reusing `documents.list`'s shapes and the
existing `patients_docs_acl` policy. report-hub's lens system turned out to be a hardcoded enum +
generic report-card catalog, not an extensible registry — the 7th lens needed special-casing
across 4 files (`reportHubTypes.ts`, `reportHubLensMeta.ts`, `ReportHubAccessService.php`,
`ReportHubLensPane.tsx`) plus a Twig toolbar button, matching how the existing `today` lens is
special-cased. Reused the `enable_documents_native` flag (no new toggle). Live browser
verification surfaced a pre-existing, already-tracked scalability gap — PHP's default session-file
locking serializes concurrent same-session ajax calls because no New Clinic handler calls
`session_write_close()` yet (`NEW_CLINIC_V1_SCALABILITY_HARDENING_PLAN.md`) — correctly attributed
as a systemic, out-of-scope issue rather than a defect in the new action. 5 new PHPUnit tests + 3
new Vitest tests.

**2026-07-11 — GAP-A / A1 Office Notes + A2 Documents tab (per-patient half) shipped**

Closed G1 (Office Notes) and the per-patient half of G2 (Documents manager) from the
[OpenEMR gap analysis](./new/NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md) — new
`office-notes` island (clinic-wide sticky notes, pin/archive) and a native Documents tab in
`patient-chart` (list, upload, recategorize, soft-delete), both behind default-OFF flags
(`enable_office_notes`, `enable_documents_native`) with the stock screens still reachable. Both
reuse the existing `Clinicians` GACL group grants — no new `acl_setup.php` wiring needed. Fixed a
critical bug found in live browser smoke testing (not caught by unit tests, since neither service
had any): `DocumentsService` queried a `categories.active` column that doesn't exist in the stock
schema, 500ing every category-related action. Added first-ever test coverage for both services (9
tests). A2's clinic-wide "unfiled documents" inbox lens remains open.

**2026-07-05 — UX Enhancement Sprint (21 features)**

Completed comprehensive Front Desk UX overhaul (sp182touch → sp191fuzzydup):

**Accessibility (WCAG 2.1 AA compliant):**
- Skip navigation links (bypass blocks)
- ARIA landmarks & labels (semantic structure)
- Screen reader live announcements (status messages)
- Keyboard shortcuts system with help overlay (full keyboard nav)
- Touch target optimization (44×44px minimum)

**Performance & Scalability:**
- Virtual scrolling for 1000+ results (@tanstack/react-virtual)
- Request debouncing (80% API call reduction)
- Optimistic UI updates (instant feedback)
- Type-ahead predictive search (zero-latency suggestions)

**User Experience:**
- Field-level validation (inline errors)
- Auto-save with draft recovery (zero data loss)
- Toast notification system (non-blocking feedback)
- Undo/redo patient navigation (Ctrl+Z)
- Bulk check-in workflow
- Progressive disclosure
- Smooth state transitions

**Mobile & Touch:**
- Swipe gestures (react-swipeable)
- Responsive layouts (tablet/mobile breakpoints)
- Mobile-optimized interactions

**Data Quality:**
- Fuzzy duplicate detection (fuse.js)
- Confidence scoring (0-100 scale)
- Match reason transparency

**New components:** SkipNav, LiveRegion, VirtualizedSearchResults, SwipeablePane, KeyboardShortcutsHelp, fuzzy detection module

**New hooks:** useAutoSave, useOptimisticUpdate, usePatientHistory, useTypeAheadSuggestions, useLiveAnnounce, useSwipeGestures

**Documentation:** `FRONT_DESK_UX_ENHANCEMENTS_SESSION_20260705.md`

---

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
| 2026-07-05 | Engineering | M1 Front Desk UX enhancements: touch target optimization (WCAG AA); keyboard shortcuts help (`?` overlay); field-level validation with inline errors; auto-save with draft recovery; ARIA landmarks & labels (screen reader A11y); asset `sp179touchopt` → `sp183aria`; session doc `FRONT_DESK_UX_IMPROVEMENTS_SESSION_20260705.md` |
| 2026-07-08 | Engineering | **AUDIT-13 doc-sync:** M8-F07/M9-F06 skip-to-payment confirmed restored (AUDIT-1); scorecard samples added; PRD §12.4 flag matrix reconciled with `install.sql`; CLAUDE.md island/cashier wording fixed; `new/` index consolidated |
| 2026-07-08 | Engineering | **Spec-completion batches 1–5:** 19 companion specs audited against code, gaps fixed (payment-history quintet, enriched activity feed, role picker, admin menu cutover, CDb referral wizard + `new_referral_meta`, Ghana HIS pack, SDOH chips, pilot wrappers, core-ACL grants); 15 specs archived to `done/`; AUDIT-1–15 refactor roadmap complete; golden-path E2E 2/2; asset `20260708chartdepth1` |
| 2026-07-09 | Engineering | **Spec-completion batch 6:** M1a/M16/M10 implementation-audit closure (spec v1.0.10 / v0.1.4 / v0.2.2); `reports.hub_advanced_open` distinct audit event (§16.3); `registry-signoff` + report-hub smoke re-verified green; scorecard rollup + stale cells refreshed; asset `20260709batch6` |
| 2026-07-09 | Engineering | **Spec-completion batch 7:** MRD/B7/Referrals closure (spec v0.2.37 / v0.1.2 / v0.1.3) — `hide_dashboard_cards` §17.6 mapping, Referral issued chip (REF-4/D34), D-REF-8 print identity confirm, D-REF-9 encounter guard, D-REF-12 read-only status gating, D-REF-3 wrapper LBTref sort, §503 Visits-row referrals link; asset `20260709batch7` |
| 2026-07-14 | Engineering | **M9 native Prescription History:** replaces "Open Rx list (core)" with native, paginated `rx-history.php` (view + print only — no bulk print/fax, no discontinue) behind `enable_native_rx_history` (default OFF); `PrescriptionHistoryService`/`PrescriptionHistoryPolicy`; `pharmacy.rx_history` ajax action; `PharmacyService::rxListUrl()` flag-aware; PRD v1.20.52 / PAGE_DESIGNS v0.6.52 / PHARMACY_OPERATIONS_REDESIGN v0.1.10 |
| 2026-07-15 | Engineering | **D-HIST-9 native Background editor (built):** curated West-Africa-first History quick editor drawer on the chart Clinical tab (family + tick-list incl. sickle cell, lifestyle dropdowns, herbal medicine/occupation, past illnesses, region screening) writing canonical `history_data`; `PatientHistoryEditorService`, `patients.chart.history_{get,save}`, flag `enable_native_history_editor` (default OFF); supersedes D-HIST-1 for the edit path; MEDICAL_HISTORY_BACKGROUND_REDESIGN v0.2.0. **D-HIST-10 planned:** full native History form replacing stock `history_full.php` — `NEW_CLINIC_V1_FULL_HISTORY_FORM_REDESIGN.md` v0.2.0 (WHO-PEN risk-factor list; suicide/mental-illness behind reveal; spouse/offspring dropped; two flags), flag `enable_native_history_full_form` |
| 2026-07-15 | Engineering | **D-HIST-10a/10b native full History form (built):** the Background drawer gains a "Full form" mode (superset of the D-HIST-9 quick editor) adding WHO-PEN risk factors (`usertext15`/`16`), sleep (`sleep_patterns`), and sensitive family conditions incl. suicide (`relatives_suicide`) behind a reveal; quick⇆full switch; stock form kept as "Advanced"; `PatientHistoryEditorService` partial-update save; `enable_native_history_full_form` flag wired (install.sql / EDITABLE_SETTINGS / Admin Hub). Full-form redesign spec v0.3.0. Parity sign-off (10c) pending |
| 2026-07-15 | Engineering | **M12 Lab Ops audit + critical-value flag (D-LAB-CRIT):** audit benchmarked the page against ISO 15189 / WHO-SLIPTA (the accreditation ladder for African labs). Core release workflow (dual entry/release ACL, server-validated + audited release) is up to standard; gaps were the SLIPTA operational indicators. Added **critical/panic-value detection** end-to-end: `crit_min`/`crit_max` (+ qualitative `critical_values`) in `LabResultValidationService` with standard adult panic thresholds (HB <5/>20, glucose <40/>500, WBC <1.5/>30, HCT <20/>60, PLT <20/>900); loud red "notify the clinician now" callout in the result drawer (live + on release); `releaseOrder` audit + response now record which tests were critical (never blocks — a critical result is valid and urgent). Also replaced 8 `window.alert()` with `showDeskToast`. Spec LAB_OPERATIONS_REDESIGN v0.1.12. |
| 2026-07-15 | Engineering | **M12 Lab Ops — remaining SLIPTA indicators + prompt (D-LAB-REJECT / D-LAB-TAT):** closed the three items left open above. (1) **Specimen rejection log** — new `new_lab_specimen_rejection` table (one row per event → rejection-rate reporting) + `rejected_at`/`rejection_reason` on `new_lab_order_meta`; `LabOpsOrderMetaService::rejectSpecimen` (8 standard reasons: haemolysed, clotted, QNS, wrong tube, mislabelled, leaked, wrong patient, contaminated) clears collected state so the specimen is re-taken; `lab_ops.specimen_reject` action (enter ACL); worklist "Reject specimen" action + reason modal; row shows "Specimen rejected (reason) · recollect". (2) **Turnaround time** — worklist `tat_label` (order→release for done; "In lab"/"Waiting" elapsed for in-progress). (3) `window.prompt` → inline input. **Verified live end-to-end:** seeded a collected order, drove reject in the browser, confirmed the log row + meta clear in the DB. Note: the supplementary `EventAuditLogger` call follows the module's existing (unpersisted-on-this-install) lab-audit pattern; the dedicated rejection table is the authoritative record. Spec v0.1.13. |
| 2026-07-15 | Engineering | **Report Hub perf (SCALE-1.2/1.3 extension, perf):** three measured fixes. (1) `reports.daily/reconciliation/ancillary/documentation_integrity/scheduling` added to `READONLY_ACTIONS` — daily was the worst session-lock holder (4.5–68 s runs froze the user's whole session; other pages died at 60 s in SessionUtil; hub_summary queued 5.9 s); their pre-existing `BUDGET_EXEMPT` entries were dead code without this membership. (2) `ReportsService::completionByRegisteringUser` registrar subquery rewritten `ORDER BY l.date LIMIT 1` → `MIN(l.id)` lookup — the log(date) index made the old form walk 1.4 M audit rows per patient with no registration event (10.0 s, 4 M rows examined, slow-log evidence); also sargable `regdate` range. (3) `ReportHubAccessService::hasAcl` per-request memo — `reports.catalog` re-ran the same gacl ACL query 245× (2.6 s). Measured: hub_summary 5.9 s→0.6 s, reports.daily 13.6 s→0.9 s warm, page settled ~20 s→4.3 s. |
| 2026-07-15 | Engineering | **D-PROF-1 Profile tab read view (fix):** the chart Profile tab showed only a completion checklist + payments + Edit button — the patient's actual demographic values never rendered (roles without edit rights saw no details at all). Added `ProfileInfoPanel` rendering the values already returned by `patients.registration.get` (`getFormData` section_1–4: name, sex, DOB, phone, national ID, address, email, emergency contact, blood group, occupation, insurance) — pure frontend, no new fetch. Empty fields hidden. |
| 2026-07-15 | Engineering | **D-IMM-1 native immunization editor (built):** Add/Edit on the chart Immunizations section opens a native drawer with a **Ghana EPI vaccine set** (BCG, OPV, Pentavalent, PCV, Rotavirus, Measles-Rubella, Yellow Fever, Meningococcal A, Vitamin A, Td — seeded to `list_options` option_ids 500–519) instead of stock `immunizations.php`; records vaccine/date/here-elsewhere/lot/note to the canonical `immunizations` table via plain INSERT/UPDATE (no stock `REPLACE INTO` re-add bug); `PatientImmunizationEditorService`, `patients.chart.immunization_{options,get,save}` (2 reads on SCALE-1.2 allowlist), `enable_native_immunization_editor` flag (3-place wired). Also **removed the stock "Other transactions" link** from the referrals strip (product decision). Spec `NEW_CLINIC_V1_IMMUNIZATION_REDESIGN.md` v0.1.0 |
| 2026-07-15 | Engineering | **D-HIST-10c parity signed off + stock form retired:** parity verified end-to-end via headless browser + live DB (native writes land in correct `history_data` columns; stock-only fields seatbelt/mammogram/hazardous/coffee/offspring **untouched** by a native save via partial-update; stock→native read; `patients/med` ACL; 360px tablet). Stock "Advanced (stock form)" escape hatch **removed** from the full editor — native full form is now the sole full editor when `enable_native_history_full_form` is on. Spec v0.4.0 |
| 2026-07-17 | Engineering | **Native Clinical Instructions editor (built, DEFAULT no flag):** the M17 hub "Clinical instructions" card opens a native drawer (one note + snippet chips) writing the stock `form_clinical_instructions` shape; edit-in-place; all entry paths funnel native (card + Add-form client intercept, `ClinicalDocFormOpenService::openForm` server-route to `?open_form=clinical_instructions`). Flag removed per product decision — stock form kept via encounter Advanced view. `ClinicalInstructionsEditorService`, `clinical_doc.instructions_{get,save}`. Live-smoked. |
| 2026-07-17 | Engineering | **Screening questionnaires redesign (planned + audited):** stock Screening-lens "Questionnaires" card is OpenEMR's FHIR/LForms engine with an **empty repository** (0 questionnaires/responses) — unusable; the `phq9`/`gad7` cards are dead scaffolding (no table, not registered — `buildCard` drops them). Plan: native scored **PHQ-9 + GAD-7** screeners (live score + severity + PHQ-9 self-harm alert) writing a new `form_nc_screening` table; keeps the FHIR engine for custom questionnaires (does NOT rebuild it — FHIR non-goal). Flag `enable_native_screening` (default OFF). Spec `NEW_CLINIC_V1_SCREENING_QUESTIONNAIRES_REDESIGN.md` v0.1.1 (code-audited). |
| 2026-07-17 | Engineering | **Screening questionnaires (SCRN-1/2 BUILT):** native PHQ-9 + GAD-7 screeners on the M17 Screening lens. `ScreeningInstrumentCatalog` (public-domain PHQ-9/GAD-7 defs + server scoring), `ScreeningAssessmentService` (get/save/status, re-scores server-side, edit-in-place in `form_nc_screening`), ajax `clinical_doc.screening_{get,save}` (write ACL). Catalog shows two virtual cards (`buildCard` native-screening allowance — cards carry live score/severity from `form_nc_screening`); `ScreeningDrawer` React island with live score, self-harm safety alert, per-item validation. Live-smoked (scoring, save, edit-in-place, self-harm flag, catalog emit). `form_nc_screening` table. Spec v0.2.0. |
| 2026-07-17 | Engineering | **Screening: native default (no flag) + stock card removed:** per product decision, `enable_native_screening` **removed** (native PHQ-9/GAD-7 always on, like native Clinical Instructions) and the generic stock **"Questionnaires" (FHIR/LForms) card removed from the Screening lens** — no stock pages on the tab. Verified live: `getCatalog('screening')` returns `[phq9, gad7]` with no flag. Only `clinical_doc_show_screening` still gates whether the lens shows. asset `…-scrndefault38` |
| 2026-07-17 | Engineering | **Full-suite green sweep (3 remaining issues fixed):** (1) REAL BUG — `ClinicalVitalsSeriesService` selected a nonexistent `form_vitals.encounter` column (the linkage lives on the `forms` row) → chart Vitals-Trends panel was erroring; fixed with a `forms` join. Same service also read a MISSPELLED global (`units_of_measure`) → always labelled lb/in/°F over the module's kg/cm data; now fixed to module convention (kg/cm always, temperature converted to °C via `temperatureForEvaluation`). Live-smoked: series builds, °C/kg/cm labels. (2) `ClinicalIssueEditorServiceTest` failed whenever a pilot facility legitimately toggled `enable_native_issue_editor` ON — the test now pins the flag OFF in setUp and restores real values in tearDown (suite must not depend on ambient clinic config). (3) CLI REMOTE_ADDR warning in `EncounterNoteServiceIntegrationTest` silenced via setUp default. **Result: frontend gate 843/843 green end-to-end (first fully-clean run) + PHP suite 1,175 tests 0 errors/0 failures/0 warnings.** |
| 2026-07-17 | Engineering | **Eye-exam audit (5 findings, all fixed):** (1) HIGH — tinyint flags returned as strings and `Boolean("0")===true` in JS, so saved "not examined"/"not equal-reactive" states rendered as TICKED on reload; `loadLatest` now int-casts the six flag columns (smoked: `pupils=integer(0)`). (2) HIGH/clinical — a fresh exam defaulted pupils to unticked → quick exams silently recorded "not equal/reactive" by omission; drawer now defaults the normal finding TRUE for new exams, and the summary wording is 'Not equal/reactive' (was 'Abnormal'). (3) MED — fundus finding codes persisted even when "examined" was unticked; validate() now nulls findings for unexamined eyes (smoked: `[]`). (4) MED — spectacle Rx sph/cyl/add accepted arbitrary text and PD was unvalidated; now signed-dioptre regex + PD 40–85 mm (bad values rejected live). (5) LOW — dead `$placeholders` var removed. Module verify PASS, 32 island tests green. asset `…-eyeaudit59` |
| 2026-07-17 | Engineering | **Eye Exam BUILT (Part B of the cert+eye-exam plan):** primary-care native eye exam on the Specialty lens behind `enable_native_eye_exam` (3-place wired, default OFF; **ON at facility 3** + specialty lens enabled there for testing). `form_nc_eye_exam` + `nc_eye_exam` registry/report.php; `EyeExamService` (server-owned option catalogs: 6/x acuity values incl. CF/HM/PL, antseg/fundus finding codes, IOP methods; whitelist+bounds validation — bad acuity rejected; edit-in-place; e-sign lock; flag gate); `clinical_doc.eye_exam_{get,save}` (get on readonly allowlist, pins). `EyeExamDrawer` (width lg): R/L acuity selects, pupils/RAPD, IOP pair+method, toggle finding chips per eye, fundus behind explicit "examined" checkboxes ("not examined" honest), collapsible spectacle Rx, impression, refer checkbox (save toast reminds to write the referral). Gotcha: the specialty lens has an opt-in pack filter (`clinical_doc_specialty_pack`, empty = NO cards) that silently dropped the card — `nc_eye_exam` now bypasses the pack (its own flag is the gate). Live-smoked (save/readback/edit-in-place/validation) + browser E2E screenshot. Both plan parts (certificate + eye exam) now BUILT. asset `…-eyeexam58` |
| 2026-07-17 | Engineering | **Certificate audit (3 findings, all fixed):** (1) HIGH — concurrent issuance could collide on the fixed `PENDING` placeholder under `cert_no`'s UNIQUE index → placeholder now `PENDING-<uniqid>` (smoked: back-to-back issues → MC-…-00004/00005, zero leftover PENDING rows). (2) MED — the Days auto-fill formatted via UTC (`toISOString`), a day off in negative-offset timezones → local-date formatting. (3) LOW — bad visit ids on BOTH print pages (certificate + instructions) fell through to a 500 → clean 400; hub tests now clear the certificate drawer cache. Verified intentional: reprints still work if the flag is later disabled (issued certificates stay verifiable); superseded certificates remain on the encounter summary marked "superseded" (audit trail). asset `…-certaudit57` |
| 2026-07-17 | Engineering | **Medical Certificate BUILT (Part A of the cert+eye-exam plan):** `form_nc_certificate` + `nc_certificate` registry row + `enable_native_certificate` (3-place wired, default OFF; **turned ON at facility 3 for pilot testing**). `CertificateService`: serial `MC-YYYY-NNNNN` derived from the unique row id (race-free — spec's per-facility counter simplified, noted), editable-until-first-print then amend⇒NEW number + supersede (old row activity=0 + superseded_by), diagnosis only with consent flag, issuer from session identity, print logging via `certificate-print.php` (letterhead + verify line, hub-read, works after visit closes). Card on the This-visit lens (promoted out of consult "More" — E2E caught it hidden there), `clinical_doc.certificate_{get,save}` (get on readonly allowlist), drawer with type chips / rest-days auto-fill / consent checkbox / supersede warning, e-sign lock read-only. Full browser E2E: issue → card Print → letterhead screenshot (MC-2026-00003). Scoped tests 85 green; module verify PASS. Eye exam (Part B) not started. asset `…-certificate56` |
| 2026-07-17 | Engineering | **Medical Certificate + Eye Exam redesign (planned):** analyzed stock `note` (Work/School — free-text doctor name, no date range, no numbering/verification = fraud-prone; not installed here) and stock `eye_mag` (~13k lines / ~16 tables subspecialty ophthalmology suite; disabled here). Plan: (A) numbered auditable **Medical certificate** drawer (excuse duty / school / fit-to-work / attendance; per-facility cert numbers `MC-YYYY-NNNNN`, diagnosis only with consent checkbox, session-identity clinician, print+reprint logged, letterhead print with verify line, supersede-not-edit after print); (B) WHO-primary-care **Eye exam** on the Specialty lens (R/L pairs, 6/x acuity chips incl. CF/HM/PL, pupils/IOP/antseg/fundus quick-picks, "not examined" first-class, one-tap refer bridging into the native referral editor, optional spectacle Rx slip; module table, NOT the stock 16-table shape). Flags `enable_native_certificate` / `enable_native_eye_exam` default OFF. Spec `NEW_CLINIC_V1_CERTIFICATE_EYE_EXAM_REDESIGN.md` v0.1.0 |
| 2026-07-17 | Engineering | **"Add form" removed then RESTORED (product decision reversed same day):** briefly hidden (`…-hideaddform50`), then restored with an upgrade — the picker now routes ALL native editors (clinical_instructions, vitals, phq9/gad7) to their drawers instead of the stock bridge. Live catalog at facility 3: Consultation note, Lab orders, Prescriptions, PHQ-9, GAD-7, Vitals, Clinical instructions. asset `…-addformback51` |
| 2026-07-17 | Engineering | **Clinical Instructions patient handout print:** new `clinical-doc/instructions-print.php` (referral-print pattern — clinic header, patient name/MRN/DOB, DD/MM/YYYY dates, instructions, clinician signature line, printed timestamp, auto print dialog) backed by `ClinicalInstructionsEditorService::getPrintable` (hub-read ACL, **no clinical-state guard** — reprints work after the visit moves on; 404 when nothing saved). Print buttons on the hub card (started native card) and in the drawer footer (enabled once a note is saved; save response `form_id` now tracked/cached). Signed-card label Edit→View. E2E-verified in browser (save → card Print → handout screenshot). asset `…-ciprint48` |
| 2026-07-17 | Engineering | **Native-editor audit (3 findings, all fixed):** (1) **CRITICAL/compliance — e-sign lock not enforced**: all three native editors (vitals, instructions, screening) would save over an e-sign-locked form. Fixed: services check `EncounterSignService::isFormdirSignedOnEncounter` — `get` returns `locked`, `save` throws 409; drawers render read-only with an info callout when locked. Live-proven (signed a vitals forms row → locked=true + save rejected 409). (2) **HIGH/data loss — `waist_circ` silently dropped**: `VitalsValidationService::validateForTriage` only passes its 8 known fields; the Waist input never saved. Fixed in `VitalsEditorService` (validated 20–300 cm, merged into payload); live-proven stored. (3) **MEDIUM/display — stale "Last saved"**: edit-in-place didn't touch `forms.date` (the card's timestamp source). Fixed in all three editors; live-proven advancing. Gate 828 green. asset `…-esignlock47` |
| 2026-07-17 | Engineering | **Native Vitals editor (built, DEFAULT no flag):** the M17 hub "Vitals" card (all lenses + Add form + deep links via `openForm` `?open_form=vitals`) opens a native metric drawer — 2-col fields with units + required markers, live **BMI + WHO status chip**, note — instead of the stock vitals screen. `VitalsEditorService` reuses `VitalsValidationService` + `EncounterService::insertVital`/`VitalsService::saveVitalsArray` (canonical `form_vitals` + `forms` row; module kg/cm convention); BMI/BMI_status recomputed server-side; edit-in-place of the latest set. Gotcha fixed: `VitalsService::save()`'s whitelist drops `uuid` → FHIR uuid-mapping post-save listener dies on update; editor passes the row uuid through `saveVitalsArray`. `clinical_doc.vitals_{get,save}`; get on the SCALE readonly allowlist. Live-smoked create/update/readback; screenshot-verified. **All three plan forms (Instructions, PHQ-9/GAD-7, Vitals) are now native — the Clinical Documentation hub has no stock-form cards left in the pilot path.** asset `…-vitals46` |
| 2026-07-17 | Engineering | **Screening-tab freeze — TRUE root cause (screenshot-verified):** `clinical-doc/main.css` never imported `core/tokens.css`, so the SlideOver/Dialog primitives (positioned entirely by Tailwind utilities) rendered **unstyled and invisible** — clicking PHQ-9/GAD-7 opened an invisible modal that blocked every click ("page freezes, other buttons stop working"). DOM-level Playwright tests passed against the invisible drawer for 3 rounds; a screenshot caught it. Fix: one `@import '../../core/tokens.css'` in the island CSS; also makes the Add-form dialog and hub card styling render as designed. Stress suite 0 failures, gate 824 green. asset `…-drawercss44` |
| 2026-07-17 | Engineering | **Screening-tab freeze contributors fixed (Playwright stress repro):** rapid drawer open/close cycles queued a flood of `screening_get` requests, each serializing ~0.5-0.6s on the PHP session lock **during bootstrap** (before the SCALE-1.1 release point — parallel-probe verified even allowlisted actions serialize there); the next drawer then sat on "Loading…" >10s with the modal blocking the page. Fixes: `clinical_doc.{instructions,screening}_get` → `READONLY_ACTIONS` (+ policy-test pins), and client **cache + single-flight** in both native drawers (instant reopen from module-level cache, background revalidate guarded by a dirty flag, max one GET in flight per key). Stress suite (rapid Esc/X cycles + save races): 0 failures, pointer-events clean. asset `…-scrncache42` |
| 2026-07-17 | Engineering | **Screening SCRN-3 (both deferred items done + button hardening):** (1) **encounter-summary parity** — `interface/forms/nc_screening/report.php` + `nc_screening` registry row; `ScreeningAssessmentService::saveAssessment` `addForm`s on insert (edit-in-place = one `forms` row) so the score + per-item answers show on the stock encounter summary. (2) **`openForm` server-route** — `phq9`/`gad7` now redirect to `clinical-doc/index.php?tab=screening&open_form=<instrument>` and the hub auto-opens the drawer; covers deep-links / favorites / **stale-bundle fallback** (previously the card button fell through to a non-existent stock form dir → the "buttons not working" report). Live-smoked (route + addForm + edit-in-place single forms row). Also: restored the user's `clinical_doc_show_screening=1` (fac 3) that an earlier smoke-cleanup wrongly deleted. asset `…-scrnroute40` |
| 2026-07-19 | Engineering | **Certificate + Eye exam deferred polish (spec → v0.4.0, all 4 open questions closed):** verify-by-number (`CertificateService::verifyBySerial`, `front_desk.verify_certificate`, Front Desk "Verify certificate" dialog — facility-scope misses read as not-found, lookups audited); eye-exam refer bridge (save-with-refer returns a `referral_url`, drawer's "Write referral now" opens the chart-depth composer pre-filled with findings, seeding only untouched fields); `eye_exam_show_iop` toggle (default ON, hides IOP for clinics without a tonometer); spectacle-prescription print slip (`clinical-doc/spectacle-print.php`, handout pattern, reprints work after visit close). Certificate can now attract a fee (product decision): `certificate_auto_bill` toggle (default OFF) + fee-schedule code `MED_CERT` + `CertificateChargeService` posting to encounter billing on issue, idempotent per encounter so amend/supersede never double-charges, missing/inactive price warns but never blocks the save. Audit pass (1 medium fixed: stale referral link surviving drawer reopen across patients; 1 low: verify lookups now audited) + 11 new tests. Gates: verifier PASS, module suite 1260 green, island suites 85 green. asset `…-eyeaudit90` |
| 2026-07-19 | Engineering | **Admin Hub Apple-theme redesign (ADM-1..7, `NEW_CLINIC_ADMIN_HUB_APPLE_REDESIGN_PLAN.md` v1.6.0; ADM-8 final-verify in progress):** wrapped 10-tab strip → sticky grouped left-rail nav (Get started / Clinic / People & money / Operations); "Queue & roles" mega-tab split into **Queue & desks** + **Features**; Setup checklist promoted to its own destination (legacy `?tab=system#nc-admin-setup-checklist` still resolves); global settings search across every tab's fields + destinations with jump-and-highlight; unsaved-changes guard now covers every navigation, not just the scope switch; one-accent visual pass (green reserved for done/success only — fixed a hardcoded-green guided-task icon that ignored its own tone prop, and every `--oe-nc-shadow-sm/md` token turned out to never be defined, silently running on fallback the whole time); product-wide `xl()` desk-title apostrophe bug (turned out to be two bugs — a second, `base.html.twig` re-translation of the already-composed title). **New: per-clinic setting override transparency** — "Overridden for this clinic" + "Use global value" reset, backed by `ClinicConfigService::hasFacilityOverride`/`getGlobalValue`/`deleteFacilityOverride`. Building it surfaced a real pre-existing bug, not a UI-only one: the settings form has always saved its full ~180-key state on every Save, and the backend wrote every key unconditionally, so the first save at any facility silently gave every setting a facility-level row forever (confirmed live: 167/180 keys already "overridden" on the dev facility from ordinary testing). Fixed by writing only when a value genuinely differs from what the facility resolves to — zero runtime behavior change, only which rows exist; proven via a stash-and-test regression pair + a live-DB smoke script, plus a one-time cleanup pass on the dev facility (111 no-op rows removed, 42 genuine overrides kept). Two E2E specs green (`setup-checklist.spec.js`, `v11-admin-smoke.spec.js`), full module PHPUnit suite green (1268 tests), browser-QA'd at 1280/1024/390px. |

---

## Related documents

- [PRD §5.6 matrix](./done/NEW_CLINIC_V1_PRD.md#56-implementation-status-matrix)
- [PRD §20.1 slices](./done/NEW_CLINIC_V1_PRD.md#201-post-pilot-release-slices-v11-family--independent-ships)
- [PRD §21 acceptance](./done/NEW_CLINIC_V1_PRD.md#21-acceptance-criteria-v1-pilot)
- [§21 E2E evidence map](./NEW_CLINIC_V1_SECTION21_E2E_MAP.md)
- [§21 QA sign-off record](./NEW_CLINIC_V1_SECTION21_QA_SIGNOFF.md)
- [NEXT_STEPS.md](../../interface/modules/custom_modules/oe-module-new-clinic/NEXT_STEPS.md) — deploy / pilot commands
- [CODE_AUDIT React migration](../../interface/modules/custom_modules/oe-module-new-clinic/CODE_AUDIT_2026-06-27-REACT-MIGRATION.md) — superseded for open items by [audit roadmap](./done/NEW_CLINIC_CODEBASE_AUDIT_AND_REFACTOR_ROADMAP.md)
