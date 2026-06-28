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

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_shared_device_session_warning
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_shared_device_session_warning', '0');
#EndIf

#IfNotRow2D new_clinic_config facility_id 0 config_key enable_faster_queue_interrupts
INSERT INTO `new_clinic_config` (`facility_id`, `config_key`, `config_value`) VALUES
(0, 'enable_faster_queue_interrupts', '0'),
(0, 'faster_queue_interrupt_poll_seconds', '10'),
(0, 'enable_similar_surname_queue_warning', '0'),
(0, 'enable_pinned_reception_preview', '0');
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
