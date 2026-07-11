# New Clinic — AJAX Action → ACL Matrix (SEC-1)

| Field | Value |
|-------|-------|
| **Document version** | 1.0.4 |
| **Status** | Living security control — regenerate after any `AjaxActionPolicy` change |
| **Owner** | Engineering (security) |
| **Generated from** | `src/Services/AjaxActionPolicy.php` via the audit harness in SEC-1 |

## Why this document is a control, not just documentation

`public/ajax.php` is the **single authenticated endpoint** fronting all 22 React islands.
Every dispatchable action is classified by `AjaxActionPolicy::describe()`; `AjaxController::authorizeAction()`
enforces the classification **before dispatch**, and any action whose type is `unknown` is rejected
with a generic 400. Two automated guards keep this from regressing:

- **`composer verify:new-clinic`** (and CI) runs `ajax-action-crosscheck.php`, which **fails the build**
  if any controller/handler-dispatched action is not classified by the policy (`type === 'unknown'`),
  or has zero repo callers.
- **`AjaxAclContractTest`** (in `composer test:new-clinic-mandatory`) asserts representative
  wrong-role denials per ACL tier.

**Deferred actions** (chart reads + exports) skip the top-level gate by design and re-authorize inside
their handler via `authorizeDeferredHandler()` — every one also calls `assertPatientChartPid()`
(→ `FacilityScopeService::assertPatientAccessible`) for the IDOR/facility-scope check. Visit-mutating
writes load through `VisitQueueService::getVisitForActor()` → `assertVisitAccessible()`; patient writes
(`patients.update`) call `assertPatientAccessible($pid)`. So an authorized role cannot operate on an
out-of-facility `pid`/`visit` by editing the payload (wrong-patient guard G12).

## SEC-1 audit result (2026-07-09)

- **249** dispatchable actions; **0** unclassified (`unknown`); **0** without an ACL path.
- Chart-read IDOR guards: **all present**. Visit-write facility scope: **enforced at the FSM chokepoint**.
- **Fix applied:** `reports.ancillary`, `reports.documentation_integrity`, `reports.scheduling`
  were `desk_acl` (any of 8 roles) while their `_export` siblings required `reports` — a lab/pharmacy/cashier
  role could pull cross-patient operational/clinical-status reports by calling the ajax directly, bypassing
  the reports-gated page. Reclassified to `reports`.

## Full matrix

| Action | Policy type | Required ACL (any-of) | Deferred (handler re-auths) |
|--------|-------------|-----------------------|-----------------------------|
| `admin.acl.group_create` | single_acl | new_admin |  |
| `admin.acl.group_permissions` | single_acl | new_admin |  |
| `admin.acl.group_permissions_add` | single_acl | new_admin |  |
| `admin.acl.group_permissions_remove` | single_acl | new_admin |  |
| `admin.acl.group_remove` | single_acl | new_admin |  |
| `admin.acl.groups` | single_acl | new_admin |  |
| `admin.acl.membership` | single_acl | new_admin |  |
| `admin.acl.membership_add` | single_acl | new_admin |  |
| `admin.acl.membership_remove` | single_acl | new_admin |  |
| `admin.acl.return_values` | single_acl | new_admin |  |
| `admin.acl.users` | single_acl | new_admin |  |
| `admin.backup.complete` | single_acl | new_admin |  |
| `admin.backup.run` | single_acl | new_admin |  |
| `admin.completion_weights.save` | single_acl | new_admin |  |
| `admin.config` | single_acl | new_admin |  |
| `admin.config.export` | single_acl | new_admin |  |
| `admin.config.import` | single_acl | new_admin |  |
| `admin.config.save` | single_acl | new_admin |  |
| `admin.facility_user.get` | single_acl | new_admin |  |
| `admin.facility_user.list` | single_acl | new_admin |  |
| `admin.facility_user.matrix` | single_acl | new_admin |  |
| `admin.facility_user.save` | single_acl | new_admin |  |
| `admin.fee.archive` | single_acl | new_fee_schedule_admin |  |
| `admin.fee.billing_codes` | single_acl | new_fee_schedule_admin |  |
| `admin.fee.import` | single_acl | new_fee_schedule_admin |  |
| `admin.fee.save` | single_acl | new_fee_schedule_admin |  |
| `admin.forms_catalog.set_state` | single_acl | new_admin |  |
| `admin.geo.districts` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin |  |
| `admin.geo.regions` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin |  |
| `admin.health_status` | single_acl | new_admin |  |
| `admin.his_pack_import` | single_acl | new_admin |  |
| `admin.his_pack_status` | single_acl | new_admin |  |
| `admin.profile.apply_cash_clinic` | single_acl | new_admin |  |
| `admin.reconciliation.run` | single_acl | new_admin |  |
| `admin.roles.grant_self` | single_acl | new_admin |  |
| `admin.roles.templates` | single_acl | new_admin |  |
| `admin.setup.complete` | single_acl | new_admin |  |
| `admin.setup.mark_item` | single_acl | new_admin |  |
| `admin.staff.access_summary` | single_acl | new_admin |  |
| `admin.staff.create` | single_acl | new_admin |  |
| `admin.staff.deactivate` | single_acl | new_admin |  |
| `admin.staff.get` | single_acl | new_admin |  |
| `admin.staff.list` | single_acl | new_admin |  |
| `admin.staff.locked_list` | single_acl | new_admin |  |
| `admin.staff.reset_password` | single_acl | new_admin |  |
| `admin.staff.unlock` | single_acl | new_admin |  |
| `admin.staff.update` | single_acl | new_admin |  |
| `admin.visit_type.archive` | single_acl | new_admin |  |
| `admin.visit_type.save` | single_acl | new_admin |  |
| `bill_ops.charge_correct` | bill_ops_correct_acl | new_bill_ops_correct|new_admin |  |
| `bill_ops.daysheet` | bill_ops_close_acl | new_bill_ops_close|new_admin |  |
| `bill_ops.daysheet_export` | bill_ops_close_acl | new_bill_ops_close|new_admin |  |
| `bill_ops.outstanding_list` | bill_ops_outstanding_acl | new_bill_ops_outstanding|new_admin |  |
| `bill_ops.payment_reverse` | bill_ops_payment_acl | new_bill_ops_payment|new_admin |  |
| `bill_ops.payments_search` | bill_ops_payment_acl | new_bill_ops_payment|new_admin |  |
| `bill_ops.receipt_reprint` | bill_ops_payment_acl | new_bill_ops_payment|new_admin |  |
| `bill_ops.visit_charges` | bill_ops_correct_acl | new_bill_ops_correct|new_admin |  |
| `cashier.charges.post` | single_acl | new_cashier |  |
| `cashier.close_zero` | single_acl | new_close_without_charge |  |
| `cashier.mark_unpaid` | single_acl | new_visit_mark_outstanding |  |
| `cashier.pay` | single_acl | new_cashier |  |
| `cashier.queue` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `cashier.resolve_patient` | single_acl | new_cashier |  |
| `cashier.select` | single_acl | new_cashier |  |
| `chart_depth.export_builder` | any_acl | new_chart_depth_export \| new_chart_depth_export_full \| new_admin | yes |
| `chart_depth.export_generate` | any_acl | new_chart_depth_export \| new_chart_depth_export_full \| new_admin | yes |
| `chart_depth.payments_list` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `chart_depth.receipt_reprint` | any_acl | new_receipt_reprint \| new_chart_depth_finance \| new_admin |  |
| `chart_depth.referral_print` | single_acl | new_chart_depth_referral |  |
| `chart_depth.referral_save` | single_acl | new_chart_depth_referral |  |
| `chart_depth.referral_status` | single_acl | new_chart_depth_referral |  |
| `chart_depth.referrals_list` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `chart_depth.visit_charges_summary` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `clinical_doc.catalog` | clinical_doc_read_acl | clinical doc read roles |  |
| `clinical_doc.favorites` | clinical_doc_read_acl | clinical doc read roles |  |
| `clinical_doc.import_ancillary_pack` | single_acl | new_admin |  |
| `clinical_doc.import_ghana_pack` | single_acl | new_admin |  |
| `clinical_doc.import_referral_hospital_pack` | single_acl | new_admin |  |
| `clinical_doc.open_form` | clinical_doc_write_acl | clinical doc write roles |  |
| `clinical_doc.sign_status` | clinical_doc_read_acl | clinical doc read roles |  |
| `clinical_doc.visit_summary` | clinical_doc_read_acl | clinical doc read roles |  |
| `cohort.export` | cohort_export_acl | registry export access |  |
| `cohort.presets` | cohort_acl | registry access (PatientCohortSearchService::assertRegistryAccess) |  |
| `cohort.saved_filter` | cohort_acl | registry access (PatientCohortSearchService::assertRegistryAccess) |  |
| `cohort.search` | cohort_acl | registry access (PatientCohortSearchService::assertRegistryAccess) |  |
| `communications.assign_patient` | core_notes_acl | patients/notes (core) |  |
| `communications.compose_options` | core_notes_acl | patients/notes (core) |  |
| `communications.hub_counts` | core_notes_acl | patients/notes (core) |  |
| `communications.message_delete` | core_notes_acl | patients/notes (core) |  |
| `communications.message_detail` | core_notes_acl | patients/notes (core) |  |
| `communications.message_done` | core_notes_acl | patients/notes (core) |  |
| `communications.message_send` | core_notes_acl | patients/notes (core) |  |
| `communications.message_status` | core_notes_acl | patients/notes (core) |  |
| `communications.messages_list` | core_notes_acl | patients/notes (core) |  |
| `communications.reminder_create` | core_notes_acl | patients/notes (core) |  |
| `communications.reminder_create_options` | core_notes_acl | patients/notes (core) |  |
| `communications.reminder_done` | core_notes_acl | patients/notes (core) |  |
| `communications.reminder_log` | core_notes_acl | patients/notes (core) |  |
| `communications.reminders_list` | core_notes_acl | patients/notes (core) |  |
| `communications.save_preferences` | core_notes_acl | patients/notes (core) |  |
| `desk.shared_session_probe` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `doctor.active` | single_acl | new_doctor |  |
| `doctor.complete` | single_acl | new_doctor |  |
| `doctor.formulary_rx_catalog` | single_acl | new_doctor |  |
| `doctor.formulary_rx_place` | single_acl | new_doctor |  |
| `doctor.lab_panel_catalog` | single_acl | new_doctor |  |
| `doctor.lab_panel_place` | single_acl | new_doctor |  |
| `doctor.queue` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `doctor.reopen` | single_acl | new_visit_reopen | Reason optional/ignored when the actor is the visit's own assigned doctor; required (≥10 chars) only for admin reopening someone else's patient |
| `doctor.restore_session` | single_acl | new_doctor |  |
| `doctor.roster` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `doctor.roster.set_taking` | single_acl | new_doctor |  |
| `doctor.routing.reassign` | any_acl | new_admin \| new_reception |  |
| `doctor.search_providers` | single_acl | new_doctor |  |
| `doctor.set_supervisor` | single_acl | new_doctor |  |
| `doctor.shortcut_preflight` | single_acl | new_doctor |  |
| `doctor.start_walk_in` | single_acl | new_doctor | VIP/walk-in bypass — visit created directly in `with_doctor`, skips Front Desk and Triage entirely |
| `doctor.take` | single_acl | new_doctor |  |
| `encounter_note.get` | encounter_note_acl | encounter note roles |  |
| `encounter_note.prefill` | encounter_note_acl | encounter note roles |  |
| `encounter_note.save` | encounter_note_acl | encounter note roles |  |
| `encounter_note.sign` | encounter_note_acl | encounter note roles |  |
| `encounter_note.unlock` | encounter_note_acl | encounter note roles |  |
| `encounter_note.validate` | encounter_note_acl | encounter note roles |  |
| `front_desk.desk_stats` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `front_desk.flow_charts` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `front_desk.recently_viewed` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `front_desk.recently_viewed.clear` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `front_desk.recently_viewed.remember` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `front_desk.revisit_awaiting_documents` | single_acl | new_reception |  |
| `front_desk.todays_appointments` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `front_desk.upload_referral` | single_acl | new_reception |  |
| `lab.complete` | single_acl | new_lab |  |
| `lab.queue` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `lab.restore_session` | single_acl | new_lab |  |
| `lab.select` | single_acl | new_lab |  |
| `lab.shortcut_preflight` | single_acl | new_lab |  |
| `lab.skip_to_payment` | single_acl | new_visit_skip_queue |  |
| `lab.take` | single_acl | new_lab |  |
| `lab_ops.fee_map_list` | lab_ops_catalog_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.fee_map_save` | lab_ops_catalog_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.mark_send_out` | lab_ops_enter_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.panel_import` | lab_ops_catalog_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.provider_create` | lab_ops_catalog_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.result_get` | lab_ops_read_acl | new_lab_ops|new_lab|new_lab_lead|new_doctor|new_admin |  |
| `lab_ops.result_release` | lab_ops_release_acl | new_lab_ops_release|new_lab_lead|new_admin |  |
| `lab_ops.result_save` | lab_ops_enter_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.sendout_provider_create` | lab_ops_catalog_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.setup_model` | lab_ops_catalog_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.setup_status` | lab_ops_read_acl | new_lab_ops|new_lab|new_lab_lead|new_doctor|new_admin |  |
| `lab_ops.specimen_collect` | lab_ops_enter_acl | new_lab_ops_enter|new_lab|new_lab_lead|new_admin |  |
| `lab_ops.worklist` | lab_ops_read_acl | new_lab_ops|new_lab|new_lab_lead|new_doctor|new_admin |  |
| `mrd.clinical_labs_summary` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `mrd.clinical_meds_summary` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `mrd.clinical_referrals_strip` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `mrd.profile_payments_summary` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.chart.activity_feed` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.chart.clinical` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.chart.messages` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.chart.search` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.chart.visits` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.create` | single_acl | new_reception |  |
| `patients.dup_check` | single_acl | new_reception |  |
| `patients.preview` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.registration.get` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin | yes |
| `patients.search` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin |  |
| `patients.update` | any_acl | new_reception \| new_nurse \| new_doctor \| new_cashier \| new_admin |  |
| `pharm_ops.controlled_catalog` | pharm_ops_catalog_acl | pharm-ops catalog roles |  |
| `pharm_ops.controlled_catalog_save` | pharm_ops_catalog_acl | pharm-ops catalog roles |  |
| `pharm_ops.destroy_confirm` | pharm_ops_destroy_acl | pharm-ops destroy roles |  |
| `pharm_ops.destroy_get` | pharm_ops_destroy_acl | pharm-ops destroy roles |  |
| `pharm_ops.dispense_confirm` | pharm_ops_dispense_acl | pharm-ops dispense roles |  |
| `pharm_ops.dispense_get` | pharm_ops_read_acl | pharm-ops read roles |  |
| `pharm_ops.dispense_label_pdf` | pharm_ops_dispense_label_acl | pharm-ops label roles |  |
| `pharm_ops.formulary_import` | pharm_ops_catalog_acl | pharm-ops catalog roles |  |
| `pharm_ops.otc_drugs_search` | pharm_ops_read_acl | pharm-ops read roles |  |
| `pharm_ops.otc_sale_confirm` | pharm_ops_dispense_acl | pharm-ops dispense roles |  |
| `pharm_ops.otc_sale_get` | pharm_ops_read_acl | pharm-ops read roles |  |
| `pharm_ops.receive_get` | pharm_ops_receive_acl | new_pharm_ops_receive|new_pharmacy_lead|new_admin |  |
| `pharm_ops.receive_save` | pharm_ops_receive_acl | new_pharm_ops_receive|new_pharmacy_lead|new_admin |  |
| `pharm_ops.reports_embed` | pharm_ops_read_acl | pharm-ops read roles |  |
| `pharm_ops.rx_print_pdf` | pharm_ops_rx_print_acl | pharm-ops rx print roles |  |
| `pharm_ops.setup_status` | pharm_ops_read_acl | pharm-ops read roles |  |
| `pharm_ops.warehouse_create` | pharm_ops_catalog_acl | pharm-ops catalog roles |  |
| `pharm_ops.worklist` | pharm_ops_read_acl | pharm-ops read roles |  |
| `pharmacy.complete` | single_acl | new_pharmacy |  |
| `pharmacy.queue` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `pharmacy.restore_session` | single_acl | new_pharmacy |  |
| `pharmacy.select` | single_acl | new_pharmacy |  |
| `pharmacy.shortcut_preflight` | single_acl | new_pharmacy |  |
| `pharmacy.skip_to_payment` | single_acl | new_visit_skip_queue |  |
| `pharmacy.take` | single_acl | new_pharmacy |  |
| `pharmacy.walkin_close` | single_acl | new_pharmacy |  |
| `profile.change_password` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `profile.get` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `profile.update` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `queue.counts` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `queue_bridge.dismiss` | queue_bridge_dismiss_acl | queue bridge dismiss roles |  |
| `queue_bridge.eod_export` | queue_bridge_read_acl | queue bridge read roles |  |
| `queue_bridge.link_appointment` | queue_bridge_resolve_acl | queue bridge resolve roles |  |
| `queue_bridge.list` | queue_bridge_read_acl | queue bridge read roles |  |
| `queue_bridge.resolve` | queue_bridge_resolve_acl | queue bridge resolve roles |  |
| `reports.ancillary` | single_acl | reports |  |
| `reports.ancillary_export` | single_acl | reports |  |
| `reports.catalog` | report_hub_read_acl | report hub read roles |  |
| `reports.daily` | single_acl | reports |  |
| `reports.documentation_integrity` | single_acl | reports |  |
| `reports.documentation_integrity_export` | single_acl | reports |  |
| `reports.export` | report_hub_export_acl | report hub export roles |  |
| `reports.export_download` | report_hub_export_acl | report hub export roles |  |
| `reports.export_run` | report_hub_export_acl | report hub export roles |  |
| `reports.export_status` | report_hub_export_acl | report hub export roles |  |
| `reports.hub_summary` | report_hub_read_acl | report hub read roles |  |
| `reports.reconciliation` | single_acl | reports |  |
| `reports.run` | report_hub_export_acl | report hub export roles |  |
| `reports.scheduling` | single_acl | reports |  |
| `scheduling.calendar.book` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.calendar.move` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.calendar.poll` | scheduling_read_acl | scheduling read roles |  |
| `scheduling.calendar.range` | scheduling_read_acl | scheduling read roles |  |
| `scheduling.calendar.resize` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.flow_board.advance` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.flow_board.lane_map` | scheduling_read_acl | scheduling read roles |  |
| `scheduling.flow_board.lane_map.save` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.flow_board.list` | scheduling_read_acl | scheduling read roles |  |
| `scheduling.flow_board.poll` | scheduling_read_acl | scheduling read roles |  |
| `scheduling.flow_board.prefs` | scheduling_read_acl | scheduling read roles |  |
| `scheduling.flow_board.prefs.save` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.flow_board.room` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.recalls.delete` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.recalls.list` | scheduling_read_acl | scheduling read roles |  |
| `scheduling.recalls.save` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.recalls.send_reminder` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.recalls.snooze` | scheduling_write_acl | scheduling write roles |  |
| `scheduling.recalls.update_status` | scheduling_write_acl | scheduling write roles |  |
| `triage.auto_start` | single_acl | new_nurse |  |
| `triage.queue` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `triage.restore_session` | single_acl | new_nurse |  |
| `triage.save_vitals` | single_acl | new_nurse |  |
| `triage.select` | single_acl | new_nurse |  |
| `triage.send_doctor` | single_acl | new_nurse |  |
| `triage.set_urgent` | single_acl | new_nurse | Nurse-side urgency escalation (never changes state); reason required to de-escalate |
| `triage.start` | single_acl | new_nurse |  |
| `visit.board` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `visit.cancel` | single_acl | new_visit_cancel |  |
| `visit.detail` | desk_acl | any New Clinic desk role (new_reception|nurse|doctor|lab|pharmacy|cashier|admin|reports) |  |
| `visit.hard_assign` | single_acl | new_hard_assign_provider |  |
| `visit.send_back_to_doctor` | single_acl | new_visit_return_to_doctor | Reception Lead or Nurse (any, not lead-only) routes an ancillary-complete visit into the shared `ready_for_doctor` pool (not `with_doctor` directly) — no session lock; original doctor carried as routing suggestion |
| `visit.skip_triage` | single_acl | new_skip_triage |  |
| `visit.start` | single_acl | new_reception |  |
| `visit.start_from_appointment` | single_acl | new_reception |  |
| `visit.types` | any_acl | new_reception \| new_nurse \| new_doctor \| new_lab \| new_pharmacy \| new_cashier \| new_admin |  |
