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
    ) {
    }

    public function isConsultSigned(int $encounterId): bool
    {
        return $this->isEncounterDocumentationSigned($encounterId);
    }

    public function isEncounterDocumentationSigned(int $encounterId): bool
    {
        return ($this->batchEncounterDocumentationSigned([$encounterId])[$encounterId] ?? false);
    }

    public function assertConsultSigned(int $encounterId, int $pid): void
    {
        if ($this->isConsultSigned($encounterId)) {
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
        try {
            $visit = $this->queueService->getVisitForActor($visitId);
        } catch (\Throwable) {
            return false;
        }

        $encounterId = (int) ($visit['encounter'] ?? 0);

        return $encounterId > 0 && $this->isEncounterDocumentationSigned($encounterId);
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

        return $this->isEncounterDocumentationSigned($encounterId)
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

    public static function buildEncounterUrl(string $webroot, int $pid, int $encounterId): string
    {
        return $webroot . '/interface/patient_file/encounter/encounter_top.php?set_pid='
            . urlencode((string) $pid)
            . '&set_encounter=' . urlencode((string) $encounterId);
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
            'esign_override',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            json_encode([
                'visit_id' => $visitId,
                'encounter_id' => (int) ($visit['encounter'] ?? 0),
                'service_profile' => (string) ($visit['service_profile'] ?? ''),
                'reason' => mb_substr(trim($reason), 0, 200),
            ]),
            (int) ($visit['pid'] ?? 0)
        );
    }
}
