--
-- New Clinic Module — install SQL (B0 core)
--
-- @package   OpenEMR
-- @link      https://www.open-emr.org
-- @copyright Copyright (c) 2026 OpenEMR contributors
-- @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
--

#IfNotTable new_clinic_config
CREATE TABLE IF NOT EXISTS `new_clinic_config` (
    `facility_id` INT NOT NULL DEFAULT 0,
    `config_key` VARCHAR(64) NOT NULL,
    `config_value` TEXT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`facility_id`, `config_key`)
) ENGINE=InnoDB COMMENT='Per-facility New Clinic configuration';
#EndIf

#IfNotTable new_visit_type
CREATE TABLE IF NOT EXISTS `new_visit_type` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL DEFAULT 0,
    `label` VARCHAR(128) NOT NULL,
    `pc_catid` INT NOT NULL,
    `service_profile` ENUM('full_opd','lab_direct','pharmacy_walkin') NOT NULL DEFAULT 'full_opd',
    `referral_required` TINYINT(1) NOT NULL DEFAULT 0,
    `cashier_fee_hint_ids` JSON NULL,
    `default_fee_schedule_id` INT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    KEY `idx_facility_active` (`facility_id`, `is_active`)
) ENGINE=InnoDB COMMENT='Visit types mapped to calendar categories';
#EndIf

#IfNotTable new_visit
CREATE TABLE IF NOT EXISTS `new_visit` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `pid` BIGINT NOT NULL,
    `encounter` INT NOT NULL,
    `facility_id` INT NOT NULL,
    `visit_date` DATE NOT NULL,
    `visit_type_id` INT NULL,
    `pc_eid` INT UNSIGNED NULL,
    `appt_date` DATE NULL,
    `queue_number` INT UNSIGNED NOT NULL DEFAULT 0,
    `state` VARCHAR(32) NOT NULL DEFAULT 'waiting',
    `chief_complaint` VARCHAR(500) NULL,
    `is_urgent` TINYINT(1) NOT NULL DEFAULT 0,
    `service_profile` ENUM('full_opd','lab_direct','pharmacy_walkin') NOT NULL DEFAULT 'full_opd',
    `referral_document_id` INT NULL,
    `pharmacy_outcome` VARCHAR(64) NULL,
    `referred_to_visit_id` BIGINT NULL,
    `lab_ordered` TINYINT(1) NOT NULL DEFAULT 0,
    `pharmacy_ordered` TINYINT(1) NOT NULL DEFAULT 0,
    `routing_method` VARCHAR(32) NULL,
    `closed_no_charge` TINYINT(1) NOT NULL DEFAULT 0,
    `left_unpaid_at` DATETIME NULL,
    `assigned_provider_id` INT NULL,
    `routing_suggested_provider_id` INT NULL,
    `hard_assigned_provider_id` INT NULL,
    `started_at` DATETIME NULL,
    `completed_at` DATETIME NULL,
    `cancelled_at` DATETIME NULL,
    `cancel_reason` TEXT NULL,
    `created_by` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `row_version` INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    KEY `idx_pid_date` (`pid`, `visit_date`),
    KEY `idx_facility_date_state` (`facility_id`, `visit_date`, `state`),
    KEY `idx_encounter` (`encounter`),
    KEY `idx_queue_sort` (`facility_id`, `visit_date`, `is_urgent`, `queue_number`, `started_at`)
) ENGINE=InnoDB COMMENT='Operational visit queue state';
#EndIf

#IfNotTable new_visit_state_log
CREATE TABLE IF NOT EXISTS `new_visit_state_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `visit_id` BIGINT NOT NULL,
    `from_state` VARCHAR(32) NULL,
    `to_state` VARCHAR(32) NOT NULL,
    `actor_user_id` INT NULL,
    `reason` TEXT NULL,
    `is_reverse` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_visit_id` (`visit_id`)
) ENGINE=InnoDB COMMENT='Visit FSM transition audit log';
#EndIf

#IfNotTable new_visit_queue_counter
CREATE TABLE IF NOT EXISTS `new_visit_queue_counter` (
    `facility_id` INT NOT NULL,
    `counter_date` DATE NOT NULL,
    `last_seq` INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`facility_id`, `counter_date`)
) ENGINE=InnoDB COMMENT='Atomic daily queue number counter';
#EndIf

#IfNotTable new_patient_meta
CREATE TABLE IF NOT EXISTS `new_patient_meta` (
    `pid` BIGINT NOT NULL,
    `dob_estimated` TINYINT(1) NOT NULL DEFAULT 0,
    `no_phone_reason` VARCHAR(64) NULL,
    `preferred_language` VARCHAR(32) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`pid`)
) ENGINE=InnoDB COMMENT='Module-owned patient metadata';
#EndIf

#IfNotTable new_patient_completion
CREATE TABLE IF NOT EXISTS `new_patient_completion` (
    `pid` BIGINT NOT NULL,
    `completion_score` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `missing_fields_json` TEXT NULL,
    `last_recomputed_at` DATETIME NULL,
    `status` ENUM('incomplete','complete') NOT NULL DEFAULT 'incomplete',
    PRIMARY KEY (`pid`)
) ENGINE=InnoDB COMMENT='Cached patient profile completion score';
#EndIf

#IfNotTable new_completion_field_weight
CREATE TABLE IF NOT EXISTS `new_completion_field_weight` (
    `field_key` VARCHAR(64) NOT NULL,
    `level` TINYINT NOT NULL,
    `weight` TINYINT NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`field_key`)
) ENGINE=InnoDB COMMENT='Completion score field weights';
#EndIf

#IfNotTable new_fee_schedule
CREATE TABLE IF NOT EXISTS `new_fee_schedule` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL DEFAULT 0,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `category` VARCHAR(64) NULL,
    `price_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `code_type` VARCHAR(32) NOT NULL,
    `billing_code` VARCHAR(32) NOT NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_facility_active` (`facility_id`, `is_active`)
) ENGINE=InnoDB COMMENT='Cash fee schedule for M5/M6';
#EndIf

#IfNotTable new_receipt_counter
CREATE TABLE IF NOT EXISTS `new_receipt_counter` (
    `facility_id` INT NOT NULL,
    `counter_date` DATE NOT NULL,
    `last_seq` INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`facility_id`, `counter_date`)
) ENGINE=InnoDB COMMENT='Daily receipt sequence counter (M5.3)';
#EndIf

#IfNotTable new_receipt
CREATE TABLE IF NOT EXISTS `new_receipt` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL,
    `receipt_number` VARCHAR(32) NOT NULL,
    `visit_id` BIGINT NOT NULL,
    `pid` BIGINT NOT NULL,
    `encounter` INT NOT NULL,
    `amount_paid` DECIMAL(12,2) NOT NULL,
    `change_due` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `receipt_note` VARCHAR(255) NULL,
    `actor_user_id` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_facility_receipt` (`facility_id`, `receipt_number`),
    KEY `idx_visit` (`visit_id`)
) ENGINE=InnoDB COMMENT='Cashier receipt log (M5.3)';
#EndIf

#IfNotTable new_cashier_payment_request
CREATE TABLE IF NOT EXISTS `new_cashier_payment_request` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `client_request_id` VARCHAR(64) NOT NULL,
    `visit_id` BIGINT NOT NULL,
    `actor_user_id` INT NOT NULL,
    `response_json` TEXT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_client_request` (`client_request_id`)
) ENGINE=InnoDB COMMENT='Payment idempotency keys (M5-F06b)';
#EndIf

#IfNotRow2D new_visit_type facility_id 0 label General OPD
INSERT INTO `new_visit_type` (`facility_id`, `label`, `pc_catid`, `service_profile`, `is_active`)
VALUES (0, 'General OPD', 5, 'full_opd', 1);
#EndIf

#IfNotRow2D new_fee_schedule facility_id 0 code OPD_CONSULT
INSERT INTO `new_fee_schedule`
    (`facility_id`, `code`, `name`, `category`, `price_amount`, `code_type`, `billing_code`, `sort_order`, `is_active`)
VALUES
    (0, 'OPD_CONSULT', 'OPD consultation', 'consult', 50.00, 'CPT4', 'OPD_CONSULT', 10, 1);
#EndIf

#IfRow2D new_fee_schedule facility_id 0 code OPD_CONSULT
UPDATE `new_visit_type`
SET `cashier_fee_hint_ids` = (
    SELECT CONCAT('[', MIN(fs.id), ']')
    FROM `new_fee_schedule` fs
    WHERE fs.facility_id = 0 AND fs.code = 'OPD_CONSULT' AND fs.is_active = 1
)
WHERE `facility_id` = 0 AND `label` = 'General OPD'
AND (`cashier_fee_hint_ids` IS NULL OR `cashier_fee_hint_ids` = '[]');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key registration_mode
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'registration_mode', 'desk_full_form'),
(0, 'completion_required_for_billing', '70'),
(0, 'enforce_completion_on_revisit', '1'),
(0, 'enforce_completion_on_rx', '0'),
(0, 'allow_billing_completion_override', '1'),
(0, 'pediatric_exact_dob_age', '5'),
(0, 'dup_block_threshold', '17'),
(0, 'dup_warn_threshold', '10'),
(0, 'enable_lab_role', '0'),
(0, 'enable_pharmacy_role', '0'),
(0, 'enable_lab_ops', '0'),
(0, 'enable_lab_panel_order', '0'),
(0, 'enable_pharm_ops', '0'),
(0, 'enable_triage', '1'),
(0, 'country_code', '233'),
(0, 'currency_code', 'GHS'),
(0, 'currency_symbol', 'GH₵'),
(0, 'currency_decimals', '2'),
(0, 'currency_symbol_position', 'before'),
(0, 'allow_multiple_visits_per_day', '1'),
(0, 'enable_multi_doctor_filters', '0'),
(0, 'enable_aggressive_orphan_facility_repair', '0'),
(0, 'auto_dismiss_product_registration', '1'),
(0, 'enable_chart_depth', '0'),
(0, 'enable_chart_depth_finance', '0'),
(0, 'enable_chart_depth_referral', '0'),
(0, 'enable_chart_depth_export', '0'),
(0, 'communications_hub_enable', '0'),
(0, 'enable_patient_registry', '0'),
(0, 'require_esign_before_complete_consult', '0'),
(0, 'doctor_desk_default_filter', 'all'),
(0, 'rate_limit_patients_search', '30'),
(0, 'rate_limit_dup_check', '60'),
(0, 'enable_scheduled_integration', '1'),
(0, 'enable_legacy_patient_context_overlay', '0'),
(0, 'enable_legacy_strip_clinical_chips', '0'),
(0, 'enable_legacy_strip_desk_return', '1'),
(0, 'enable_shared_device_session_warning', '0'),
(0, 'module_enabled', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key default_visit_type_id
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`)
SELECT 0, 'default_visit_type_id', CAST(id AS CHAR)
FROM `new_visit_type`
WHERE `facility_id` = 0 AND `label` = 'General OPD' AND `is_active` = 1
LIMIT 1;
#EndIf

#IfMissingColumn patient_data phone_normalized
ALTER TABLE `patient_data` ADD COLUMN `phone_normalized` VARCHAR(20) NULL;
#EndIf

#IfNotIndex patient_data new_idx_pd_lname
CREATE INDEX `new_idx_pd_lname` ON `patient_data` (`lname`);
#EndIf

#IfNotIndex patient_data new_idx_pd_fname
CREATE INDEX `new_idx_pd_fname` ON `patient_data` (`fname`);
#EndIf

#IfNotIndex patient_data new_idx_pd_phone_norm
CREATE INDEX `new_idx_pd_phone_norm` ON `patient_data` (`phone_normalized`);
#EndIf

#IfNotIndex patient_data new_idx_pd_pubpid
CREATE INDEX `new_idx_pd_pubpid` ON `patient_data` (`pubpid`);
#EndIf

#IfNotIndex patient_data new_idx_pd_dob
CREATE INDEX `new_idx_pd_dob` ON `patient_data` (`DOB`);
#EndIf

#IfNotIndex new_visit idx_facility_state_active
CREATE INDEX `idx_facility_state_active` ON `new_visit` (`facility_id`, `state`);
#EndIf

#IfNotIndex new_visit idx_queue_sort_stateless
CREATE INDEX `idx_queue_sort_stateless` ON `new_visit` (`facility_id`, `is_urgent`, `visit_date`, `queue_number`, `started_at`);
#EndIf

#IfNotRow2D new_completion_field_weight field_key fname level 1
INSERT INTO `new_completion_field_weight` (`field_key`, `level`, `weight`, `is_active`) VALUES
('fname', 1, 15, 1),
('lname', 1, 15, 1),
('DOB', 1, 20, 1),
('sex', 1, 10, 1),
('phone_cell', 1, 15, 1),
('street', 2, 10, 1),
('city', 2, 5, 1),
('state', 2, 5, 1),
('email', 3, 5, 1);
#EndIf

#IfNotRow2D new_completion_field_weight field_key allergies_documented
INSERT INTO `new_completion_field_weight` (`field_key`, `level`, `weight`, `is_active`) VALUES
('allergies_documented', 2, 15, 1);
#EndIf

#IfMissingColumn new_patient_meta region_code
ALTER TABLE `new_patient_meta`
    ADD COLUMN `region_code` VARCHAR(16) NULL,
    ADD COLUMN `region_label` VARCHAR(128) NULL,
    ADD COLUMN `district_code` VARCHAR(16) NULL,
    ADD COLUMN `district_label` VARCHAR(128) NULL,
    ADD COLUMN `landmark` VARCHAR(255) NULL,
    ADD COLUMN `emergency_contact_name` VARCHAR(128) NULL,
    ADD COLUMN `emergency_contact_phone` VARCHAR(32) NULL,
    ADD COLUMN `blood_group` VARCHAR(16) NULL,
    ADD COLUMN `disability_flag` TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN `pregnancy_status` VARCHAR(32) NULL,
    ADD COLUMN `insurance_type` ENUM('cash','nhis','private') NOT NULL DEFAULT 'cash',
    ADD COLUMN `nhis_number` VARCHAR(64) NULL,
    ADD COLUMN `nhis_expiry` DATE NULL,
    ADD COLUMN `private_insurer` VARCHAR(128) NULL,
    ADD COLUMN `private_policy` VARCHAR(64) NULL;
#EndIf

#IfMissingColumn new_patient_meta nationality
ALTER TABLE `new_patient_meta`
    ADD COLUMN `nationality` VARCHAR(64) NULL,
    ADD COLUMN `place_of_birth` VARCHAR(128) NULL,
    ADD COLUMN `tribe` VARCHAR(64) NULL,
    ADD COLUMN `religion` VARCHAR(64) NULL,
    ADD COLUMN `race` VARCHAR(64) NULL,
    ADD COLUMN `education_level` VARCHAR(64) NULL,
    ADD COLUMN `occupation` VARCHAR(128) NULL;
#EndIf

#IfNotRow2D new_completion_field_weight field_key mname
INSERT INTO `new_completion_field_weight` (`field_key`, `level`, `weight`, `is_active`) VALUES
('mname', 1, 5, 1),
('national_id', 2, 8, 1),
('region_code', 2, 3, 1),
('district_code', 2, 2, 1),
('landmark', 2, 2, 1),
('emergency_contact', 2, 5, 1),
('nhis_number', 4, 5, 1);
#EndIf

#IfMissingColumn new_patient_meta reach_contact_name
ALTER TABLE `new_patient_meta`
    ADD COLUMN `reach_contact_name` VARCHAR(128) NULL,
    ADD COLUMN `reach_contact_phone` VARCHAR(32) NULL,
    ADD COLUMN `reach_contact_relationship` VARCHAR(32) NULL;
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key phone_validation_regex
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'phone_validation_regex', '^0[235]\\d{8}$');
#EndIf

#IfRow2D new_clinic_config facility_id 0 config_key registration_mode
UPDATE `new_clinic_config`
SET `config_value` = 'desk_full_form'
WHERE `facility_id` = 0 AND `config_key` = 'registration_mode' AND `config_value` = 'progressive';
#EndIf

#IfRow2D new_completion_field_weight field_key city level 2
UPDATE `new_completion_field_weight` SET `is_active` = 0 WHERE `field_key` IN ('city', 'state');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_chart_depth
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_chart_depth', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_chart_depth_finance
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_chart_depth_finance', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_chart_depth_referral
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_chart_depth_referral', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_lab_ops
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_lab_ops', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_lab_panel_order
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_lab_panel_order', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_pharm_ops
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_pharm_ops', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_chart_depth_export
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_chart_depth_export', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key communications_hub_enable
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'communications_hub_enable', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_patient_registry
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_patient_registry', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_scheduled_integration
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_scheduled_integration', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_legacy_patient_context_overlay
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_legacy_patient_context_overlay', '0'),
(0, 'enable_legacy_strip_clinical_chips', '0'),
(0, 'enable_legacy_strip_desk_return', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_visit_board
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_visit_board', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_triage_desk
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_triage_desk', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_doctor_desk
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_doctor_desk', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_cashier_desk
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_cashier_desk', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_lab_desk
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_lab_desk', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_pharmacy_desk
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_pharmacy_desk', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_front_desk
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_front_desk', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_patient_registry
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_patient_registry', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_daily_reports
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_daily_reports', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_communications_hub
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_communications_hub', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_admin_hub
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_admin_hub', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_patient_chart
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_patient_chart', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_lab_ops
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_lab_ops', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_pharm_ops
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_pharm_ops', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_react_chart_depth
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_react_chart_depth', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_bill_ops
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_bill_ops', '0'),
(0, 'enable_bill_ops_outstanding', '0'),
(0, 'bill_ops_reopen_on_correction', '0'),
(0, 'enable_react_bill_ops', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_report_hub
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_report_hub', '0'),
(0, 'report_hub_show_us_quality', '0'),
(0, 'report_hub_async_export_threshold', '5000'),
(0, 'enable_react_report_hub', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_queue_bridge
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_queue_bridge', '0'),
(0, 'queue_bridge_show_recurring_info', '1'),
(0, 'queue_bridge_eod_block', '0'),
(0, 'enable_react_queue_bridge', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_scheduling_redesign
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_scheduling_redesign', '0'),
(0, 'enable_react_scheduling', '1');
#EndIf

#IfNotTable queue_bridge_exception_snapshot
CREATE TABLE IF NOT EXISTS `queue_bridge_exception_snapshot` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL,
    `snapshot_date` DATE NOT NULL,
    `exception_code` VARCHAR(16) NOT NULL,
    `pid` BIGINT NOT NULL,
    `pc_eid` INT NULL,
    `visit_id` BIGINT NULL,
    `severity` ENUM('action','info','resolved') NOT NULL,
    `detected_at` DATETIME NOT NULL,
    `resolved_at` DATETIME NULL,
    `resolved_by` BIGINT NULL,
    `resolve_action` VARCHAR(64) NULL,
    `dismiss_reason` TEXT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_facility_date` (`facility_id`, `snapshot_date`),
    KEY `idx_pid_date` (`pid`, `snapshot_date`)
) ENGINE=InnoDB COMMENT='M18 queue bridge exception snapshots';
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_insurance
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_insurance', '0');
#EndIf

#IfMissingColumn new_receipt reversed_at
ALTER TABLE `new_receipt` ADD COLUMN `reversed_at` DATETIME NULL AFTER `created_at`;
#EndIf

#IfMissingColumn new_receipt reversal_reason
ALTER TABLE `new_receipt` ADD COLUMN `reversal_reason` VARCHAR(255) NULL AFTER `reversed_at`;
#EndIf

#IfMissingColumn new_receipt reversal_actor_user_id
ALTER TABLE `new_receipt` ADD COLUMN `reversal_actor_user_id` INT NULL AFTER `reversal_reason`;
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_shared_device_session_warning
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_shared_device_session_warning', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_faster_queue_interrupts
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_faster_queue_interrupts', '0'),
(0, 'faster_queue_interrupt_poll_seconds', '10'),
(0, 'enable_similar_surname_queue_warning', '0'),
(0, 'enable_momo_payment', '0'),
(0, 'enable_pinned_reception_preview', '0'),
(0, 'enable_pregnancy_banner_chip', '0'),
(0, 'enable_l3b_background_completion', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_lab_results_toast
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_lab_results_toast', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_visit_board_kiosk_chrome
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_visit_board_kiosk_chrome', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_banner_mrd_deep_links
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_banner_mrd_deep_links', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_allergy_count_chip
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_allergy_count_chip', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key require_allergies_for_rx
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'require_allergies_for_rx', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_in_chart_patient_search
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_in_chart_patient_search', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_scheduling_full_analytics
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_scheduling_full_analytics', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_history_editor_wrap
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_history_editor_wrap', '0');
#EndIf

#IfNotRow2D new_completion_field_weight field_key background_history_documented
INSERT INTO `new_completion_field_weight` (`field_key`, `level`, `weight`, `is_active`) VALUES
('background_history_documented', 3, 5, 0);
#EndIf

#IfNotTable new_condition_map
CREATE TABLE IF NOT EXISTS `new_condition_map` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `condition_key` VARCHAR(64) NOT NULL,
    `display_name` VARCHAR(128) NOT NULL,
    `icd10_patterns` VARCHAR(255) NOT NULL COMMENT 'Comma-separated ICD10 prefixes e.g. B50,B51',
    `title_patterns` VARCHAR(255) NULL COMMENT 'Comma-separated LIKE terms e.g. malaria',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_condition_key` (`condition_key`)
) ENGINE=InnoDB COMMENT='Patient Registry friendly condition map (M10 PR-2)';
#EndIf

#IfNotRow2D new_condition_map condition_key malaria
INSERT INTO `new_condition_map` (`condition_key`, `display_name`, `icd10_patterns`, `title_patterns`) VALUES
('malaria', 'Malaria', 'B50,B51,B52,B53,B54', 'malaria'),
('hypertension', 'Hypertension', 'I10,I11,I12,I13,I15', 'hypertension,high blood pressure'),
('diabetes', 'Diabetes', 'E10,E11,E13,E14', 'diabetes,diabetic'),
('pregnancy', 'Pregnancy', 'O00,O01,O02,O03,O04,O08,O09,O20,O21,O22,O23,O24,O25,O26,O28,O29,O30,O31,O32,O33,O34,O35,O36,O40,O41,O42,O43,O44,O45,O46,O47,O48,O80,O81,O82,O83,O84,O85,O86,O87,O88,O89,O90,O91,O92,O94,O95,O96,O97,O98,O99,Z33,Z34,Z35,Z36,Z37,Z39', 'pregnant,pregnancy');
#EndIf

#IfNotTable new_cohort_saved_filter
CREATE TABLE IF NOT EXISTS `new_cohort_saved_filter` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `filter_json` JSON NOT NULL,
    `is_shared` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_shared` (`user_id`, `is_shared`)
) ENGINE=InnoDB COMMENT='Patient Registry saved cohort filters (M10 PR-3)';
#EndIf

#IfNotTable new_doctor_availability
CREATE TABLE IF NOT EXISTS `new_doctor_availability` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `facility_id` INT NOT NULL DEFAULT 0,
    `taking_patients` TINYINT(1) NOT NULL DEFAULT 1,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_facility` (`user_id`, `facility_id`)
) ENGINE=InnoDB COMMENT='V1.1-RTa doctor on-duty roster';
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_doctor_roster
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_doctor_roster', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_advisory_routing
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_advisory_routing', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key routing_weight_active
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'routing_weight_active', '2.0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key routing_weight_waiting_assigned
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'routing_weight_waiting_assigned', '1.0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key routing_weight_waiting_unassigned
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'routing_weight_waiting_unassigned', '0.5');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key routing_fairness_minutes_per_point
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'routing_fairness_minutes_per_point', '15');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key routing_continuity_days
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'routing_continuity_days', '90');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key require_override_reason
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'require_override_reason', '0');
#EndIf

#IfNotTable new_visit_notify_log
CREATE TABLE IF NOT EXISTS `new_visit_notify_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `visit_id` BIGINT NOT NULL,
    `recipient_user_id` BIGINT NOT NULL,
    `channel` VARCHAR(16) NOT NULL,
    `notified_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_visit_recipient` (`visit_id`, `recipient_user_id`),
    KEY `idx_recipient` (`recipient_user_id`)
) ENGINE=InnoDB COMMENT='V1.2 doctor-ready notify debounce (§6.5.4)';
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_hard_provider_assignment
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_hard_provider_assignment', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_doctor_ready_notify
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_doctor_ready_notify', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key notify_unassigned_to_all_on_duty
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'notify_unassigned_to_all_on_duty', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_doctor_ready_web_push
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_doctor_ready_web_push', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key lab_inhouse_provider_id
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'lab_inhouse_provider_id', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key lab_setup_model
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'lab_setup_model', 'in_house');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key lab_sendout_provider_id
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'lab_sendout_provider_id', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key lab_auto_bill_on_order
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'lab_auto_bill_on_order', '1');
#EndIf

#IfNotTable new_lab_order_meta
CREATE TABLE IF NOT EXISTS `new_lab_order_meta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `procedure_order_id` BIGINT NOT NULL,
    `visit_id` BIGINT NULL,
    `pid` BIGINT NOT NULL,
    `fulfillment` ENUM('in_house','send_out') NOT NULL DEFAULT 'in_house',
    `accession_no` VARCHAR(32) NULL,
    `collected_at` DATETIME NULL,
    `collected_by` BIGINT NULL,
    `requisition_printed_at` DATETIME NULL,
    `document_id` INT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_procedure_order` (`procedure_order_id`),
    KEY `idx_pid` (`pid`),
    KEY `idx_visit` (`visit_id`)
) ENGINE=InnoDB COMMENT='Lab Operations metadata per procedure order (M12)';
#EndIf

#IfMissingColumn new_receipt posted_payment_id
ALTER TABLE `new_receipt` ADD COLUMN `posted_payment_id` BIGINT NULL AFTER `actor_user_id`;
#EndIf

#IfNotIndex new_receipt idx_receipt_facility_date
CREATE INDEX `idx_receipt_facility_date` ON `new_receipt` (`facility_id`, `created_at`);
#EndIf

#IfNotTable new_reconciliation_run
CREATE TABLE IF NOT EXISTS `new_reconciliation_run` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL,
    `run_date` DATE NOT NULL,
    `trigger` ENUM('scheduled','manual') NOT NULL DEFAULT 'scheduled',
    `module_total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `core_total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `delta_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `status` ENUM('ok','warning','error') NOT NULL DEFAULT 'ok',
    `error_message` TEXT NULL,
    `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME NULL,
    `actor_user_id` INT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_facility_run_date` (`facility_id`, `run_date`)
) ENGINE=InnoDB COMMENT='Daily cashier reconciliation runs (M7-F10, §16.2)';
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key print_queue_slip_on_start_visit
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'print_queue_slip_on_start_visit', '1'),
(0, 'print_queue_number_on_receipt', '1'),
(0, 'queue_slip_instruction_text', 'Please wait to be called'),
(0, 'reconciliation_cron_time', '23:55'),
(0, 'reconciliation_tolerance', '0.01'),
(0, 'reconciliation_enabled', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key react_migration_cutover_v1
UPDATE `new_clinic_config`
SET `config_value` = '1'
WHERE `config_key` IN (
    'enable_react_visit_board',
    'enable_react_triage_desk',
    'enable_react_doctor_desk',
    'enable_react_cashier_desk',
    'enable_react_lab_desk',
    'enable_react_pharmacy_desk',
    'enable_react_front_desk',
    'enable_react_patient_registry',
    'enable_react_daily_reports',
    'enable_react_communications_hub',
    'enable_react_admin_hub',
    'enable_react_patient_chart',
    'enable_react_lab_ops',
    'enable_react_pharm_ops',
    'enable_react_chart_depth',
    'enable_react_bill_ops',
    'enable_react_report_hub'
) AND `config_value` = '0';
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'react_migration_cutover_v1', '1');
#EndIf

#IfNotTable new_config_log
CREATE TABLE IF NOT EXISTS `new_config_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `config_scope` VARCHAR(32) NOT NULL DEFAULT 'openemr_global',
    `config_key` VARCHAR(128) NOT NULL,
    `prev_value` TEXT NULL,
    `new_value` TEXT NULL,
    `actor_user_id` INT NULL,
    `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_config_key_applied` (`config_key`, `applied_at`)
) ENGINE=InnoDB COMMENT='Audit log for cash clinic profile and config changes (M6-F07)';
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key clinic_tz
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'clinic_tz', 'Africa/Accra');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_rx_print
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_rx_print', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_dispense_label
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_dispense_label', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_pharm_rx_favorites
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_pharm_rx_favorites', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key pharm_expiry_warn_days
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'pharm_expiry_warn_days', '90');
#EndIf

#IfNotTable new_drug_meta
CREATE TABLE IF NOT EXISTS `new_drug_meta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `drug_id` INT NOT NULL,
    `fda_reg_no` VARCHAR(32) NULL,
    `eml_code` VARCHAR(16) NULL,
    `local_brand_name` VARCHAR(128) NULL,
    `is_controlled` TINYINT(1) NOT NULL DEFAULT 0,
    `controlled_schedule_code` VARCHAR(32) NULL COMMENT 'National schedule placeholder (O-PHARM-5)',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_drug` (`drug_id`),
    KEY `idx_controlled` (`is_controlled`)
) ENGINE=InnoDB COMMENT='Optional drug metadata for M13 pharmacy ops (PRD §12.1)';
#EndIf

#IfNotTable report_hub_export_run
CREATE TABLE IF NOT EXISTS `report_hub_export_run` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL,
    `report_key` VARCHAR(64) NOT NULL,
    `date_from` DATE NULL,
    `date_to` DATE NULL,
    `row_count` INT NULL,
    `file_path` VARCHAR(512) NULL,
    `status` ENUM('ok','failed','running') NOT NULL,
    `actor_user_id` BIGINT NOT NULL,
    `started_at` DATETIME NOT NULL,
    `finished_at` DATETIME NULL,
    `message` TEXT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_facility_started` (`facility_id`, `started_at`),
    KEY `idx_report_key` (`report_key`)
) ENGINE=InnoDB COMMENT='M16 export audit (V1.1-REP)';
#EndIf

#IfNotTable clinical_doc_form_open
CREATE TABLE IF NOT EXISTS `clinical_doc_form_open` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL,
    `visit_id` BIGINT NOT NULL,
    `encounter` INT NOT NULL,
    `formdir` VARCHAR(64) NOT NULL,
    `form_id` INT NULL,
    `actor_user_id` BIGINT NOT NULL,
    `opened_at` DATETIME NOT NULL,
    `action` ENUM('open','save','sign') NOT NULL DEFAULT 'open',
    PRIMARY KEY (`id`),
    KEY `idx_visit_opened` (`visit_id`, `opened_at`),
    KEY `idx_facility_opened` (`facility_id`, `opened_at`)
) ENGINE=InnoDB COMMENT='M17 clinical documentation form open audit (V1.1-DOC)';
#EndIf

#IfNotTable admin_hub_backup_run
CREATE TABLE IF NOT EXISTS `admin_hub_backup_run` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `facility_id` INT NOT NULL,
    `started_at` DATETIME NOT NULL,
    `finished_at` DATETIME NULL,
    `status` ENUM('ok','failed','running') NOT NULL,
    `file_path` VARCHAR(512) NULL,
    `actor_id` BIGINT NULL,
    `message` TEXT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_facility_started` (`facility_id`, `started_at`)
) ENGINE=InnoDB COMMENT='M15 admin hub manual backup runs (V1.1-ADMIN)';
#EndIf

#IfNotTable admin_hub_setup_progress
CREATE TABLE IF NOT EXISTS `admin_hub_setup_progress` (
    `facility_id` INT NOT NULL,
    `checklist_key` VARCHAR(64) NOT NULL,
    `completed_at` DATETIME NULL,
    `completed_by` BIGINT NULL,
    PRIMARY KEY (`facility_id`, `checklist_key`)
) ENGINE=InnoDB COMMENT='M15 setup wizard progress (V1.1-ADMIN)';
#EndIf

#IfIndex medex_recalls r_PRACTID
ALTER TABLE `medex_recalls` DROP INDEX `r_PRACTID`;
#EndIf

#IfNotIndex medex_recalls idx_medex_recalls_pid
ALTER TABLE `medex_recalls` ADD INDEX `idx_medex_recalls_pid` (`r_pid`);
#EndIf

#IfNotTable new_clinic_flowboard_lane_prefs
CREATE TABLE IF NOT EXISTS `new_clinic_flowboard_lane_prefs` (
    `user_id` INT NOT NULL,
    `collapsed_json` TEXT NOT NULL,
    `order_json` TEXT NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`)
) ENGINE=InnoDB COMMENT='S1 Flow Board lane collapse/order per user (§10.3)';
#EndIf

#IfNotTable new_clinic_flowboard_lane_map
CREATE TABLE IF NOT EXISTS `new_clinic_flowboard_lane_map` (
    `facility_id` INT NOT NULL,
    `apptstat_code` VARCHAR(31) NOT NULL,
    `lane_key` VARCHAR(32) NOT NULL,
    `lane_label` VARCHAR(64) NOT NULL DEFAULT '',
    `lane_seq` INT NOT NULL DEFAULT 0,
    `status_seq` INT NOT NULL DEFAULT 0,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`facility_id`, `apptstat_code`),
    KEY `idx_lane_key` (`facility_id`, `lane_key`, `lane_seq`)
) ENGINE=InnoDB COMMENT='S1 admin apptstat → flow board lane mapping (§10.3)';
#EndIf

#IfMissingColumn new_clinic_recall_meta recall_type
ALTER TABLE `new_clinic_recall_meta` ADD COLUMN `recall_type` VARCHAR(32) NOT NULL DEFAULT 'general' AFTER `status`;
#EndIf

#IfNotTable new_clinic_recall_meta
CREATE TABLE IF NOT EXISTS `new_clinic_recall_meta` (
    `recall_id` INT NOT NULL COMMENT 'medex_recalls.r_ID',
    `status` VARCHAR(32) NOT NULL DEFAULT 'open',
    `produced_eid` INT UNSIGNED NULL,
    `outcome_note` TEXT NULL,
    `updated_by` INT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`recall_id`),
    KEY `idx_status` (`status`),
    KEY `idx_produced_eid` (`produced_eid`)
) ENGINE=InnoDB COMMENT='S1 recall status and loop link (H1-safe extension)';
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_admin_hub
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_admin_hub', '0'),
(0, 'admin_hub_backup_retention_days', '30'),
(0, 'admin_hub_setup_complete', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_clinical_doc_hub
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_clinical_doc_hub', '0'),
(0, 'clinical_doc_bundle', 'ghana_opd_v1'),
(0, 'clinical_doc_show_screening', '0'),
(0, 'clinical_doc_show_specialty', '0'),
(0, 'clinical_doc_show_us_quality', '0'),
(0, 'clinical_doc_specialty_pack', '[]'),
(0, 'consult_note_formdir', 'soap'),
(0, 'enable_react_clinical_doc_hub', '1');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_ancillary_services
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_ancillary_services', '0'),
(0, 'ancillary_refer_window_hours', '4'),
(0, 'lab_intake_formdir', 'lab_intake'),
(0, 'pharmacy_service_formdir', 'pharmacy_service'),
(0, 'pharmacy_refer_to_opd_terminal_state', 'cancelled'),
(0, 'pharmacy_declined_terminal_state', 'cancelled');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key external_rx_max_age_days
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'external_rx_max_age_days', '730');
#EndIf

UPDATE `new_clinic_config`
SET `config_value` = 'ghana_opd_v1'
WHERE `config_key` = 'clinical_doc_bundle'
  AND `config_value` <> 'ghana_opd_v1';
