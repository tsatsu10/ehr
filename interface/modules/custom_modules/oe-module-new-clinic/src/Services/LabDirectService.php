<?php

/**
 * M8-F08 — lab-direct intake panel payload (V1.1-ANC)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;

class LabDirectService
{
    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicalDocDocumentationStatusService $docStatus = new ClinicalDocDocumentationStatusService(),
        private readonly ReferralDocumentService $referralDocuments = new ReferralDocumentService(),
    ) {
    }

    public function isLabDirectVisit(array $visit): bool
    {
        return (string) ($visit['service_profile'] ?? '') === 'lab_direct';
    }

    public function isAncillaryEnabled(int $facilityId): bool
    {
        return $this->config->getInt('enable_ancillary_services', 0, $facilityId) === 1;
    }

    public function canCreateOrders(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_lab_order_intake')
            || AclMain::aclCheckCore('new_clinic', 'new_lab_lead')
            || AclMain::aclCheckCore('new_clinic', 'new_doctor')
            || AclMain::aclCheckCore('new_clinic', 'new_admin');
    }

    public function assertCanCreateOrders(): void
    {
        if (!$this->canCreateOrders()) {
            throw new \RuntimeException('Forbidden', 403);
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function intakePayload(
        array $visit,
        int $facilityId,
        int $pid,
        int $orderCount = 0,
    ): ?array {
        if (!$this->isLabDirectVisit($visit) || !$this->isAncillaryEnabled($facilityId)) {
            return null;
        }

        $status = $this->docStatus->getStatusForVisit($visit, $facilityId);
        $labIntakeFormdir = strtolower(trim(
            (string) ($this->config->get('lab_intake_formdir', 'lab_intake', $facilityId) ?? 'lab_intake')
        ));
        $unsignedLabIntake = null;
        foreach ($status['unsigned_required'] ?? [] as $form) {
            if (!is_array($form)) {
                continue;
            }
            if (strtolower((string) ($form['formdir'] ?? '')) === $labIntakeFormdir) {
                $unsignedLabIntake = $form;
                break;
            }
        }

        $referralDocId = (int) ($visit['referral_document_id'] ?? 0);
        $referralRequired = $this->isReferralRequiredForVisit($visit);

        return [
            'enabled' => true,
            'has_referral' => $referralDocId > 0,
            'referral_required_warning' => $referralRequired && $referralDocId <= 0,
            'referral_view_url' => $referralDocId > 0
                ? $this->buildReferralViewUrl($pid, $referralDocId)
                : null,
            'can_create_orders' => $this->canCreateOrders(),
            'lab_intake_formdir' => $labIntakeFormdir,
            'lab_intake_title' => is_array($unsignedLabIntake)
                ? (string) ($unsignedLabIntake['title'] ?? 'Lab intake')
                : $this->resolveLabIntakeTitle($labIntakeFormdir),
            'lab_intake_signed' => $unsignedLabIntake === null,
            'lab_intake_started' => $unsignedLabIntake === null
                || !empty($unsignedLabIntake['started']),
            'documentation_hub_url' => $status['documentation_hub_url'] ?? null,
            'clinical_doc_hub_enabled' => !empty($status['hub_enabled']),
            'order_count' => $orderCount,
        ];
    }

    /**
     * @param array<string, mixed> $visit
     */
    private function isReferralRequiredForVisit(array $visit): bool
    {
        $visitTypeId = (int) ($visit['visit_type_id'] ?? 0);
        if ($visitTypeId <= 0) {
            return false;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT referral_required FROM new_visit_type WHERE id = ?',
            [$visitTypeId]
        );

        return is_array($row) && !empty($row['referral_required']);
    }

    private function resolveLabIntakeTitle(string $formdir): string
    {
        $row = QueryUtils::querySingleRow(
            'SELECT name FROM registry WHERE LOWER(directory) = ? LIMIT 1',
            [strtolower($formdir)]
        );
        if (is_array($row)) {
            $name = trim((string) ($row['name'] ?? ''));
            if ($name !== '') {
                return $name;
            }
        }

        return 'Lab intake';
    }

    private function buildReferralViewUrl(int $pid, int $documentId): ?string
    {
        return $this->referralDocuments->buildViewUrl($pid, $documentId);
    }
}
