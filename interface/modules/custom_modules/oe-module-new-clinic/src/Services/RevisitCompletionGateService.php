<?php

/**
 * Returning-patient completion gate at start visit (M1.7, M1d-F05)
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

class RevisitCompletionGateService
{
    public function __construct(
        private readonly PatientCompletionService $completionService = new PatientCompletionService(),
        private readonly ClinicConfigService $config = new ClinicConfigService(),
    ) {
    }

    /**
     * @return array{
     *   applies: bool,
     *   blocked: bool,
     *   score: int,
     *   threshold: int,
     *   pediatric_dob_block: bool,
     *   missing_labels: array<int, string>,
     *   can_manager_override: bool
     * }
     */
    public function assess(int $pid, ?int $facilityId = null): array
    {
        $facilityId = $facilityId ?? 0;
        $applies = $this->config->getInt('enforce_completion_on_revisit', 1, $facilityId) === 1
            && $this->isReturningPatient($pid);

        $completion = $this->completionService->readCached($pid);
        $score = (int) ($completion['score'] ?? 0);
        $threshold = $this->completionService->getBillingThreshold();
        $pediatricBlock = $this->hasPediatricDobBlock($pid, $facilityId);
        $belowThreshold = $score < $threshold;
        $blocked = $applies && ($belowThreshold || $pediatricBlock);
        $canOverride = AclMain::aclCheckCore('new_clinic', 'new_revisit_skip_completion');

        return [
            'applies' => $applies,
            'blocked' => $blocked,
            'score' => $score,
            'threshold' => $threshold,
            'pediatric_dob_block' => $pediatricBlock,
            'missing_labels' => $completion['missing_labels'] ?? [],
            'can_manager_override' => $canOverride,
        ];
    }

    public function assertCanStartVisit(
        int $pid,
        int $actorUserId,
        ?int $facilityId,
        ?string $overrideReason
    ): void {
        $gate = $this->assess($pid, $facilityId);
        if (!$gate['blocked']) {
            return;
        }

        $reason = trim((string) $overrideReason);
        if ($reason === '') {
            throw new \InvalidArgumentException(
                'Profile incomplete for revisit — complete profile, use manager override, or mark awaiting documents'
            );
        }

        if (!$gate['can_manager_override']) {
            throw new \InvalidArgumentException('Manager override not permitted for incomplete profile');
        }

        $this->logOverride($pid, $actorUserId, $gate, $reason);
    }

    /**
     * @param array<string, mixed> $gate
     */
    public function logOverride(int $pid, int $actorUserId, array $gate, string $reason): void
    {
        $this->logCompletionOverride($pid, $actorUserId, 'start_visit', $gate, $reason);
    }

    /**
     * @param array<string, mixed> $gate
     */
    public function logCompletionOverride(
        int $pid,
        int $actorUserId,
        string $chokepoint,
        array $gate,
        string $reason,
        ?int $visitId = null,
    ): void {
        $payload = [
            'pid' => $pid,
            'actor' => $actorUserId,
            'chokepoint' => $chokepoint,
            'score' => (int) ($gate['score'] ?? 0),
            'reason' => mb_substr(trim($reason), 0, 200),
        ];
        if ($visitId !== null && $visitId > 0) {
            $payload['visit_id'] = $visitId;
        }

        $this->auditRevisitEvent('completion_override', $pid, $actorUserId, $payload);
    }

    public function logAwaitingDocuments(int $pid, int $actorUserId, ?string $note = null): void
    {
        $payload = [
            'pid' => $pid,
            'actor' => $actorUserId,
            'chokepoint' => 'start_visit',
            'path' => 'awaiting_documents',
            'note' => $note !== null ? mb_substr(trim($note), 0, 200) : null,
        ];

        $this->auditRevisitEvent('completion_hold', $pid, $actorUserId, $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function auditRevisitEvent(string $eventSubtype, int $pid, int $actorUserId, array $payload): void
    {
        EventAuditLogger::getInstance()->newEvent(
            'new_clinic',
            $_SESSION['authUser'] ?? 'system',
            $_SESSION['authProvider'] ?? 'default',
            $eventSubtype,
            'pid=' . $pid . ';actor=' . $actorUserId . ';' . json_encode($payload),
            $pid
        );
    }

    private function isReturningPatient(int $pid): bool
    {
        $row = QueryUtils::querySingleRow(
            "SELECT COUNT(*) AS cnt FROM form_encounter WHERE pid = ?",
            [$pid]
        );

        return is_array($row) && (int) ($row['cnt'] ?? 0) > 0;
    }

    private function hasPediatricDobBlock(int $pid, int $facilityId): bool
    {
        $meta = QueryUtils::querySingleRow(
            "SELECT dob_estimated FROM new_patient_meta WHERE pid = ?",
            [$pid]
        );
        if (!is_array($meta) || empty($meta['dob_estimated'])) {
            return false;
        }

        $patient = QueryUtils::querySingleRow(
            "SELECT DOB FROM patient_data WHERE pid = ?",
            [$pid]
        );
        $dob = is_array($patient) ? ($patient['DOB'] ?? null) : null;
        if (empty($dob) || $dob === '0000-00-00') {
            return false;
        }

        try {
            $ageYears = (int) (new \DateTime($dob))->diff(new \DateTime('today'))->y;
        } catch (\Exception) {
            return false;
        }

        return $ageYears < $this->config->getInt('pediatric_exact_dob_age', 5, $facilityId);
    }
}
