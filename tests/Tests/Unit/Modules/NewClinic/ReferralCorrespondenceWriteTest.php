<?php

/**
 * Integration tests for the referral wizard write paths (M11-F03 / AUDIT batch)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Tests\Unit\Modules\NewClinic;

require_once __DIR__ . '/ModuleAutoload.php';

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Modules\NewClinic\Services\ReferralCorrespondenceService;
use OpenEMR\Services\PatientService;
use PHPUnit\Framework\TestCase;

class ReferralCorrespondenceWriteTest extends TestCase
{
    public function testStatusModelMatchesSpec(): void
    {
        $this->assertSame(
            ['draft', 'printed', 'given', 'result_received'],
            ReferralCorrespondenceService::REFERRAL_STATUSES
        );
    }

    public function testUnauthorizedContextCannotSaveReferral(): void
    {
        $savedUser = $_SESSION['authUser'] ?? null;
        unset($_SESSION['authUser']);

        try {
            $this->expectException(\RuntimeException::class);
            (new ReferralCorrespondenceService())->saveReferral([
                'pid' => 1,
                'destination_facility' => 'X',
                'summary' => 'Y',
            ], 1);
        } finally {
            if ($savedUser !== null) {
                $_SESSION['authUser'] = $savedUser;
            }
        }
    }

    public function testWizardLifecycleWritesStockTablesAndMeta(): void
    {
        $service = $this->serviceWithOpenGates();

        $created = (new PatientService())->insert([
            'fname' => 'ReferralTest',
            'lname' => 'Fixture' . substr(uniqid(), -6),
            'sex' => 'Male',
            'DOB' => '1985-05-05',
        ]);
        $pid = (int) ($created->getData()[0]['pid'] ?? 0);
        if ($pid <= 0) {
            $this->markTestSkipped('Could not create patient fixture');
        }

        $transactionId = 0;
        try {
            $saved = $service->saveReferral([
                'pid' => $pid,
                'destination_facility' => 'Regional Teaching Hospital',
                'destination_department' => 'Cardiology',
                'chief_complaint' => 'Chest pain',
                'diagnosis' => 'Suspected angina',
                'summary' => 'Please review — abnormal ECG at OPD.',
            ], 42);

            $transactionId = (int) $saved['transaction_id'];
            $this->assertGreaterThan(0, $transactionId);
            $this->assertSame('draft', $saved['status']);
            $this->assertStringContainsString('print_referral.php', (string) $saved['print_url']);

            $lbt = QueryUtils::fetchRecords(
                'SELECT field_id, field_value FROM lbt_data WHERE form_id = ?',
                [$transactionId]
            ) ?: [];
            $fields = array_column($lbt, 'field_value', 'field_id');
            $this->assertSame('Regional Teaching Hospital — Cardiology', $fields['refer_to'] ?? null);
            $this->assertStringContainsString('Suspected angina', (string) ($fields['body'] ?? ''));

            $printed = $service->printReferral($transactionId, 42);
            $this->assertSame('printed', $printed['status']);

            $given = $service->updateReferralStatus($transactionId, 'given', null, 42);
            $this->assertSame('given', $given['status']);

            $meta = QueryUtils::querySingleRow(
                'SELECT status FROM new_referral_meta WHERE transaction_id = ?',
                [$transactionId]
            );
            $this->assertSame('given', $meta['status'] ?? null);

            $this->expectException(\InvalidArgumentException::class);
            $service->updateReferralStatus($transactionId, 'not_a_status', null, 42);
        } finally {
            if ($transactionId > 0) {
                QueryUtils::sqlStatementThrowException('DELETE FROM new_referral_meta WHERE transaction_id = ?', [$transactionId]);
                QueryUtils::sqlStatementThrowException('DELETE FROM lbt_data WHERE form_id = ?', [$transactionId]);
                QueryUtils::sqlStatementThrowException('DELETE FROM transactions WHERE id = ?', [$transactionId]);
            }
            QueryUtils::sqlStatementThrowException('DELETE FROM patient_data WHERE pid = ?', [$pid]);
        }
    }

    public function testSaveReferralRejectsEncounterOfAnotherPatient(): void
    {
        // D-REF-9 / G12 — encounter_id must belong to the referral's pid.
        $service = $this->serviceWithOpenGates();

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Encounter does not belong');
        $service->saveReferral([
            'pid' => 1,
            'encounter_id' => 999999903,
            'destination_facility' => 'X',
            'summary' => 'Y',
        ], 1);
    }

    public function testReferralIssuedChipDetectsOutboundReferralByEncounter(): void
    {
        // REF-4 / D34 — chip keyed on new_referral_meta.encounter_id.
        $context = new class extends \OpenEMR\Modules\NewClinic\Services\PatientContextService {
            public function exposeHasOutboundReferral(?array $activeVisit): bool
            {
                return $this->encounterHasOutboundReferral($activeVisit);
            }
        };

        $this->assertFalse($context->exposeHasOutboundReferral(null));
        $this->assertFalse($context->exposeHasOutboundReferral(['encounter_id' => 0]));

        QueryUtils::sqlStatementThrowException(
            "INSERT INTO new_referral_meta (transaction_id, pid, encounter_id, status)
             VALUES (999999901, 1, 999999901, 'printed')",
            []
        );
        try {
            $this->assertTrue($context->exposeHasOutboundReferral(['encounter_id' => 999999901]));
            $this->assertFalse($context->exposeHasOutboundReferral(['encounter_id' => 999999902]));
        } finally {
            QueryUtils::sqlStatementThrowException(
                'DELETE FROM new_referral_meta WHERE transaction_id = 999999901',
                []
            );
        }
    }

    private function serviceWithOpenGates(): ReferralCorrespondenceService
    {
        return new class extends ReferralCorrespondenceService {
            protected function assertReferralEnabled(): void
            {
                // Config gate bypassed for behavioral tests of the write logic.
            }

            protected function assertCanManage(): void
            {
                // ACL gate bypassed for behavioral tests of the write logic.
            }
        };
    }

    public function testValidateEditorFieldsAcceptsWorkingSet(): void
    {
        $clean = ReferralCorrespondenceService::validateEditorFields([
            'refer_date' => ' 2026-07-15 ',
            'refer_to' => 'Regional Hospital — Surgery',
            'refer_risk_level' => 'high',
            'body' => 'Suspected appendicitis',
            'unknown_field' => 'ignored',
        ], ['low', 'medium', 'high']);

        $this->assertSame('2026-07-15', $clean['refer_date']);
        $this->assertSame('Regional Hospital — Surgery', $clean['refer_to']);
        $this->assertSame('high', $clean['refer_risk_level']);
        $this->assertArrayNotHasKey('unknown_field', $clean);
    }

    public function testValidateEditorFieldsRejectsBadDate(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        ReferralCorrespondenceService::validateEditorFields(
            ['refer_date' => '15/07/2026'],
            []
        );
    }

    public function testValidateEditorFieldsRejectsUnknownRiskLevel(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unknown risk level');
        ReferralCorrespondenceService::validateEditorFields(
            ['refer_risk_level' => 'catastrophic'],
            ['low', 'medium', 'high']
        );
    }

    public function testValidateEditorFieldsRejectsOversizeValue(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        ReferralCorrespondenceService::validateEditorFields(
            ['refer_to' => str_repeat('x', 300)],
            []
        );
    }

    public function testEditorFingerprintIsDeterministicAndOrderInsensitive(): void
    {
        $a = ReferralCorrespondenceService::editorFingerprint([
            'refer_to' => 'Regional Hospital',
            'refer_date' => '2026-07-15',
        ]);
        $b = ReferralCorrespondenceService::editorFingerprint([
            'refer_date' => '2026-07-15',
            'refer_to' => 'Regional Hospital',
        ]);
        $c = ReferralCorrespondenceService::editorFingerprint([
            'refer_date' => '2026-07-15',
            'refer_to' => 'Regional Hospital — Surgery',
        ]);

        // Same values in any key order → same token; any value change → new token.
        $this->assertSame($a, $b);
        $this->assertNotSame($a, $c);
        $this->assertSame(40, strlen($a));
    }

    public function testAjaxPolicyMapsEditorActionsToReferralAcl(): void
    {
        $policy = new \OpenEMR\Modules\NewClinic\Services\AjaxActionPolicy();

        $this->assertSame(
            'new_chart_depth_referral',
            $policy->describe('chart_depth.referral_editor_get')['acl'] ?? null
        );
        $this->assertSame(
            'new_chart_depth_referral',
            $policy->describe('chart_depth.referral_update')['acl'] ?? null
        );
    }
}
