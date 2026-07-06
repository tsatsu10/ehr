<?php

/**
 * Encounter documentation signature checks (M0-F24)
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
use OpenEMR\Modules\NewClinic\Exceptions\UnsignedEncounterException;

class EncounterSignService
{
    /** @var array<int, string> */
    public const UNSIGNED_REPORT_STATES = [
        'with_doctor',
        'ready_for_lab',
        'in_lab',
        'ready_for_pharmacy',
        'in_pharmacy',
        'ready_for_payment',
    ];

    public function __construct(
        private readonly VisitQueueService $queueService = new VisitQueueService(),
        private readonly ClinicalDocCatalogService $catalog = new ClinicalDocCatalogService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    public function isConsultSigned(int $encounterId, ?array $visit = null): bool
    {
        if (is_array($visit) && (int) ($visit['encounter'] ?? 0) > 0) {
            return $this->isVisitDocumentationSigned($visit);
        }

        $resolvedVisit = $this->resolveVisitByEncounter($encounterId);
        if ($resolvedVisit !== null) {
            return $this->isVisitDocumentationSigned($resolvedVisit);
        }

        return $this->isEncounterDocumentationSigned($encounterId);
    }

    /**
     * Legacy check: true when any encounter-level or forms-row E-Sign lock exists.
     * Prefer {@see isVisitDocumentationSigned()} for payment and complete-consult gates.
     */
    public function isEncounterDocumentationSigned(int $encounterId): bool
    {
        return ($this->batchEncounterDocumentationSigned([$encounterId])[$encounterId] ?? false);
    }

    /**
     * @param array<string, mixed> $visit
     */
    public function isVisitDocumentationSigned(array $visit, ?int $facilityId = null): bool
    {
        $encounterId = (int) ($visit['encounter'] ?? 0);
        $pid = (int) ($visit['pid'] ?? 0);
        if ($encounterId <= 0 || $pid <= 0) {
            return false;
        }

        if ($facilityId === null || $facilityId < 0) {
            $facilityId = (int) ($visit['facility_id'] ?? 0);
        }

        foreach ($this->getRequiredDocumentationSpecs($visit, $facilityId) as $spec) {
            $formdir = $this->catalog->resolveRegistryDirectory($spec['formdir']);
            if (!$this->isFormdirSignedOnEncounter($encounterId, $pid, $formdir)) {
                return false;
            }
        }

        return true;
    }

    public function isVisitDocumentationSignedById(int $visitId): bool
    {
        try {
            $visit = $this->queueService->getVisitForActor($visitId);
        } catch (\Throwable) {
            return false;
        }

        return $this->isVisitDocumentationSigned($visit);
    }

    public function assertConsultSigned(int $encounterId, int $pid, ?array $visit = null): void
    {
        if (is_array($visit)) {
            if ($this->isVisitDocumentationSigned($visit)) {
                return;
            }
        } elseif ($this->isConsultSigned($encounterId)) {
            return;
        }

        $webroot = $GLOBALS['webroot'] ?? '';
        throw new UnsignedEncounterException(
            'Documentation must be signed before completing the consult',
            $this->getUnsignedReason($encounterId),
            self::buildEncounterUrl($webroot, $pid, $encounterId)
        );
    }

    public function isProfileSigned(int $visitId): bool
    {
        return $this->isVisitDocumentationSignedById($visitId);
    }

    public function assertProfileSigned(int $visitId, ?string $overrideReason = null): void
    {
        if ($this->isProfileSigned($visitId)) {
            return;
        }

        if ($this->allowEsignOverride($overrideReason)) {
            $this->auditOverride($visitId, $overrideReason);

            return;
        }

        try {
            $visit = $this->queueService->getVisitForActor($visitId);
        } catch (\Throwable) {
            throw new \RuntimeException('Visit not accessible', 404);
        }
        $pid = (int) ($visit['pid'] ?? 0);
        $encounterId = (int) ($visit['encounter'] ?? 0);
        $webroot = $GLOBALS['webroot'] ?? '';

        throw new UnsignedEncounterException(
            $this->getProfileUnsignedReason($visitId),
            'unsigned_encounter',
            $encounterId > 0 ? self::buildEncounterUrl($webroot, $pid, $encounterId) : null
        );
    }

    public function getUnsignedReason(int $encounterId): string
    {
        if ($encounterId <= 0) {
            return 'missing_note';
        }

        return $this->isConsultSigned($encounterId)
            ? 'signed'
            : 'unsigned_encounter';
    }

    public function getProfileUnsignedReason(int $visitId): string
    {
        try {
            $visit = $this->queueService->getVisitForActor($visitId);
        } catch (\Throwable) {
            return 'Visit not found';
        }

        $profile = (string) ($visit['service_profile'] ?? 'full_opd');

        return match ($profile) {
            'lab_direct' => 'Lab intake not signed — contact lab',
            'pharmacy_walkin' => 'Pharmacy service note not signed — contact pharmacy',
            default => 'Consultation not signed — contact doctor',
        };
    }

    /**
     * @param array<string, mixed> $visit
     * @return list<array{formdir: string, title: string}>
     */
    public function getRequiredDocumentationSpecs(array $visit, int $facilityId): array
    {
        $profile = (string) ($visit['service_profile'] ?? 'full_opd');

        return match ($profile) {
            'lab_direct' => [[
                'formdir' => (string) ($this->config->get('lab_intake_formdir', 'lab_intake', $facilityId) ?? 'lab_intake'),
                'title' => 'Lab intake',
            ]],
            'pharmacy_walkin' => [[
                'formdir' => (string) ($this->config->get('pharmacy_service_formdir', 'pharmacy_service', $facilityId) ?? 'pharmacy_service'),
                'title' => 'Pharmacy service note',
            ]],
            default => [[
                'formdir' => $this->catalog->getCatalog(null, $facilityId)['consult_note_formdir'] ?? 'soap',
                'title' => 'Consult note',
            ]],
        };
    }

    public function isFormdirSignedOnEncounter(int $encounterId, int $pid, string $formdir): bool
    {
        $row = QueryUtils::querySingleRow(
            'SELECT id FROM forms
             WHERE encounter = ? AND pid = ? AND deleted = 0 AND LOWER(formdir) = ?
             ORDER BY date DESC LIMIT 1',
            [$encounterId, $pid, strtolower($formdir)]
        );
        if (!is_array($row)) {
            return false;
        }

        $formsRowId = (int) ($row['id'] ?? 0);
        if ($formsRowId <= 0) {
            return false;
        }

        $signed = QueryUtils::querySingleRow(
            "SELECT tid FROM esign_signatures
             WHERE tid = ? AND `table` = 'forms' AND is_lock = 1 LIMIT 1",
            [$formsRowId]
        );

        return is_array($signed);
    }

    /**
     * @param array<int, int> $encounterIds
     * @return array<int, bool>
     */
    public function batchEncounterDocumentationSigned(array $encounterIds): array
    {
        $encounterIds = array_values(array_unique(array_filter(
            array_map('intval', $encounterIds),
            static fn (int $id): bool => $id > 0
        )));

        if (empty($encounterIds)) {
            return [];
        }

        $signed = array_fill_keys($encounterIds, false);
        $placeholders = implode(',', array_fill(0, count($encounterIds), '?'));

        $encounterLocks = QueryUtils::fetchRecords(
            "SELECT DISTINCT tid AS encounter_id FROM esign_signatures
             WHERE tid IN ($placeholders) AND `table` = 'form_encounter' AND is_lock = 1",
            $encounterIds
        ) ?: [];

        foreach ($encounterLocks as $row) {
            $signed[(int) ($row['encounter_id'] ?? 0)] = true;
        }

        $remaining = array_keys(array_filter($signed, static fn (bool $v): bool => !$v));
        if (empty($remaining)) {
            return $signed;
        }

        $remainingPlaceholders = implode(',', array_fill(0, count($remaining), '?'));
        $formLocks = QueryUtils::fetchRecords(
            "SELECT DISTINCT f.encounter AS encounter_id FROM esign_signatures es
             INNER JOIN forms f ON f.id = es.tid AND es.`table` = 'forms'
             WHERE f.encounter IN ($remainingPlaceholders) AND es.is_lock = 1",
            $remaining
        ) ?: [];

        foreach ($formLocks as $row) {
            $signed[(int) ($row['encounter_id'] ?? 0)] = true;
        }

        return $signed;
    }

    /**
     * Profile-aware batch check for unsigned-documentation reports.
     *
     * @param list<array<string, mixed>> $visitRows
     * @return array<int, bool>
     */
    public function batchVisitDocumentationSigned(array $visitRows): array
    {
        $signed = [];
        foreach ($visitRows as $row) {
            $encounterId = (int) ($row['encounter'] ?? 0);
            if ($encounterId <= 0) {
                continue;
            }
            $signed[$encounterId] = $this->isVisitDocumentationSigned($row);
        }

        return $signed;
    }

    public static function buildEncounterUrl(string $webroot, int $pid, int $encounterId): string
    {
        return $webroot . '/interface/patient_file/encounter/encounter_top.php?set_pid='
            . urlencode((string) $pid)
            . '&set_encounter=' . urlencode((string) $encounterId);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveVisitByEncounter(int $encounterId): ?array
    {
        if ($encounterId <= 0) {
            return null;
        }

        $row = QueryUtils::querySingleRow(
            'SELECT * FROM new_visit WHERE encounter = ? ORDER BY id DESC LIMIT 1',
            [$encounterId]
        );

        return is_array($row) ? $row : null;
    }

    private function allowEsignOverride(?string $reason): bool
    {
        $reason = trim((string) $reason);
        if ($reason === '') {
            return false;
        }

        return AclMain::aclCheckCore('new_clinic', 'new_esign_skip_complete');
    }

    private function auditOverride(int $visitId, string $reason): void
    {
        try {
            $visit = $this->queueService->getVisitForActor($visitId);
        } catch (\Throwable) {
            $visit = [];
        }
        EventAuditLogger::getInstance()->newEvent(
            'new_visit',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            'esign_override',
            'pid=' . (int) ($visit['pid'] ?? 0) . ';visit_id=' . $visitId . ';' . json_encode([
                'visit_id' => $visitId,
                'encounter_id' => (int) ($visit['encounter'] ?? 0),
                'service_profile' => (string) ($visit['service_profile'] ?? ''),
                'reason' => mb_substr(trim($reason), 0, 200),
            ]),
            (int) ($visit['pid'] ?? 0)
        );
    }
}
