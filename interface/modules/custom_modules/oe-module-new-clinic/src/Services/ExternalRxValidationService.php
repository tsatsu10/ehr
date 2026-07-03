<?php

/**
 * M9-F15 — external paper Rx prescriber + date validation (V1.1-ANC §6.1k)
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Acl\AclMain;
use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Common\Logging\EventAuditLogger;
use OpenEMR\Modules\NewClinic\Exceptions\ExternalRxIncompleteException;

class ExternalRxValidationService
{
    public const MIN_OVERRIDE_REASON_LENGTH = 10;
    public const DEFAULT_MAX_AGE_DAYS = 730;

    public function __construct(
        private readonly ClinicConfigService $config = new ClinicConfigService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
        private readonly ClinicalDocDocumentationStatusService $docStatus = new ClinicalDocDocumentationStatusService(),
        private readonly ClinicDateService $clinicDate = new ClinicDateService(),
    ) {
    }

    public static function isOverrideAllowed(?string $reason, bool $hasOverrideAcl): bool
    {
        if (!$hasOverrideAcl) {
            return false;
        }

        $reason = trim((string) $reason);

        return $reason !== '' && mb_strlen($reason) >= self::MIN_OVERRIDE_REASON_LENGTH;
    }

    /**
     * @param array{prescriber_name?: string, prescriber_reg_id?: string, rx_date?: string} $fields
     * @return array{
     *   valid: bool,
     *   missing: list<string>,
     *   field_errors: array<string, string>,
     *   override_used: bool
     * }
     */
    public static function evaluate(
        array $fields,
        string $todayYmd,
        int $maxAgeDays,
        ?string $overrideReason,
        bool $hasOverrideAcl,
    ): array {
        if (self::isOverrideAllowed($overrideReason, $hasOverrideAcl)) {
            return [
                'valid' => true,
                'missing' => [],
                'field_errors' => [],
                'override_used' => true,
            ];
        }

        $missing = [];
        $errors = [];

        $name = trim((string) ($fields['prescriber_name'] ?? ''));
        if (mb_strlen($name) < 2) {
            $missing[] = 'prescriber_name';
            if ($name !== '') {
                $errors['prescriber_name'] = 'Prescriber name must be at least 2 characters';
            }
        }

        $regId = trim((string) ($fields['prescriber_reg_id'] ?? ''));
        if ($regId === '') {
            $missing[] = 'prescriber_reg_id';
        }

        $rxDate = trim((string) ($fields['rx_date'] ?? ''));
        if ($rxDate === '') {
            $missing[] = 'rx_date';
        } else {
            $parsed = \DateTimeImmutable::createFromFormat('Y-m-d', $rxDate);
            $parseOk = $parsed instanceof \DateTimeImmutable && $parsed->format('Y-m-d') === $rxDate;
            if (!$parseOk) {
                $missing[] = 'rx_date';
                $errors['rx_date'] = 'Rx date must be a valid date (YYYY-MM-DD)';
            } else {
                $today = new \DateTimeImmutable($todayYmd);
                if ($parsed > $today) {
                    $missing[] = 'rx_date';
                    $errors['rx_date'] = 'Rx date cannot be in the future';
                } else {
                    $minDate = $today->sub(new \DateInterval('P' . max(1, $maxAgeDays) . 'D'));
                    if ($parsed < $minDate) {
                        $missing[] = 'rx_date';
                        $errors['rx_date'] = 'Rx date is older than the configured maximum age';
                    }
                }
            }
        }

        return [
            'valid' => $missing === [],
            'missing' => array_values(array_unique($missing)),
            'field_errors' => $errors,
            'override_used' => false,
        ];
    }

    public static function buildBlockMessage(): string
    {
        return 'External Rx metadata incomplete — enter prescriber name, registration/ID, and Rx date on the pharmacy service note, or use supervisor override';
    }

    public function canOverride(): bool
    {
        return AclMain::aclCheckCore('new_clinic', 'new_pharmacy_external_rx_override');
    }

    public function maxAgeDays(int $facilityId): int
    {
        $days = $this->config->getInt('external_rx_max_age_days', self::DEFAULT_MAX_AGE_DAYS, $facilityId);

        return max(1, min(3650, $days));
    }

    /**
     * @return array<string, mixed>|null
     */
    public function deskStatus(int $pid, int $encounterId, int $facilityId, array $visit): ?array
    {
        if ($encounterId <= 0 || $pid <= 0) {
            return null;
        }

        $fields = $this->readFieldsFromEncounter($pid, $encounterId, $facilityId);
        $maxAgeDays = $this->maxAgeDays($facilityId);
        $evaluation = self::evaluate(
            $fields,
            $this->clinicDate->today(),
            $maxAgeDays,
            null,
            false
        );

        $formdir = strtolower(trim(
            (string) ($this->config->get('pharmacy_service_formdir', 'pharmacy_service', $facilityId) ?? 'pharmacy_service')
        ));
        $canonicalFormdir = $this->catalog->resolveRegistryDirectory($formdir);
        $docStatus = $this->docStatus->getStatusForVisit($visit, $facilityId);
        $pharmacyForm = null;
        foreach ($docStatus['unsigned_required'] ?? [] as $form) {
            if (!is_array($form)) {
                continue;
            }
            if (strtolower((string) ($form['formdir'] ?? '')) === strtolower($canonicalFormdir)) {
                $pharmacyForm = $form;
                break;
            }
        }

        return [
            'fields' => $fields,
            'valid' => $evaluation['valid'],
            'missing' => $evaluation['missing'],
            'field_errors' => $evaluation['field_errors'],
            'max_age_days' => $maxAgeDays,
            'can_override' => $this->canOverride(),
            'pharmacy_service_formdir' => $canonicalFormdir,
            'pharmacy_service_title' => is_array($pharmacyForm)
                ? (string) ($pharmacyForm['title'] ?? 'Pharmacy service note')
                : 'Pharmacy service note',
            'pharmacy_service_started' => is_array($pharmacyForm)
                ? !empty($pharmacyForm['started'])
                : $this->isPharmacyFormStarted($encounterId, $pid, $canonicalFormdir),
            'documentation_hub_url' => $docStatus['documentation_hub_url'] ?? null,
            'clinical_doc_hub_enabled' => !empty($docStatus['hub_enabled']),
        ];
    }

    public function assertComplete(
        int $pid,
        int $encounterId,
        int $facilityId,
        ?string $overrideReason,
        int $actorUserId,
        int $visitId,
    ): void {
        if ($encounterId <= 0 || $pid <= 0) {
            throw new ExternalRxIncompleteException(self::buildBlockMessage(), ['rx_date', 'prescriber_name', 'prescriber_reg_id']);
        }

        $fields = $this->readFieldsFromEncounter($pid, $encounterId, $facilityId);
        $hasOverrideAcl = $this->canOverride();
        $evaluation = self::evaluate(
            $fields,
            $this->clinicDate->today(),
            $this->maxAgeDays($facilityId),
            $overrideReason,
            $hasOverrideAcl
        );

        if ($evaluation['valid']) {
            if (!empty($evaluation['override_used'])) {
                EventAuditLogger::getInstance()->newEvent(
                    'new_clinic',
                    'pharmacy_external_rx_override',
                    $actorUserId,
                    1,
                    'visit_id=' . $visitId
                        . ' pid=' . $pid
                        . ' encounter=' . $encounterId
                        . ' reason=' . mb_substr(trim((string) $overrideReason), 0, 200)
                );
            }

            return;
        }

        throw new ExternalRxIncompleteException(
            self::buildBlockMessage(),
            $evaluation['missing'],
            $evaluation['field_errors']
        );
    }

    /**
     * @return array{prescriber_name: string, prescriber_reg_id: string, rx_date: string}
     */
    public function readFieldsFromEncounter(int $pid, int $encounterId, int $facilityId): array
    {
        $formdir = strtolower(trim(
            (string) ($this->config->get('pharmacy_service_formdir', 'pharmacy_service', $facilityId) ?? 'pharmacy_service')
        ));
        $canonicalFormdir = strtolower($this->catalog->resolveRegistryDirectory($formdir));

        $formRow = QueryUtils::querySingleRow(
            'SELECT form_id FROM forms
             WHERE encounter = ? AND pid = ? AND deleted = 0 AND LOWER(formdir) = ?
             ORDER BY date DESC, id DESC LIMIT 1',
            [$encounterId, $pid, $canonicalFormdir]
        );

        $out = [
            'prescriber_name' => '',
            'prescriber_reg_id' => '',
            'rx_date' => '',
        ];

        if (!is_array($formRow)) {
            return $out;
        }

        $formId = (int) ($formRow['form_id'] ?? 0);
        if ($formId <= 0) {
            return $out;
        }

        $rows = QueryUtils::fetchRecords(
            "SELECT field_id, field_value FROM lbf_data
             WHERE form_id = ?
             AND field_id IN ('external_prescriber_name', 'external_prescriber_reg_id', 'external_rx_date')",
            [$formId]
        ) ?: [];

        $map = [
            'external_prescriber_name' => 'prescriber_name',
            'external_prescriber_reg_id' => 'prescriber_reg_id',
            'external_rx_date' => 'rx_date',
        ];

        foreach ($rows as $row) {
            $fieldId = (string) ($row['field_id'] ?? '');
            if (!isset($map[$fieldId])) {
                continue;
            }
            $out[$map[$fieldId]] = trim((string) ($row['field_value'] ?? ''));
        }

        return $out;
    }

    private function isPharmacyFormStarted(int $encounterId, int $pid, string $formdir): bool
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM forms
             WHERE encounter = ? AND pid = ? AND deleted = 0 AND LOWER(formdir) = ?
             LIMIT 1',
            [$encounterId, $pid, strtolower($formdir)]
        );

        return is_array($row);
    }
}
