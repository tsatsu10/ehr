<?php

/**
 * Native Clinical Instructions editor — read/write service.
 *
 * Backs the native React drawer that is the default editor for the
 * `clinical_instructions` encounter form (no feature flag). The stock form has a
 * single field — a free-text patient-education / clinical-instruction note — so
 * the native editor is one textarea plus reusable snippet chips. Writes the
 * canonical stock shape (form_clinical_instructions row + the `forms` registry
 * row) so the note stays visible everywhere OpenEMR reads the stock form; the
 * stock screen stays reachable via the encounter's Advanced view.
 *
 * Edit-in-place: one instruction note per encounter. The latest non-deleted
 * `clinical_instructions` form on the encounter is loaded for editing; saving
 * updates it in place, or creates the first one. Lazy getters only (crash-pattern
 * rule — no eager service trees).
 *
 * @package   OpenEMR
 * @link      https://www.open-emr.org
 * @copyright Copyright (c) 2026 OpenEMR contributors
 * @license   https://github.com/openemr/openemr/blob/master/LICENSE GNU General Public License 3
 */

namespace OpenEMR\Modules\NewClinic\Services;

use OpenEMR\Common\Database\QueryUtils;
use OpenEMR\Services\FormService;

class ClinicalInstructionsEditorService
{
    private const FORMDIR = 'clinical_instructions';
    private const FORM_TITLE = 'Clinical Instructions';

    /** States in which a clinician may write instructions on a visit. */
    private const CLINICAL_STATES = [
        'awaiting_triage', 'in_triage', 'with_doctor',
        'ready_for_lab', 'in_lab', 'ready_for_pharmacy', 'in_pharmacy',
    ];

    public function __construct(
        private readonly ClinicalDocAccessService $access = new ClinicalDocAccessService(),
        private readonly VisitQueueService $queueService = new VisitQueueService(),
    ) {
    }

    /**
     * Bootstrap payload: visit context + the existing instruction note (if any).
     *
     * @return array<string, mixed>
     */
    public function getInstructions(int $visitId, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);

        $existing = $this->loadLatest($pid, $encounter);

        return [
            'enabled' => true,
            'visit_id' => $visitId,
            'pid' => $pid,
            'encounter' => $encounter,
            'form_id' => $existing['form_id'] ?? null,
            'instruction' => $existing['instruction'] ?? '',
            'locked' => $this->isSigned($encounter, $pid),
            'snippets' => $this->snippetChips(),
        ];
    }

    /**
     * Save (create or update) the encounter's instruction note.
     *
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function saveInstructions(array $body, int $actorUserId): array
    {
        $this->access->assertWriteAccess();

        $visitId = (int) ($body['visit_id'] ?? 0);
        $visit = $this->resolveClinicalVisit($visitId, $actorUserId);
        $pid = (int) $visit['pid'];
        $encounter = (int) ($visit['encounter'] ?? 0);

        $instruction = trim((string) ($body['instruction'] ?? ''));
        if ($instruction === '') {
            throw new \InvalidArgumentException('Instruction text is required');
        }
        if ($encounter <= 0) {
            throw new \InvalidArgumentException('Visit has no encounter yet');
        }
        // E-sign is compliance, never optional: a signed note must not be
        // silently edited — it needs the unlock/amend flow first.
        if ($this->isSigned($encounter, $pid)) {
            throw new \RuntimeException('These instructions are signed — unlock the encounter to amend them', 409);
        }

        $existing = $this->loadLatest($pid, $encounter);
        $formId = (int) ($existing['form_id'] ?? 0);

        if ($formId > 0) {
            QueryUtils::sqlStatementThrowException(
                'UPDATE form_clinical_instructions SET instruction = ?, date = NOW() WHERE id = ?',
                [$instruction, $formId]
            );
            // Touch the forms registry date so the card's "Last saved" reflects
            // this edit.
            QueryUtils::sqlStatementThrowException(
                "UPDATE forms SET date = NOW() WHERE form_id = ? AND encounter = ? AND pid = ? AND formdir = ?",
                [$formId, $encounter, $pid, self::FORMDIR]
            );
        } else {
            $formId = (int) QueryUtils::sqlInsert(
                'INSERT INTO form_clinical_instructions (pid, encounter, user, instruction, date, activity)
                 VALUES (?, ?, ?, ?, NOW(), 1)',
                [$pid, $encounter, $_SESSION['authUser'] ?? '', $instruction]
            );
            (new FormService())->addForm($encounter, self::FORM_TITLE, $formId, self::FORMDIR, $pid, '1');
        }

        return [
            'saved' => true,
            'form_id' => $formId,
            'instruction' => $instruction,
        ];
    }

    /**
     * Latest non-deleted clinical-instructions note on the encounter.
     *
     * @return array{form_id: int, instruction: string}|null
     */
    private function loadLatest(int $pid, int $encounter): ?array
    {
        if ($encounter <= 0) {
            return null;
        }

        $row = QueryUtils::fetchRecords(
            "SELECT f.form_id, ci.instruction
             FROM forms f
             JOIN form_clinical_instructions ci ON ci.id = f.form_id
             WHERE f.encounter = ? AND f.pid = ? AND f.formdir = ? AND f.deleted = 0
             ORDER BY f.date DESC
             LIMIT 1",
            [$encounter, $pid, self::FORMDIR]
        );

        if (empty($row[0])) {
            return null;
        }

        return [
            'form_id' => (int) $row[0]['form_id'],
            'instruction' => (string) ($row[0]['instruction'] ?? ''),
        ];
    }

    /**
     * Printable payload for the patient handout. Hub-read access only and NO
     * clinical-state/provider guard — printing must work after the visit has
     * moved on (e.g. at checkout, or reprinting the next day).
     *
     * @return array<string, mixed>
     */
    public function getPrintable(int $visitId): array
    {
        $this->access->assertHubAccess();

        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }
        $visit = $this->queueService->getVisitForActor($visitId);
        $pid = (int) ($visit['pid'] ?? 0);
        $encounter = (int) ($visit['encounter'] ?? 0);

        $existing = $this->loadLatest($pid, $encounter);
        if ($existing === null) {
            throw new \RuntimeException('No instructions saved on this visit yet', 404);
        }

        $patient = QueryUtils::querySingleRow(
            'SELECT fname, lname, pubpid, DOB FROM patient_data WHERE pid = ?',
            [$pid]
        ) ?: [];

        $facilityId = (int) ($visit['facility_id'] ?? 0);
        $facility = $facilityId > 0
            ? (QueryUtils::querySingleRow(
                'SELECT name, street, city, phone FROM facility WHERE id = ?',
                [$facilityId]
            ) ?: [])
            : [];

        $providerId = (int) ($visit['assigned_provider_id'] ?? 0);
        $provider = $providerId > 0
            ? (QueryUtils::querySingleRow(
                'SELECT fname, lname FROM users WHERE id = ?',
                [$providerId]
            ) ?: [])
            : [];

        return [
            'instruction' => $existing['instruction'],
            'patient_name' => trim(((string) ($patient['fname'] ?? '')) . ' ' . ((string) ($patient['lname'] ?? ''))),
            'pubpid' => (string) ($patient['pubpid'] ?? $pid),
            'dob' => (string) ($patient['DOB'] ?? ''),
            'clinic_name' => (string) ($facility['name'] ?? ''),
            'clinic_street' => (string) ($facility['street'] ?? ''),
            'clinic_city' => (string) ($facility['city'] ?? ''),
            'clinic_phone' => (string) ($facility['phone'] ?? ''),
            'provider_name' => trim(((string) ($provider['fname'] ?? '')) . ' ' . ((string) ($provider['lname'] ?? ''))),
        ];
    }

    /** Instantiated at call time (not in the constructor) — crash-pattern rule. */
    private function isSigned(int $encounter, int $pid): bool
    {
        if ($encounter <= 0) {
            return false;
        }

        return (new EncounterSignService())->isFormdirSignedOnEncounter($encounter, $pid, self::FORMDIR);
    }

    /**
     * @return array<string, mixed>
     */
    private function resolveClinicalVisit(int $visitId, int $actorUserId): array
    {
        if ($visitId <= 0) {
            throw new \InvalidArgumentException('visit_id is required');
        }

        $visit = $this->queueService->getVisitForActor($visitId);
        $state = (string) ($visit['state'] ?? '');
        if (!in_array($state, self::CLINICAL_STATES, true)) {
            throw new \InvalidArgumentException('Visit is not in an active clinical state');
        }
        if ($state === 'with_doctor' && (int) ($visit['assigned_provider_id'] ?? 0) !== $actorUserId) {
            throw new \InvalidArgumentException('Visit is assigned to another provider');
        }

        return $visit;
    }

    /**
     * Reusable instruction snippets offered as quick-insert chips. Kept generic
     * (no regional/product-specific text) — a starter set the clinician appends.
     *
     * @return array<int, string>
     */
    private function snippetChips(): array
    {
        return [
            'Take medication as prescribed; complete the full course.',
            'Return immediately if symptoms worsen or fever persists.',
            'Rest and drink plenty of fluids.',
            'Follow up in one week or sooner if not improving.',
            'Avoid strenuous activity until the next review.',
            'Keep the wound clean and dry; change the dressing daily.',
        ];
    }
}
